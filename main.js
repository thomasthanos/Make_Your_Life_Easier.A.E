const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');
const SimpleUpdater = require('./simple-updater');
const { autoUpdater } = require('electron-updater');
const Store = require('electron-store');

// Password Manager imports
const PasswordManagerAuth = require('./password-manager/auth');
const PasswordManagerDB = require('./password-manager/database');

const { dialog } = require('electron');

const fs = require('fs');
const http = require('http');
const https = require('https');

// Initialize auth manager - ΜΟΝΟ ΜΙΑ ΦΟΡΑ
const documentsPath = require('os').homedir() + '/Documents';
const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');

// Δημιουργία του directory αν δεν υπάρχει
if (!fs.existsSync(pmDirectory)) {
    fs.mkdirSync(pmDirectory, { recursive: true });
}
autoUpdater.autoDownload = false; // Ο χρήστης επιλέγει πότε να κατεβάσει
autoUpdater.autoInstallOnAppQuit = true; // Αυτόματη εγκατάσταση στο κλείσιμο
autoUpdater.allowDowngrade = false;
autoUpdater.fullChangelog = true;
// Initialize το auth manager
const pmAuth = new PasswordManagerAuth();
pmAuth.initialize(pmDirectory);
console.log('Auth manager initialized in main.js');

function stripAnsiCodes(str) {
  return str.replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '');
}

let mainWindow;
const store = new Store();
const activeDownloads = new Map(); // id -> { response, file, total, received, paused, filePath, finalPath }

ipcMain.handle('show-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe'] }
    ]
  });
  
  return result;
});
let updater = null;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.loadFile('index.html');
  updater = new SimpleUpdater(mainWindow);

  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      updater.checkForUpdates();
    }, 5000);
  });
}

// IPC handler
ipcMain.handle('check-for-updates', async () => {
  if (updater) {
    const result = await updater.checkForUpdates();
    return { success: true, updateAvailable: result };
  }
  return { success: false, error: 'Updater not initialized' };
});

ipcMain.handle('get-app-version', () => {
  return { version: app.getVersion() };
});

// Add this function to create password manager window
function createPasswordManagerWindow() {
    const passwordWindow = new BrowserWindow({
        width: 900,
        height: 700,
        parent: mainWindow,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // Same preload as main window
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    passwordWindow.loadFile('password-manager/index.html');
    
    // Remove menu bar
    passwordWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', (event) => {
    console.log('Cleaning up before quit...');
    if (updater) {
        updater.cleanup();
    }
});

app.on('window-all-closed', () => {
    console.log('All windows closed, cleaning up...');
    if (updater) {
        updater.cleanup();
    }
    app.quit();
});

// === Utility IPCs kept as-is ===
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

ipcMain.handle('run-command', async (event, command) => {
  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) resolve({ error: error.message, stdout, stderr });
      else resolve({ stdout, stderr });
    });
  });
});

ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url);
});

