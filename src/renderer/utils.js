

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

export function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / Math.pow(1024, index)).toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

export function stripAnsi(text) {
    return String(text)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x08/g, '');
}


function getDirectoryName(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return '';
    }
    const idx = filePath.includes('\\') ? filePath.lastIndexOf('\\') : filePath.lastIndexOf('/');
    return idx === -1 ? '' : filePath.substring(0, idx);
}

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

export function getExtractedFolderPath(zipPath) {
    const parentDir = getDirectoryName(zipPath);
    const baseName = getBaseName(zipPath, '.zip');
    const sep = zipPath.includes('\\') ? '\\' : '/';
    return `${parentDir}${sep}${baseName}`;
}


export function normalizeVersion(v) {
    if (!v) return null;
    v = String(v).trim().replace(/^v/i, '');

    if (/^0+(?:\.0+){0,3}$/.test(v)) return null;

    if (!/^\d+(?:\.\d+){1,3}$/.test(v)) return null;
    return v;
}

export function normalizeVersionTag(v) {
    const normalized = normalizeVersion(v);
    return normalized ? `v${normalized}` : null;
}

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
        }
    }
    const envV = normalizeVersion(typeof process !== 'undefined' ? process?.env?.npm_package_version : null);
    if (envV) return `v${envV}`;
    return 'v1.0.0';
}



