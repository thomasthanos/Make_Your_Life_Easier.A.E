const { contextBridge, ipcRenderer } = require('electron');

/**
 * Helper to create a one-way event listener with cleanup
 * @param {string} channel - IPC channel name
 * @param {Function} callback - Event handler
 * @returns {Function} Unsubscribe function
 */
function onEvent(channel, callback) {
  const listener = (_event, data) => callback(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('api', {

  // ── Platform ──
  isWindows: () => process.platform === 'win32',

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  setWindowSize: (width, height) => ipcRenderer.invoke('window-set-size', { width, height }),

  // ── App Lifecycle ──
  signalAppReady: (width, height) => ipcRenderer.invoke('app-ready', { width, height }),
  updateLoadingProgress: (progress, message) => ipcRenderer.invoke('update-loading-progress', { progress, message }),
  getAssetPath: (relativePath) => ipcRenderer.invoke('get-asset-path', relativePath),

  // ── Auto-Updater ──
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  onUpdateStatus: (callback) => onEvent('update-status', callback),

  // ── Download Manager ──
  downloadStart: (id, url, dest) => ipcRenderer.send('download-start', { id, url, dest }),
  onDownloadEvent: (callback) => onEvent('download-event', callback),

  // ── Winget Upgrade (streaming) ──
  checkWingetUpgrade: () => ipcRenderer.invoke('winget-upgrade-check'),
  wingetUpgradeAll: () => ipcRenderer.invoke('winget-upgrade-all'),
  cancelWingetUpgrade: () => ipcRenderer.invoke('winget-upgrade-cancel'),
  onWingetUpgradeOutput: (callback) => onEvent('winget-upgrade-output', callback),

  // ── File Operations ──
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  runInstaller: (filePath) => ipcRenderer.invoke('run-installer', filePath),
  extractArchive: (filePath, password, destDir) =>
    ipcRenderer.invoke('extract-archive', { filePath, password, destDir }),
  replaceExe: (sourcePath, destPath) =>
    ipcRenderer.invoke('replace-exe', { sourcePath, destPath }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  cleanupInstallArtifacts: (zipPath, dir) => ipcRenderer.invoke('cleanup-install-artifacts', { zipPath, dir }),
  findExeFiles: (directoryPath) => ipcRenderer.invoke('find-exe-files', directoryPath),
  showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),

  // ── System Maintenance: Cleanup ──
  scanCleanerTasks: (options) => ipcRenderer.invoke('scan-cleaner-tasks', options),
  runCleanerTasks: (taskIds, options) => ipcRenderer.invoke('run-cleaner-tasks', taskIds, options),
  onCleanerProgress: (callback) => onEvent('cleaner-progress', callback),
  enableCleanerAdmin: () => ipcRenderer.invoke('cleaner-admin-enable'),

  // ── System Maintenance: Network & Connectivity ──
  flushDnsCache: () => ipcRenderer.invoke('flush-dns-cache'),
  releaseRenewIp: () => ipcRenderer.invoke('release-renew-ip'),
  fixBluetooth: () => ipcRenderer.invoke('fix-bluetooth'),
  networkReset: () => ipcRenderer.invoke('network-reset'),

  // ── System Maintenance: Repair & Diagnostics ──
  runSfcScan: () => ipcRenderer.invoke('run-sfc-scan'),
  runDismRepair: () => ipcRenderer.invoke('run-dism-repair'),
  cancelSystemRepair: () => ipcRenderer.invoke('system-repair-cancel'),
  onSystemRepairOutput: (callback) => onEvent('system-repair-output', callback),
  checkDisk: () => ipcRenderer.invoke('check-disk'),
  restartAudioSystem: () => ipcRenderer.invoke('restart-audio-system'),
  restartToBios: () => ipcRenderer.invoke('restart-to-bios'),

  // ── Debloat & Scripts ──
  runSparkleDebloat: () => ipcRenderer.invoke('run-sparkle-debloat'),
  processDownloadedSparkle: (zipPath) => ipcRenderer.invoke('process-downloaded-sparkle', zipPath),
  sparkleStatus: () => ipcRenderer.invoke('sparkle-status'),
  runChrisTitus: () => ipcRenderer.invoke('run-christitus'),
  cancelChrisTitus: () => ipcRenderer.invoke('run-christitus-cancel'),
  onChrisTitusOutput: (callback) => onEvent('christitus-output', callback),

  // ── Spicetify / Spotify ──
  installSpicetify: () => ipcRenderer.invoke('install-spicetify'),
  cancelSpicetifyInstall: () => ipcRenderer.invoke('install-spicetify-cancel'),
  onSpicetifyInstallOutput: (callback) => onEvent('spicetify-install-output', callback),
  uninstallSpicetify: () => ipcRenderer.invoke('uninstall-spicetify'),
  fullUninstallSpotify: () => ipcRenderer.invoke('full-uninstall-spotify'),

  // ── Authentication ──
  loginGoogle: () => ipcRenderer.invoke('login-google'),
  loginDiscord: () => ipcRenderer.invoke('login-discord'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  logout: () => ipcRenderer.invoke('logout'),

  // ── Settings (local-first + Supabase sync) ──
  getSetting: (key) => ipcRenderer.invoke('settings-get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings-set', { key, value }),
  getAllSettings: () => ipcRenderer.invoke('settings-all'),
  resetSettings: () => ipcRenderer.invoke('settings-reset'),
});
