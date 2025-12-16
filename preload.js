const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  runCommand: (command) => ipcRenderer.invoke('run-command', command),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  downloadStart: (id, url, dest) => ipcRenderer.send('download-start', { id, url, dest }),
  downloadPause: (id) => ipcRenderer.send('download-pause', id),
  downloadResume: (id) => ipcRenderer.send('download-resume', id),
  downloadCancel: (id) => ipcRenderer.send('download-cancel', id),
  restartToBios: () => ipcRenderer.invoke('restart-to-bios'),
  openInstaller: (filePath) => ipcRenderer.invoke('open-installer', filePath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  passwordManagerReset: () => ipcRenderer.invoke('password-manager-reset'),
  extractArchive: (filePath, password, destDir) =>
    ipcRenderer.invoke('extract-archive', { filePath, password, destDir }),
  replaceExe: (sourcePath, destPath) =>
    ipcRenderer.invoke('replace-exe', { sourcePath, destPath }),
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  renameDirectory: (src, dest) => ipcRenderer.invoke('rename-directory', { src, dest }),
  isWindows: () => process.platform === 'win32',

  onDownloadEvent: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-event', listener);
    return () => ipcRenderer.removeListener('download-event', listener);
  },

  installSpicetify: () => ipcRenderer.invoke('install-spicetify'),
  uninstallSpicetify: () => ipcRenderer.invoke('uninstall-spicetify'),
  fullUninstallSpotify: () => ipcRenderer.invoke('full-uninstall-spotify'),

  runSfcScan: () => ipcRenderer.invoke('run-sfc-scan'),
  runDismRepair: () => ipcRenderer.invoke('run-dism-repair'),
  runTempCleanup: () => ipcRenderer.invoke('run-temp-cleanup'),

  runActivateScript: () => ipcRenderer.invoke('run-activate-script'),
  runAutologinScript: () => ipcRenderer.invoke('run-autologin-script'),

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

  openPasswordManager: (lang) => ipcRenderer.invoke('open-password-manager', lang),

  passwordManagerHasMasterPassword: () => ipcRenderer.invoke('password-manager-has-master-password'),
  passwordManagerCreateMasterPassword: (password) => ipcRenderer.invoke('password-manager-create-master-password', password),
  passwordManagerAuthenticate: (password) => ipcRenderer.invoke('password-manager-authenticate', password),
  passwordManagerLogout: () => ipcRenderer.invoke('password-manager-logout'),
  passwordManagerChangePassword: (currentPassword, newPassword) => ipcRenderer.invoke('password-manager-change-password', currentPassword, newPassword),
  passwordManagerValidatePassword: (password) => ipcRenderer.invoke('password-manager-validate-password', password),

  findExeFiles: (directoryPath) => ipcRenderer.invoke('find-exe-files', directoryPath),
  showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),

  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  saveUpdateInfo: (info) => ipcRenderer.invoke('save-update-info', info),
  getUpdateInfo: () => ipcRenderer.invoke('get-update-info'),
  getUpdateState: () => ipcRenderer.invoke('get-update-state'),
  cancelUpdate: () => ipcRenderer.invoke('cancel-update'),
  forceCheckUpdates: () => ipcRenderer.invoke('force-check-updates'),
  retryUpdate: () => ipcRenderer.invoke('retry-update'),

  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  runMsiInstaller: (msiPath) => ipcRenderer.invoke('run-msi-installer', msiPath),
  runInstaller: (filePath) => ipcRenderer.invoke('run-installer', filePath),
  runChrisTitus: () => ipcRenderer.invoke('run-christitus'),
  ensureSparkle: () => ipcRenderer.invoke('ensure-sparkle'),
  runRaphiDebloat: () => ipcRenderer.invoke('run-raphi-debloat'),

  loginGoogle: () => ipcRenderer.invoke('login-google'),
  loginDiscord: () => ipcRenderer.invoke('login-discord'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  logout: () => ipcRenderer.invoke('logout'),

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
  passwordManagerCloseWindow: () => ipcRenderer.invoke('password-window-close'),

  // Asset path helper for images and other assets
  getAssetPath: (relativePath) => ipcRenderer.invoke('get-asset-path', relativePath),

  // App ready signal - notify main process that the app is fully loaded
  signalAppReady: (width, height) => ipcRenderer.invoke('app-ready', { width, height }),
  
  // Loading progress update
  updateLoadingProgress: (progress, message) => ipcRenderer.invoke('update-loading-progress', { progress, message })
});