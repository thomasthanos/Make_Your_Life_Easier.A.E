
const fs = require('fs');
const path = require('path');

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
