/**
 * Security Validation Module
 * Provides input validation, path sanitization, and security checks
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

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
    /[;&|`$<>]/,           // Command separators and redirection
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
  const homedir = os.homedir();
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
    if (resolved.toLowerCase().startsWith(blocked.toLowerCase())) {
      return { valid: false, error: 'Access to system directories is not allowed' };
    }
  }

  return { valid: true, normalized: resolved };
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
    const isAllowed = allowedDirs.some(dir => {
      try {
        const resolvedDir = path.resolve(dir);
        return resolved.toLowerCase().startsWith(resolvedDir.toLowerCase());
      } catch {
        return false;
      }
    });

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
    
    const isInSafeDir = resolved.toLowerCase().startsWith(tempDir.toLowerCase()) ||
                        resolved.toLowerCase().startsWith(downloadsDir.toLowerCase());
    
    if (!isInSafeDir) {
      return { valid: false, error: 'Deletion of system executables is restricted' };
    }
  }

  return { valid: true, normalized: resolved };
}

/**
 * Sanitize a path for use in PowerShell commands
 * Escapes special characters and validates the path
 * @param {string} filePath - The path to sanitize
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
function sanitizePathForPowerShell(filePath) {
  const validation = validatePath(filePath);
  if (!validation.valid) {
    return validation;
  }

  const normalized = validation.normalized;

  // PowerShell path escaping: single quotes escape everything except single quotes
  // We need to escape single quotes by doubling them
  const sanitized = normalized.replace(/'/g, "''");

  return { valid: true, sanitized: `'${sanitized}'` };
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
 * Validate command arguments and throw on failure
 * Use this when you want to ensure execution stops on invalid arguments
 * @param {string[]} args - Command arguments to validate
 * @throws {Error} If validation fails
 */
function validateCommandArgsOrThrow(args) {
  const result = validateCommandArgs(args);
  if (!result.valid) {
    throw new Error(`Command argument validation failed: ${result.error}`);
  }
}

/**
 * Validate path and throw on failure
 * Use this when you want to ensure execution stops on invalid path
 * @param {string} filePath - The path to validate
 * @returns {string} The normalized path
 * @throws {Error} If validation fails
 */
function validatePathOrThrow(filePath) {
  const result = validatePath(filePath);
  if (!result.valid) {
    throw new Error(`Path validation failed: ${result.error}`);
  }
  return result.normalized;
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

/**
 * Check if a path is within allowed boundaries
 * @param {string} filePath - The path to check
 * @param {string[]} allowedDirs - Array of allowed directory prefixes
 * @returns {boolean}
 */
function isPathInAllowedDirs(filePath, allowedDirs) {
  if (!allowedDirs || allowedDirs.length === 0) {
    return true; // No restrictions
  }

  const validation = validatePath(filePath);
  if (!validation.valid) {
    return false;
  }

  const resolved = validation.normalized.toLowerCase();

  return allowedDirs.some(dir => {
    try {
      const resolvedDir = path.resolve(dir).toLowerCase();
      return resolved.startsWith(resolvedDir);
    } catch {
      return false;
    }
  });
}

module.exports = {
  validatePath,
  validatePathOrThrow,
  validateDeletePath,
  sanitizePathForPowerShell,
  validateCommandArgs,
  validateCommandArgsOrThrow,
  validateFileExists,
  isPathInAllowedDirs
};

