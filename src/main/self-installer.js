const { app } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const APP_DISPLAY_NAME = 'Make Your Life Easier';
const APP_EXE_NAME = 'MakeYourLifeEasier.exe';
const UNINSTALL_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MakeYourLifeEasier';

function isInstallerMode() {
    if (process.argv.includes('--install-mode')) return true;
    const portableFile = process.env.PORTABLE_EXECUTABLE_FILE;
    if (portableFile && /setup/i.test(path.basename(portableFile))) return true;
    return false;
}

function isUninstallMode() {
    return process.argv.includes('--uninstall');
}

function defaultInstallDir() {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'ThomasThanos', 'MakeYourLifeEasier');
}

function sourceDir() {
    return path.dirname(process.execPath);
}

async function withoutAsar(fn) {
    const prev = process.noAsar;
    process.noAsar = true;
    try {
        return await fn();
    } finally {
        process.noAsar = prev;
    }
}

async function walkFiles(dir, out) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walkFiles(full, out);
        } else if (entry.isFile()) {
            out.push(full);
        }
    }
    return out;
}

async function computeSize(dir) {
    return withoutAsar(async () => {
        let bytes = 0;
        let count = 0;
        const files = await walkFiles(dir, []);
        for (const file of files) {
            try {
                const stat = await fs.promises.stat(file);
                bytes += stat.size;
                count += 1;
            } catch { /* skip unreadable */ }
        }
        return { bytes, count, sizeMB: Math.max(1, Math.round(bytes / (1024 * 1024))) };
    });
}

async function getInstallInfo() {
    const src = sourceDir();
    let size = { bytes: 0, count: 0, sizeMB: 0 };
    try {
        size = await computeSize(src);
    } catch { /* best effort */ }
    return {
        appName: APP_DISPLAY_NAME,
        version: app.getVersion(),
        defaultDir: defaultInstallDir(),
        sizeMB: size.sizeMB,
        fileCount: size.count,
        isPackaged: app.isPackaged
    };
}

function runPs(script) {
    return new Promise((resolve, reject) => {
        execFile('powershell.exe',
            ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
            { windowsHide: true },
            (err, stdout, stderr) => {
                if (err) reject(new Error(stderr || err.message));
                else resolve(stdout);
            });
    });
}

function runReg(args) {
    return new Promise((resolve, reject) => {
        execFile('reg.exe', args, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout);
        });
    });
}