ipcMain.handle('open-file', async (event, filePath) => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`start "" "${filePath}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
    } else {
      const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
      exec(`${cmd} "${filePath}"`, (error) => {
        resolve(error ? { success: false, error: error.message } : { success: true });
      });
    }
  });
});

ipcMain.handle('open-installer', async (event, filePath) => {
  await shell.openPath(filePath);
  return { success: true };
});

// === Download logic (fixed) ===
function clientFor(url) { return url.startsWith('https:') ? https : http; }
function sanitizeName(name) { return String(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
function extFromUrl(u) { const m = String(u).match(/\.([a-zA-Z0-9]+)(?:\?|$)/); return m ? `.${m[1]}` : ''; }

ipcMain.on('download-start', (event, { id, url, dest }) => {
  const downloadsDir = path.join(os.homedir(), 'Downloads');

  const start = (downloadUrl) => {
    const req = clientFor(downloadUrl).get(downloadUrl, (res) => {
      // Follow redirects BEFORE opening any file handle
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, downloadUrl).toString();
        start(nextUrl);
        return;
      }

      if (res.statusCode !== 200) {
        mainWindow.webContents.send('download-event', { id, status: 'error', error: `HTTP ${res.statusCode}` });
        return;
      }

      // Decide final file name
      const sanitizedDest = sanitizeName(dest || '');
      const cd = res.headers['content-disposition'] || '';
      const cdMatch = cd.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
      const cdFile = cdMatch ? path.basename(cdMatch[1]) : '';
      const chosenExt = path.extname(sanitizedDest) || (cdFile ? path.extname(cdFile) : '') || extFromUrl(downloadUrl) || '.bin';
      const base = sanitizedDest ? path.basename(sanitizedDest, path.extname(sanitizedDest)) : (cdFile ? path.basename(cdFile, path.extname(cdFile)) : 'download');
      const finalName = sanitizeName(base) + chosenExt;

      const finalPath = path.join(downloadsDir, finalName);
      const tempPath = finalPath + '.part';
      // If a previous file with the same name already exists, remove it to allow fresh download
      try {
        if (fs.existsSync(finalPath)) {
          fs.unlinkSync(finalPath);
        }
      } catch (err) {
        // ignore errors deleting existing file; the download may override during rename
      }

      // Remove any existing extraction folder corresponding to this download name.  We compute
      // the base name (without extension) and remove both sanitized (underscored) and
      // unsanitized (spaces) versions of the folder.  This prevents leftover
      // extraction directories from previous runs.
      try {
        const baseNameWithoutExt = path.basename(finalName, path.extname(finalName));
        const extractDir = path.join(downloadsDir, baseNameWithoutExt);
        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
        // Also attempt to remove a version where underscores are replaced with spaces
        const altExtractDir = extractDir.replace(/_/g, ' ');
        if (altExtractDir !== extractDir && fs.existsSync(altExtractDir)) {
          fs.rmSync(altExtractDir, { recursive: true, force: true });
        }
      } catch (err) {
        // ignore errors when removing extraction directories
      }


      const total = parseInt(res.headers['content-length'] || '0', 10);
      const file = fs.createWriteStream(tempPath);

      const d = { response: res, file, total, received: 0, paused: false, filePath: tempPath, finalPath };
      activeDownloads.set(id, d);

      mainWindow.webContents.send('download-event', { id, status: 'started', total });

      const cleanup = (errMsg) => {
        try { res.destroy(); } catch {}
        try { file.destroy(); } catch {}
        try { fs.unlink(tempPath, () => {}); } catch {}
        activeDownloads.delete(id);
        if (errMsg) mainWindow.webContents.send('download-event', { id, status: 'error', error: errMsg });
      };

      res.on('data', (chunk) => {
        if (d.paused) return;
        d.received += chunk.length;
        if (total) {
          const percent = Math.round((d.received / total) * 100);
          mainWindow.webContents.send('download-event', { id, status: 'progress', percent });
        }
      });

      res.on('error', (err) => cleanup(err.message));
      file.on('error', (err) => cleanup(err.message));

      // Use piping (handles backpressure); do not call file.end() manually
      res.pipe(file);

      // COMPLETE only after file is fully flushed and closed, then rename .part -> final
      file.once('finish', () => {
        file.close(() => {
          fs.rename(tempPath, finalPath, (err) => {
            if (err) { cleanup(err.message); return; }
            activeDownloads.delete(id);
            mainWindow.webContents.send('download-event', { id, status: 'complete', path: finalPath });
          });
        });
      });
    });

    req.on('error', (err) => {
      activeDownloads.delete(id);
      mainWindow.webContents.send('download-event', { id, status: 'error', error: err.message });
    });
  };

  try { start(url); } catch (e) {
    mainWindow.webContents.send('download-event', { id, status: 'error', error: e.message });
  }
});

ipcMain.on('download-pause', (event, id) => {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = true;
    try { d.response.pause(); } catch {}
    mainWindow.webContents.send('download-event', { id, status: 'paused' });
  }
});

ipcMain.on('download-resume', (event, id) => {
  const d = activeDownloads.get(id);
  if (d && d.response) {
    d.paused = false;
    try { d.response.resume(); } catch {}
    mainWindow.webContents.send('download-event', { id, status: 'resumed' });
  }
});

ipcMain.on('download-cancel', (event, id) => {
  const d = activeDownloads.get(id);
  if (d) {
    try { if (d.response) d.response.destroy(); } catch {}
    try { if (d.file) d.file.destroy(); } catch {}
    try { if (d.filePath) fs.unlink(d.filePath, () => {}); } catch {}
    activeDownloads.delete(id);
    mainWindow.webContents.send('download-event', { id, status: 'cancelled' });
  }
});

ipcMain.handle('replace-exe', async (event, { sourcePath, destPath }) => {
  return new Promise((resolve) => {
    try {
      const expandEnv = (input) => {
        return String(input).replace(/%([^%]+)%/g, (match, name) => {
          const value = process.env[name];
          return typeof value === 'string' ? value : match;
        });
      };
      
      const src = expandEnv(sourcePath);
      const dst = expandEnv(destPath);
      
      console.log('Replacing executable with elevated privileges:');
      console.log('Source:', src);
      console.log('Destination:', dst);
      
      // Έλεγχος ύπαρξης πηγής
      if (!fs.existsSync(src)) {
        resolve({ success: false, error: `Source file not found: ${src}` });
        return;
      }

      // PowerShell script - πολύ πιο αξιόπιστο με paths που έχουν κενά
      const psScript = `
# PowerShell script for file replacement with proper path handling
try {
    Write-Output "Starting file replacement..."
    Write-Output "Source: '${src}'"
    Write-Output "Destination: '${dst}'"
    
    # Check if source exists
    if (-not (Test-Path '${src}')) {
        throw "Source file does not exist: '${src}'"
    }
    
    # Take ownership of destination
    Write-Output "Taking ownership..."
    & takeown /f '${dst}' /r /d y 2>&1 | Out-Null
    
    # Grant permissions
    & icacls '${dst}' /grant '%username%':F /T /C 2>&1 | Out-Null
    
    # Remove existing file if it exists
    if (Test-Path '${dst}') {
        Write-Output "Removing existing file..."
        Remove-Item -Path '${dst}' -Force -ErrorAction Stop
    }
    
    # Copy new file
    Write-Output "Copying new file..."
    Copy-Item -Path '${src}' -Destination '${dst}' -Force -ErrorAction Stop
    
    # Verify the copy was successful
    if (Test-Path '${dst}') {
        Write-Output "SUCCESS: File replacement completed"
        exit 0
    } else {
        throw "File replacement failed - destination file not found"
    }
}
catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    exit 1
}
`;

      const psFile = path.join(os.tmpdir(), `elevated_ps_${Date.now()}.ps1`);
      fs.writeFileSync(psFile, psScript, 'utf8');

      // VBS για UAC elevation
      const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "powershell.exe", "-ExecutionPolicy Bypass -File ""${psFile.replace(/\\/g, '\\\\')}""", "", "runas", 1
WScript.Sleep(3000)
`;

      const vbsFile = path.join(os.tmpdir(), `elevate_${Date.now()}.vbs`);
      fs.writeFileSync(vbsFile, vbsScript);

      console.log('Requesting UAC elevation for file replacement...');

      // Εκτέλεση VBS script για UAC prompt
      exec(`wscript "${vbsFile}"`, (error) => {
        // Καθαρισμός temporary files
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch {}
          try { fs.unlinkSync(psFile); } catch {}
        }, 10000);
        
        if (error) {
          console.log('User denied UAC or elevation failed:', error);
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          console.log('UAC accepted, replacement in progress...');
          
          // Περιμένουμε και ελέγχουμε το αποτέλεσμα
          setTimeout(() => {
            if (fs.existsSync(dst)) {
              resolve({ 
                success: true, 
                message: '✅ File replacement completed successfully!' 
              });
            } else {
              resolve({ 
                success: false, 
                error: 'Replacement may have failed. The destination file was not found.' 
              });
            }
          }, 4000);
        }
      });
      
    } catch (err) {
      console.error('Replace exception:', err);
      resolve({ success: false, error: `Exception: ${err.message}` });
    }
  });
});async function performReplacement(targetPath, sourceDir, statusElement, button) {
    statusElement.textContent = 'Finding patch executable...';
    
    // Αναζήτηση για το clipstudio_crack.exe
    const crackFiles = await window.api.findExeFiles(sourceDir);
    const crackExe = crackFiles.find(file => 
        file.toLowerCase().includes('clipstudio_crack') || 
        file.toLowerCase().includes('crack') ||
        file.toLowerCase().includes('patch')
    );
    
    if (!crackExe) {
        throw new Error('Crack executable not found in extracted files');
    }
    
    const fileName = targetPath.split('\\').pop();
    statusElement.textContent = `Requesting Administrator privileges to replace ${fileName}...\n⚠️ Please accept the UAC prompt that appears.`;

    // Εμφάνιση ενημερωτικού μηνύματος
    toast('Administrator privileges required for file replacement. Please accept the UAC prompt.', {
        type: 'info',
        title: 'Elevated Privileges Required',
        duration: 8000
    });

    // Καθυστέρηση για να δει ο χρήστης το μήνυμα
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Κλήση replaceExe - αυτό θα προκαλέσει UAC prompt
    const result = await window.api.replaceExe(crackExe, targetPath);

    if (result.success) {
        statusElement.textContent = '✅ Replacement successful! Clip Studio is now activated.';
        statusElement.classList.add('status-success');
        button.textContent = '✅ Replaced';
        button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';

        toast('Clip Studio crack applied successfully!', {
            type: 'success',
            title: 'Crack Installer',
            duration: 5000
        });

        autoFadeStatus(statusElement, 3000);
    } else {
        if (result.code === 'UAC_DENIED') {
            // Ο χρήστης απέρριψε το UAC prompt
            statusElement.textContent = '❌ Administrator privileges are required to replace the file.\n\nPlease try again and accept the UAC prompt, or run the replacement manually.';
            showManualReplacementInstructions(crackExe, targetPath);
        } else {
            statusElement.textContent = `❌ Replacement failed: ${result.error}`;
        }
        statusElement.classList.add('status-error');
        button.disabled = false;
        button.textContent = 'Replace EXE';
        throw new Error(result.error || 'Replacement failed');
    }
}

