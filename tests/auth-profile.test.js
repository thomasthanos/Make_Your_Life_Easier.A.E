const test = require('node:test');
const assert = require('node:assert/strict');

const { profileFromUser, normalizeAvatar, staticAvatarRendition } = require('../src/modules/auth-profile');

test('cached renderer profile can be reconstructed from the Supabase session user', () => {
  const profile = profileFromUser({
    id: 'user-a',
    email: 'user@example.com',
    app_metadata: { provider: 'google' },
    user_metadata: { full_name: 'Test User', avatar_url: 'https://example.com/avatar.png' }
  });

  assert.deepEqual(profile, {
    id: 'user-a',
    name: 'Test User',
    avatar: 'https://example.com/avatar.png',
    avatarFallback: null,
    provider: 'google'
  });
});

test('the identity matching the provider wins over the merged user_metadata blob', () => {
  // Google and Discord linked to one Supabase account: user_metadata is a single
  // merged object, so reading the avatar from there shows the wrong provider.
  const user = {
    id: 'user-b',
    email: 'user@example.com',
    app_metadata: { provider: 'google', providers: ['google', 'discord'] },
    user_metadata: {
      full_name: 'Google Name',
      avatar_url: 'https://lh3.googleusercontent.com/a/GOOGLEPIC=s96-c'
    },
    identities: [
      {
        provider: 'google',
        last_sign_in_at: '2026-01-01T00:00:00Z',
        identity_data: {
          full_name: 'Google Name',
          avatar_url: 'https://lh3.googleusercontent.com/a/GOOGLEPIC=s96-c'
        }
      },
      {
        provider: 'discord',
        last_sign_in_at: '2026-08-01T00:00:00Z',
        identity_data: {
          full_name: 'DiscordName',
          avatar_url: 'https://cdn.discordapp.com/avatars/42/DISCORDHASH.png'
        }
      }
    ]
  };

  assert.deepEqual(profileFromUser(user, 'discord'), {
    id: 'user-b',
    name: 'DiscordName',
    avatar: 'https://cdn.discordapp.com/avatars/42/DISCORDHASH.png?size=128',
    avatarFallback: null,
    provider: 'discord'
  });

  // With no hint, follow the identity that signed in most recently rather than
  // app_metadata.provider, which is frozen at the provider the account was made with.
  assert.equal(profileFromUser(user).provider, 'discord');
});

test('provider placeholder pictures are reported as no avatar', () => {
  const discordDefault = {
    id: 'user-c',
    app_metadata: { provider: 'discord' },
    user_metadata: {},
    identities: [{
      provider: 'discord',
      identity_data: { full_name: 'No Pic', avatar_url: 'https://cdn.discordapp.com/embed/avatars/2.png' }
    }]
  };
  assert.equal(profileFromUser(discordDefault, 'discord').avatar, null);

  const googleDefault = {
    id: 'user-d',
    app_metadata: { provider: 'google' },
    user_metadata: { avatar_url: 'https://lh3.googleusercontent.com/a/default-user=s96-c' },
    identities: []
  };
  assert.equal(profileFromUser(googleDefault, 'google').avatar, null);
});

test('avatar URLs are upsized and non-http schemes are rejected', () => {
  assert.equal(
    normalizeAvatar('https://lh3.googleusercontent.com/a/REAL=s96-c'),
    'https://lh3.googleusercontent.com/a/REAL=s128-c'
  );
  assert.equal(
    normalizeAvatar('https://cdn.discordapp.com/avatars/1/h.png'),
    'https://cdn.discordapp.com/avatars/1/h.png?size=128'
  );
  assert.equal(normalizeAvatar('javascript:alert(1)'), null);
  assert.equal(normalizeAvatar('not a url'), null);
  assert.equal(normalizeAvatar(''), null);
  assert.equal(normalizeAvatar(null), null);
});

test('an animated Discord avatar carries a still rendition to fall back on', () => {
  // Discord only serves the .gif while the account still has an animated avatar.
  // Once it does not, the CDN answers 415 for the .gif and only .png/.webp load —
  // so the profile has to ship the still URL alongside it.
  const user = {
    id: 'user-e',
    app_metadata: { provider: 'discord' },
    user_metadata: {},
    identities: [{
      provider: 'discord',
      identity_data: {
        full_name: 'thomass_28',
        avatar_url: 'https://cdn.discordapp.com/avatars/706932839907852389/a_1823f393.gif'
      }
    }]
  };

  const profile = profileFromUser(user, 'discord');
  assert.equal(profile.avatar, 'https://cdn.discordapp.com/avatars/706932839907852389/a_1823f393.gif?size=128');
  assert.equal(profile.avatarFallback, 'https://cdn.discordapp.com/avatars/706932839907852389/a_1823f393.png?size=128');
});

test('only Discord .gif avatars get a still rendition', () => {
  assert.equal(staticAvatarRendition('https://cdn.discordapp.com/avatars/1/h.png?size=128'), null);
  assert.equal(staticAvatarRendition('https://lh3.googleusercontent.com/a/X=s128-c'), null);
  assert.equal(staticAvatarRendition('https://example.com/a.gif'), null);
  assert.equal(staticAvatarRendition(null), null);
});
