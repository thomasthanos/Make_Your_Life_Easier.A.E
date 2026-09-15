/**
 * Folders that a desktop sync client mirrors to the cloud.
 *
 * Putting the backup folder inside one of them is the whole cloud feature: the
 * client uploads the copies, and restoring on another PC means letting it
 * download them first. Nothing here talks to a cloud service.
 */

const fs = require('fs');
const path = require('path');

// Google Drive for desktop mounts a virtual drive; the folder name is localised.
const GOOGLE_DRIVE_FOLDERS = ['My Drive', 'Το Drive μου'];

function isDirectory(fsImpl, dir) {
  try {
    return fsImpl.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function readJsonFile(fsImpl, file) {
  try {
    return JSON.parse(fsImpl.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * @param {Object} [options]
 * @param {Object} [options.env] - Environment variables
 * @param {Object} [options.fsImpl] - fs implementation
 * @param {string} [options.driveLetters] - Drives to look for Google Drive on
 * @returns {Array<{id: string, label: string, path: string}>}
 */
function detectCloudFolders({ env = process.env, fsImpl = fs, driveLetters = 'DEFGHIJKLMNOPQRSTUVWXYZ' } = {}) {
  const found = [];
  const add = (id, label, dir) => {
    if (typeof dir !== 'string' || !dir || !isDirectory(fsImpl, dir)) return;
    const normalized = path.normalize(dir);
    const duplicate = found.some((item) => item.id === id || item.path.toLowerCase() === normalized.toLowerCase());
    if (!duplicate) found.push({ id, label, path: normalized });
  };

  add('onedrive', 'OneDrive', env.OneDriveConsumer || env.OneDrive);
  add('onedrive-work', 'OneDrive (work)', env.OneDriveCommercial);

  for (const base of [env.LOCALAPPDATA, env.APPDATA]) {
    if (!base) continue;
    const info = readJsonFile(fsImpl, path.join(base, 'Dropbox', 'info.json'));
    if (info && info.personal) add('dropbox', 'Dropbox', info.personal.path);
    if (info && info.business) add('dropbox-business', 'Dropbox (business)', info.business.path);
  }

  for (const letter of driveLetters) {
    const hit = GOOGLE_DRIVE_FOLDERS
      .map((name) => `${letter}:\\${name}`)
      .find((dir) => isDirectory(fsImpl, dir));
    if (hit) {
      add('google-drive', 'Google Drive', hit);
      break;
    }
  }
  if (env.USERPROFILE) add('google-drive', 'Google Drive', path.join(env.USERPROFILE, 'Google Drive'));

  return found;
}

module.exports = {
  detectCloudFolders
};
