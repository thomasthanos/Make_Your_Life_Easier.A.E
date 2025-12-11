const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const baseEnv = { ...process.env };

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

// Στο main.js αφαίρεσε το titleBarOverlay και titleBarStyle
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0f172a',
        frame: false, // Αυτό δίνει το custom titlebar
        titleBarStyle: 'hidden',
        titleBarOverlay: {
            color: '#00000000',
            symbolColor: '#ffffff',
            height: 35
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: !isDev
        }
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
}

app.whenReady().then(createWindow);

// --- HANDLERS ---

// Window control handlers for the custom titlebar
ipcMain.on('window-minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('window-maximize', () => {
    if (mainWindow) {
        mainWindow.maximize();
    }
});

ipcMain.on('window-close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

ipcMain.on('window-toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});

// GET RELEASES (SAFE MODE - NO DESCRIPTION)
// main.js - τροποποίηση του get-releases handler
ipcMain.handle('get-releases', async (event, projectPath) => {
    return new Promise((resolve) => {
        // Πρώτα πάρε το repository URL
        const getRepoCmd = 'gh repo view --json url';
        exec(getRepoCmd, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
            if (error) {
                resolve([]);
                return;
            }

            try {
                const repoInfo = JSON.parse(stdout);
                const repoUrl = repoInfo.url;

                // Τώρα πάρε τα releases
                const cmd = 'gh release list --json tagName,publishedAt,name,isDraft --limit 20';
                exec(cmd, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
                    if (error) {
                        resolve([]);
                    } else {
                        try {
                            const rawData = JSON.parse(stdout);
                            const releases = rawData.map(rel => ({
                                tagName: rel.tagName,
                                publishedAt: rel.publishedAt,
                                // Χρησιμοποίησε το σωστό URL για το release
                                url: `${repoUrl}/releases/tag/${rel.tagName}`,
                                title: rel.name || rel.tagName,
                                isDraft: rel.isDraft || false
                            }));
                            resolve(releases);
                        } catch (e) {
                            console.error('Error parsing releases:', e);
                            resolve([]);
                        }
                    }
                });
            } catch (e) {
                console.error('Error parsing repo info:', e);
                resolve([]);
            }
        });
    });
});

ipcMain.handle('create-release', async (event, { path: projectPath, version, title, notes }) => {
    return new Promise((resolve) => {
        const safeNotes = notes.replace(/"/g, '\\"');
        const command = `gh release create "${version}" --title "${title}" --notes "${safeNotes}"`;
        exec(command, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
            if (error) resolve({ success: false, error: stderr });
            else resolve({ success: true, output: stdout });
        });
    });
});

ipcMain.handle('delete-release', async (event, { path: projectPath, tagName }) => {
    return new Promise((resolve) => {
        const cmdDeleteRelease = `gh release delete "${tagName}" --yes`;
        exec(cmdDeleteRelease, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
            if (error) {
                resolve({ success: false, error: stderr });
            } else {
                exec(`git push origin --delete "${tagName}"`, { cwd: projectPath, env: baseEnv }, () => { });
                exec(`git tag -d "${tagName}"`, { cwd: projectPath, env: baseEnv }, () => { });
                resolve({ success: true });
            }
        });
    });
});

ipcMain.handle('trigger-build', (event, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    let buildCommand = null;

    try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const scripts = pkg.scripts || {};

        // Prefer build-all if present, otherwise fall back to build
        if (scripts['build-all']) {
            buildCommand = 'npm run build-all';
        } else if (scripts.build) {
            buildCommand = 'npm run build';
        }
    } catch (err) {
        mainWindow.webContents.send('build-log', `\n❌ Could not read package.json at ${pkgPath}: ${err.message}\n`);
        return;
    }

    if (!buildCommand) {
        mainWindow.webContents.send('build-log', `\n❌ No build script found (looking for "build-all" or "build").\n`);
        return;
    }

    mainWindow.webContents.send('build-log', `\n🚀 Starting ${buildCommand} in: ${projectPath}...\n`);
    const buildProcess = exec(buildCommand, { cwd: projectPath });
    buildProcess.stdout.on('data', (data) => mainWindow.webContents.send('build-log', data));
    buildProcess.stderr.on('data', (data) => mainWindow.webContents.send('build-log', `[MSG] ${data}`));
    buildProcess.on('close', async (code) => {
        let msg;

        if (code === 0) {
            msg = '\n✅ Build Completed Successfully!';

            const distPath = path.join(projectPath, 'dist');
            const releasePath = path.join(projectPath, 'release');
            let openedPath = null;

            if (fs.existsSync(distPath)) {
                openedPath = distPath;
            } else if (fs.existsSync(releasePath)) {
                openedPath = releasePath;
            }

            if (openedPath) {
                try {
                    const openResult = await shell.openPath(openedPath);
                    if (openResult) {
                        msg += `\n⚠️ Could not open output folder: ${openResult}`;
                    } else {
                        msg += `\n📂 Opened output folder: ${path.basename(openedPath)}`;
                    }
                } catch (err) {
                    msg += `\n⚠️ Could not open output folder: ${err.message}`;
                }
            }
        } else {
            msg = `\n❌ Build Failed (Code ${code})`;
        }

        mainWindow.webContents.send('build-log', msg);
    });
});