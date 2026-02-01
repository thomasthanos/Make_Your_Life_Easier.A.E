/**
 * IPC Handlers Module
 * Handles all Inter-Process Communication between main and renderer
 */

const { ipcMain, shell, dialog, BrowserWindow, app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * Setup window control IPC handlers
 * @param {Function} getMainWindow - Function to get main window
 */
function setupWindowHandlers(getMainWindow) {
    ipcMain.handle('window-minimize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('window-maximize', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('window-close', () => {
        const mainWindow = getMainWindow();
        if (mainWindow) mainWindow.close();
    });

    ipcMain.handle('password-window-close', (event) => {
        const mainWindow = getMainWindow();
        const senderWin = BrowserWindow.fromWebContents(event.sender);
        if (senderWin && senderWin !== mainWindow) {
            senderWin.close();
        }
    });

    ipcMain.handle('window-is-maximized', () => {
        const mainWindow = getMainWindow();
        return mainWindow ? mainWindow.isMaximized() : false;
    });

    ipcMain.handle('window-set-size', (event, size) => {
        const mainWindow = getMainWindow();
        try {
            if (mainWindow && size && typeof size.width !== 'undefined' && typeof size.height !== 'undefined') {
                const w = parseInt(size.width, 10);
                const h = parseInt(size.height, 10);
                if (!Number.isNaN(w) && !Number.isNaN(h)) {
                    mainWindow.setSize(w, h);
                    return true;
                }
            }
        } catch { }
        return false;
    });

    ipcMain.handle('window-get-size', () => {
        const mainWindow = getMainWindow();
        try {
            if (mainWindow) return mainWindow.getSize();
        } catch { }
        return [0, 0];
    });

    ipcMain.handle('window-set-bounds-animate', (event, size) => {
        const mainWindow = getMainWindow();
        try {
            if (mainWindow && size && typeof size.width !== 'undefined') {
                const bounds = mainWindow.getBounds();
                const newWidth = parseInt(size.width, 10);
                const newHeight = typeof size.height !== 'undefined' ? parseInt(size.height, 10) : bounds.height;
                if (!Number.isNaN(newWidth) && (typeof size.height === 'undefined' || !Number.isNaN(newHeight))) {
                    mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: newWidth, height: newHeight }, true);
                    return true;
                }
            }
        } catch { }
        return false;
    });

    ipcMain.handle('window-animate-resize', (event, { width, height, duration = 200 }) => {
        const mainWindow = getMainWindow();
        return new Promise((resolve) => {
            try {
                if (!mainWindow || typeof width === 'undefined' || typeof height === 'undefined') {
                    return resolve(false);
                }
                const wTarget = parseInt(width, 10);
                const hTarget = parseInt(height, 10);
                if (Number.isNaN(wTarget) || Number.isNaN(hTarget)) {
                    return resolve(false);
                }
                
                // Instant resize with content update
                const bounds = mainWindow.getBounds();
                
                // Set new size immediately without animation
                mainWindow.setSize(wTarget, hTarget, false);
                
                resolve(true);
            } catch {
                resolve(false);
            }
        });
    });
}

/**
 * Setup system info IPC handlers
 */
function setupSystemInfoHandlers() {
    ipcMain.handle('get-system-info', async () => {
        return {
            platform: os.platform(),
            release: os.release(),
            type: os.type(),
            arch: os.arch(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            cpus: os.cpus().map(c => ({ model: c.model, speed: c.speed })),
            hostname: os.hostname(),
            user: os.userInfo(),
            homedir: os.homedir()
        };
    });

    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });
}

/**
 * Setup OAuth and user profile IPC handlers
 * @param {Object} oauth - OAuth module
 * @param {Object} userProfile - User profile module
 * @param {Function} getMainWindow - Function to get main window
 */
