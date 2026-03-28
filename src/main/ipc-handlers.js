/**
 * IPC Handlers Module
 * Handles all Inter-Process Communication between main and renderer
 */

const { ipcMain, shell, dialog, BrowserWindow, app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

const DB_TIMEOUT_MS = 10000;

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

    ipcMain.handle('window-animate-resize', (event, { width, height }) => {
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
                mainWindow.setSize(wTarget, hTarget, false);
                resolve(true);
            } catch {
                resolve(false);
            }
        });
    });
}

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

function setupOAuthHandlers(oauth, userProfile, getMainWindow) {
    ipcMain.handle('login-google', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginGoogle(mainWindow);
        if (result) userProfile.set(result);
        return result;
    });

    ipcMain.handle('login-discord', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginDiscord(mainWindow);
        if (result) userProfile.set(result);
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

        const allowedWingetSubcommands = ['install', 'upgrade', 'search', 'list', 'show', 'source', 'settings', 'uninstall', '--version'];
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

    ipcMain.handle('run-elevated-winget', async (event, command) => {
        if (process.platform !== 'win32') {
            return { error: 'Elevated commands only supported on Windows' };
        }

        if (typeof command !== 'string' || !command.trim()) {
            return { error: 'Invalid command' };
        }

        const allowedElevatedCommands = [
            'winget settings --enable InstallerHashOverride'
        ];

        if (!allowedElevatedCommands.includes(command.trim())) {
            return { error: 'This elevated command is not allowed' };
        }

        const psScript = '\ntry {\n    ' + command + '\n    exit 0\n} catch {\n    exit 1\n}\n';
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
            const allowedProtocols = ['http:', 'https:', 'ms-windows-store:'];
            if (!allowedProtocols.includes(parsed.protocol)) {
                return { success: false, error: 'URL protocol not allowed' };
            }
            await shell.openExternal(url);
            return { success: true };
        } catch (err) {
            return { success: false, error: 'Invalid URL format' };
        }
    });

    ipcMain.handle('open-file', async (event, filePath) => {
        return new Promise((resolve) => {
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

        const errStr = await shell.openPath(validation.normalized);
        if (errStr) {
            return { success: false, error: errStr };
        }
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

function setupDownloadHandlers(downloadManager, getMainWindow) {
    ipcMain.on('download-start', (event, { id, url, dest }) => {
        const win = getMainWindow();
        if (!win) return;
        downloadManager.startDownload(id, url, dest, win);
    });

    ipcMain.on('download-pause', (event, id) => {
        const win = getMainWindow();
        if (!win) return;
        downloadManager.pauseDownload(id, win);
    });

    ipcMain.on('download-resume', (event, id) => {
        const win = getMainWindow();
        if (!win) return;
        downloadManager.resumeDownload(id, win);
    });

    ipcMain.on('download-cancel', (event, id) => {
        const win = getMainWindow();
        if (!win) return;
        downloadManager.cancelDownload(id, win);
    });
}

function setupFileHandlers(security, fileUtils, debug, pendingCleanupFiles) {
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
            return 'file:///' + normalizedPath;
        }
        return 'file://' + normalizedPath;
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
        return new Promise((resolve) => {
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
                    return resolve({ success: false, error: 'Cannot access file: ' + statErr.message, code: 'ACCESS_ERROR' });
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
        return new Promise((resolve) => {
            try {
                if (typeof src !== 'string' || typeof dest !== 'string' || !src || !dest) {
                    return resolve({ success: false, error: 'Invalid source or destination' });
                }

                const srcExpanded = fileUtils.expandEnvVars(src);
                const destExpanded = fileUtils.expandEnvVars(dest);

                const srcValidation = security.validatePath(srcExpanded);
                if (!srcValidation.valid) {
                    return resolve({ success: false, error: 'Invalid source path: ' + srcValidation.error, code: 'INVALID_SOURCE' });
                }

                const destValidation = security.validatePath(destExpanded);
                if (!destValidation.valid) {
                    return resolve({ success: false, error: 'Invalid destination path: ' + destValidation.error, code: 'INVALID_DEST' });
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
                    return resolve({ success: false, error: 'Cannot access source: ' + statErr.message, code: 'SRC_ACCESS_ERROR' });
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

    // ─── replace-exe ────────────────────────────────────────────────────────────
    // Strategy:
    //   1. Write src/dst to a JSON config file  → no path quoting in PS scripts
    //   2. Write elevated.ps1                   → does the actual file replacement
    //   3. Write launcher.ps1                   → calls elevated.ps1 via Start-Process -Verb RunAs -Wait
    //   4. spawn('powershell', ['-File', launcher.ps1])  → no shell string quoting at all
    //   5. Resolve when proc closes (code 0 = success)
    //
    // Fixes vs old approach:
    //   • No exec() string with nested quotes
    //   • No JS template literal substitution inside PS variable names (${username} bug)
    //   • No VBScript (.vbs disabled on Win11 24H2+)
    //   • No broken polling (dst already existed before replacement)
    // ────────────────────────────────────────────────────────────────────────────
ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
    return new Promise(async (resolve) => {
            try {
                const srcExpanded = fileUtils.expandEnvVars(sourcePath);
                const dstExpanded = fileUtils.expandEnvVars(destPath);

                const srcValidation = security.validatePath(srcExpanded);
                if (!srcValidation.valid) {
                    return resolve({ success: false, error: srcValidation.error, code: 'INVALID_SOURCE_PATH' });
                }
                const dstValidation = security.validatePath(dstExpanded);
                if (!dstValidation.valid) {
                    return resolve({ success: false, error: dstValidation.error, code: 'INVALID_DEST_PATH' });
                }

                const src = srcValidation.normalized;
                const dst = dstValidation.normalized;

                debug('info', 'replace-exe src:', src);
                debug('info', 'replace-exe dst:', dst);

                const srcExists = await security.validateFileExists(src);
                if (!srcExists.valid || !srcExists.exists) {
                    return resolve({ success: false, error: 'Source file not found: ' + src, code: 'SRC_MISSING' });
                }
                const dstExists = await security.validateFileExists(dst);
                if (!dstExists.valid || !dstExists.exists) {
                    return resolve({ success: false, error: 'Destination file not found: ' + dst, code: 'DEST_MISSING' });
                }

                const stamp = Date.now();
                const tmpDir = os.tmpdir();

                // 1. JSON config — paths go in here, not in PS script strings
                const configFile = path.join(tmpDir, 'replace_cfg_' + stamp + '.json');
                fs.writeFileSync(configFile, JSON.stringify({ src, dst }), 'utf8');

                // PS single-quote-safe version of configFile path
                const cfgPS = configFile.replace(/'/g, "''");

                // 2. Elevated PS1 — reads from JSON, no JS-interpolated PS variables
                //    Use $($env:USERNAME) for the current user — avoids ${...} entirely
                const psLines = [
                    "$cfg = Get-Content -LiteralPath '" + cfgPS + "' -Raw | ConvertFrom-Json",
                    '$src = $cfg.src',
                    '$dst = $cfg.dst',
                    'try {',
                    '    if (-not (Test-Path -LiteralPath $src)) { throw "Source not found: $src" }',
                    '    if (-not (Test-Path -LiteralPath $dst)) { throw "Destination not found: $dst" }',
                    '    takeown /f "$dst" /d y 2>&1 | Out-Null',
                    '    icacls "$dst" /grant "$($env:USERNAME):F" /T /C 2>&1 | Out-Null',
                    '    Remove-Item -LiteralPath $dst -Force -ErrorAction Stop',
                    '    Copy-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop',
                    "    Remove-Item -LiteralPath '" + cfgPS + "' -Force -ErrorAction SilentlyContinue",
                    '    exit 0',
                    '} catch {',
                    '    Write-Output "ERROR: $($_.Exception.Message)"',
                    "    Remove-Item -LiteralPath '" + cfgPS + "' -Force -ErrorAction SilentlyContinue",
                    '    exit 1',
                    '}'
                ];
                const psFile = path.join(tmpDir, 'replace_ps_' + stamp + '.ps1');
                fs.writeFileSync(psFile, psLines.join('\r\n'), 'utf8');

                // 3. Launcher PS1 — calls elevated PS1 via Start-Process -Verb RunAs -Wait
                //    Uses -ArgumentList with array syntax to avoid quoting issues with spaces in path
                const psFilePS = psFile.replace(/'/g, "''");
                const launcherLines = [
                    // Use $proc to capture the elevated process, then forward its exit code
                    "$proc = Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', '" + psFilePS + "') -Verb RunAs -Wait -PassThru",
                    "exit $proc.ExitCode"
                ];
                const launcherFile = path.join(tmpDir, 'replace_launcher_' + stamp + '.ps1');
                fs.writeFileSync(launcherFile, launcherLines.join('\r\n'), 'utf8');

                pendingCleanupFiles.add(psFile);
                pendingCleanupFiles.add(launcherFile);
                pendingCleanupFiles.add(configFile);

                const cleanup = () => {
                    [psFile, launcherFile, configFile].forEach(f => {
                        try {
                            if (fs.existsSync(f)) fs.unlinkSync(f);
                            pendingCleanupFiles.delete(f);
                        } catch { }
                    });
                };

                debug('info', 'Spawning launcher PS1 for UAC elevation...');

                // 4. spawn with arg array — zero shell quoting needed
                const proc = spawn('powershell.exe', [
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-File', launcherFile
                ], { windowsHide: false });

                proc.on('error', (err) => {
                    cleanup();
                    debug('error', 'Spawn error:', err.message);
                    resolve({ success: false, error: 'Failed to start PowerShell: ' + err.message });
                });

                // 5. Resolve when proc closes — no polling, no race conditions
                proc.on('close', (code) => {
                    cleanup();
                    debug('info', 'Launcher exited with code:', code);
                    if (code === 0) {
                        if (fs.existsSync(dst)) {
                            resolve({ success: true });
                        } else {
                            resolve({ success: false, error: 'PowerShell exited OK but destination file not found.' });
                        }
                    } else {
                        resolve({
                            success: false,
                            error: code === null
                                ? 'UAC was cancelled or the process was killed.'
                                : 'UAC was denied or replacement failed (exit code ' + code + ').',
                            code: 'UAC_DENIED'
                        });
                    }
                });

            } catch (err) {
                debug('error', 'replace-exe exception:', err);
                resolve({ success: false, error: 'Exception: ' + err.message });
            }
        });
    });
}

function setupArchiveHandlers(archiveUtils, downloadManager) {
    ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
        try {
            return await archiveUtils.extractArchive(filePath, password, destDir, downloadManager.trackExtractedDir);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

function setupSparkleHandlers(sparkleModule) {
    ipcMain.handle('ensure-sparkle', async () => {
        try {
            return await sparkleModule.ensureSparkle();
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('process-downloaded-sparkle', async (event, zipPath) => {
        try {
            return await sparkleModule.processDownloadedSparkle(zipPath);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

function setupSystemToolsHandlers(systemTools) {
    const safeWrap = (fn) => async () => {
        try { return await fn(); } catch (error) { return { success: false, error: error.message }; }
    };

    ipcMain.handle('run-sparkle-debloat', safeWrap(() => systemTools.runSparkleDebloat()));
    ipcMain.handle('run-sfc-scan', safeWrap(() => systemTools.runSfcScan()));
    ipcMain.handle('run-dism-repair', safeWrap(() => systemTools.runDismRepair()));
    ipcMain.handle('run-temp-cleanup', safeWrap(() => systemTools.runTempCleanup()));
    ipcMain.handle('restart-to-bios', safeWrap(() => systemTools.restartToBios()));
}

function setupSpicetifyHandlers(spicetifyModule) {
    ipcMain.handle('install-spicetify', async () => {
        try { return await spicetifyModule.installSpicetify(); } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('uninstall-spicetify', async () => {
        try { return await spicetifyModule.uninstallSpicetify(); } catch (error) { return { success: false, error: error.message }; }
    });

    ipcMain.handle('full-uninstall-spotify', async () => {
        try { return await spicetifyModule.fullUninstallSpotify(); } catch (error) { return { success: false, error: error.message }; }
    });
}

function setupInstallerHandlers(debug, security) {
    ipcMain.handle('find-exe-files', async (event, directoryPath) => {
        return new Promise((resolve) => {
            try {
                if (!fs.existsSync(directoryPath)) {
                    resolve([]);
                    return;
                }

                const executableFiles = [];

                const MAX_DEPTH = 10;
                const MAX_FILES = 500;

                function searchDirectory(dir, depth = 0) {
                    if (depth > MAX_DEPTH || executableFiles.length >= MAX_FILES) return;
                    try {
                        const items = fs.readdirSync(dir);
                        for (const item of items) {
                            if (executableFiles.length >= MAX_FILES) break;
                            const fullPath = path.join(dir, item);
                            try {
                                const stat = fs.lstatSync(fullPath);
                                // Skip symlinks to avoid circular references
                                if (stat.isSymbolicLink()) continue;
                                if (stat.isDirectory()) {
                                    searchDirectory(fullPath, depth + 1);
                                } else if (stat.isFile()) {
                                    const ext = path.extname(item).toLowerCase();
                                    if (ext === '.exe' || ext === '.bat') {
                                        executableFiles.push(fullPath);
                                    }
                                }
                            } catch (statErr) {
                                debug('warn', 'Cannot access ' + fullPath + ': ' + (statErr.code || statErr.message));
                                continue;
                            }
                        }
                    } catch (readErr) {
                        debug('warn', 'Cannot read directory ' + dir + ': ' + (readErr.code || readErr.message));
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

            const validation = security.validatePath(msiPath);
            if (!validation.valid) {
                resolve({ success: false, error: validation.error });
                return;
            }
            const normalized = validation.normalized;

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
            const validation = security.validatePath(filePath);
            if (!validation.valid) {
                return resolve({ success: false, error: validation.error });
            }
            const normalized = validation.normalized;
            const ext = path.extname(normalized).toLowerCase();

            try {
                if (!fs.existsSync(normalized)) {
                    return resolve({ success: false, error: 'File does not exist: ' + normalized });
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);

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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.addCategory(name, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.updateCategory(id, name, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.deleteCategory(id, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);

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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.getPasswordById(id, (err, row) => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);

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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.updatePassword(id, passwordData, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.deletePassword(id, function (err) {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            if (!db) return resolve({ success: false, error: 'Database unavailable' });
            let finished = false;
            const timeout = setTimeout(() => {
                if (finished) return;
                finished = true;
                resolve({ success: false, error: 'Database timeout' });
            }, DB_TIMEOUT_MS);
            db.searchPasswords(query, (err, rows) => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
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
            const db = getPasswordDB();
            if (db) {
                try { db.close(); } catch { }
            }

            if (pmAuth.configPath && fs.existsSync(pmAuth.configPath)) {
                fs.unlinkSync(pmAuth.configPath);
            }
            if (pmAuth.dbDirectory) {
                const dbPath = path.join(pmAuth.dbDirectory, 'password_manager.db');
                if (fs.existsSync(dbPath)) {
                    fs.unlinkSync(dbPath);
                }
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
