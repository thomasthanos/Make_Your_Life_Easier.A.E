
const PLACEHOLDER_AVATAR = [
  /^https?:\/\/cdn\.discordapp\.com\/embed\/avatars\//i,
  /^https?:\/\/cdn\.discordapp\.com\/avatars\/[^/]*\/(?:null|undefined)?\.(?:png|jpe?g|webp|gif)(?:\?|$)/i,
  /^https?:\/\/[^/]*googleusercontent\.com\/a-?\/default-user/i
];

const AVATAR_SIZE = 128;

function isPlaceholderAvatar(url) {
  return PLACEHOLDER_AVATAR.some((re) => re.test(url));
}

function withAvatarSize(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === 'cdn.discordapp.com') {
      parsed.searchParams.set('size', String(AVATAR_SIZE));
      return parsed.toString();
    }

    if (host.endsWith('googleusercontent.com')) {
      parsed.pathname = parsed.pathname.replace(/=s\d+(-c)?$/, `=s${AVATAR_SIZE}$1`);
      if (!/=s\d+/.test(parsed.pathname)) parsed.pathname += `=s${AVATAR_SIZE}-c`;
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}

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

function normalizeAvatar(value) {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url) return null;

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

function pickIdentity(user, provider) {
  const identities = Array.isArray(user.identities) ? user.identities : [];
  if (!identities.length) return null;

  if (provider) {
    const match = identities.find((i) => i && i.provider === provider);
    if (match) return match;
  }

  return identities
    .filter(Boolean)
    .slice()
    .sort((a, b) => Date.parse(b.last_sign_in_at || 0) - Date.parse(a.last_sign_in_at || 0))[0] || null;
}

function profileFromUser(user, providerOverride = null) {
  if (!user) return null;

  const metadata = user.user_metadata || {};

  const identity = pickIdentity(user, providerOverride);

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
