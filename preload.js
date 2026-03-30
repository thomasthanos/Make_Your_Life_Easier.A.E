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
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // ── Window Controls ──
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowStateChange: (callback) => ipcRenderer.on('window-state-changed', callback),
  setWindowSize: (width, height) => ipcRenderer.invoke('window-set-size', { width, height }),
  getWindowSize: () => ipcRenderer.invoke('window-get-size'),
  animateWindowSize: (width, height) => ipcRenderer.invoke('window-set-bounds-animate', { width, height }),
  animateResize: (width, height, duration) =>
    ipcRenderer.invoke('window-animate-resize', { width, height, duration }),

  // ── App Lifecycle ──
  signalAppReady: (width, height) => ipcRenderer.invoke('app-ready', { width, height }),
  updateLoadingProgress: (progress, message) => ipcRenderer.invoke('update-loading-progress', { progress, message }),
  getAssetPath: (relativePath) => ipcRenderer.invoke('get-asset-path', relativePath),

  // ── Auto-Updater ──
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  forceCheckUpdates: () => ipcRenderer.invoke('force-check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  retryUpdate: () => ipcRenderer.invoke('retry-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  saveUpdateInfo: (info) => ipcRenderer.invoke('save-update-info', info),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  onUpdateStatus: (callback) => onEvent('update-status', callback),

  // ── Download Manager ──
  downloadStart: (id, url, dest) => ipcRenderer.send('download-start', { id, url, dest }),
  downloadPause: (id) => ipcRenderer.send('download-pause', id),
  downloadResume: (id) => ipcRenderer.send('download-resume', id),
  downloadCancel: (id) => ipcRenderer.send('download-cancel', id),
  onDownloadEvent: (callback) => onEvent('download-event', callback),

  // ── File Operations ──
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openInstaller: (filePath) => ipcRenderer.invoke('open-installer', filePath),
  runInstaller: (filePath) => ipcRenderer.invoke('run-installer', filePath),
  runMsiInstaller: (msiPath) => ipcRenderer.invoke('run-msi-installer', msiPath),
  extractArchive: (filePath, password, destDir) =>
    ipcRenderer.invoke('extract-archive', { filePath, password, destDir }),
  replaceExe: (sourcePath, destPath) =>
    ipcRenderer.invoke('replace-exe', { sourcePath, destPath }),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  renameDirectory: (src, dest) => ipcRenderer.invoke('rename-directory', { src, dest }),
  findExeFiles: (directoryPath) => ipcRenderer.invoke('find-exe-files', directoryPath),
  showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),
  runElevatedWinget: (command) => ipcRenderer.invoke('run-elevated-winget', command),

  // ── System Maintenance: Cleanup ──
  runTempCleanup: () => ipcRenderer.invoke('run-temp-cleanup'),
  cleanRecycleBin: () => ipcRenderer.invoke('clean-recycle-bin'),
  cleanWindowsCache: () => ipcRenderer.invoke('clean-windows-cache'),
  clearThumbnailCache: () => ipcRenderer.invoke('clear-thumbnail-cache'),
  clearErrorReports: () => ipcRenderer.invoke('clear-error-reports'),
  runDiskCleaner: () => ipcRenderer.invoke('run-disk-cleaner'),

  // ── System Maintenance: Network & Connectivity ──
  flushDnsCache: () => ipcRenderer.invoke('flush-dns-cache'),
  releaseRenewIp: () => ipcRenderer.invoke('release-renew-ip'),
  fixBluetooth: () => ipcRenderer.invoke('fix-bluetooth'),
  networkReset: () => ipcRenderer.invoke('network-reset'),

  // ── System Maintenance: Repair & Diagnostics ──
  runSfcScan: () => ipcRenderer.invoke('run-sfc-scan'),
  runDismRepair: () => ipcRenderer.invoke('run-dism-repair'),
  checkDisk: () => ipcRenderer.invoke('check-disk'),
  restartAudioSystem: () => ipcRenderer.invoke('restart-audio-system'),
  restartToBios: () => ipcRenderer.invoke('restart-to-bios'),

  // ── Debloat & Scripts ──
  runSparkleDebloat: () => ipcRenderer.invoke('run-sparkle-debloat'),
  ensureSparkle: () => ipcRenderer.invoke('ensure-sparkle'),
  processDownloadedSparkle: (zipPath) => ipcRenderer.invoke('process-downloaded-sparkle', zipPath),
  runRaphiDebloat: () => ipcRenderer.invoke('run-raphi-debloat'),
  runChrisTitus: () => ipcRenderer.invoke('run-christitus'),
  runActivateScript: () => ipcRenderer.invoke('run-activate-script'),
  runAutologinScript: () => ipcRenderer.invoke('run-autologin-script'),

  // ── Spicetify / Spotify ──
  installSpicetify: () => ipcRenderer.invoke('install-spicetify'),
  uninstallSpicetify: () => ipcRenderer.invoke('uninstall-spicetify'),
  fullUninstallSpotify: () => ipcRenderer.invoke('full-uninstall-spotify'),

  // ── Authentication ──
  loginGoogle: () => ipcRenderer.invoke('login-google'),
  loginDiscord: () => ipcRenderer.invoke('login-discord'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  logout: () => ipcRenderer.invoke('logout'),

  // ── Password Manager ──
  openPasswordManager: (lang) => ipcRenderer.invoke('open-password-manager', lang),
  passwordManagerCloseWindow: () => ipcRenderer.invoke('password-window-close'),
  passwordManagerReset: () => ipcRenderer.invoke('password-manager-reset'),
  passwordManagerHasMasterPassword: () => ipcRenderer.invoke('password-manager-has-master-password'),
  passwordManagerCreateMasterPassword: (password) => ipcRenderer.invoke('password-manager-create-master-password', password),
  passwordManagerAuthenticate: (password) => ipcRenderer.invoke('password-manager-authenticate', password),
  passwordManagerLogout: () => ipcRenderer.invoke('password-manager-logout'),
  passwordManagerChangePassword: (currentPassword, newPassword) => ipcRenderer.invoke('password-manager-change-password', currentPassword, newPassword),
  passwordManagerValidatePassword: (password) => ipcRenderer.invoke('password-manager-validate-password', password),
  passwordManagerGetCategories: () => ipcRenderer.invoke('password-manager-get-categories'),
  passwordManagerAddCategory: (name) => ipcRenderer.invoke('password-manager-add-category', name),
  passwordManagerUpdateCategory: (id, name) => ipcRenderer.invoke('password-manager-update-category', id, name),
  passwordManagerDeleteCategory: (id) => ipcRenderer.invoke('password-manager-delete-category', id),
  passwordManagerGetPasswords: (categoryId) => ipcRenderer.invoke('password-manager-get-passwords', categoryId),
  passwordManagerGetPassword: (id) => ipcRenderer.invoke('password-manager-get-password', id),
  passwordManagerAddPassword: (passwordData) => ipcRenderer.invoke('password-manager-add-password', passwordData),
  passwordManagerUpdatePassword: (id, passwordData) => ipcRenderer.invoke('password-manager-update-password', id, passwordData),
  passwordManagerDeletePassword: (id) => ipcRenderer.invoke('password-manager-delete-password', id),
  passwordManagerSearchPasswords: (query) => ipcRenderer.invoke('password-manager-search-passwords', query),
});
