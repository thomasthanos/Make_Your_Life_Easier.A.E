const test = require('node:test');
const assert = require('node:assert/strict');

const { prepareSettingsForUser } = require('../src/modules/settings-state');

test('anonymous settings are adopted by the first authenticated account', () => {
  const result = prepareSettingsForUser({ data: { lang: 'gr' }, updated_at: null }, 'user-a');

  assert.equal(result.reset, false);
  assert.equal(result.changed, true);
  assert.deepEqual(result.state, {
    data: { lang: 'gr' },
    updated_at: null,
    owner_id: 'user-a'
  });
});

test('settings owned by another account are never reused for the new account', () => {
  const result = prepareSettingsForUser({
    data: { dangerousPreference: true },
    updated_at: '2026-07-20T10:00:00.000Z',
    owner_id: 'user-a'
  }, 'user-b');

  assert.equal(result.reset, true);
  assert.equal(result.changed, true);
  assert.deepEqual(result.state, {
    data: {},
    updated_at: null,
    owner_id: 'user-b'
  });
});

test('settings for the current account remain unchanged', () => {
  const state = { data: { theme: 'dark' }, updated_at: null, owner_id: 'user-a' };
  const result = prepareSettingsForUser(state, 'user-a');

  assert.equal(result.reset, false);
  assert.equal(result.changed, false);
  assert.deepEqual(result.state, state);
});