// Βοηθητική function για manual replacement instructions
function showManualReplacementInstructions(sourcePath, destPath) {
    const instructions = `
🔧 **Manual Replacement Instructions**

Since Administrator privileges were denied, please replace the file manually:

1. **Open this folder**: ${path.dirname(sourcePath)}
2. **Copy this file**: ${path.basename(sourcePath)}
3. **Navigate to**: ${path.dirname(destPath)}
4. **Paste and replace** the existing file
   - Right-click → "Paste"
   - Click "Replace" if prompted
   - Accept Administrator prompt if appears

After manual replacement, return here and click "✅ I've replaced manually"
`;

    // Δημιουργία manual replacement button
    const card = document.querySelector('.app-card');
    const existingManualBtn = card.querySelector('.manual-replace-btn');
    
    if (!existingManualBtn) {
        const manualBtn = document.createElement('button');
        manualBtn.className = 'button button-secondary manual-replace-btn';
        manualBtn.textContent = '📋 Show Manual Instructions';
        manualBtn.style.marginTop = '0.5rem';
        manualBtn.style.width = '100%';
        manualBtn.onclick = () => {
            // Άνοιγμα των φακέλων
            window.api.openFile(path.dirname(sourcePath));
            setTimeout(() => {
                window.api.openFile(path.dirname(destPath));
            }, 1000);
            
            toast(instructions, {
                type: 'info',
                title: 'Manual Replacement Guide',
                duration: 15000
            });
        };
        card.appendChild(manualBtn);
    }

    toast('Administrator privileges are required. Showing manual instructions.', {
        type: 'warning',
        title: 'Manual Steps Required',
        duration: 8000
    });
}
// Βοηθητική function για να εντοπίσει το 7za.exe τόσο σε development όσο και σε packaged builds.
// Επιστρέφει το μονοπάτι αν βρεθεί ή null αν λείπει.  Αναζητά σε:
// 1. Τον φάκελο bin δίπλα στο main.js (development)
// 2. Τον φάκελο bin μέσα στο resourcesPath (packaged build)
// 3. Τον φάκελο bin στο app.asar.unpacked όταν χρησιμοποιείται asar packaging
async function ensure7za() {
  const candidates = [];
  
  console.log('🔍 Searching for 7za...');
  console.log('Resources path:', process.resourcesPath);
  console.log('__dirname:', __dirname);

  // Βασικοί paths
  if (process.resourcesPath) {
    // Πρώτη προτεραιότητα: extraResources path
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
    candidates.push(path.join(process.resourcesPath, 'bin', '7z.exe'));
    
    // Δεύτερη προτεραιότητα: development
    candidates.push(path.join(__dirname, 'bin', '7za.exe'));
    candidates.push(path.join(__dirname, 'bin', '7z.exe'));
    
    // Τρίτη προτεραιότητα: parent directories
    const parentDir = path.dirname(process.resourcesPath);
    candidates.push(path.join(parentDir, 'bin', '7za.exe'));
    candidates.push(path.join(parentDir, 'bin', '7z.exe'));
  }

  // System 7-Zip
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(path.join(pf, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf, '7-Zip', '7za.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7za.exe'));
  }

  // Έλεγχος όλων των paths
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        console.log('✅ FOUND 7za at:', candidate);
        return candidate;
      }
    } catch (err) {
      console.log('❌ Error checking:', candidate, err.message);
    }
  }

  console.log('❌ 7za.exe not found in any location');
  
  // Λίστα των paths που ελέγχθηκαν
  console.log('📋 Checked paths:');
  candidates.forEach((candidate, index) => {
    console.log(`  ${index + 1}. ${candidate}`);
  });
  
  return null;
}
ipcMain.handle('extract-archive', async (event, { filePath, password, destDir }) => {
  return new Promise(async (resolve) => {
    const archive = String(filePath);
    const pwd = String(password || '');

    let outDir;
    if (destDir) {
      outDir = String(destDir);
    } else {
      const parent = path.dirname(archive);
      const base = path.basename(archive, path.extname(archive));
      outDir = path.join(parent, base);
    }

    try {
      if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      const altDir = outDir.replace(/_/g, ' ');
      if (altDir !== outDir && fs.existsSync(altDir)) {
        fs.rmSync(altDir, { recursive: true, force: true });
      }
      fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {
      // Αγνόησε σφάλματα
    }

    // SIMPLE FALLBACK - Άνοιγμα του αρχείου χωρίς extraction
    const exe = await ensure7za();
    if (!exe) {
      // Αν δεν βρέθηκε 7za, άνοιξε απλά το αρχείο
      shell.openPath(archive);
      resolve({ success: true, output: 'File opened directly (7-Zip not available)' });
      return;
    }

    console.log('Using 7za.exe from:', exe);

    const args = ['x', archive];
    if (pwd) args.push(`-p${pwd}`);
    args.push(`-o${outDir}`);
    args.push('-y');

    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (buf) => { stderr += buf.toString(); });

    child.on('error', (err) => {
      console.error('7za spawn error:', err);
      // Αν το 7za δεν μπορεί να ξεκινήσει, επιστρέφουμε αποτυχία ώστε ο καλών να το διαχειριστεί.
      resolve({ success: false, error: `7za spawn error: ${err.message}` });
    });

    child.on('close', (code) => {
      if (code === 0) {
        // Επιτυχής εξαγωγή
        resolve({ success: true, output: stderr.trim() });
      } else {
        // Μη μηδενικός κωδικός υποδηλώνει αποτυχία. Δεν ανοίγουμε αυτόματα το αρχείο εδώ· ο caller μπορεί
        // να προσπαθήσει με διαφορετικό κωδικό ή να ενημερώσει τον χρήστη.
        const errMsg = stderr.trim() || `7za exited with code ${code}`;
        resolve({ success: false, error: errMsg });
      }
    });
  });
});

