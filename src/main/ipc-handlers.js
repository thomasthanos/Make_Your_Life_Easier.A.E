/**
 * IPC Handlers Module
 * Handles all Inter-Process Communication between main and renderer
 */

const { ipcMain, shell, dialog, app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

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
}

function setupSystemInfoHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });
}

function setupOAuthHandlers(oauth, userProfile, getMainWindow, supabase, settingsStore) {
    ipcMain.handle('login-google', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginGoogle(mainWindow);
        if (result) {
            userProfile.set(result);
            await settingsStore.pullFromCloud().catch(() => {});
        }
        return result;
    });

    ipcMain.handle('login-discord', async () => {
        const mainWindow = getMainWindow();
        const result = await oauth.loginDiscord(mainWindow);
        if (result) {
            userProfile.set(result);
            await settingsStore.pullFromCloud().catch(() => {});
        }
        return result;
    });

    ipcMain.handle('get-user-profile', async () => {
        return userProfile.get();
    });

    ipcMain.handle('logout', async () => {
        await supabase.signOut();
        userProfile.clear();
        return { success: true };
    });
}

function setupSettingsHandlers(settingsStore) {
    ipcMain.handle('settings-get', async (event, key) => {
        return settingsStore.get(key);
    });

    ipcMain.handle('settings-set', async (event, payload) => {
        if (!payload || typeof payload.key !== 'string') {
            return { success: false, error: 'Invalid settings key' };
        }
        settingsStore.set(payload.key, payload.value);
        return { success: true };
    });

    ipcMain.handle('settings-all', async () => {
        return settingsStore.all();
    });

    ipcMain.handle('settings-reset', async () => {
        settingsStore.clearAll();
        return { success: true };
    });
}

function splitCommandLine(command) {
    const parts = [];
    const re = /"([^"]*)"|(\S+)/g;
    let match;
    while ((match = re.exec(command)) !== null) {
        parts.push(match[1] !== undefined ? match[1] : match[2]);
    }
    return parts;
}

