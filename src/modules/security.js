
const path = require('path');
const os = require('os');
const fs = require('fs');

function isWithin(target, dir) {
  try {
    const resolvedDir = path.resolve(dir);
    const relative = path.relative(resolvedDir, path.resolve(target));
    return relative === '' || (!relative.startsWith('..' + path.sep)
      && relative !== '..'
      && !path.isAbsolute(relative));
  } catch {
    return false;
  }
}

function validatePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    return { valid: false, error: 'Invalid path: must be a non-empty string' };
  }

  let normalized;
  try {
    normalized = path.normalize(filePath);
  } catch (err) {
    return { valid: false, error: 'Invalid path format' };
  }

  const dangerousPatterns = [
    /[;|`$<>]/,
    /\$\(/,
    /\$\{/,
    /\.\./,
    /[\x00-\x1f]/,
    /[\r\n]/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(normalized)) {
      return { valid: false, error: 'Path contains potentially dangerous characters' };
    }
  }

  let resolved;
  try {
    resolved = path.resolve(normalized);
  } catch (err) {
    return { valid: false, error: 'Cannot resolve path' };
  }

  const systemRoot = process.platform === 'win32'
    ? (process.env.SystemRoot || 'C:\\Windows')
    : '/';

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

function writableRoots(userDataPath) {
  const roots = [path.join(os.homedir(), 'Downloads'), os.tmpdir()];
  if (userDataPath) roots.push(userDataPath);
  return roots;
}

function isWritableTarget(target, userDataPath) {
  return writableRoots(userDataPath).some((root) => isWithin(target, root));
}

function validateDeletePath(filePath, allowedDirs = []) {
  const baseValidation = validatePath(filePath);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const resolved = baseValidation.normalized;

  if (allowedDirs.length > 0) {
    const isAllowed = allowedDirs.some(dir => isWithin(resolved, dir));

    if (!isAllowed) {
      return { valid: false, error: 'File deletion is not allowed in this directory' };
    }
  }

  const criticalExtensions = ['.exe', '.dll', '.sys', '.drv'];
  const ext = path.extname(resolved).toLowerCase();

  if (criticalExtensions.includes(ext)) {
    const tempDir = os.tmpdir();
    const downloadsDir = path.join(os.homedir(), 'Downloads');

    const isInSafeDir = isWithin(resolved, tempDir) || isWithin(resolved, downloadsDir);

    if (!isInSafeDir) {
      return { valid: false, error: 'Deletion of system executables is restricted' };
    }
  }

  return { valid: true, normalized: resolved };
}

function validateCommandArgs(args) {
  if (!Array.isArray(args)) {
    return { valid: false, error: 'Arguments must be an array' };
  }

  for (const arg of args) {
    if (typeof arg !== 'string') {
      return { valid: false, error: 'All arguments must be strings' };
    }

    const dangerousPatterns = [
      /[;&|`$<>]/,
      /\$\(/,
      /\$\{/,
      /[\r\n]/,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(arg)) {
        return { valid: false, error: 'Arguments contain potentially dangerous characters' };
      }
    }
  }

  return { valid: true };
}

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

