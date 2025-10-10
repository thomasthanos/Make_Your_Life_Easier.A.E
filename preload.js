const { contextBridge, ipcRenderer } = require('electron');

// The preload script exposes a safe API to the renderer process.  By
// using contextBridge, Node APIs remain inaccessible to the page except
// through these whitelisted methods.  See the Electron security
// recommendations for more details.
contextBridge.exposeInMainWorld('api', {

  // Execute a system command and capture its output.  Use only for
  // predefined commands; do not pass unsanitized user input.
  runCommand: (command) => ipcRenderer.invoke('run-command', command),

  // Launch a URL in the default web browser.
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  // Start a file download with progress reporting. Uses events for progress updates.
  downloadStart: (id, url, dest) => ipcRenderer.send('download-start', { id, url, dest }),

  // Pause a download by ID.
  downloadPause: (id) => ipcRenderer.send('download-pause', id),

  // Resume a paused download by ID.
  downloadResume: (id) => ipcRenderer.send('download-resume', id),

  // Cancel a download by ID.
  downloadCancel: (id) => ipcRenderer.send('download-cancel', id),

  restartToBios: () => ipcRenderer.invoke('restart-to-bios'),

  openInstaller: (filePath) => ipcRenderer.invoke('open-installer', filePath),

  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

  // Extract a password‑protected archive using the bundled 7‑Zip.  Provide the
  // archive path, the password, and an optional output directory.  Returns
  // { success, output } or { success, error }.
  extractArchive: (filePath, password, destDir) =>
    ipcRenderer.invoke('extract-archive', { filePath, password, destDir }),

  // Replace an executable file at the destination with a file from the extracted archive.
  replaceExe: (sourcePath, destPath) =>
    ipcRenderer.invoke('replace-exe', { sourcePath, destPath }),

  isWindows: () => process.platform === 'win32',
  
  // Listen to download events (progress, complete, error).
  onDownloadEvent: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('download-event', listener);
    return () => ipcRenderer.removeListener('download-event', listener);
  },
  
  installSpicetify: () => ipcRenderer.invoke('install-spicetify'),
  uninstallSpicetify: () => ipcRenderer.invoke('uninstall-spicetify'),
  fullUninstallSpotify: () => ipcRenderer.invoke('full-uninstall-spotify'),

  // System maintenance
  runSfcScan: () => ipcRenderer.invoke('run-sfc-scan'),
  runDismRepair: () => ipcRenderer.invoke('run-dism-repair'),
  runTempCleanup: () => ipcRenderer.invoke('run-temp-cleanup'),

  // Activation scripts
  runActivateScript: () => ipcRenderer.invoke('run-activate-script'),
  runAutologinScript: () => ipcRenderer.invoke('run-autologin-script'),

  // ===== PASSWORD MANAGER APIs =====
  passwordManagerGetCategories: () => ipcRenderer.invoke('password-manager-get-categories'),
  passwordManagerAddCategory: (name) => ipcRenderer.invoke('password-manager-add-category', name),
  passwordManagerUpdateCategory: (id, name) => ipcRenderer.invoke('password-manager-update-category', id, name),
  passwordManagerDeleteCategory: (id) => ipcRenderer.invoke('password-manager-delete-category', id),
  passwordManagerGetPasswords: (categoryId) => ipcRenderer.invoke('password-manager-get-passwords', categoryId),
  passwordManagerAddPassword: (passwordData) => ipcRenderer.invoke('password-manager-add-password', passwordData),
  passwordManagerUpdatePassword: (id, passwordData) => ipcRenderer.invoke('password-manager-update-password', id, passwordData),
  passwordManagerDeletePassword: (id) => ipcRenderer.invoke('password-manager-delete-password', id),
  passwordManagerSearchPasswords: (query) => ipcRenderer.invoke('password-manager-search-passwords', query),

// Add this to the preload.js API
  openPasswordManager: () => ipcRenderer.invoke('open-password-manager'),

  passwordManagerHasMasterPassword: () => ipcRenderer.invoke('password-manager-has-master-password'),
  passwordManagerCreateMasterPassword: (password) => ipcRenderer.invoke('password-manager-create-master-password', password),
  passwordManagerAuthenticate: (password) => ipcRenderer.invoke('password-manager-authenticate', password),
  passwordManagerLogout: () => ipcRenderer.invoke('password-manager-logout'),
  passwordManagerChangePassword: (currentPassword, newPassword) => ipcRenderer.invoke('password-manager-change-password', currentPassword, newPassword),
  passwordManagerValidatePassword: (password) => ipcRenderer.invoke('password-manager-validate-password', password),
  
  findExeFiles: (directoryPath) => ipcRenderer.invoke('find-exe-files', directoryPath),

    showFileDialog: () => ipcRenderer.invoke('show-file-dialog'),


});