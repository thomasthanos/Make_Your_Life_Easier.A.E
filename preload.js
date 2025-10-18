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
  passwordManagerAddPassword: (passwordData) => ipcRenderer.invoke('password-manager-add-password', passwordData),
  passwordManagerUpdatePassword: (id, passwordData) => ipcRenderer.invoke('password-manager-update-password', id, passwordData),
  passwordManagerDeletePassword: (id) => ipcRenderer.invoke('password-manager-delete-password', id),
  passwordManagerSearchPasswords: (query) => ipcRenderer.invoke('password-manager-search-passwords', query),

  openPasswordManager: () => ipcRenderer.invoke('open-password-manager'),

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

  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  onUpdateStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-status', listener);
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  runMsiInstaller: (msiPath) => ipcRenderer.invoke('run-msi-installer', msiPath),
  runInstaller: (filePath) => ipcRenderer.invoke('run-installer', filePath),

  loginGoogle: () => ipcRenderer.invoke('login-google'),
  loginDiscord: () => ipcRenderer.invoke('login-discord'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  logout: () => ipcRenderer.invoke('logout'),

});