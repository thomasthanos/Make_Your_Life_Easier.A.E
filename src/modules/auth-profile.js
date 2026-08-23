/**
 * Auth Profile Module
 * Turns a Supabase user object into the small profile shape the renderer renders.
 */

/**
 * Identity providers hand out a generic placeholder picture when the account has
 * no real avatar (Discord's coloured blob, Google's grey silhouette). Those URLs
 * return HTTP 200, so an <img> error fallback never fires and the UI ends up
 * showing a stock image that has nothing to do with the user. Treat them as
 * "no avatar" so the initial-letter placeholder is used instead.
 */
const PLACEHOLDER_AVATAR = [
  // https://cdn.discordapp.com/embed/avatars/3.png
  /^https?:\/\/cdn\.discordapp\.com\/embed\/avatars\//i,
  // Supabase builds the Discord URL by string concatenation, so an account with
  // no avatar yields .../avatars/<id>/.png (or literal "null"/"undefined").
  /^https?:\/\/cdn\.discordapp\.com\/avatars\/[^/]*\/(?:null|undefined)?\.(?:png|jpe?g|webp|gif)(?:\?|$)/i,
  // https://lh3.googleusercontent.com/a/default-user=s96-c (and the older a-/ form)
  /^https?:\/\/[^/]*googleusercontent\.com\/a-?\/default-user/i
];

/** Size we request from provider CDNs — the modal renders the avatar at ~72 CSS px. */
const AVATAR_SIZE = 128;

function isPlaceholderAvatar(url) {
  return PLACEHOLDER_AVATAR.some((re) => re.test(url));
}

/**
 * Ask the provider CDN for an avatar big enough to stay sharp on HiDPI screens.
 * Both CDNs ignore unknown parameters, so a URL we do not recognise is returned
 * untouched rather than guessed at.
 * @param {string} url - Raw avatar URL from the identity provider
 * @returns {string} URL with a size hint applied where we know the CDN
 */
function withAvatarSize(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'cdn.discordapp.com') {
      parsed.searchParams.set('size', String(AVATAR_SIZE));
      return parsed.toString();
    }

    if (host.endsWith('googleusercontent.com')) {
      // Google encodes the size in the last path segment: ...=s96-c
      parsed.pathname = parsed.pathname.replace(/=s\d+(-c)?$/, `=s${AVATAR_SIZE}$1`);
      if (!/=s\d+/.test(parsed.pathname)) parsed.pathname += `=s${AVATAR_SIZE}-c`;
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * The still-image rendition of an animated Discord avatar, or null.
 *
 * Discord marks an animated avatar with an `a_` hash prefix, and Supabase always
 * builds the URL as `.gif` when it sees one. But the animated asset only exists
 * while the account actually has it — drop Nitro and the CDN starts answering
 * `415 Invalid resource` for the `.gif` while `.png` and `.webp` keep working.
 * A 415 is not a network error the browser retries; the <img> just fails, so the
 * avatar silently collapses to the initial-letter placeholder.
 *
 * There is no way to tell the two cases apart without asking the CDN, so keep the
 * `.gif` as the primary source and hand the renderer this as a second try before
 * it gives up — animation is preserved where it exists, and accounts that lost it
 * still get their picture.
 * @param {string|null} url - A normalised avatar URL
 * @returns {string|null} The .png rendition, or null when not applicable
 */
function staticAvatarRendition(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.toLowerCase() !== 'cdn.discordapp.com') return null;
    if (!/\.gif$/i.test(parsed.pathname)) return null;
    parsed.pathname = parsed.pathname.replace(/\.gif$/i, '.png');
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value - Candidate avatar URL from provider metadata
 * @returns {string|null} A usable https avatar URL, or null when there is none
 */
function normalizeAvatar(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;

  // Only ever hand the renderer an absolute http(s) URL: provider metadata is
  // attacker-influenced (a display name field can hold anything), and the
  // renderer drops it straight into an <img src>.
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (isPlaceholderAvatar(url)) return null;

  return withAvatarSize(url);
}

/**
 * Pick the identity row that matches the provider the user actually signed in with.
 * A Supabase user can have several linked identities (same e-mail on Google and
 * Discord); `user_metadata` is a merged blob that reflects whichever identity wrote
 * last, so reading the avatar from there shows the wrong provider's picture.
 * @param {Object} user - Supabase user object
 * @param {string|null} provider - Provider to prefer
 * @returns {Object|null} The matching identity, the most recently used one, or null
 */
function pickIdentity(user, provider) {
  const identities = Array.isArray(user.identities) ? user.identities : [];
  if (!identities.length) return null;

  if (provider) {
    const match = identities.find((i) => i && i.provider === provider);
    if (match) return match;
  }

  // No provider hint: fall back to the identity used most recently.
  return identities
    .filter(Boolean)
    .slice()
    .sort((a, b) => Date.parse(b.last_sign_in_at || 0) - Date.parse(a.last_sign_in_at || 0))[0] || null;
}

/**
 * Build the renderer profile from a Supabase user.
 * @param {Object|null} user - Supabase session/user object
 * @param {string|null} providerOverride - Provider the user just signed in with
 * @returns {{id: string, name: string, avatar: string|null, provider: string}|null}
 */
function profileFromUser(user, providerOverride = null) {
  if (!user) return null;

  const metadata = user.user_metadata || {};

  // Prefer the matching identity's own data over the merged user_metadata blob.
  const identity = pickIdentity(user, providerOverride);

  // `app_metadata.provider` is the provider the account was *created* with and does
  // not move when a second provider is linked later, so the identity we picked (the
  // one just used, or the most recent) is the better answer when we have one.
  const provider = providerOverride
    || identity?.provider
    || user.app_metadata?.provider
    || 'unknown';

  const identityData = identity?.identity_data || {};

  const name = identityData.full_name
    || identityData.name
    || identityData.custom_claims?.global_name
    || identityData.user_name
    || metadata.full_name
    || metadata.name
    || metadata.user_name
    || user.email
    || 'User';

  const avatar = normalizeAvatar(identityData.avatar_url)
    || normalizeAvatar(identityData.picture)
    || normalizeAvatar(metadata.avatar_url)
    || normalizeAvatar(metadata.picture);

  return {
    id: user.id,
    name,
    avatar: avatar || null,
    avatarFallback: staticAvatarRendition(avatar),
    provider
  };
}

module.exports = {
  profileFromUser,
  normalizeAvatar,
  isPlaceholderAvatar,
  staticAvatarRendition
};
