/**
 * Modules Index
 * Central export point for all utility modules
 */

module.exports = {
  debug: require('./debug'),
  fileUtils: require('./file-utils'),
  processUtils: require('./process-utils'),
  versionUtils: require('./version-utils'),
  httpUtils: require('./http-utils'),
  autoUpdater: require('./auto-updater'),
  userProfile: require('./user-profile'),
  downloadManager: require('./download-manager'),
  oauth: require('./oauth'),
  systemTools: require('./system-tools'),
  spicetify: require('./spicetify'),
  archiveUtils: require('./archive-utils'),
  sparkle: require('./sparkle')
};
