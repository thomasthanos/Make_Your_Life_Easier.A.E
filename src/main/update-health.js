const fs = require('fs');
const path = require('path');

const PENDING_FILE = '.update-health-pending';
const ACK_FILE = '.update-health-ok';

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function markerPaths(userDataPath) {
  return {
    pendingPath: path.join(userDataPath, PENDING_FILE),
    ackPath: path.join(userDataPath, ACK_FILE)
  };
}

function readUpdateHealth(userDataPath) {
  const { pendingPath, ackPath } = markerPaths(userDataPath);
  const pendingVersion = readText(pendingPath);
  const acknowledgedVersion = readText(ackPath);
  return {
    pendingVersion,
    acknowledgedVersion,
    pending: Boolean(pendingVersion),
    acknowledged: Boolean(pendingVersion && acknowledgedVersion === pendingVersion)
  };
}

function acknowledgeUpdateHealth(userDataPath, runningVersion) {
  const { pendingPath, ackPath } = markerPaths(userDataPath);
  const version = readText(pendingPath);
  if (!version || version !== runningVersion) return false;

  const tempPath = `${ackPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, version, 'utf8');
    fs.renameSync(tempPath, ackPath);
    return true;
  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch { }
    throw error;
  }
}

module.exports = { acknowledgeUpdateHealth, readUpdateHealth, markerPaths };
