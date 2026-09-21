
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');
const { debug } = require('./debug');

let userProfile = null;
let profilePath = null;

function encryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function initialize(userDataPath) {
  profilePath = path.join(userDataPath, 'userProfile.json');
  load();
}

function load() {
  try {
    if (profilePath && fs.existsSync(profilePath)) {
      const raw = fs.readFileSync(profilePath);
      let text;
      if (encryptionAvailable()) {
        try { text = safeStorage.decryptString(raw); }
        catch { text = raw.toString('utf-8'); }
      } else {
        text = raw.toString('utf-8');
      }
      userProfile = JSON.parse(text);
    }
  } catch (err) {
    debug('warn', 'Failed to load saved user profile:', err);
    userProfile = null;
  }
}

function save() {
  try {
    if (!profilePath) return;

    if (userProfile) {
      const json = JSON.stringify(userProfile);
      if (encryptionAvailable()) {
        fs.writeFileSync(profilePath, safeStorage.encryptString(json));
      } else {
        fs.writeFileSync(profilePath, json, 'utf8');
      }
    } else {
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
      }
    }
  } catch (err) {
    debug('warn', 'Failed to save user profile:', err);
  }
}

function get() {
  return userProfile;
}

function set(profile) {
  userProfile = profile;
  save();
}

function clear() {
  userProfile = null;
  save();
}

module.exports = {
  initialize,
  load,
  save,
  get,
  set,
  clear
};
