const fs = require('fs');
const path = require('path');
const { getClient, isConfigured, getSessionUser } = require('./supabase');
const userProfile = require('./user-profile');
const { debug } = require('./debug');
const { normalizeSettingsState, prepareSettingsForUser } = require('./settings-state');

const TABLE = 'user_settings';
const PUSH_DEBOUNCE_MS = 1500;

let settingsPath = null;
let local = normalizeSettingsState();
let pushTimer = null;

function initialize(userDataPath) {
  settingsPath = path.join(userDataPath, 'settings.json');
  load();
}

function load() {
  try {
    if (settingsPath && fs.existsSync(settingsPath)) {
      const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        local = normalizeSettingsState(parsed);
      }
    }
  } catch (err) {
    debug('warn', 'Failed to load settings:', err.message);
    local = normalizeSettingsState();
  }
}

function persist() {
  try {
    if (!settingsPath) return;
    fs.writeFileSync(settingsPath, JSON.stringify(local, null, 2));
  } catch (err) {
    debug('warn', 'Failed to save settings:', err.message);
  }
}

function get(key) {
  return local.data[key];
}

function all() {
  return { ...local.data };
}

function isLoggedIn() {
  return Boolean(userProfile.get());
}

function set(key, value) {
  local.data[key] = value;
  if (isLoggedIn()) {
    local.updated_at = new Date().toISOString();
    schedulePush();
  }
  persist();
  return local.data[key];
}

function clearAll() {
  local = {
    data: {},
    updated_at: isLoggedIn() ? new Date().toISOString() : local.updated_at,
    owner_id: local.owner_id
  };
  persist();
  if (isLoggedIn()) schedulePush();
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushToCloud().catch(() => {});
  }, PUSH_DEBOUNCE_MS);
}

async function pushToCloud() {
  if (!isConfigured() || !isLoggedIn()) return;
  try {
    const user = await getSessionUser();
    if (!user) {
      debug('warn', 'Settings push skipped: the cached account has no active Supabase session.');
      return;
    }

    const prepared = prepareSettingsForUser(local, user.id);
    if (prepared.changed) {
      local = prepared.state;
      persist();
    }

    const { error } = await getClient()
      .from(TABLE)
      .upsert({ user_id: user.id, data: local.data, updated_at: local.updated_at || new Date().toISOString() });
    if (error) debug('warn', 'Settings push failed:', error.message);
  } catch (err) {
    debug('warn', 'Settings push error:', err.message);
  }
}

async function pullFromCloud() {
  if (!isConfigured() || !isLoggedIn()) return;
  try {
    const user = await getSessionUser();
    if (!user) return;

    const prepared = prepareSettingsForUser(local, user.id);
    if (prepared.changed) {
      local = prepared.state;
      persist();
      if (prepared.reset) {
        debug('warn', 'Local settings belonged to another account and were isolated before cloud sync.');
      }
    }

    const { data: row, error } = await getClient()
      .from(TABLE)
      .select('data, updated_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      debug('warn', 'Settings pull failed:', error.message);
      return;
    }
    if (!row) {
      await pushToCloud();
      return;
    }
    const cloudNewer = row.updated_at && (!local.updated_at || row.updated_at > local.updated_at);
    if (cloudNewer) {
      local = normalizeSettingsState({ data: row.data, updated_at: row.updated_at, owner_id: user.id });
      persist();
    } else if (local.updated_at && (!row.updated_at || local.updated_at > row.updated_at)) {
      await pushToCloud();
    }
  } catch (err) {
    debug('warn', 'Settings pull error:', err.message);
  }
}

function onSignedOut() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
}

module.exports = {
  initialize,
  load,
  get,
  set,
  all,
  clearAll,
  pullFromCloud,
  onSignedOut
};