function setupCommandHandlers(security, processUtils, fileUtils, systemTools) {
    ipcMain.handle('run-command', async (event, command) => {
        if (typeof command !== 'string' || !command.trim()) {
            return { success: false, error: 'Invalid command' };
        }

        const allowedCommands = ['winget'];
        const parts = splitCommandLine(command.trim());
        const cmd = parts[0].toLowerCase();

        if (!allowedCommands.includes(cmd)) {
            return { success: false, error: `Command '${cmd}' is not allowed. Only winget is permitted.` };
        }

        const args = parts.slice(1);
        const argsValidation = security.validateCommandArgs(args);
        if (!argsValidation.valid) {
            return { success: false, error: argsValidation.error };
        }

        const allowedWingetSubcommands = ['install', 'upgrade', 'search', 'list', 'show', 'source', 'settings', 'uninstall', '--version'];
        const subcommand = args[0]?.toLowerCase();
        if (!subcommand || !allowedWingetSubcommands.includes(subcommand)) {
            return { success: false, error: `Winget subcommand '${subcommand || ''}' is not allowed. Allowed: ${allowedWingetSubcommands.join(', ')}` };
        }

        for (const arg of args) {
            if (arg.includes('..')) {
                return { success: false, error: 'Path traversal detected in command arguments' };
            }
        }

        return processUtils.runSpawnCommand(parts[0], args, { shell: false, windowsHide: true });
    });

    let wingetUpgradeChild = null;
    let wingetUpgradeCancelled = false;

    // Probe winget presence + version. Returns { installed, version } where
    // version is a { major, minor } object (null if it could not be parsed).
    async function probeWinget() {
        try {
            const result = await processUtils.runSpawnCommand('winget', ['--version'], { shell: false, windowsHide: true });
            const combined = ((result.stdout || '') + (result.stderr || '') + (result.error || '')).toLowerCase();
            const notFound =
                combined.includes('is not recognized') ||
                combined.includes('was not found') ||
                combined.includes('cannot find') ||
                combined.includes('no such file') ||
                combined.includes('command not found') ||
                combined.includes('enoent');
            if (notFound) return { installed: false, version: null };

            const match = (result.stdout || '').match(/v?(\d+)\.(\d+)/);
            const version = match ? { major: Number(match[1]), minor: Number(match[2]) } : null;
            return { installed: true, version };
        } catch {
            return { installed: false, version: null };
        }
    }

    ipcMain.handle('winget-upgrade-check', async () => probeWinget());

    ipcMain.handle('winget-upgrade-all', async (event) => {
        if (wingetUpgradeChild) {
            return { success: false, error: 'An upgrade is already running.' };
        }

        const { installed, version } = await probeWinget();
        if (!installed) {
            return { success: false, notInstalled: true };
        }

        // --include-unknown / --disable-interactivity require winget 1.4+.
        // Older builds reject them, so only add them when supported.
        const supportsModernFlags = version && (version.major > 1 || (version.major === 1 && version.minor >= 4));
        const args = ['upgrade', '--all', '--accept-source-agreements', '--accept-package-agreements'];
        if (supportsModernFlags) {
            args.push('--include-unknown', '--disable-interactivity');
        }

        wingetUpgradeCancelled = false;
        const { child, done } = processUtils.runStreamingCommand('winget', args, { shell: false, windowsHide: true }, (stream, text) => {
            try {
                if (!event.sender.isDestroyed()) {
                    event.sender.send('winget-upgrade-output', { stream, text });
                }
            } catch { }
        });

        wingetUpgradeChild = child;
        try {
            const result = await done;
            if (wingetUpgradeCancelled) return { success: false, cancelled: true };

            // winget `upgrade --all` exits non-zero when ANY single package fails or
            // is blocked, even if the rest upgraded fine. Treat the known
            // "some upgrades failed" code (0x8A15002C) as a partial success so the
            // UI doesn't report the whole run as a hard failure.
            const WINGET_UPDATE_ALL_HAS_FAILURE = 0x8A15002C; // 2316632108
            if (!result.success && result.code === WINGET_UPDATE_ALL_HAS_FAILURE) {
                return { success: true, partial: true, code: result.code };
            }
            return result;
        } finally {
            wingetUpgradeChild = null;
        }
    });

    ipcMain.handle('winget-upgrade-cancel', async () => {
        if (!wingetUpgradeChild) {
            return { success: false, error: 'No upgrade in progress.' };
        }
        try {
            wingetUpgradeCancelled = true;
            wingetUpgradeChild.kill();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    let chrisTitusTask = null;
    let chrisTitusCancelled = false;

    ipcMain.handle('run-christitus', async (event) => {
        if (chrisTitusTask) {
            return { success: false, error: 'The utility is already running.' };
        }

        chrisTitusCancelled = false;
        try {
            const task = systemTools.runChrisTitus((stream, text) => {
                try {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('christitus-output', { stream, text });
                    }
                } catch { }
            });

            chrisTitusTask = task;
            try {
                const result = await task.done;
                if (chrisTitusCancelled) return { success: false, cancelled: true };
                return result;
            } finally {
                chrisTitusTask = null;
            }
        } catch (error) {
            chrisTitusTask = null;
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('run-christitus-cancel', async () => {
        if (!chrisTitusTask) {
            return { success: false, error: 'The utility is not running.' };
        }
        try {
            chrisTitusCancelled = true;
            if (typeof chrisTitusTask.cancel === 'function') {
                chrisTitusTask.cancel();
            } else {
                chrisTitusTask.child.kill();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
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

    ipcMain.handle('show-file-dialog', async () => {
        try {
            return await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'Executables', extensions: ['exe'] }]
            });
        } catch (err) {
            return { canceled: true, filePaths: [], error: err.message };
        }
    });
}

function setupDownloadHandlers(downloadManager, getMainWindow) {
    ipcMain.removeAllListeners('download-start');
    ipcMain.on('download-start', (event, { id, url, dest }) => {
        const win = getMainWindow();
        if (!win) return;
        downloadManager.startDownload(id, url, dest, win);
    });
}

function setupFileHandlers(security, fileUtils, debug, pendingCleanupFiles) {
    ipcMain.handle('get-asset-path', async (event, relativePath) => {
        const isDev = !app.isPackaged;
        let assetPath;
        if (isDev) {
            assetPath = path.join(__dirname, '..', 'assets', relativePath);
        } else {
            assetPath = path.join(app.getAppPath(), 'src', 'assets', relativePath);
        }
        const normalizedPath = assetPath.replace(/\\/g, '/');
        if (process.platform === 'win32' && normalizedPath.match(/^[A-Za-z]:/)) {
            return 'file:///' + normalizedPath;
        }
        return 'file://' + normalizedPath;
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
    return new Promise((resolve) => {
        (async () => {
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
        })();
    });
    });
}

function setupArchiveHandlers(security, archiveUtils, downloadManager) {
    ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
        try {
            const fileCheck = security.validatePath(filePath);
            if (!fileCheck.valid) {
                return { success: false, error: `Invalid archive path: ${fileCheck.error}` };
            }

            let safeDestDir = destDir;
            if (destDir) {
                const destCheck = security.validatePath(destDir);
                if (!destCheck.valid) {
                    return { success: false, error: `Invalid destination: ${destCheck.error}` };
                }
                safeDestDir = destCheck.normalized;
            }

            return await archiveUtils.extractArchive(fileCheck.normalized, password, safeDestDir, downloadManager.trackExtractedDir);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

function setupSparkleHandlers(sparkleModule) {
    ipcMain.handle('process-downloaded-sparkle', async (event, zipPath) => {
        try {
            return await sparkleModule.processDownloadedSparkle(zipPath);
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('sparkle-status', async () => {
        try {
            return { available: sparkleModule.isSparkleAvailable() };
        } catch (error) {
            return { available: false, error: error.message };
        }
    });
}

function setupSystemToolsHandlers(systemTools) {
    const safeWrap = (fn) => async () => {
        try { return await fn(); } catch (error) { return { success: false, error: error.message }; }
    };

    ipcMain.handle('run-sparkle-debloat', safeWrap(() => systemTools.runSparkleDebloat()));
    let systemRepairTask = null;
    let systemRepairCancelled = false;

    const runSystemRepair = (runner) => async (event) => {
        if (systemRepairTask) {
            return { success: false, error: 'A repair task is already running.' };
        }

        systemRepairCancelled = false;
        try {
            const task = runner((stream, text) => {
                try {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('system-repair-output', { stream, text });
                    }
                } catch { }
            });

            systemRepairTask = task;
            try {
                const result = await task.done;
                if (systemRepairCancelled) return { success: false, cancelled: true };
                return result;
            } finally {
                systemRepairTask = null;
            }
        } catch (error) {
            systemRepairTask = null;
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle('run-sfc-scan', runSystemRepair((onOutput) => systemTools.runSfcScan(onOutput)));
    ipcMain.handle('run-dism-repair', runSystemRepair((onOutput) => systemTools.runDismRepair(onOutput)));

    ipcMain.handle('system-repair-cancel', async () => {
        if (!systemRepairTask) {
            return { success: false, error: 'No repair task is running.' };
        }
        try {
            systemRepairCancelled = true;
            if (typeof systemRepairTask.cancel === 'function') {
                systemRepairTask.cancel();
            } else {
                systemRepairTask.child.kill();
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('scan-cleaner-tasks', async (event, options) => {
        try { return await systemTools.scanCleanerTasks(options); } catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('run-cleaner-tasks', async (event, taskIds, options) => {
        try {
            return await systemTools.runCleanerTasks(taskIds, options, (text) => {
                try {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('cleaner-progress', { text });
                    }
                } catch { }
            });
        } catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('cleaner-admin-enable', async () => {
        try { return await systemTools.enableCleanerAdminSession(); } catch (error) { return { success: false, error: error.message }; }
    });
    ipcMain.handle('restart-to-bios', safeWrap(() => systemTools.restartToBios()));
    ipcMain.handle('flush-dns-cache', runSystemRepair((onOutput) => systemTools.flushDnsCache(onOutput)));
    ipcMain.handle('release-renew-ip', runSystemRepair((onOutput) => systemTools.releaseRenewIp(onOutput)));
    ipcMain.handle('fix-bluetooth', runSystemRepair((onOutput) => systemTools.fixBluetooth(onOutput)));
    ipcMain.handle('check-disk', runSystemRepair((onOutput) => systemTools.checkDisk(onOutput)));
    ipcMain.handle('network-reset', runSystemRepair((onOutput) => systemTools.networkReset(onOutput)));
    ipcMain.handle('restart-audio-system', runSystemRepair((onOutput) => systemTools.restartAudioSystem(onOutput)));
}

function setupSpicetifyHandlers(spicetifyModule) {
    let spicetifyTask = null;
    let spicetifyCancelled = false;
    let spicetifyUninstalling = false;

    const runSpicetifyStreaming = (runner) => async (event) => {
        if (spicetifyTask || spicetifyUninstalling) {
            return { success: false, error: 'A Spicetify task is already running.' };
        }

        spicetifyCancelled = false;
        try {
            const task = runner((stream, text) => {
                try {
                    if (!event.sender.isDestroyed()) {
                        event.sender.send('spicetify-install-output', { stream, text });
                    }
                } catch { }
            });

            spicetifyTask = task;
            try {
                const result = await task.done;
                if (spicetifyCancelled) return { success: false, cancelled: true };
                return result;
            } finally {
                spicetifyTask = null;
            }
        } catch (error) {
            spicetifyTask = null;
            return { success: false, error: error.message };
        }
    };

    ipcMain.handle('install-spicetify', runSpicetifyStreaming((onOutput) => spicetifyModule.installSpicetify(onOutput)));
    ipcMain.handle('full-uninstall-spotify', runSpicetifyStreaming((onOutput) => spicetifyModule.fullUninstallSpotify(onOutput)));

    ipcMain.handle('install-spicetify-cancel', async () => {
        if (!spicetifyTask) {
            return { success: false, error: 'No Spicetify task in progress.' };
        }
        try {
            spicetifyCancelled = true;
            spicetifyTask.child.kill();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('uninstall-spicetify', async () => {
        if (spicetifyTask || spicetifyUninstalling) {
            return { success: false, error: 'A Spicetify task is already running.' };
        }
        spicetifyUninstalling = true;
        try { return await spicetifyModule.uninstallSpicetify(); }
        catch (error) { return { success: false, error: error.message }; }
        finally { spicetifyUninstalling = false; }
    });
}

function setupInstallerHandlers(debug, security) {
    ipcMain.handle('find-exe-files', async (event, directoryPath) => {
        try {
            if (typeof directoryPath !== 'string' || !directoryPath.trim()) {
                return [];
            }
            const validation = security.validatePath(directoryPath);
            if (!validation.valid) {
                return [];
            }
            const rootDir = validation.normalized;

            try {
                await fs.promises.access(rootDir);
            } catch {
                return [];
            }

            const executableFiles = [];
            const MAX_DEPTH = 10;
            const MAX_FILES = 500;

            const queue = [{ path: rootDir, depth: 0 }];
            
            while (queue.length > 0 && executableFiles.length < MAX_FILES) {
                // Process in chunks to avoid blocking the event loop
                const currentChunk = queue.splice(0, 20);
                
                await Promise.all(currentChunk.map(async ({ path: dir, depth }) => {
                    if (depth > MAX_DEPTH || executableFiles.length >= MAX_FILES) return;
                    
                    try {
                        const items = await fs.promises.readdir(dir, { withFileTypes: true });
                        for (const item of items) {
                            if (executableFiles.length >= MAX_FILES) break;
                            const fullPath = path.join(dir, item.name);
                            
                            if (item.isSymbolicLink()) continue;
                            
                            if (item.isDirectory()) {
                                queue.push({ path: fullPath, depth: depth + 1 });
                            } else if (item.isFile()) {
                                const ext = path.extname(item.name).toLowerCase();
                                if (ext === '.exe' || ext === '.bat') {
                                    executableFiles.push(fullPath);
                                }
                            }
                        }
                    } catch (readErr) {
                        debug('warn', 'Cannot access ' + dir + ': ' + (readErr.code || readErr.message));
                    }
                }));
            }
            return executableFiles;
        } catch {
            return [];
        }
    });

    ipcMain.handle('run-installer', async (event, filePath) => {
        return new Promise((resolve) => {
            debug('info', 'Running installer:', filePath);
            const validation = security.validatePath(filePath);
            if (!validation.valid) {
                return resolve({ success: false, error: validation.error });
            }
            const normalized = validation.normalized;

            const downloadsDir = path.join(os.homedir(), 'Downloads').toLowerCase();
            const tempDir = os.tmpdir().toLowerCase();
            const lowerPath = normalized.toLowerCase();
            if (!lowerPath.startsWith(downloadsDir) && !lowerPath.startsWith(tempDir)) {
                return resolve({ success: false, error: 'Installers can only be run from Downloads or temp folder' });
            }

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

module.exports = {
    setupWindowHandlers,
    setupSystemInfoHandlers,
    setupOAuthHandlers,
    setupSettingsHandlers,
    setupCommandHandlers,
    setupDownloadHandlers,
    setupFileHandlers,
    setupArchiveHandlers,
    setupSparkleHandlers,
    setupSystemToolsHandlers,
    setupSpicetifyHandlers,
    setupInstallerHandlers
};