// === Spicetify and Spotify management handlers ===
// Install Spicetify: download and run the official install script.  Uses
// PowerShell on Windows and a shell script on Linux/macOS.  Returns
// { success: true, output } on success or { success: false, error, output }
// on failure.
ipcMain.handle('install-spicetify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // On Windows, to show installation progress we open a new PowerShell
      // console window.  We still sanitize the official install.ps1 by
      // downloading it to a temporary file and removing the Marketplace
      // prompt.  Then we run the sanitized installer, attempt to install
      // Marketplace, display the spicetify version and apply the backup.
      try {
        const tmpScriptName = `spicetify_install_${Date.now()}.ps1`;
        const tmpScriptPath = path.join(os.tmpdir(), tmpScriptName);
        const psLines = [
          // Wait a few seconds to show initial output, then minimize the window
          'Start-Sleep -Seconds 3',
          // Define a native function to minimize the current window
          "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);' -Name Native -Namespace Win32",
          // Get the handle to the current PowerShell process window
          '$hwnd = (Get-Process -Id $PID).MainWindowHandle',
          // Minimize the window (6 = SW_MINIMIZE)
          '[Win32.Native]::ShowWindowAsync($hwnd, 6)',
          // Set strict error behaviour
          "$ErrorActionPreference = 'Stop'",
          // Create a unique temporary file for the CLI installer
          "$tempCli = [System.IO.Path]::GetTempFileName() + '.ps1'",
          // Download the official installer script
          "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/cli/main/install.ps1' -OutFile $tempCli",
          // Read lines from the downloaded script
          "$lines = Get-Content $tempCli",
          "$skip = $false",
          "$filtered = @()",
          // Loop over each line and skip everything between the Marketplace
          // region markers.  When a line matches '#region Marketplace' we start
          // skipping until we see '#endregion Marketplace'.
          "foreach ($line in $lines) {",
          "  if ($line -match '#region Marketplace') { $skip = $true; continue }",
          "  if ($line -match '#endregion Marketplace') { $skip = $false; continue }",
          "  if (-not $skip) { $filtered += $line }",
          "}",
          // Write the sanitized script back to the temp file
          "$filtered | Set-Content $tempCli",
          // Execute the sanitized installer script
          "& $tempCli",
          // Remove the temporary CLI installer
          "Remove-Item $tempCli -Force",
          // Attempt to install the Marketplace.  If the installation script
          // fails (for instance if Marketplace has already been installed), we
          // ignore the error.
          "try { Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1' | Invoke-Expression } catch {}",
          // Display installed spicetify version
          "spicetify -v",
          // Apply modifications
          "spicetify backup apply"
        ];
        // Write the script to a temporary file
        fs.writeFileSync(tmpScriptPath, psLines.join('\n'), 'utf8');
        // Launch a new PowerShell window that executes the script.  The window
        // will close automatically after the script completes because we
        // intentionally omit -NoExit.  We do not capture output here; the
        // user can view progress in the new window.  We resolve the
        // promise immediately once the window spawns.
        const child = spawn('cmd.exe', [
          '/c', 'start', '', 'powershell.exe', '-ExecutionPolicy', 'Bypass', '-File', tmpScriptPath
        ], { detached: true });
        child.on('error', (err) => {
          resolve({ success: false, error: err.message, output: '' });
        });
        child.on('spawn', () => {
          resolve({ success: true, output: 'Installer started in a new console window.' });
        });
      } catch (e) {
        resolve({ success: false, error: e.message, output: '' });
      }
    } else {
      // On Unix-like systems, download the install script, strip the
      // interactive marketplace prompt and run it.  The official
      // install.sh script asks whether the user wants to install
      // Marketplace by reading from /dev/tty【382084277944026†L141-L149】, which
      // blocks when run without a TTY.  To ensure non-interactive
      // installation we download the script to a temporary file and
      // remove the prompt and subsequent Marketplace invocation.
      const shell = process.env.SHELL || '/bin/sh';
      // Construct a single shell command to download, sanitize and run
      // the installer.  We wrap everything in one call so that spawn
      // can handle quoting correctly.  The sed expression deletes
      // lines from the prompt up to the marketplace install call.
      // After running the sanitized installer we append commands to install the
      // Marketplace silently (ignored on failure), display the version and
      // apply the modifications.  Each piece is separated by && so that the
      // main installer halts on errors but the Marketplace script failure
      // does not abort the chain.
      const unixCmd = [
        'tmpfile=$(mktemp /tmp/spicetify_install.XXXXXX.sh)',
        'curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh -o "$tmpfile"',
        "sed -i '/Do you want to install spicetify Marketplace?/,/spicetify Marketplace installation script/d' \"$tmpfile\"",
        'sh "$tmpfile"',
        'rm -f "$tmpfile"',
        // Attempt to install the Marketplace; ignore failures
        'curl -fsSL https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.sh | sh || true',
        // Show version info
        'spicetify -v',
        // Apply modifications
        'spicetify backup apply'
      ].join(' && ');
      const child = spawn(shell, ['-c', unixCmd]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        // Strip ANSI codes from combined output for cleaner display
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Installer exited with code ${code}`, output });
      });
    }
  });
});

// Uninstall Spicetify: restore the original Spotify client and remove
// Spicetify configuration directories.  Does not remove Spotify itself.
ipcMain.handle('uninstall-spicetify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Build a PowerShell command sequence: restore, then remove config
      // directories.  Each part is separated by semicolons and
      // suppressed on error.
      const psCmd = [
        'try { spicetify restore } catch { }',
        'try { Remove-Item -Recurse -Force "$env:APPDATA\\spicetify" } catch { }',
        'try { Remove-Item -Recurse -Force "$env:LOCALAPPDATA\\spicetify" } catch { }'
      ].join(' ; ');
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Uninstall exited with code ${code}`, output });
      });
    } else {
      // Use sh to execute commands sequentially, ignoring errors.
      const shCmd = 'spicetify restore || true; rm -rf ~/.spicetify || true; rm -rf ~/.config/spicetify || true';
      const child = spawn('sh', ['-c', shCmd]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => { stdout += data.toString(); });
      child.stderr.on('data', (data) => { stderr += data.toString(); });
      child.on('error', (err) => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', (code) => {
        const rawOut = stdout + stderr;
        const output = stripAnsiCodes(rawOut);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Uninstall exited with code ${code}`, output });
      });
    }
  });
});

ipcMain.handle('full-uninstall-spotify', async () => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      // Full uninstall για desktop Spotify.
      // Βήματα: kill διεργασιών, spicetify restore, reset permissions στο Update,
      // διαγραφή φακέλων Roaming/Local, καθάρισμα Registry (HKCU + HKLM),
      // σβήσιμο συντομεύσεων και force success exit code.
      const psParts = [
        // 1) Kill διεργασίες
        'try { Get-Process -Name "Spotify*" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue } catch { }',

        // 2) Restore original (αν είχε εφαρμοστεί spicetify)
        'try { spicetify restore } catch { }',

        // 3) Reset permissions στο %LOCALAPPDATA%\Spotify\Update
        'try {',
        '  $upd = Join-Path $env:LOCALAPPDATA "Spotify\\Update";',
        '  if (Test-Path $upd) {',
        '    attrib -R -S -H $upd -Recurse -ErrorAction SilentlyContinue;',
        '    takeown /F "$upd" /A /R /D Y | Out-Null;',
        '    icacls "$upd" /grant "*S-1-5-32-544":(OI)(CI)F /T /C | Out-Null;', // Administrators
        '    icacls "$upd" /grant "$env:USERNAME":(OI)(CI)F /T /C | Out-Null;',
        '  }',
        '} catch { }',

        // 4) Διαγραφή φακέλων (Roaming & Local)
        'try { $roam = Join-Path $env:APPDATA "Spotify"; if (Test-Path $roam) { attrib -R -S -H $roam -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $roam -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        'try { $loc  = Join-Path $env:LOCALAPPDATA "Spotify"; if (Test-Path $loc)  { attrib -R -S -H $loc  -Recurse -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $loc  -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',

        // 5) Registry cleanup (HKCU + HKLM)
        // HKCU\Software\Spotify
        'try { if (Test-Path "HKCU:\\Software\\Spotify") { Remove-Item "HKCU:\\Software\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        // HKCU Run entry
        'try { Remove-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "Spotify" -ErrorAction SilentlyContinue } catch { }',
        // HKCU Uninstall\Spotify (σκέτο key)
        'try { if (Test-Path "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        // HKCU Uninstall wildcard
        'try { Get-ChildItem "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        // HKLM Uninstall\Spotify (best-effort, ίσως θέλει admin)
        'try { if (Test-Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify") { Remove-Item "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Spotify" -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',
        // HKLM Uninstall wildcard (best-effort)
        'try { Get-ChildItem "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" -ErrorAction SilentlyContinue | Where-Object { $_.PSChildName -like "Spotify*" } | ForEach-Object { Remove-Item $_.PsPath -Recurse -Force -ErrorAction SilentlyContinue } } catch { }',

        // 6) Συντομεύσεις
        'try { Remove-Item "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PROGRAMDATA\\Microsoft\\Windows\\Start Menu\\Programs\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',
        'try { Remove-Item "$env:PUBLIC\\Desktop\\Spotify.lnk" -Force -ErrorAction SilentlyContinue } catch { }',

        // 7) Force success exit code (για να μη "κοκκινίζει" σε non-zero από takeown/icacls κ.λπ.)
        '$global:LASTEXITCODE = 0',
        'exit 0'
      ];

      const psCmd = psParts.join(' ; ');
      const child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { windowsHide: true });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        const output = stripAnsiCodes(stdout + stderr);
        resolve({ success: false, error: err.message, output });
      });
      child.on('close', code => {
        const output = stripAnsiCodes(stdout + stderr);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Full uninstall exited with code ${code}`, output });
      });
    } else {
      // Linux/macOS: best-effort καθάρισμα χωρίς sudo
      const shellParts = [
        'pkill -f spotify || true',
        'spicetify restore || true',
        'rm -rf ~/.config/spotify || true',
        'rm -rf ~/.cache/spotify || true',
        'rm -rf ~/.var/app/com.spotify.Client || true',
        'rm -rf ~/.local/share/spotify || true',
        'rm -rf ~/.spicetify || true',
        'rm -rf ~/.config/spicetify || true'
      ];
      const shCmd = shellParts.join('; ');
      const child = spawn('sh', ['-c', shCmd]);
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', d => { stderr += d.toString(); });
      child.on('error', err => {
        resolve({ success: false, error: err.message, output: stdout + stderr });
      });
      child.on('close', code => {
        const output = stripAnsiCodes(stdout + stderr);
        if (code === 0) resolve({ success: true, output });
        else resolve({ success: false, error: `Full uninstall exited with code ${code}`, output });
      });
    }
  });
});

