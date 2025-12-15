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
 * @param {boolean} immediate - Execute on leading edge instead of trailing
 * @returns {Function} Debounced function with .cancel() method
 */
export function debounce(func, wait = 300, immediate = false) {
    let timeoutId = null;

    const debounced = function (...args) {
        const callNow = immediate && !timeoutId;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = null;
            if (!immediate) {
                func.apply(this, args);
            }
        }, wait);

        if (callNow) {
            func.apply(this, args);
        }
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
export function getDirectoryName(filePath) {
    if (filePath.includes('\\')) {
        return filePath.substring(0, filePath.lastIndexOf('\\'));
    }
    return filePath.substring(0, filePath.lastIndexOf('/'));
}

/**
 * Get the base name from a file path
 * @param {string} filePath - The file path
 * @param {string} ext - Extension to remove (optional)
 * @returns {string} The base name
 */
export function getBaseName(filePath, ext = '') {
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
    return `${parentDir}\\${baseName}`;
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
    try {
        const res = await fetch('./package.json');
        if (res.ok) {
            const pkg = await res.json();
            const v = normalizeVersion(pkg?.version);
            if (v) return `v${v}`;
        }
    } catch { }
    const envV = normalizeVersion(typeof process !== 'undefined' ? process?.env?.npm_package_version : null);
    if (envV) return `v${envV}`;
    return 'v1.0.0';
}

// ============================================
// SVG DATA URL HELPER
// ============================================

/**
 * Convert an SVG string to a data URL
 * @param {string} svg - SVG markup
 * @returns {string} Data URL
 */
export function svgDataUrl(svg) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ============================================
// UI HELPERS
// ============================================

/**
 * Auto-fade a status element after a delay
 * @param {HTMLElement} statusElement - The status element to fade
 * @param {number} delay - Delay in milliseconds before fading
 */
export function autoFadeStatus(statusElement, delay = 5000) {
    if (!statusElement || !statusElement.textContent || statusElement.textContent.trim() === '') return;

    if (statusElement._autoFadeTimeout) {
        clearTimeout(statusElement._autoFadeTimeout);
    }

    statusElement._autoFadeTimeout = setTimeout(() => {
        statusElement.classList.add('status-element', 'fade-out');

        setTimeout(() => {
            statusElement.classList.remove('visible');
            statusElement.classList.add('status-element');
            statusElement.classList.remove('fade-out');
            statusElement.classList.add('reset');
            statusElement.textContent = '';
            statusElement.classList.remove('status-success', 'status-error', 'status-warning');
        }, 500);
    }, delay);
}

/**
 * Create a modern button element
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} options - Button options
 * @returns {HTMLButtonElement} The button element
 */
export function createModernButton(text, onClick, options = {}) {
    const button = document.createElement('button');
    button.className = options.secondary ? 'button button-secondary' : 'button';
    button.textContent = text;

    if (options.icon) {
        button.innerHTML = `${options.icon} ${escapeHtml(text)}`;
    }

    if (onClick) {
        button.addEventListener('click', onClick);
    }

    if (options.style) {
        Object.assign(button.style, options.style);
    }

    return button;
}

/**
 * Create a card element with title and body content
 * @param {string} titleKey - Translation key for title
 * @param {string|Node|Array} bodyContent - Card body content
 * @param {Object} translations - Translations object
 * @returns {HTMLDivElement} The card element
 */
export function createCard(titleKey, bodyContent, translations = {}) {
    const card = document.createElement('div');
    card.className = 'card';

    const h2 = document.createElement('h2');
    h2.textContent = translations.pages?.[titleKey] || titleKey;
    card.appendChild(h2);

    if (typeof bodyContent === 'string') {
        const p = document.createElement('p');
        p.textContent = bodyContent;
        p.classList.add('description-text');
        card.appendChild(p);
    } else if (bodyContent instanceof Node) {
        card.appendChild(bodyContent);
    } else if (Array.isArray(bodyContent)) {
        bodyContent.forEach((node) => card.appendChild(node));
    }

    return card;
}