async function closeRunningInstance(exePath, debug) {
    try {
        const escaped = exePath.replace(/'/g, "''");
        await runPs(`Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq '${escaped}' } | Stop-Process -Force -ErrorAction SilentlyContinue`);
        await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
        debug('warn', 'Failed to close running instance:', err.message);
    }
}

async function copyTree(src, dest, onProgress, debug) {
    return withoutAsar(async () => {
        const files = await walkFiles(src, []);
        const total = files.length || 1;
        let done = 0;
        await fs.promises.mkdir(dest, { recursive: true });

        for (const file of files) {
            const rel = path.relative(src, file);
            const target = path.join(dest, rel);
            try {
                await fs.promises.mkdir(path.dirname(target), { recursive: true });
                await fs.promises.copyFile(file, target);
            } catch (err) {
                debug('warn', `Copy failed for ${rel}: ${err.message}`);
                throw err;
            }
            done += 1;
            if (onProgress && (done % 12 === 0 || done === total)) {
                onProgress(Math.round((done / total) * 100), done, total);
            }
        }
    });
}

async function createShortcut(lnkPath, targetExe, workingDir) {
    const q = (s) => s.replace(/'/g, "''");
    const script =
        `$s = (New-Object -ComObject WScript.Shell).CreateShortcut('${q(lnkPath)}');` +
        `$s.TargetPath = '${q(targetExe)}';` +
        `$s.WorkingDirectory = '${q(workingDir)}';` +
        `$s.IconLocation = '${q(targetExe)},0';` +
        `$s.Description = '${q(APP_DISPLAY_NAME)}';` +
        `$s.Save()`;
    return runPs(script);
}

function programsDir() {
    return path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs');
}

function startMenuDir() {
    return path.join(programsDir(), APP_DISPLAY_NAME);
}

function startupDir() {
    return path.join(programsDir(), 'Startup');
}

async function writeUninstallRegistry(targetExe, targetDir, version, sizeMB) {
    const uninstallCmd = `"${targetExe}" --uninstall`;
    const entries = [
        ['DisplayName', 'REG_SZ', `${APP_DISPLAY_NAME} ${version}`],
        ['DisplayVersion', 'REG_SZ', version],
        ['DisplayIcon', 'REG_SZ', targetExe],
        ['Publisher', 'REG_SZ', 'ThomasThanos'],
        ['InstallLocation', 'REG_SZ', targetDir],
        ['UninstallString', 'REG_SZ', uninstallCmd],
        ['QuietUninstallString', 'REG_SZ', `${uninstallCmd} --silent`],
        ['NoModify', 'REG_DWORD', '1'],
        ['NoRepair', 'REG_DWORD', '1'],
        ['EstimatedSize', 'REG_DWORD', String(Math.max(1, sizeMB) * 1024)],
        ['URLInfoAbout', 'REG_SZ', 'https://thomasthanos.github.io/Make_Your_Life_Easier.A.E/src/public/readme.html'],
        ['Comments', 'REG_SZ', 'A modern, user-friendly desktop application with auto-updater']
    ];
    for (const [name, type, data] of entries) {
        await runReg(['add', UNINSTALL_KEY, '/v', name, '/t', type, '/d', data, '/f']);
    }
}

async function install(win, options, onProgress, debug) {
    const version = app.getVersion();
    const src = sourceDir();

    if (!app.isPackaged) {
        throw new Error('Install is only available in the packaged Setup build. Run the Setup .exe to install for real.');
    }

    const targetDir = defaultInstallDir();

    if (path.normalize(src).toLowerCase() === targetDir.toLowerCase()) {
        throw new Error('The install folder cannot be the same as the Setup location.');
    }

    const targetExe = path.join(targetDir, APP_EXE_NAME);

    onProgress({ phase: 'preparing', percent: 0 });
    await closeRunningInstance(targetExe, debug);

    if (fs.existsSync(targetDir)) {
        await withoutAsar(() =>
            fs.promises.rm(targetDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
        ).catch(() => {});
    }

    onProgress({ phase: 'copying', percent: 0 });
    await copyTree(src, targetDir, (percent, done, total) => {
        onProgress({ phase: 'copying', percent, done, total });
    }, debug);

    onProgress({ phase: 'shortcuts', percent: 100 });
    const opts = options || {};
    const desktopShortcut = opts.desktopShortcut !== false;
    const startMenuShortcut = opts.startMenuShortcut !== false;
    const startupShortcut = opts.startupShortcut === true;
    const lnkName = `${APP_DISPLAY_NAME}.lnk`;

    if (desktopShortcut) {
        await createShortcut(path.join(app.getPath('desktop'), lnkName), targetExe, targetDir)
            .catch((err) => debug('warn', 'Desktop shortcut failed:', err.message));
    }
    if (startMenuShortcut) {
        await createShortcut(path.join(programsDir(), lnkName), targetExe, targetDir)
            .catch((err) => debug('warn', 'Start Menu shortcut failed:', err.message));
    }
    if (startupShortcut) {
        const suDir = startupDir();
        await fs.promises.mkdir(suDir, { recursive: true }).catch(() => {});
        await createShortcut(path.join(suDir, lnkName), targetExe, targetDir)
            .catch((err) => debug('warn', 'Startup shortcut failed:', err.message));
    }

    onProgress({ phase: 'registry', percent: 100 });
    let sizeMB = 0;
    try { sizeMB = (await computeSize(targetDir)).sizeMB; } catch { /* best effort */ }
    await writeUninstallRegistry(targetExe, targetDir, version, sizeMB)
        .catch((err) => debug('warn', 'Registry write failed:', err.message));

    onProgress({ phase: 'done', percent: 100 });
    return { targetDir, targetExe };
}

function launchInstalled(targetExe) {
    const child = spawn(targetExe, [], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        cwd: path.dirname(targetExe)
    });
    child.unref();
}

async function uninstall(debug) {
    const targetDir = defaultInstallDir();
    const targetExe = path.join(targetDir, APP_EXE_NAME);

    await closeRunningInstance(targetExe, debug);

    const lnkName = `${APP_DISPLAY_NAME}.lnk`;
    await fs.promises.rm(path.join(app.getPath('desktop'), lnkName), { force: true }).catch(() => {});
    await fs.promises.rm(path.join(startupDir(), lnkName), { force: true }).catch(() => {});
    await fs.promises.rm(path.join(programsDir(), lnkName), { force: true }).catch(() => {});
    await fs.promises.rm(startMenuDir(), { recursive: true, force: true }).catch(() => {});

    await runReg(['delete', UNINSTALL_KEY, '/f']).catch(() => {});

    const roaming = path.join(app.getPath('appData'), 'ThomasThanos', 'MakeYourLifeEasier');
    await fs.promises.rm(roaming, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});

    if (fs.existsSync(targetDir)) {
        app.once('will-quit', () => {
            try {
                const script = `ping -n 3 127.0.0.1 >nul & rmdir /s /q "${targetDir}" & if exist "${targetDir}" (ping -n 3 127.0.0.1 >nul & rmdir /s /q "${targetDir}")`;
                spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
            } catch (err) {
                debug('warn', 'Deferred install-dir removal failed to start:', err.message);
            }
        });
    }

    return { targetDir };
}

module.exports = {
    isInstallerMode,
    isUninstallMode,
    getInstallInfo,
    install,
    launchInstalled,
    uninstall,
    defaultInstallDir,
    APP_DISPLAY_NAME,
    APP_EXE_NAME
};
