/**
 * Archive Utils Module
 * Handles archive extraction using 7za
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { debug } = require('./debug');
const { isWithin } = require('./security');

/**
 * Find 7za executable
 * @returns {Promise<string|null>}
 */
async function ensure7za() {
  const candidates = [];

  debug('info', '🔍 Searching for 7za...');

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', '7za.exe'));
    candidates.push(path.join(process.resourcesPath, 'bin', '7z.exe'));
    candidates.push(path.join(__dirname, '..', 'resources', 'bin', '7za.exe'));
    candidates.push(path.join(__dirname, '..', 'resources', 'bin', '7z.exe'));

    const parentDir = path.dirname(process.resourcesPath);
    candidates.push(path.join(parentDir, 'bin', '7za.exe'));
    candidates.push(path.join(parentDir, 'bin', '7z.exe'));
  }

  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(path.join(pf, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf, '7-Zip', '7za.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7z.exe'));
    candidates.push(path.join(pf86, '7-Zip', '7za.exe'));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        debug('success', '✅ FOUND 7za at:', candidate);
        return candidate;
      }
    } catch (err) {
      debug('error', 'Error checking:', candidate, err.message);
    }
  }

  debug('warn', '7za.exe not found in any location');
  return null;
}

/**
 * List an archive and return the first entry that would land outside `outDir`.
 *
 * Nothing downstream constrains where entries go — the paths inside the archive
 * are simply handed to 7za, which writes them wherever they point. An entry like
 * `..\..\Startup\evil.exe` therefore escapes the extraction directory entirely.
 * `l -slt` prints one `Path = ...` line per entry, which is enough to check every
 * destination against the directory we intend to fill before writing anything.
 *
 * A listing that fails (wrong password, corrupt file) is not treated as unsafe —
 * the extraction that follows will fail on its own and report the real reason.
 * @param {string} exe - Path to 7za
 * @param {string} archive - Archive to inspect
 * @param {string} pwd - Archive password, if any
 * @param {string} outDir - Directory the archive will be extracted into
 * @returns {Promise<string|null>} The offending entry path, or null when all are safe
 */
function findEscapingEntry(exe, archive, pwd, outDir) {
  return new Promise((resolve) => {
    const args = ['l', '-slt', archive];
    if (pwd) args.push(`-p${pwd}`);

    const child = spawn(exe, args, { windowsHide: true });
    let stdout = '';
    const timeout = setTimeout(() => { try { child.kill(); } catch { } resolve(null); }, 30000);

    child.stdout.on('data', (buf) => { stdout += buf.toString(); });
    child.on('error', () => { clearTimeout(timeout); resolve(null); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) return resolve(null);

      for (const line of stdout.split(/\r?\n/)) {
        const match = /^Path = (.+)$/.exec(line);
        if (!match) continue;
        const entry = match[1].trim();
        // 7-Zip echoes the archive's own path as the first "Path =" line.
        if (!entry || path.resolve(entry) === path.resolve(archive)) continue;
        if (path.isAbsolute(entry) || !isWithin(path.resolve(outDir, entry), outDir)) {
          return resolve(entry);
        }
      }
      resolve(null);
    });
  });
}

/**
 * Extract an archive
 * @param {string} filePath - Path to the archive
 * @param {string} password - Optional password
 * @param {string} destDir - Optional destination directory
 * @param {Function} trackExtractedDir - Function to track extracted directories
 * @returns {Promise<Object>}
 */
async function extractArchive(filePath, password, destDir, trackExtractedDir) {
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

  // Directory setup — kill any locked exes inside before removing
  const killLockedExes = (dir) => {
    return new Promise((resolve) => {
      if (!fs.existsSync(dir)) return resolve();
      // Safety timeout — don't hang if taskkill never returns
      const timeout = setTimeout(() => resolve(), 5000);
      try {
        const items = fs.readdirSync(dir);
        // The image name handed to `taskkill /F /IM` comes out of a previously
        // extracted archive, so the archive gets to choose which process dies.
        // Restrict it to a plain filename: no path separators, no wildcards, no
        // PID-looking values, nothing that could name a process we did not put here.
        const exes = items.filter((f) => /^[\w.-]+\.exe$/i.test(f));
        if (exes.length === 0) { clearTimeout(timeout); return resolve(); }
        let pending = exes.length;
        const done = () => { if (--pending === 0) { clearTimeout(timeout); resolve(); } };
        exes.forEach(exe => {
          const kill = spawn('taskkill', ['/F', '/IM', exe], { windowsHide: true, stdio: 'ignore' });
          kill.on('close', done);
          kill.on('error', done);
        });
      } catch { clearTimeout(timeout); resolve(); }
    });
  };

  try {
    if (fs.existsSync(outDir)) {
      await killLockedExes(outDir);
      // Small delay to let Windows release file handles
      await new Promise(r => setTimeout(r, 500));
      try { fs.rmSync(outDir, { recursive: true, force: true }); } catch (e) {
        debug('warn', 'Could not fully remove outDir:', e.message);
      }
    }
    // There used to be a second pass here that also deleted
    // `outDir.replace(/_/g, ' ')`. Because sanitizeFilename() turns every
    // non-alphanumeric character into '_', extracting Clip_Studio_Paint.zip
    // recursively removed ~/Downloads/Clip Studio Paint — a folder this app never
    // created and has no business touching. Only the directory we are about to
    // extract into gets cleared.
    fs.mkdirSync(outDir, { recursive: true });

    if (trackExtractedDir) {
      trackExtractedDir(outDir);
    }
  } catch (e) {
    debug('warn', 'Directory setup error:', e.message);
  }

  // Find 7za executable
  const exe = await ensure7za();
  if (!exe) {
    return { success: false, error: '7-Zip executable not found — cannot extract archive.' };
  }

  debug('info', 'Using 7za.exe from:', exe);

  const slip = await findEscapingEntry(exe, archive, pwd, outDir);
  if (slip) {
    debug('warn', 'Refusing archive with an escaping entry:', slip);
    return { success: false, error: `Archive contains an unsafe path and was not extracted: ${slip}` };
  }

  // Build arguments
  const args = ['x', archive];
  if (pwd) args.push(`-p${pwd}`);
  args.push(`-o${outDir}`);
  args.push('-y');

  // ✅ Wrap only the spawn part in Promise (no async executor!)
  return new Promise((resolve) => {
    const child = spawn(exe, args, { windowsHide: true });
    let stderr = '';

    child.stderr.on('data', (buf) => { stderr += buf.toString(); });

    child.on('error', (err) => {
      debug('error', '7za spawn error:', err);
      resolve({ success: false, error: `7za spawn error: ${err.message}` });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output: stderr.trim() });
      } else {
        const errMsg = stderr.trim() || `7za exited with code ${code}`;
        resolve({ success: false, error: errMsg });
      }
    });
  });
}

module.exports = {
  ensure7za,
  extractArchive
};
