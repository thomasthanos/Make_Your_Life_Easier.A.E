/**
 * Renderer Utilities
 * Contains debug logging, debounce, UI helpers and common utility functions
 */

// ============================================
// DEBUG LOGGING
// ============================================

/**
 * Log a debug message with colored output
 * @param {'info'|'warn'|'error'|'success'} level - Log level
 * @param  {...any} args - Arguments to log
 */
export function debug(level, ...args) {
    const emojiMap = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
    const colorMap = {
        info: 'color:#2196F3; font-weight:bold;',
        warn: 'color:#FF9800; font-weight:bold;',
        error: 'color:#F44336; font-weight:bold;',
        success: 'color:#4CAF50; font-weight:bold;'
    };
    const emoji = emojiMap[level] || '';
    const style = colorMap[level] || '';
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const fn =
        level === 'error'
            ? console.error
            : level === 'warn'
                ? console.warn
                : console.log;
    if (isBrowser) {
        fn.call(console, `%c${emoji}`, style, ...args);
    } else {
        fn.call(console, `${emoji}`, ...args);
    }
}

// ============================================
// HTML ESCAPE
// ============================================

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} text - The text to escape
 * @returns {string} The escaped text safe for innerHTML
 */
export function escapeHtml(text) {
    if (text == null) return '';
    const str = String(text);
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

// ============================================
// DEBOUNCE
// ============================================

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified wait time has elapsed since the last call.
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to wait (default: 300)
 * @returns {Function} Debounced function with .cancel() method
 */
export function debounce(func, wait = 300) {
    let timeoutId = null;

    const debounced = function (...args) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            func.apply(this, args);
        }, wait);
    };

    debounced.cancel = function () {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debounced;
}

// ============================================
// PATH UTILITIES
// ============================================

/**
 * Get the directory name from a file path
 * @param {string} filePath - The file path
 * @returns {string} The directory name
 */
function getDirectoryName(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return '';
    }
    const idx = filePath.includes('\\') ? filePath.lastIndexOf('\\') : filePath.lastIndexOf('/');
    return idx === -1 ? '' : filePath.substring(0, idx);
}

/**
 * Get the base name from a file path
 * @param {string} filePath - The file path
 * @param {string} ext - Extension to remove (optional)
 * @returns {string} The base name
 */
export function getBaseName(filePath, ext = '') {
    if (!filePath || typeof filePath !== 'string') {
        return '';
    }
    let fileName;
    if (filePath.includes('\\')) {
        fileName = filePath.substring(filePath.lastIndexOf('\\') + 1);
    } else {
        fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
    }

    if (ext && fileName.endsWith(ext)) {
        fileName = fileName.substring(0, fileName.length - ext.length);
    }
    return fileName;
}

/**
 * Get the extracted folder path from a zip path
 * @param {string} zipPath - The zip file path
 * @returns {string} The expected extracted folder path
 */
export function getExtractedFolderPath(zipPath) {
    const parentDir = getDirectoryName(zipPath);
    const baseName = getBaseName(zipPath, '.zip');
    const sep = zipPath.includes('\\') ? '\\' : '/';
    return `${parentDir}${sep}${baseName}`;
}

// ============================================
// VERSION UTILITIES
// ============================================

/**
 * Normalize a version string (remove 'v' prefix, validate format)
 * @param {string} v - Version string
 * @returns {string|null} Normalized version or null if invalid
 */
export function normalizeVersion(v) {
    if (!v) return null;
    v = String(v).trim().replace(/^v/i, '');

    if (/^0+(?:\.0+){0,3}$/.test(v)) return null;

    if (!/^\d+(?:\.\d+){1,3}$/.test(v)) return null;
    return v;
}

/**
 * Normalize version and add 'v' prefix
 * @param {string} v - Version string
 * @returns {string|null} Normalized version with 'v' prefix or null
 */
export function normalizeVersionTag(v) {
    const normalized = normalizeVersion(v);
    return normalized ? `v${normalized}` : null;
}

/**
 * Get the app version with fallback options
 * @returns {Promise<string>} Version string with 'v' prefix
 */
export async function getAppVersionWithFallback() {
    try {
        if (window.api?.getAppVersion) {
            const raw = await window.api.getAppVersion();
            const v = normalizeVersion(raw);
            if (v) return `v${v}`;
        }
    } catch { }
    const packageCandidates = ['../../package.json', './package.json'];
    for (const url of packageCandidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const pkg = await res.json();
                const v = normalizeVersion(pkg?.version);
                if (v) return `v${v}`;
            }
        } catch {
            // Try next candidate
        }
    }
    const envV = normalizeVersion(typeof process !== 'undefined' ? process?.env?.npm_package_version : null);
    if (envV) return `v${envV}`;
    return 'v1.0.0';
}