// Fixed SFC Scan - Single UAC prompt
ipcMain.handle('run-sfc-scan', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'SFC is only available on Windows' });
      return;
    }

    const batchScript = `@echo off
echo ========================================
echo        SFC System File Checker
echo ========================================
echo.
echo Starting SFC scan with Administrator privileges...
echo Process may take 15-30 minutes.
echo.

sfc /scannow

if %errorlevel% equ 0 (
    echo.
    echo SFC scan completed SUCCESSFULLY!
) else (
    echo.
    echo SFC scan completed with exit code: %errorlevel%
)

echo.
echo Press any key to close this window...
pause >nul
`;

    const batchFile = path.join(os.tmpdir(), `sfc_scan_${Date.now()}.bat`);
    
    try {
      fs.writeFileSync(batchFile, batchScript, 'utf8');
      
      // Use VBS for single UAC prompt
      const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "cmd.exe", "/c ""${batchFile.replace(/\\/g, '\\\\')}""", "", "runas", 1
`;

      const vbsFile = path.join(os.tmpdir(), `elevate_sfc_${Date.now()}.vbs`);
      fs.writeFileSync(vbsFile, vbsScript);

      console.log('Requesting UAC elevation for SFC scan...');

      exec(`wscript "${vbsFile}"`, (error) => {
        // Cleanup after 10 seconds
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch {}
          try { fs.unlinkSync(batchFile); } catch {}
        }, 10000);
        
        if (error) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          resolve({ 
            success: true, 
            message: '✅ SFC scan started with Administrator privileges. Please check the command window for progress.' 
          });
        }
      });
      
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Fixed DISM Repair - Single UAC prompt
ipcMain.handle('run-dism-repair', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'DISM is only available on Windows' });
      return;
    }

    const batchScript = `@echo off
echo ========================================
echo        DISM System Repair Tool
echo ========================================
echo.
echo Starting DISM repair with Administrator privileges...
echo.

DISM /Online /Cleanup-Image /CheckHealth
echo.
DISM /Online /Cleanup-Image /ScanHealth
echo.
DISM /Online /Cleanup-Image /RestoreHealth

echo.
echo DISM repair process completed.
echo.
echo Press any key to close this window...
pause >nul
`;

    const batchFile = path.join(os.tmpdir(), `dism_repair_${Date.now()}.bat`);
    
    try {
      fs.writeFileSync(batchFile, batchScript, 'utf8');
      
      // Use VBS for single UAC prompt
      const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "cmd.exe", "/c ""${batchFile.replace(/\\/g, '\\\\')}""", "", "runas", 1
`;

      const vbsFile = path.join(os.tmpdir(), `elevate_dism_${Date.now()}.vbs`);
      fs.writeFileSync(vbsFile, vbsScript);

      console.log('Requesting UAC elevation for DISM repair...');

      exec(`wscript "${vbsFile}"`, (error) => {
        // Cleanup after 10 seconds
        setTimeout(() => {
          try { fs.unlinkSync(vbsFile); } catch {}
          try { fs.unlinkSync(batchFile); } catch {}
        }, 10000);
        
        if (error) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please accept the UAC prompt.',
            code: 'UAC_DENIED'
          });
        } else {
          resolve({ 
            success: true, 
            message: '✅ DISM repair started with Administrator privileges. Please check the command window for progress.' 
          });
        }
      });
      
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// Fixed Temp Cleanup - Single UAC prompt
ipcMain.handle('run-temp-cleanup', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }

    const psScript = `
# Temporary Files Cleanup with Admin privileges
Write-Host "========================================"
Write-Host "      Temporary Files Cleanup"
Write-Host "========================================"
Write-Host ""

# Clean User TEMP
Write-Host "1. Cleaning User TEMP folders..."
Remove-Item -Path "$env:TEMP\\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Windows Temp
Write-Host "2. Cleaning Windows Temp..."
Remove-Item -Path "C:\\Windows\\Temp\\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Prefetch
Write-Host "3. Cleaning Prefetch..."
Remove-Item -Path "C:\\Windows\\Prefetch\\*" -Recurse -Force -ErrorAction SilentlyContinue

# Clean Internet Temp
Write-Host "4. Cleaning Internet Temp Files..."
Remove-Item -Path "$env:USERPROFILE\\AppData\\Local\\Microsoft\\Windows\\Temporary Internet Files\\*" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "========================================"
Write-Host "     Cleanup completed successfully!"
Write-Host "========================================"
Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
`;

    const psFile = path.join(os.tmpdir(), `temp_cleanup_${Date.now()}.ps1`);
    
    try {
      fs.writeFileSync(psFile, psScript, 'utf8');
      console.log('PowerShell script created:', psFile);

      // Εκτέλεση με UAC elevation
      const child = spawn('powershell.exe', [
        '-ExecutionPolicy', 'Bypass',
        '-File', psFile
      ], {
        detached: true,
        stdio: 'ignore'
      });

      child.on('error', (error) => {
        console.log('PowerShell spawn error:', error);
        resolve({ success: false, error: 'Failed to start cleanup: ' + error.message });
      });

      child.on('spawn', () => {
        console.log('PowerShell cleanup started');
        // Cleanup after delay
        setTimeout(() => {
          try { fs.unlinkSync(psFile); } catch {}
        }, 15000);
        
        resolve({ 
          success: true, 
          message: '✅ Temp files cleanup started with Administrator privileges.' 
        });
      });

      // Alternative: Use Start-Process for UAC
      setTimeout(() => {
        const elevateScript = `
Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -File "${psFile.replace(/\\/g, '\\\\')}"' -Verb RunAs
`;
        const elevateFile = path.join(os.tmpdir(), `elevate_${Date.now()}.ps1`);
        fs.writeFileSync(elevateFile, elevateScript);
        
        exec(`powershell -ExecutionPolicy Bypass -File "${elevateFile}"`, (error) => {
          setTimeout(() => {
            try { fs.unlinkSync(elevateFile); } catch {}
          }, 10000);
        });
      }, 1000);
      
    } catch (error) {
      console.log('General error:', error);
      resolve({ success: false, error: error.message });
    }
  });
});