function setupOAuthHandlers(oauth, userProfile, getMainWindow) {
    ipcMain.handle('login-google', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginGoogle(mainWindow);
        if (result) {
            userProfile.set(result);
        }
        return result;
    });

    ipcMain.handle('login-discord', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginDiscord(mainWindow);
        if (result) {
            userProfile.set(result);
        }
        return result;
    });

    ipcMain.handle('get-user-profile', async () => {
        return userProfile.get();
    });

    ipcMain.handle('logout', async () => {
        userProfile.clear();
        return { success: true };
    });
}

/**
 * Setup command and external process IPC handlers
 * @param {Object} security - Security module
 * @param {Object} processUtils - Process utilities module
 * @param {Object} fileUtils - File utilities module
 * @param {Object} systemTools - System tools module
 */
function setupCommandHandlers(security, processUtils, fileUtils, systemTools) {
    ipcMain.handle('run-command', async (event, command) => {
        if (typeof command !== 'string' || !command.trim()) {
            return { error: 'Invalid command' };
        }

        const allowedCommands = ['winget'];
        const parts = command.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        if (!allowedCommands.includes(cmd)) {
            return { error: `Command '${cmd}' is not allowed. Only winget is permitted.` };
        }

        const args = parts.slice(1);
        const argsValidation = security.validateCommandArgs(args);
        if (!argsValidation.valid) {
            return { error: argsValidation.error };
        }

        const allowedWingetSubcommands = ['install', 'upgrade', 'search', 'list', 'show', 'source', 'settings', 'uninstall'];
        const subcommand = args[0]?.toLowerCase();
        if (!subcommand || !allowedWingetSubcommands.includes(subcommand)) {
            return { error: `Winget subcommand '${subcommand || ''}' is not allowed. Allowed: ${allowedWingetSubcommands.join(', ')}` };
        }

        for (const arg of args) {
            if (arg.includes('..')) {
                return { error: 'Path traversal detected in command arguments' };
            }
        }

        return processUtils.runSpawnCommand(parts[0], args, { shell: true, windowsHide: false });
    });

    // Elevated winget command for enabling settings that require admin
    ipcMain.handle('run-elevated-winget', async (event, command) => {
        if (process.platform !== 'win32') {
            return { error: 'Elevated commands only supported on Windows' };
        }

        if (typeof command !== 'string' || !command.trim()) {
            return { error: 'Invalid command' };
        }

        // Only allow specific safe elevated commands
        const allowedElevatedCommands = [
            'winget settings --enable InstallerHashOverride'
        ];

        if (!allowedElevatedCommands.includes(command.trim())) {
            return { error: 'This elevated command is not allowed' };
        }

        const psScript = `
try {
    ${command}
    exit 0
} catch {
    exit 1
}
`;
        return processUtils.runElevatedPowerShellScriptHidden(
            psScript,
            'Setting enabled successfully',
            'Failed to enable setting'
        );
    });

    ipcMain.handle('run-christitus', async () => {
        return systemTools.runChrisTitus();
    });

    ipcMain.handle('open-external', async (event, url) => {
        if (typeof url !== 'string' || !url.trim()) {
            return { success: false, error: 'Invalid URL' };
        }

        try {
            const parsed = new URL(url);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                return { success: false, error: 'Only http/https URLs are allowed' };
            }
            await shell.openExternal(url);
            return { success: true };
        } catch (err) {
            return { success: false, error: 'Invalid URL format' };
        }
    });

    ipcMain.handle('open-file', async (event, filePath) => {
        return new Promise(async (resolve) => {
            try {
                if (typeof filePath !== 'string' || !filePath.trim()) {
                    return resolve({ success: false, error: 'Invalid file path' });
                }

                const expanded = fileUtils.expandEnvVars(filePath);
                const validation = security.validatePath(expanded);
                if (!validation.valid) {
                    return resolve({ success: false, error: validation.error });
                }

                const normalized = validation.normalized;

                if (!fs.existsSync(normalized)) {
                    return resolve({ success: false, error: 'File does not exist' });
                }

                if (process.platform === 'win32') {
                    shell.openPath(normalized)
                        .then((errStr) => {
                            if (errStr) {
                                resolve({ success: false, error: errStr });
                            } else {
                                resolve({ success: true });
                            }
                        })
                        .catch((err) => {
                            resolve({ success: false, error: err.message });
                        });
                } else {
                    const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
                    const child = spawn(cmd, [normalized], { detached: true, stdio: 'ignore' });
                    child.on('error', (err) => {
                        resolve({ success: false, error: err.message });
                    });
                    child.unref();
                    resolve({ success: true });
                }
            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    });

    ipcMain.handle('open-installer', async (event, filePath) => {
        if (typeof filePath !== 'string' || !filePath.trim()) {
            return { success: false, error: 'Invalid file path' };
        }

        const validation = security.validatePath(filePath);
        if (!validation.valid) {
            return { success: false, error: validation.error };
        }

        const downloadsDir = path.join(os.homedir(), 'Downloads').toLowerCase();
        const tempDir = os.tmpdir().toLowerCase();
        const normalizedPath = validation.normalized.toLowerCase();

        if (!normalizedPath.startsWith(downloadsDir) && !normalizedPath.startsWith(tempDir)) {
            return { success: false, error: 'Installers can only be run from Downloads or temp folder' };
        }

        await shell.openPath(validation.normalized);
        return { success: true };
    });

    ipcMain.handle('show-file-dialog', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Executables', extensions: ['exe'] }]
        });
        return result;
    });
}

