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

  /**
   * Retrieve the list of application package IDs that are recommended for removal.
   * This invokes the main process handler 'get-default-remove-apps' and returns
   * an array of strings.
   *
   * @returns {Promise<string[]>} The default removable package IDs.
   */
  getDefaultRemoveApps: () => ipcRenderer.invoke('get-default-remove-apps'),
  
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

  // Execute a simple debloat routine that disables a handful of
  // Windows suggestions and web search features.  This legacy
  // handler remains for backward compatibility with earlier
  // versions of the application.  Prefer using `runDebloatTasks`
  // with a custom selection of tasks instead.
  runDebloat: () => ipcRenderer.invoke('run-debloat'),

  /**
   * Execute a customizable set of debloat tasks. Pass an array of
   * string identifiers corresponding to individual actions and
   * optionally an array of additional application IDs to remove.
   * The backend assembles a PowerShell script based on the
   * provided selections and executes it with elevated privileges
   * when required. The promise resolves to an object containing
   * a boolean `success` flag, a human readable message, and
   * optionally the contents of the generated log.
   *
   * @param {string[]} selectedTasks - The identifiers of the debloat
   *   tasks the user has chosen.
   * @param {string[]} [extraApps] - Additional Microsoft Store
   *   package names to remove when the removePreinstalledApps task
   *   is selected. These should be the app package names (e.g.
   *   "SpotifyAB.SpotifyMusic").
   */
  /**
   * Execute a customizable set of debloat tasks. Accepts an
   * object containing the selected task identifiers along with
   * optional parameters such as the list of appx package names to
   * remove and the desired search bar mode.  The backend
   * assembles a PowerShell script based on the provided selections
   * and executes it with elevated privileges.  Returns an object
   * with a success flag, a message and, when available, the log
   * contents.
   *
   * @param {Object|Array} options - When passed an array, the array
   *   is treated as the list of selected task identifiers for
   *   backwards compatibility.  When passed an object, it may
   *   contain `selectedTasks: string[]`, `removeApps: string[]`,
   *   and `searchBarMode: number`.
   */
  runDebloatTasks: (options, removeApps, searchBarMode) => {
    // Maintain backward compatibility: if the first argument is an
    // array, treat it as selected tasks and ignore the other
    // parameters.
    if (Array.isArray(options)) {
      return ipcRenderer.invoke('run-debloat-tasks', { selectedTasks: options, removeApps: Array.isArray(removeApps) ? removeApps : [], searchBarMode: typeof searchBarMode === 'number' ? searchBarMode : null });
    }
    return ipcRenderer.invoke('run-debloat-tasks', options);
  },

  /**
   * Retrieve a list of installed preinstalled AppX packages that can
   * be removed.  This method queries the system via PowerShell and
   * returns an array of package names.  Use this list to present
   * checkboxes for app removal.
   *
   * @returns {Promise<string[]>} The removable app package names.
   */
  getPreinstalledApps: () => ipcRenderer.invoke('get-preinstalled-apps'),

  loginGoogle: () => ipcRenderer.invoke('login-google'),
  loginDiscord: () => ipcRenderer.invoke('login-discord'),
  getUserProfile: () => ipcRenderer.invoke('get-user-profile'),
  logout: () => ipcRenderer.invoke('logout'),

});