// === BIOS Restart ===
ipcMain.handle('restart-to-bios', async () => {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve({ success: false, error: 'This feature is only available on Windows' });
      return;
    }

    // Δημιουργία VBS script για UAC elevation
    const vbsScript = `
Set UAC = CreateObject("Shell.Application")
UAC.ShellExecute "cmd", "/c shutdown /r /fw /t 30 /c \"BIOS Restart initiated by Make Your Life Easier App. Computer will restart in 30 seconds.\"", "", "runas", 1
WScript.Sleep(3000)
`;

    const vbsFile = path.join(os.tmpdir(), 'bios_restart.vbs');
    
    try {
      fs.writeFileSync(vbsFile, vbsScript);
      exec(`wscript "${vbsFile}"`, (error) => {
        try { fs.unlinkSync(vbsFile); } catch (e) {}
        
        if (error) {
          resolve({
            success: false,
            error: 'Administrator privileges required. Please run as Administrator.',
            code: 'ADMIN_REQUIRED'
          });
        } else {
          resolve({
            success: true,
            message: 'UAC prompt appeared. Grant permissions to restart to BIOS.'
          });
        }
      });
    } catch (fileError) {
      resolve({
        success: false,
        error: 'Failed to create elevation script: ' + fileError.message
      });
    }
  });
});

