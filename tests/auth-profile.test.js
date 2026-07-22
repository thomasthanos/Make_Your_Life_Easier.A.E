const test = require('node:test');
const assert = require('node:assert/strict');

const { profileFromUser } = require('../src/modules/auth-profile');

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
    provider: 'google'
  });
});
