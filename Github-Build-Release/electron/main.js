const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');

const baseEnv = { ...process.env };

const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function getBuildCommand(projectPath, overrideCommand) {
    if (overrideCommand && overrideCommand.trim()) return overrideCommand.trim();

    const pkgPath = path.join(projectPath, 'package.json');
    let buildCommand = null;

    try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const scripts = pkg.scripts || {};

        if (scripts['build-all']) {
            buildCommand = 'npm run build-all';
        } else if (scripts.build) {
            buildCommand = 'npm run build';
        }
    } catch (err) {
        buildCommand = null;
    }

    return buildCommand;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 850,
        minWidth: 1000,
        minHeight: 700,
        backgroundColor: '#0f172a',
        frame: false,
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

// --- WINDOW CONTROL HANDLERS ---

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

// --- PROJECT HANDLERS ---

ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
});

// PROJECT INFO
ipcMain.handle('get-project-info', async (event, projectPath) => {
    const pkgPath = path.join(projectPath, 'package.json');
    let version = null;
    let suggestedBuildCommand = null;

    try {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        version = pkg.version || null;
        suggestedBuildCommand = getBuildCommand(projectPath, null);
    } catch (err) {
        version = null;
        suggestedBuildCommand = null;
    }

    return { version, suggestedBuildCommand };
});

// GET RELEASES
ipcMain.handle('get-releases', async (event, projectPath) => {
    return new Promise((resolve) => {
        const getRepoCmd = 'gh repo view --json url';
        exec(getRepoCmd, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
            if (error) {
                resolve([]);
                return;
            }

            try {
                const repoInfo = JSON.parse(stdout);
                const repoUrl = repoInfo.url;

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

// CREATE RELEASE WITH BUILD & UPLOAD
ipcMain.handle('create-release', async (event, { path: projectPath, version, title, notes, buildCommand }) => {
    return new Promise((resolve) => {
        // Step 1: Build the project
        mainWindow.webContents.send('build-log', `\n🔨 Step 1/3: Building project...\n`);

        const pkgPath = path.join(projectPath, 'package.json');
        const resolvedBuildCommand = getBuildCommand(projectPath, buildCommand);

        if (!resolvedBuildCommand) {
            resolve({ success: false, error: 'No build script found in package.json and no custom command provided.' });
            return;
        }

        const buildProcess = exec(resolvedBuildCommand, { cwd: projectPath });

        buildProcess.stdout.on('data', (data) => {
            mainWindow.webContents.send('build-log', data);
        });

        buildProcess.stderr.on('data', (data) => {
            mainWindow.webContents.send('build-log', `[BUILD] ${data}`);
        });

        buildProcess.on('close', (buildCode) => {
            if (buildCode !== 0) {
                mainWindow.webContents.send('build-log', `\n❌ Build failed with code ${buildCode}\n`);
                resolve({ success: false, error: `Build failed with exit code ${buildCode}` });
                return;
            }

            mainWindow.webContents.send('build-log', `\n✅ Build completed successfully!\n`);

            // Step 2: Create GitHub release
            mainWindow.webContents.send('build-log', `\n🚀 Step 2/3: Creating GitHub release ${version}...\n`);

            const notesFilePath = path.join(os.tmpdir(), `release-notes-${Date.now()}.md`);

            try {
                fs.writeFileSync(notesFilePath, notes, 'utf-8');
            } catch (err) {
                resolve({ success: false, error: `Failed to write release notes: ${err.message}` });
                return;
            }

            const createReleaseCmd = `gh release create "${version}" --title "${title}" --notes-file "${notesFilePath}"`;

            exec(createReleaseCmd, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
                fs.unlink(notesFilePath, () => { });

                if (error) {
                    mainWindow.webContents.send('build-log', `\n❌ Failed to create release: ${stderr}\n`);
                    resolve({ success: false, error: stderr });
                    return;
                }

                mainWindow.webContents.send('build-log', `\n✅ Release created successfully!\n`);

                // Step 3: Upload artifacts
                mainWindow.webContents.send('build-log', `\n📦 Step 3/3: Uploading build artifacts...\n`);

                const distPath = path.join(projectPath, 'dist');

                if (!fs.existsSync(distPath)) {
                    mainWindow.webContents.send('build-log', `\n⚠️ No dist folder found. Skipping artifact upload.\n`);
                    resolve({ success: true, output: stdout });
                    return;
                }

                // Find all relevant files to upload
                const files = fs.readdirSync(distPath);
                const artifactFiles = files.filter(f => {
                    const lower = f.toLowerCase();
                    if (lower === 'builder-debug.yml') return false;

                    return (
                        lower.endsWith('.exe') ||
                        lower.endsWith('.yml') ||
                        lower.endsWith('.blockmap') ||
                        lower.endsWith('.dmg') ||
                        lower.endsWith('.appimage')
                    );
                });

                if (artifactFiles.length === 0) {
                    mainWindow.webContents.send('build-log', `\n⚠️ No artifacts found to upload.\n`);
                    resolve({ success: true, output: stdout });
                    return;
                }

                mainWindow.webContents.send('build-log', `\nFound ${artifactFiles.length} files to upload:\n${artifactFiles.map(f => `  - ${f}`).join('\n')}\n`);

                // Upload each file
                let uploadCount = 0;
                let uploadErrors = [];

                artifactFiles.forEach((file, index) => {
                    const filePath = path.join(distPath, file);
                    const uploadCmd = `gh release upload "${version}" "${filePath}"`;

                    exec(uploadCmd, { cwd: projectPath, env: baseEnv }, (error, stdout, stderr) => {
                        if (error) {
                            uploadErrors.push(`${file}: ${stderr}`);
                            mainWindow.webContents.send('build-log', `\n❌ Failed to upload ${file}\n`);
                        } else {
                            mainWindow.webContents.send('build-log', `\n✅ Uploaded ${file}\n`);
                        }

                        uploadCount++;

                        // Check if all uploads are done
                        if (uploadCount === artifactFiles.length) {
                            if (uploadErrors.length > 0) {
                                mainWindow.webContents.send('build-log', `\n⚠️ Some uploads failed:\n${uploadErrors.join('\n')}\n`);
                            } else {
                                mainWindow.webContents.send('build-log', `\n🎉 All artifacts uploaded successfully!\n`);
                            }
                            resolve({
                                success: uploadErrors.length === 0,
                                output: stdout,
                                partialSuccess: uploadErrors.length < artifactFiles.length
                            });
                        }
                    });
                });
            });
        });
    });
});

// DELETE RELEASE
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

// TRIGGER BUILD
ipcMain.handle('trigger-build', (event, { path: projectPath, command }) => {
    const resolvedBuildCommand = getBuildCommand(projectPath, command);

    if (!resolvedBuildCommand) {
        mainWindow.webContents.send('build-log', `\n❌ No build script found (looking for "build-all" or "build") and no custom command provided.\n`);
        return;
    }

    mainWindow.webContents.send('build-log', `\n🚀 Starting ${resolvedBuildCommand} in: ${projectPath}...\n`);
    const buildProcess = exec(resolvedBuildCommand, { cwd: projectPath });
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