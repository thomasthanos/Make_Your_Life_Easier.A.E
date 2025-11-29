/**
 * User Profile Module
 * Manages user authentication and profile storage
 */

const fs = require('fs');
const path = require('path');
const { debug } = require('./debug');

let userProfile = null;
let profilePath = null;

/**
 * Initialize the profile module with the user data path
 * @param {string} userDataPath - Path to the user data directory
 */
function initialize(userDataPath) {
  profilePath = path.join(userDataPath, 'userProfile.json');
  load();
}

/**
 * Load user profile from disk
 */
function load() {
  try {
    if (profilePath && fs.existsSync(profilePath)) {
      const data = fs.readFileSync(profilePath, 'utf-8');
      userProfile = JSON.parse(data);
    }
  } catch (err) {
    debug('warn', 'Failed to load saved user profile:', err);
    userProfile = null;
  }
}

/**
 * Save user profile to disk
 */
function save() {
  try {
    if (!profilePath) return;
    
    if (userProfile) {
      fs.writeFileSync(profilePath, JSON.stringify(userProfile, null, 2));
    } else {
      if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
      }
    }
  } catch (err) {
    debug('warn', 'Failed to save user profile:', err);
  }
}

/**
 * Get the current user profile
 * @returns {Object|null}
 */
function get() {
  return userProfile;
}

/**
 * Set the user profile
 * @param {Object} profile - The profile to set
 */
function set(profile) {
  userProfile = profile;
  save();
}

/**
 * Clear the user profile (logout)
 */
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