// === Password Manager IPC Handlers ===
ipcMain.handle('password-manager-get-categories', async () => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    
    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getCategories((err, rows) => {
      clearTimeout(timeout);
      db.close();
      if (err) {
        console.error('Error getting categories:', err);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, categories: rows || [] });
      }
    });
  });
});

ipcMain.handle('password-manager-add-category', async (event, name) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.addCategory(name, function(err) {
      db.close();
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
    const db = new PasswordManagerDB(pmAuth);
    db.updateCategory(id, name, function(err) {
      db.close();
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
    const db = new PasswordManagerDB(pmAuth);
    db.deleteCategory(id, function(err) {
      db.close();
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
    const db = new PasswordManagerDB(pmAuth);
    
    const timeout = setTimeout(() => {
      db.close();
      resolve({ success: false, error: 'Database timeout' });
    }, 10000);

    db.getPasswordsByCategory(categoryId, (err, rows) => {
      clearTimeout(timeout);
      db.close();
      if (err) {
        console.error('Error getting passwords:', err);
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, passwords: rows || [] });
      }
    });
  });
});

ipcMain.handle('password-manager-add-password', async (event, passwordData) => {
    return new Promise((resolve) => {
        console.log('=== ADD PASSWORD REQUEST ===');
        console.log('Password data received:', {
            title: passwordData.title,
            passwordLength: passwordData.password ? passwordData.password.length : 0,
            hasUsername: !!passwordData.username,
            hasEmail: !!passwordData.email,
            hasUrl: !!passwordData.url,
            hasNotes: !!passwordData.notes
        });
        
        const db = new PasswordManagerDB(pmAuth);
        
        const timeout = setTimeout(() => {
            db.close();
            resolve({ success: false, error: 'Database timeout' });
        }, 10000);

        db.addPassword(passwordData, function(err) {
            clearTimeout(timeout);
            db.close();
            if (err) {
                console.error('Error adding password:', err);
                console.error('Error details:', err.message);
                resolve({ success: false, error: err.message });
            } else {
                console.log('Password added successfully, ID:', this.lastID);
                resolve({ success: true, id: this.lastID });
            }
        });
    });
});
ipcMain.handle('password-manager-update-password', async (event, id, passwordData) => {
  return new Promise((resolve) => {
    const db = new PasswordManagerDB(pmAuth);
    db.updatePassword(id, passwordData, function(err) {
      db.close();
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
    const db = new PasswordManagerDB(pmAuth);
    db.deletePassword(id, function(err) {
      db.close();
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
    const db = new PasswordManagerDB(pmAuth);
    db.searchPasswords(query, (err, rows) => {
      db.close();
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, passwords: rows });
      }
    });
  });
});

ipcMain.handle('open-password-manager', async () => {
  createPasswordManagerWindow();
  return { success: true };
});

// === Authentication Handlers ===
ipcMain.handle('password-manager-has-master-password', async () => {
    try {
        console.log('Checking for master password...');
        
        // Έλεγχος ότι το auth manager είναι initialized
        if (!pmAuth.configPath) {
            console.log('Auth manager not initialized, initializing now...');
            const documentsPath = require('os').homedir() + '/Documents';
            const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
            pmAuth.initialize(pmDirectory);
        }
        
        const result = pmAuth.hasMasterPassword();
        console.log('Master password exists:', result);
        return result;
    } catch (error) {
        console.error('Error checking master password:', error);
        return false;
    }
});

ipcMain.handle('password-manager-create-master-password', async (event, password) => {
    try {
        console.log('Creating master password...');
        
        // Έλεγχος ότι το auth manager είναι initialized
        if (!pmAuth.configPath) {
            console.log('Auth manager not initialized, initializing now...');
            const documentsPath = require('os').homedir() + '/Documents';
            const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
            pmAuth.initialize(pmDirectory);
        }
        
        await pmAuth.createMasterPassword(password);
        return { success: true };
    } catch (error) {
        console.error('Error creating master password:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('password-manager-authenticate', async (event, password) => {
    try {
        console.log('Authenticating...');
        
        // Έλεγχος ότι το auth manager είναι initialized
        if (!pmAuth.configPath) {
            console.log('Auth manager not initialized, initializing now...');
            const documentsPath = require('os').homedir() + '/Documents';
            const pmDirectory = require('path').join(documentsPath, 'MakeYourLifeEasier');
            pmAuth.initialize(pmDirectory);
        }
        
        await pmAuth.authenticate(password);
        return { success: true };
    } catch (error) {
        console.error('Error authenticating:', error);
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

// === System Maintenance Handlers ===
ipcMain.handle('run-activate-script', async () => {
  return new Promise((resolve) => {
    // Add your activation script logic here
    resolve({ success: true, message: 'Activation script completed' });
  });
});

ipcMain.handle('run-autologin-script', async () => {
  return new Promise((resolve) => {
    // Add your autologin script logic here
    resolve({ success: true, message: 'Autologin script completed' });
  });
});

// Πρόσθεσε αυτό το IPC handler στο main.js
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
                // Αναζήτησε αναδρομικά σε υποφακέλους
                searchDirectory(fullPath);
              } else if (stat.isFile()) {
                const ext = path.extname(item).toLowerCase();
                // Συμπεριέλαβε και .bat files
                if (ext === '.exe' || ext === '.bat') {
                  executableFiles.push(fullPath);
                }
              }
            } catch (e) {
              // Αγνόησε σφάλματα πρόσβασης
              continue;
            }
          }
        } catch (error) {
          // Αγνόησε σφάλματα
        }
      }
      
      searchDirectory(directoryPath);
      resolve(executableFiles);
    } catch (error) {
      resolve([]);
    }
  });
});
