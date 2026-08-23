/**
 * Security Validation Module
 * Provides input validation, path sanitization, and security checks
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

/**
 * Whether `target` is inside `dir` (or is `dir` itself).
 *
 * A bare `startsWith` is not a containment test: with `dir` = C:\Users\me\Downloads
 * it also accepts C:\Users\me\Downloads-old and C:\Users\me\DownloadsEvil, because
 * the prefix matches without a separator behind it. Every boundary check in this
 * module goes through here so the separator is never forgotten.
 * @param {string} target - Absolute path being checked
 * @param {string} dir - Absolute directory that should contain it
 * @returns {boolean} True when target is dir or lives under it
 */
function isWithin(target, dir) {
  try {
    const resolvedDir = path.resolve(dir);
    const relative = path.relative(resolvedDir, path.resolve(target));
    // '' means the two are the same path; a leading '..' means target escaped it.
    return relative === '' || (!relative.startsWith('..' + path.sep)
      && relative !== '..'
      && !path.isAbsolute(relative));
  } catch {
    return false;
  }
}

/**
 * Validate that a path is safe and doesn't contain injection patterns
 * @param {string} filePath - The path to validate
 * @returns {{valid: boolean, error?: string, normalized?: string}}
 */
function validatePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { valid: false, error: 'Invalid path: must be a non-empty string' };
  }

  // Normalize the path first
  let normalized;
  try {
    normalized = path.normalize(filePath);
  } catch (err) {
    return { valid: false, error: 'Invalid path format' };
  }

  // Check for dangerous patterns that could be used for injection
  const dangerousPatterns = [
    /[;|`$<>]/,            // Command separators and redirection
    /\$\(/,                // Command substitution
    /\$\{/,                // Variable expansion with braces
    /\.\./,                // Path traversal (we'll handle this separately)
    /[\x00-\x1f]/,         // Control characters
    /[\r\n]/,              // Newlines
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return { valid: false, error: 'Path contains potentially dangerous characters' };
    }
  }

  // Resolve to absolute path to prevent path traversal
  let resolved;
  try {
    resolved = path.resolve(normalized);
  } catch (err) {
    return { valid: false, error: 'Cannot resolve path' };
  }

  // Additional validation: ensure path doesn't escape expected boundaries
  // This is a basic check - you may want to add whitelist/blacklist logic
  const systemRoot = process.platform === 'win32' 
    ? (process.env.SystemRoot || 'C:\\Windows')
    : '/';

  // Block access to critical system directories
  const blockedPaths = [
    systemRoot,
    process.platform === 'win32' ? 'C:\\Windows\\System32' : '/bin',
    process.platform === 'win32' ? 'C:\\Windows\\SysWOW64' : '/sbin',
  ];

  for (const blocked of blockedPaths) {
    if (isWithin(resolved, blocked)) {
      return { valid: false, error: 'Access to system directories is not allowed' };
    }
  }

  return { valid: true, normalized: resolved };
}

/**
 * The directories this app legitimately writes into.
 *
 * Downloads and extraction targets arrive from the renderer, and the download
 * manager writes an absolute `dest` verbatim while the extractor recursively
 * removes its output directory before unpacking. Anchoring both to this list
 * means a compromised renderer cannot drop a file into Startup or wipe a folder
 * in the user's profile — the paths the app actually uses (its Downloads folder,
 * %TEMP%, and its own userData directory) all live here.
 * @param {string} [userDataPath] - app.getPath('userData'), when available
 * @returns {string[]} Absolute directories that may be written to
 */
function writableRoots(userDataPath) {
  const roots = [path.join(os.homedir(), 'Downloads'), os.tmpdir()];
  if (userDataPath) roots.push(userDataPath);
  return roots;
}

/**
 * Whether a path sits inside one of the app's writable roots.
 * @param {string} target - Absolute path to test
 * @param {string} [userDataPath] - app.getPath('userData'), when available
 * @returns {boolean} True when the path is an allowed write target
 */
function isWritableTarget(target, userDataPath) {
  return writableRoots(userDataPath).some((root) => isWithin(target, root));
}

/**
 * Validate file path for deletion operations
 * Additional restrictions for delete operations
 * @param {string} filePath - The path to validate
 * @param {string[]} allowedDirs - Optional whitelist of allowed directories
 * @returns {{valid: boolean, error?: string, normalized?: string}}
 */
function validateDeletePath(filePath, allowedDirs = []) {
  const baseValidation = validatePath(filePath);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const resolved = baseValidation.normalized;

  // If whitelist is provided, enforce it
  if (allowedDirs.length > 0) {
    const isAllowed = allowedDirs.some(dir => isWithin(resolved, dir));

    if (!isAllowed) {
      return { valid: false, error: 'File deletion is not allowed in this directory' };
    }
  }

  // Additional safety: prevent deletion of critical files
  const criticalExtensions = ['.exe', '.dll', '.sys', '.drv'];
  const ext = path.extname(resolved).toLowerCase();
  
  // Only allow deletion of certain file types in specific contexts
  // This is a basic check - you may want to customize based on your needs
  if (criticalExtensions.includes(ext)) {
    // Allow only if in user's temp or downloads directories
    const tempDir = os.tmpdir();
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    
    const isInSafeDir = isWithin(resolved, tempDir) || isWithin(resolved, downloadsDir);
    
    if (!isInSafeDir) {
      return { valid: false, error: 'Deletion of system executables is restricted' };
    }
  }

  return { valid: true, normalized: resolved };
}

/**
 * Validate command arguments for safe execution
 * @param {string[]} args - Command arguments to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateCommandArgs(args) {
  if (!Array.isArray(args)) {
    return { valid: false, error: 'Arguments must be an array' };
  }

  for (const arg of args) {
    if (typeof arg !== 'string') {
      return { valid: false, error: 'All arguments must be strings' };
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /[;&|`$<>]/,         // Command separators
      /\$\(/,              // Command substitution
      /\$\{/,              // Variable expansion
      /[\r\n]/,            // Newlines
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(arg)) {
        return { valid: false, error: 'Arguments contain potentially dangerous characters' };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate that a file exists and is accessible
 * @param {string} filePath - The path to check
 * @returns {Promise<{valid: boolean, error?: string, exists?: boolean}>}
 */
async function validateFileExists(filePath) {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return validation;
  }

  try {
    const exists = fs.existsSync(validation.normalized);
    return { valid: true, exists };
  } catch (err) {
    return { valid: false, error: `Cannot check file existence: ${err.message}` };
  }
}

module.exports = {
  isWithin,
  writableRoots,
  isWritableTarget,
  validatePath,
  validateDeletePath,
  validateCommandArgs,
  validateFileExists
};