/**
 * Setup download IPC handlers
 * @param {Object} downloadManager - Download manager module
 * @param {Function} getMainWindow - Function to get main window
 */
function setupDownloadHandlers(downloadManager, getMainWindow) {
    ipcMain.on('download-start', (event, { id, url, dest }) => {
        downloadManager.startDownload(id, url, dest, getMainWindow());
    });

    ipcMain.on('download-pause', (event, id) => {
        downloadManager.pauseDownload(id, getMainWindow());
    });

    ipcMain.on('download-resume', (event, id) => {
        downloadManager.resumeDownload(id, getMainWindow());
    });

    ipcMain.on('download-cancel', (event, id) => {
        downloadManager.cancelDownload(id, getMainWindow());
    });
}

/**
 * Setup file operation IPC handlers
 * @param {Object} security - Security module
 * @param {Object} fileUtils - File utilities module
 * @param {Object} debug - Debug function
 * @param {Set} pendingCleanupFiles - Set to track pending cleanup files
 */
function setupFileHandlers(security, fileUtils, debug, pendingCleanupFiles) {
    const { exec } = require('child_process');

    ipcMain.handle('get-asset-path', async (event, relativePath) => {
        const isDev = !app.isPackaged;
        let assetPath;
        if (isDev) {
            assetPath = path.join(__dirname, '..', 'assets', relativePath);
        } else {
            assetPath = path.join(process.resourcesPath, 'src', 'assets', relativePath);
        }
        const normalizedPath = assetPath.replace(/\\/g, '/');
        if (process.platform === 'win32' && normalizedPath.match(/^[A-Za-z]:/)) {
            return `file:///${normalizedPath}`;
        }
        return `file://${normalizedPath}`;
    });

    ipcMain.handle('file-exists', async (event, filePath) => {
        try {
            if (typeof filePath !== 'string' || !filePath.trim()) {
                return false;
            }

            const expanded = fileUtils.expandEnvVars(filePath);
            const validation = security.validatePath(expanded);
            if (!validation.valid) {
                return false;
            }

            return fs.existsSync(validation.normalized);
        } catch {
            return false;
        }
    });

    ipcMain.handle('delete-file', async (event, filePath) => {
        return new Promise(async (resolve) => {
            try {
                if (typeof filePath !== 'string' || filePath.trim() === '') {
                    return resolve({ success: false, error: 'Invalid file path' });
                }

                const expanded = fileUtils.expandEnvVars(filePath);
                const allowedDirs = [
                    os.tmpdir(),
                    path.join(os.homedir(), 'Downloads'),
                    os.homedir()
                ];

                const validation = security.validateDeletePath(expanded, allowedDirs);
                if (!validation.valid) {
                    return resolve({ success: false, error: validation.error, code: 'VALIDATION_FAILED' });
                }

                const normalizedPath = validation.normalized;

                try {
                    const stats = fs.statSync(normalizedPath);
                    if (stats.isDirectory()) {
                        return resolve({ success: false, error: 'Cannot delete directory. Use rename-directory for directories.', code: 'IS_DIRECTORY' });
                    }
                } catch (statErr) {
                    if (statErr.code === 'ENOENT') {
                        return resolve({ success: false, error: 'File does not exist', code: 'FILE_NOT_FOUND' });
                    }
                    return resolve({ success: false, error: `Cannot access file: ${statErr.message}`, code: 'ACCESS_ERROR' });
                }

                fs.unlink(normalizedPath, (err) => {
                    if (err) {
                        return resolve({ success: false, error: err.message, code: 'DELETE_FAILED' });
                    }
                    resolve({ success: true });
                });
            } catch (err) {
                resolve({ success: false, error: err.message, code: 'EXCEPTION' });
            }
        });
    });

    ipcMain.handle('rename-directory', async (event, { src, dest }) => {
        return new Promise(async (resolve) => {
            try {
                if (typeof src !== 'string' || typeof dest !== 'string' || !src || !dest) {
                    return resolve({ success: false, error: 'Invalid source or destination' });
                }

                const srcExpanded = fileUtils.expandEnvVars(src);
                const destExpanded = fileUtils.expandEnvVars(dest);

                const srcValidation = security.validatePath(srcExpanded);
                if (!srcValidation.valid) {
                    return resolve({ success: false, error: `Invalid source path: ${srcValidation.error}`, code: 'INVALID_SOURCE' });
                }

                const destValidation = security.validatePath(destExpanded);
                if (!destValidation.valid) {
                    return resolve({ success: false, error: `Invalid destination path: ${destValidation.error}`, code: 'INVALID_DEST' });
                }

                const srcNormalized = srcValidation.normalized;
                const destNormalized = destValidation.normalized;

                try {
                    const srcStats = fs.statSync(srcNormalized);
                    if (!srcStats.isDirectory()) {
                        return resolve({ success: false, error: 'Source is not a directory', code: 'NOT_DIRECTORY' });
                    }
                } catch (statErr) {
                    if (statErr.code === 'ENOENT') {
                        return resolve({ success: false, error: 'Source directory does not exist', code: 'SRC_NOT_FOUND' });
                    }
                    return resolve({ success: false, error: `Cannot access source: ${statErr.message}`, code: 'SRC_ACCESS_ERROR' });
                }

                try {
                    if (fs.existsSync(destNormalized)) {
                        const destStats = fs.statSync(destNormalized);
                        if (destStats.isDirectory()) {
                            fs.rmSync(destNormalized, { recursive: true, force: true });
                        } else {
                            return resolve({ success: false, error: 'Destination exists and is not a directory', code: 'DEST_EXISTS' });
                        }
                    }
                } catch (rmErr) {
                    debug('warn', 'Could not remove existing destination:', rmErr.message);
                }

                fs.rename(srcNormalized, destNormalized, (err) => {
                    if (err) {
                        return resolve({ success: false, error: err.message, code: 'RENAME_FAILED' });
                    }
                    resolve({ success: true });
                });
            } catch (err) {
                resolve({ success: false, error: err.message, code: 'EXCEPTION' });
            }
        });
    });

    ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
        return new Promise(async (resolve) => {
            try {
                const srcExpanded = fileUtils.expandEnvVars(sourcePath);
                const dstExpanded = fileUtils.expandEnvVars(destPath);

                const srcValidation = security.validatePath(srcExpanded);
                if (!srcValidation.valid) {
                    resolve({ success: false, error: srcValidation.error, code: 'INVALID_SOURCE_PATH' });
                    return;
                }

                const dstValidation = security.validatePath(dstExpanded);
                if (!dstValidation.valid) {
                    resolve({ success: false, error: dstValidation.error, code: 'INVALID_DEST_PATH' });
                    return;
                }

                const src = srcValidation.normalized;
                const dst = dstValidation.normalized;

                debug('info', 'Replacing executable with elevated privileges:');
                debug('info', 'Source:', src);
                debug('info', 'Destination:', dst);

                const srcExists = await security.validateFileExists(src);
                if (!srcExists.valid || !srcExists.exists) {
                    resolve({ success: false, error: `Source file not found: ${src}`, code: 'SRC_MISSING' });
                    return;
                }

                const dstExists = await security.validateFileExists(dst);
                if (!dstExists.valid || !dstExists.exists) {
                    resolve({ success: false, error: `Destination file not found: ${dst}`, code: 'DEST_MISSING' });
                    return;
                }

                const srcSanitized = security.sanitizePathForPowerShell(src);
                const dstSanitized = security.sanitizePathForPowerShell(dst);

                if (!srcSanitized.valid || !dstSanitized.valid) {
                    resolve({ success: false, error: 'Failed to sanitize paths for PowerShell', code: 'SANITIZATION_FAILED' });
                    return;
                }

                const configFile = path.join(os.tmpdir(), `replace_exe_config_${Date.now()}.json`);
                const config = {
                    sourcePath: src,
                    destPath: dst
                };
                fs.writeFileSync(configFile, JSON.stringify(config), 'utf8');

                const psScript = `
$configPath = '${configFile.replace(/\\/g, '\\\\')}'
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$sourcePath = $config.sourcePath
$destPath = $config.destPath

try {
    Write-Output "Starting file replacement..."
    Write-Output "Source: $sourcePath"
    Write-Output "Destination: $destPath"
   
    if (-not (Test-Path -LiteralPath $sourcePath)) {
        throw "Source file does not exist: $sourcePath"
    }
    
    if (-not (Test-Path -LiteralPath $destPath)) {
        throw "Destination file does not exist: $destPath"
    }
   
    Write-Output "Taking ownership..."
    & takeown /f $destPath /r /d y 2>&1 | Out-Null
   
    $username = $env:USERNAME
    & icacls $destPath /grant "\${username}:F" /T /C 2>&1 | Out-Null
   
    if (Test-Path -LiteralPath $destPath) {
        Write-Output "Removing existing file..."
        Remove-Item -LiteralPath $destPath -Force -ErrorAction Stop
    }
   
    Write-Output "Copying new file..."
    Copy-Item -LiteralPath $sourcePath -Destination $destPath -Force -ErrorAction Stop
   
    if (Test-Path -LiteralPath $destPath) {
        Write-Output "SUCCESS: File replacement completed"
        Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
        exit 0
    } else {
        throw "File replacement failed - destination file not found"
    }
}
catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    Remove-Item -LiteralPath $configPath -Force -ErrorAction SilentlyContinue
    exit 1
}
`;

                const psFile = path.join(os.tmpdir(), `elevated_ps_${Date.now()}.ps1`);
                fs.writeFileSync(psFile, psScript, 'utf8');

                const escapedPsFile = psFile.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File ""${escapedPsFile}""", "", "runas", 1
WScript.Sleep(3000)
`;
                const vbsFile = path.join(os.tmpdir(), `elevate_${Date.now()}.vbs`);
                fs.writeFileSync(vbsFile, vbsScript);

                pendingCleanupFiles.add(vbsFile);
                pendingCleanupFiles.add(psFile);
                pendingCleanupFiles.add(configFile);

                debug('info', 'Requesting UAC elevation for file replacement...');

                exec(`wscript "${vbsFile}"`, (error) => {
                    const cleanupTempFiles = () => {
                        [vbsFile, psFile, configFile].forEach(f => {
                            try {
                                if (fs.existsSync(f)) fs.unlinkSync(f);
                                pendingCleanupFiles.delete(f);
                            } catch { }
                        });
                    };

                    setTimeout(cleanupTempFiles, 10000);

                    if (error) {
                        debug('warn', 'User denied UAC or elevation failed:', error);
                        resolve({
                            success: false,
                            error: 'Administrator privileges required. Please accept the UAC prompt.',
                            code: 'UAC_DENIED'
                        });
                    } else {
                        debug('success', 'UAC accepted, replacement in progress...');
                        let waited = 0;
                        const interval = setInterval(() => {
                            waited += 1000;
                            if (fs.existsSync(dst)) {
                                clearInterval(interval);
                                resolve({ success: true, message: '✅ File replacement completed successfully!' });
                            } else if (waited >= 15000) {
                                clearInterval(interval);
                                resolve({ success: false, error: 'Replacement may have failed. The destination file was not found.' });
                            }
                        }, 1000);
                    }
                });
            } catch (err) {
                debug('error', 'Replace exception:', err);
                resolve({ success: false, error: `Exception: ${err.message}` });
            }
        });
    });
}

/**
 * Setup archive extraction IPC handlers
 * @param {Object} archiveUtils - Archive utilities module
 * @param {Object} downloadManager - Download manager module
 */
function setupArchiveHandlers(archiveUtils, downloadManager) {
    ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
        return archiveUtils.extractArchive(filePath, password, destDir, downloadManager.trackExtractedDir);
    });
}

/**
 * Setup Sparkle IPC handlers
 * @param {Object} sparkleModule - Sparkle module
 */
function setupSparkleHandlers(sparkleModule) {
    ipcMain.handle('ensure-sparkle', async () => {
        return sparkleModule.ensureSparkle();
    });
    
    ipcMain.handle('process-downloaded-sparkle', async (event, zipPath) => {
        return sparkleModule.processDownloadedSparkle(zipPath);
    });
}

/**
 * Setup system tools IPC handlers
 * @param {Object} systemTools - System tools module
 */
function setupSystemToolsHandlers(systemTools) {
    ipcMain.handle('run-sparkle-debloat', async () => {
        return systemTools.runSparkleDebloat();
    });

    ipcMain.handle('run-sfc-scan', async () => {
        return systemTools.runSfcScan();
    });

    ipcMain.handle('run-dism-repair', async () => {
        return systemTools.runDismRepair();
    });

    ipcMain.handle('run-temp-cleanup', async () => {
        return systemTools.runTempCleanup();
    });

    ipcMain.handle('restart-to-bios', async () => {
        return systemTools.restartToBios();
    });
}

/**
 * Setup Spicetify IPC handlers
 * @param {Object} spicetifyModule - Spicetify module
 */
function setupSpicetifyHandlers(spicetifyModule) {
    ipcMain.handle('install-spicetify', async () => {
        return spicetifyModule.installSpicetify();
    });

    ipcMain.handle('uninstall-spicetify', async () => {
        return spicetifyModule.uninstallSpicetify();
    });

    ipcMain.handle('full-uninstall-spotify', async () => {
        return spicetifyModule.fullUninstallSpotify();
    });
}

/**
 * Setup installer IPC handlers
 * @param {Object} debug - Debug function
 */
function setupInstallerHandlers(debug) {
    ipcMain.handle('find-exe-files', async (event, directoryPath) => {
        return new Promise((resolve) => {
            try {
                if (!fs.existsSync(directoryPath)) {
                    resolve([]);
                    return;
                }

                const executableFiles = [];

                function searchDirectory(dir) {
                    try {
                        const items = fs.readdirSync(dir);
                        for (const item of items) {
                            const fullPath = path.join(dir, item);
                            try {
                                const stat = fs.statSync(fullPath);
                                if (stat.isDirectory()) {
                                    searchDirectory(fullPath);
                                } else if (stat.isFile()) {
                                    const ext = path.extname(item).toLowerCase();
                                    if (ext === '.exe' || ext === '.bat') {
                                        executableFiles.push(fullPath);
                                    }
                                }
                            } catch (statErr) {
                                debug('warn', `Cannot access ${fullPath}: ${statErr.code || statErr.message}`);
                                continue;
                            }
                        }
                    } catch (readErr) {
                        debug('warn', `Cannot read directory ${dir}: ${readErr.code || readErr.message}`);
                    }
                }

                searchDirectory(directoryPath);
                resolve(executableFiles);
            } catch {
                resolve([]);
            }
        });
    });

    ipcMain.handle('run-msi-installer', async (event, msiPath) => {
        return new Promise((resolve) => {
            if (process.platform !== 'win32') {
                resolve({ success: false, error: 'MSI installers are only supported on Windows' });
                return;
            }

            const normalized = path.normalize(msiPath);

            try {
                const child = spawn('msiexec', ['/i', normalized], { detached: true, stdio: 'ignore' });
                child.on('error', (spawnErr) => {
                    resolve({ success: false, error: spawnErr.message });
                });
                child.unref();
                resolve({ success: true });
            } catch (err) {
                resolve({ success: false, error: err.message });
            }
        });
    });

    ipcMain.handle('run-installer', async (event, filePath) => {
        return new Promise((resolve) => {
            debug('info', 'Running installer:', filePath);
            const normalized = path.normalize(filePath);
            const ext = path.extname(normalized).toLowerCase();

            try {
                if (!fs.existsSync(normalized)) {
                    return resolve({ success: false, error: `File does not exist: ${normalized}` });
                }
            } catch (fsErr) {
                return resolve({ success: false, error: fsErr.message });
            }

            if (process.platform === 'win32') {
                if (ext === '.msi') {
                    try {
                        const child = spawn('msiexec', ['/i', normalized], { detached: true, stdio: 'ignore' });
                        child.on('error', (spawnErr) => {
                            resolve({ success: false, error: spawnErr.message });
                        });
                        child.unref();
                        return resolve({ success: true });
                    } catch (spawnErr) {
                        return resolve({ success: false, error: spawnErr.message });
                    }
                }

                shell.openPath(normalized)
                    .then((errStr) => {
                        if (!errStr) {
                            resolve({ success: true });
                        } else {
                            debug('warn', 'shell.openPath failed:', errStr);
                            resolve({ success: false, error: errStr });
                        }
                    })
                    .catch((err) => {
                        resolve({ success: false, error: err.message });
                    });
            } else {
                shell.openPath(normalized)
                    .then((errStr) => {
                        if (!errStr) {
                            resolve({ success: true });
                        } else {
                            resolve({ success: false, error: errStr });
                        }
                    })
                    .catch((err) => {
                        resolve({ success: false, error: err.message });
                    });
            }
        });
    });
}

/**
 * Setup password manager IPC handlers
 * @param {Function} createPasswordManagerWindow - Function to create password manager window
 * @param {Object} pmAuth - Password manager auth module
 * @param {Function} getPasswordDB - Function to get password DB instance
 * @param {string} pmDirectory - Password manager directory
 * @param {Object} debug - Debug function
 */
function setupPasswordManagerHandlers(createPasswordManagerWindow, pmAuth, getPasswordDB, pmDirectory, debug) {
    ipcMain.handle('open-password-manager', async (_event, lang = 'en') => {
        createPasswordManagerWindow(lang);
        return { success: true };
    });

    ipcMain.handle('password-manager-has-master-password', async () => {
        try {
            debug('info', 'Checking for master password...');
            if (!pmAuth.configPath) {
                debug('info', 'Auth manager not initialized, initializing now...');
                pmAuth.initialize(pmDirectory);
            }
            const result = pmAuth.hasMasterPassword();
            debug('info', 'Master password exists:', result);
            return result;
        } catch (error) {
            debug('error', 'Error checking master password:', error);
            return false;
        }
    });

    ipcMain.handle('password-manager-create-master-password', async (event, password) => {
        try {
            debug('info', 'Creating master password...');
            if (!pmAuth.configPath) {
                pmAuth.initialize(pmDirectory);
            }
            await pmAuth.createMasterPassword(password);
            return { success: true };
        } catch (error) {
            debug('error', 'Error creating master password:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('password-manager-authenticate', async (event, password) => {
        try {
            debug('info', 'Authenticating...');
            if (!pmAuth.configPath) {
                pmAuth.initialize(pmDirectory);
            }
            await pmAuth.authenticate(password);
            return { success: true };
        } catch (error) {
            debug('error', 'Error authenticating:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('password-manager-logout', async () => {
        pmAuth.logout();
        return { success: true };
    });

    ipcMain.handle('password-manager-change-password', async (event, currentPassword, newPassword) => {
        try {
            await pmAuth.changeMasterPassword(currentPassword, newPassword);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('password-manager-validate-password', async (event, password) => {
        const result = pmAuth.validatePasswordStrength(password);
        return result;
    });

    ipcMain.handle('password-manager-get-categories', async () => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, 10000);

            db.getCategories((err, rows) => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
                if (err) {
                    debug('error', 'Error getting categories:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, categories: rows || [] });
                }
            });
        });
    });

    ipcMain.handle('password-manager-add-category', async (event, name) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.addCategory(name, function (err) {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, id: this.lastID });
                }
            });
        });
    });

    ipcMain.handle('password-manager-update-category', async (event, id, name) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.updateCategory(id, name, function (err) {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, changes: this.changes });
                }
            });
        });
    });

    ipcMain.handle('password-manager-delete-category', async (event, id) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.deleteCategory(id, function (err) {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, changes: this.changes });
                }
            });
        });
    });

    ipcMain.handle('password-manager-get-passwords', async (event, categoryId = 'all') => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, 10000);

            db.getPasswordsByCategory(categoryId, (err, rows) => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
                if (err) {
                    debug('error', 'Error getting passwords:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, passwords: rows || [] });
                }
            });
        });
    });

    ipcMain.handle('password-manager-get-password', async (event, id) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.getPasswordById(id, (err, row) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, password: row });
                }
            });
        });
    });

    ipcMain.handle('password-manager-add-password', async (event, passwordData) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, 10000);

            db.addPassword(passwordData, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
                if (err) {
                    debug('error', 'Error adding password:', err);
                    resolve({ success: false, error: err.message });
                } else {
                    debug('success', 'Password added successfully, ID:', this.lastID);
                    resolve({ success: true, id: this.lastID });
                }
            });
        });
    });

    ipcMain.handle('password-manager-update-password', async (event, id, passwordData) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.updatePassword(id, passwordData, function (err) {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, changes: this.changes });
                }
            });
        });
    });

    ipcMain.handle('password-manager-delete-password', async (event, id) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.deletePassword(id, function (err) {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, changes: this.changes });
                }
            });
        });
    });

    ipcMain.handle('password-manager-search-passwords', async (event, query) => {
        return new Promise((resolve) => {
            const db = getPasswordDB();
            db.searchPasswords(query, (err, rows) => {
                if (err) {
                    resolve({ success: false, error: err.message });
                } else {
                    resolve({ success: true, passwords: rows });
                }
            });
        });
    });

    ipcMain.handle('password-manager-reset', async () => {
        try {
            // Close and reset singleton DB
            const db = getPasswordDB();
            if (db) {
                try { db.close(); } catch { }
            }

            if (fs.existsSync(pmAuth.configPath)) {
                fs.unlinkSync(pmAuth.configPath);
            }
            const dbPath = path.join(pmAuth.dbDirectory, 'password_manager.db');
            if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
            }
            pmAuth.logout();
            pmAuth.initialize(pmDirectory);
            return { success: true };
        } catch (error) {
            debug('error', 'Error resetting password manager:', error);
            return { success: false, error: error.message };
        }
    });
}

/**
 * Setup misc IPC handlers
 */
function setupMiscHandlers() {
    ipcMain.handle('run-activate-script', async () => {
        return { success: true, message: 'Activation script completed' };
    });

    ipcMain.handle('run-autologin-script', async () => {
        return { success: true, message: 'Autologin script completed' };
    });
}

module.exports = {
    setupWindowHandlers,
    setupSystemInfoHandlers,
    setupOAuthHandlers,
    setupCommandHandlers,
    setupDownloadHandlers,
    setupFileHandlers,
    setupArchiveHandlers,
    setupSparkleHandlers,
    setupSystemToolsHandlers,
    setupSpicetifyHandlers,
    setupInstallerHandlers,
    setupPasswordManagerHandlers,
    setupMiscHandlers
};
