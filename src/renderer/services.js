/**
 * Renderer Services
 * Contains business logic for downloads, updates, and settings
 */

import { debug, getAppVersionWithFallback, normalizeVersion, normalizeVersionTag, escapeHtml } from './utils.js';
import { toast, showUpdateOverlay, updateUpdateOverlay, hideUpdateOverlay } from './components.js';
import { attachTooltipHandlers } from './managers.js';

// ============================================
// SETTINGS MANAGEMENT
// ============================================

const defaultSettings = {
    lang: 'en',
    theme: 'dark'
};

/**
 * Load settings from localStorage with defaults
 * @returns {Object} Settings object
 */
export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('myAppSettings'));
        return { ...defaultSettings, ...(saved || {}) };
    } catch (e) {
        return { ...defaultSettings };
    }
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object to save
 */
export function saveSettings(settings) {
    localStorage.setItem('myAppSettings', JSON.stringify(settings));
}

/**
 * Apply theme to document
 * @param {string} theme - Theme name
 */
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
}

// ============================================
// TRANSLATIONS
// ============================================

let translations = {};

/**
 * Load translations for the specified language
 * @param {string} lang - Language code
 * @returns {Promise<Object>} Translations object
 */
export async function loadTranslations(lang) {
    const candidates = [`lang/${lang}.json`, `${lang}.json`];
    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                translations = await res.json();
                document.documentElement.setAttribute('lang', lang || 'en');
                return translations;
            }
        } catch (e) {
            // Try next candidate
        }
    }

    translations = {};
    document.documentElement.setAttribute('lang', lang || 'en');
    return translations;
}

/**
 * Get current translations object
 * @returns {Object} Translations
 */
export function getTranslations() {
    return translations;
}

/**
 * Set translations object (for external use)
 * @param {Object} trans - Translations object
 */
export function setTranslations(trans) {
    translations = trans;
}

// ============================================
// WINDOW RESIZE
// ============================================

/**
 * Smoothly resize the Electron window over a short duration
 * @param {number} targetWidth - Desired final width in pixels
 * @param {number} targetHeight - Desired final height in pixels
 * @param {number} duration - Total animation duration in ms
 */
export async function resizeWindowSmooth(targetWidth, targetHeight, duration = 200) {
    try {
        if (!window.api || typeof window.api.getWindowSize !== 'function' || typeof window.api.setWindowSize !== 'function') {
            window.api?.setWindowSize?.(targetWidth, targetHeight);
            return;
        }
        const currentSize = await window.api.getWindowSize();
        if (!Array.isArray(currentSize) || currentSize.length < 2) {
            await window.api.setWindowSize(targetWidth, targetHeight);
            return;
        }
        const [cw, ch] = currentSize;
        const steps = 15;
        const interval = duration / steps;
        const dw = (targetWidth - cw) / steps;
        const dh = (targetHeight - ch) / steps;
        for (let i = 1; i <= steps; i++) {
            const w = Math.round(cw + dw * i);
            const h = Math.round(ch + dh * i);
            await window.api.setWindowSize(w, h);
            await new Promise((resolve) => setTimeout(resolve, interval));
        }
    } catch (err) {
        try {
            window.api?.setWindowSize?.(targetWidth, targetHeight);
        } catch {
            // ignore secondary failures
        }
    }
}

// ============================================
// AUTO-UPDATER
// ============================================

/**
 * Initialize the auto-updater functionality
 * @param {Object} callbacks - Optional callbacks for update events
 */
export function initializeAutoUpdater(callbacks = {}) {
    const updateBtn = document.getElementById('title-bar-update');

    if (typeof window === 'undefined' || typeof window.api === 'undefined') {
        console.warn('AutoUpdater: window.api not available; skipping update event handlers.');
        return;
    }

    if (typeof window.api.onUpdateStatus !== 'function') {
        console.warn('AutoUpdater: onUpdateStatus not available; skipping update event handlers.');
        return;
    }

    if (!updateBtn) {
        window.api.onUpdateStatus((data) => {
            switch (data.status) {
                case 'available':
                    showUpdateOverlay(`Downloading update…`);
                    break;
                case 'downloading': {
                    const percent = Math.round(data.percent || 0);
                    showUpdateOverlay(`Downloading update: ${percent}%`);
                    updateUpdateOverlay(percent, `Downloading update: ${percent}%`);
                    break;
                }
                case 'downloaded':
                    showUpdateOverlay('Installing update…');
                    updateUpdateOverlay(100, 'Installing update…');
                    break;
                case 'error':
                    hideUpdateOverlay();
                    toast('Update error', { type: 'error', title: 'Update' });
                    break;
            }
        });
        return;
    }

    updateBtn.classList.add('update-btn-hidden');

    let updateAvailable = false;
    let updateDownloaded = false;
    let currentUpdateInfo = null;

    attachTooltipHandlers(updateBtn);

    updateBtn.addEventListener('click', async () => {
        if (updateBtn.classList.contains('downloading')) return;
        if (!updateAvailable) return;

        updateBtn.classList.add('downloading');
        updateBtn.setAttribute('data-tooltip', 'Downloading update...');

        try {
            await window.api.downloadUpdate();
        } catch (error) {
            updateBtn.classList.remove('downloading');
            updateBtn.setAttribute('data-tooltip', 'Update available');
            toast('Failed to download update', { type: 'error', title: 'Update' });
        }
    });

    window.api.onUpdateStatus((data) => {
        switch (data.status) {
            case 'available':
                updateAvailable = true;
                currentUpdateInfo = data;
                updateBtn.classList.add('available');
                updateBtn.setAttribute('data-tooltip', `Downloading update…`);
                showUpdateOverlay(`Downloading update…`);
                break;

            case 'downloading': {
                updateBtn.classList.add('downloading');
                const percent = Math.round(data.percent || 0);
                updateBtn.setAttribute('data-tooltip', `Downloading: ${percent}%`);
                const circle = updateBtn.querySelector('.progress-ring circle');
                if (circle) {
                    const circumference = 2 * Math.PI * 10;
                    const offset = circumference - (percent / 100) * circumference;
                    circle.style.strokeDashoffset = offset;
                }
                showUpdateOverlay(`Downloading update: ${percent}%`);
                updateUpdateOverlay(percent, `Downloading update: ${percent}%`);
                break;
            }

            case 'downloaded':
                updateDownloaded = true;
                updateBtn.classList.remove('downloading');
                updateBtn.classList.add('ready');
                updateBtn.setAttribute('data-tooltip', 'Installing update…');
                showUpdateOverlay('Installing update…');
                updateUpdateOverlay(100, 'Installing update…');
                setTimeout(async () => {
                    try {
                        if (currentUpdateInfo) {
                            const info = {
                                version: currentUpdateInfo.version,
                                releaseName: currentUpdateInfo.releaseName,
                                releaseNotes: currentUpdateInfo.releaseNotes,
                                timestamp: Date.now()
                            };
                            try {
                                await window.api.saveUpdateInfo(info);
                            } catch (e) {
                                try {
                                    localStorage.setItem('pendingUpdateInfo', JSON.stringify(info));
                                } catch (storageErr) {
                                    console.error('Failed to store update info', storageErr);
                                }
                            }
                        }
                    } catch (error) {
                        console.error('Error persisting update info:', error);
                    }
                }, 0);
                break;

            case 'error':
                updateBtn.classList.remove('downloading');
                updateBtn.setAttribute('data-tooltip', 'Update failed');
                hideUpdateOverlay();
                toast('Update error', { type: 'error', title: 'Update' });
                break;
        }
    });
}

// ============================================
// CHANGELOG
// ============================================

/**
 * Check if changelog should be shown for this version
 * @param {string} version - Version string
 * @returns {boolean}
 */
export function shouldShowChangelog(version) {
    const key = normalizeVersionTag(version);
    if (!key) return true;
    return localStorage.getItem('changelog_shown_version') !== key;
}

/**
 * Mark changelog as shown for this version
 * @param {string} version - Version string
 */
export function markChangelogShown(version) {
    const key = normalizeVersionTag(version);
    if (key) {
        try {
            localStorage.setItem('changelog_shown_version', key);
        } catch { }
    }
}

/**
 * Fetch release notes from GitHub for current version
 * @returns {Promise<Object|null>} Release info or null
 */
export async function fetchReleaseNotesFromGithub() {
    try {
        const rawVersion = await getAppVersionWithFallback();
        const normalizedVersion = normalizeVersion(rawVersion);
        if (!normalizedVersion) return null;

        const res = await fetch('https://api.github.com/repos/thomasthanos/Make_Your_Life_Easier.A.E/releases', {
            headers: {
                'Accept': 'application/vnd.github+json'
            }
        });
        if (!res.ok) return null;
        const releases = await res.json();
        if (!Array.isArray(releases)) return null;

        const match = releases.find((rel) => {
            const tag = normalizeVersion(rel.tag_name);
            const name = normalizeVersion(rel.name);
            return tag === normalizedVersion || name === normalizedVersion;
        }) || releases.find((rel) => normalizeVersion(rel.tag_name) === normalizedVersion);

        if (!match) return null;

        return {
            version: match.tag_name || `v${normalizedVersion}`,
            releaseName: match.name || match.tag_name || '',
            releaseNotes: match.body || ''
        };
    } catch (error) {
        console.error('Error fetching release notes from GitHub:', error);
        return null;
    }
}

/**
 * Parse markdown content (with fallback)
 * @param {string} notes - Markdown content
 * @returns {Promise<string>} HTML content
 */
export async function parseMarkdown(notes) {
    if (!notes) return '';
    const text = typeof notes === 'string' ? notes : String(notes);

    if (typeof window !== 'undefined' && window.marked && typeof window.marked.parse === 'function') {
        try {
            return window.marked.parse(text);
        } catch (err) {
            console.warn('Failed to parse markdown with marked, falling back', err);
        }
    }

    return formatReleaseNotes(text);
}

/**
 * Format release notes with basic markdown support
 * @param {string} notes - Release notes text
 * @returns {string} Formatted HTML
 */
export function formatReleaseNotes(notes) {
    if (!notes) return '';

    let text = typeof notes === 'string' ? notes : String(notes);

    // XSS Protection
    text = text
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');

    // GitHub-style alerts
    text = text.replace(/^>\s*\[!([A-Z]+)\]\s*\n>\s*(.+?)(?=\n\s*\n|$)/gms, (match, type, content) => {
        const map = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'important', WARNING: 'warning', CAUTION: 'caution' };
        const cls = map[type] || 'note';
        return `<div class="changelog-alert ${cls}">${content.trim()}</div>`;
    });

    text = text
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/^>\s*(.+)$/gm, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        .replace(/\[!NOTE\]\s*(.+)/g, '<div class="changelog-alert note">$1</div>')
        .replace(/\[!TIP\]\s*(.+)/g, '<div class="changelog-alert tip">$1</div>')
        .replace(/\[!IMPORTANT\]\s*(.+)/g, '<div class="changelog-alert important">$1</div>')
        .replace(/\[!WARNING\]\s*(.+)/g, '<div class="changelog-alert warning">$1</div>')
        .replace(/\[!CAUTION\]\s*(.+)/g, '<div class="changelog-alert caution">$1</div>')
        .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
        .replace(/~~~([\s\S]*?)~~~/g, '<pre><code>$1</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (match, text, url) => {
            const sanitizedUrl = url.trim();
            if (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://')) {
                return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
            return text;
        })
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^\+ (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^___$/gm, '<hr>')
        .replace(/^\*\*\*$/gm, '<hr>')
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; height:auto;">')
        .replace(/^- \[x\] (.+)$/gm, '<li><input type="checkbox" disabled checked> $1</li>')
        .replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>');

    text = text.replace(/(<li>.*?<\/li>(?:\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');

    if (!/^\s*<\s*(h\d|ul|pre|blockquote|hr)/i.test(text)) {
        text = '<p>' + text + '</p>';
    }

    return text;
}

/**
 * Show the changelog modal
 * @param {Object} updateInfo - Update info object with version, releaseName, releaseNotes
 */
export async function showChangelog(updateInfo) {
    if (!shouldShowChangelog(updateInfo?.version)) return;
    markChangelogShown(updateInfo?.version || 'unknown');

    const overlay = document.createElement('div');
    overlay.className = 'changelog-overlay';

    const modal = document.createElement('div');
    modal.className = 'changelog-modal';

    const header = document.createElement('div');
    header.className = 'changelog-header';

    const title = document.createElement('h2');
    title.className = 'changelog-title';
    title.textContent = 'Update Installed Successfully!';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'changelog-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'changelog-content';

    const versionBadge = document.createElement('div');
    versionBadge.className = 'changelog-version';
    versionBadge.textContent = `Version ${updateInfo.version || 'Unknown'}`;

    if (updateInfo.releaseName) {
        const releaseContainer = document.createElement('div');
        releaseContainer.className = 'release-title-container';

        const releaseNameEl = document.createElement('h3');
        releaseNameEl.className = 'release-title';
        releaseNameEl.textContent = updateInfo.releaseName;

        releaseContainer.appendChild(releaseNameEl);
        releaseContainer.appendChild(versionBadge);
        content.appendChild(releaseContainer);
    } else {
        content.appendChild(versionBadge);
    }

    if (updateInfo.releaseNotes) {
        const notes = document.createElement('div');
        let formattedNotes;
        try {
            formattedNotes = await parseMarkdown(updateInfo.releaseNotes);
        } catch (err) {
            formattedNotes = formatReleaseNotes(updateInfo.releaseNotes);
        }
        notes.innerHTML = formattedNotes;
        content.appendChild(notes);
    } else {
        const defaultMessage = document.createElement('p');
        defaultMessage.textContent = 'This update includes bug fixes and performance improvements.';
        content.appendChild(defaultMessage);
    }

    const footer = document.createElement('div');
    footer.className = 'changelog-footer';

    const okBtn = document.createElement('button');
    okBtn.className = 'changelog-btn';
    okBtn.textContent = 'Got it!';
    okBtn.addEventListener('click', () => overlay.remove());

    footer.appendChild(okBtn);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const escHandler = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.remove();
        }
    });
}

/**
 * Check for changelog after app update
 */
export async function checkForChangelog() {
    try {
        let result;
        if (window.api && typeof window.api.getUpdateInfo === 'function') {
            try {
                result = await window.api.getUpdateInfo();
            } catch (ipcErr) {
                result = null;
            }
        }
        if (result && result.success && result.info) {
            setTimeout(() => showChangelog(result.info), 1000);
            return;
        }

        const updateInfo = localStorage.getItem('pendingUpdateInfo');
        if (updateInfo) {
            const info = JSON.parse(updateInfo);
            localStorage.removeItem('pendingUpdateInfo');
            setTimeout(() => showChangelog(info), 1000);
            return;
        }

        const fetched = await fetchReleaseNotesFromGithub();
        if (fetched) {
            setTimeout(() => showChangelog(fetched), 1000);
        }
    } catch (error) {
        console.error('Error checking changelog:', error);
    }
}

// ============================================
// SIDEBAR VERSION
// ============================================

/**
 * Ensure the sidebar version badge is present and updated
 * @param {Object} state - App state with settings
 */
export async function ensureSidebarVersion(state = {}) {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;

    if (!sidebar.querySelector('.sidebar-footer')) {
        const footer = document.createElement('div');
        footer.className = 'sidebar-footer';
        footer.innerHTML = `
      <div class="version-wrap" data-tooltip="App version">
        <div class="version-badge" id="versionBadge">
          <span id="appVersion">v…</span>
          <span class="badge-lines"></span>
        </div>
        <div class="user-info" id="userInfo"></div>
      </div>`;
        sidebar.appendChild(footer);
        const versionWrapper = footer.querySelector('.version-wrap');
        if (versionWrapper) attachTooltipHandlers(versionWrapper);
    }

    const versionEl = document.getElementById('appVersion');
    const setSafe = (txt) => { if (versionEl) versionEl.textContent = txt; };

    setSafe(await getAppVersionWithFallback());
    setTimeout(async () => {
        const raw = (versionEl?.textContent || '').trim().replace(/^v/i, '');
        if (!raw || /^0+(?:\.0+){0,3}$/.test(raw)) {
            setSafe(await getAppVersionWithFallback());
        }
    }, 800);

    // User info update function
    async function updateUserInfo() {
        const userInfoEl = document.getElementById('userInfo');
        if (!userInfoEl) return;
        try {
            if (userInfoEl._toggleHandler) {
                userInfoEl.removeEventListener('click', userInfoEl._toggleHandler);
                userInfoEl._toggleHandler = null;
            }
            const profile = await (window.api?.getUserProfile?.());
            userInfoEl.innerHTML = '';
            if (profile && profile.name) {
                if (profile.avatar) {
                    const img = document.createElement('img');
                    img.src = profile.avatar;
                    img.alt = 'avatar';
                    userInfoEl.appendChild(img);
                }
                const span = document.createElement('span');
                span.textContent = profile.name;
                userInfoEl.appendChild(span);

                const logoutMenu = document.createElement('div');
                logoutMenu.className = 'logout-menu';
                const logoutBtn = document.createElement('button');
                logoutBtn.className = 'logout-btn';
                logoutBtn.textContent = 'Logout';
                logoutMenu.appendChild(logoutBtn);
                userInfoEl.appendChild(logoutMenu);

                const handler = async (e) => {
                    if (e.target && e.target.classList.contains('logout-btn')) {
                        e.stopPropagation();
                        try {
                            await window.api?.logout?.();
                        } catch (err) {
                            debug('error', 'Logout failed:', err);
                        }
                        updateUserInfo();
                    } else {
                        userInfoEl.classList.toggle('show-logout');
                    }
                };
                userInfoEl._toggleHandler = handler;
                userInfoEl.addEventListener('click', handler);
            } else {
                const card = document.createElement('div');
                card.className = 'login-card';

                const discordBtn = document.createElement('button');
                discordBtn.className = 'login-discord';
                discordBtn.setAttribute('data-tooltip', 'Sign in with Discord');
                discordBtn.innerHTML = `<svg fill="#000000" preserveAspectRatio="xMidYMid" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 -28.5 256 256"><g id="SVGRepo_iconCarrier"><g><path fill-rule="nonzero" fill="#5865F2" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"></path></g></g></svg>`;
                card.appendChild(discordBtn);

                const googleBtn = document.createElement('button');
                googleBtn.className = 'login-google';
                googleBtn.setAttribute('data-tooltip', 'Sign in with Google');
                googleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 0 262 262" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>`;
                card.appendChild(googleBtn);

                userInfoEl.appendChild(card);
                [discordBtn, googleBtn].forEach((btn) => {
                    attachTooltipHandlers(btn);
                });

                googleBtn.addEventListener('click', async () => {
                    try {
                        await window.api?.loginGoogle?.();
                    } catch (err) {
                        debug('error', 'Google login failed:', err);
                        const msg = String(err?.message || err);
                        if (msg && /not configured/i.test(msg)) {
                            window.alert('Google login is not available because OAuth credentials are not configured.');
                        }
                    }
                    updateUserInfo();
                });

                discordBtn.addEventListener('click', async () => {
                    try {
                        await window.api?.loginDiscord?.();
                    } catch (err) {
                        debug('error', 'Discord login failed:', err);
                        const msg = String(err?.message || err);
                        if (msg && /not configured/i.test(msg)) {
                            window.alert('Discord login is not available because OAuth credentials are not configured.');
                        }
                    }
                    updateUserInfo();
                });
            }
        } catch (err) {
            debug('warn', 'Failed to update user info:', err);
        }
    }

    updateUserInfo();
}

// ============================================
// CUSTOM APPS DATA
// ============================================

export const CUSTOM_APPS = [
    {
        id: 'AdvancedInstaller.Crack',
        name: 'Advanced Installer',
        url: 'https://www.dropbox.com/scl/fi/nx5ced8mt2t5mye4tus6j/Advanced-Installer-Architect-23.1.0.zip?rlkey=2bre9u83d9lfdvhhz778nvr04&st=cgpe2npr&dl=1',
        ext: 'zip',
        category: 'Utilities'
    },
    {
        id: 'Spotify.Dropbox',
        name: 'Spotify',
        url: 'https://www.dropbox.com/scl/fi/tgfdprtihmfmg0vmje5mw/SpotifySetup.exe?rlkey=55vfvccgpndwys4wvl1gg4u1v&dl=1',
        ext: 'exe',
        category: 'Music'
    },
    {
        id: 'BetterDiscord.Dropbox',
        name: 'BetterDiscord',
        url: 'https://www.dropbox.com/scl/fi/qdw73ry6cyqcn4d71aw5n/BetterDiscord-Windows.exe?rlkey=he0pheyexqjk42kwhdxv1cyry&dl=1',
        ext: 'exe',
        category: 'Utilities'
    },
    {
        id: 'LeagueOfLegends.Dropbox',
        name: 'League of Legends',
        url: 'https://www.dropbox.com/scl/fi/8e2lozlfwbw5uz00zxl78/League-of-Legends.exe?rlkey=q781tbxxn3k4l18jxws57d1a6&dl=1',
        ext: 'exe',
        category: 'Games'
    },
    {
        id: 'Mobalytics.Dropbox',
        name: 'Mobalytics',
        url: 'https://www.dropbox.com/scl/fi/ud8dijdfoe6sg3ntjqsxt/Mobalytics.exe?rlkey=agawubkfhkpw9mluzn8tpydu8&dl=1',
        ext: 'exe',
        category: 'Games'
    },
    {
        id: 'ProjectLightning.Dropbox',
        name: 'ProjectLightning',
        url: 'https://www.dropbox.com/scl/fi/0i9ikwaiwui6z6befhxtq/ProjectLightning.exe?rlkey=s49qkhhli071on5d23xz1gut7&dl=1',
        ext: 'exe',
        category: 'Utilities'
    },
    {
        id: 'Cursor.Dropbox',
        name: 'Cursor',
        url: 'https://www.dropbox.com/scl/fi/bjjx57hosduostifzkjjr/Cursor.exe?rlkey=o60g8k5ct0j36bwysfk9sh53l&dl=1',
        ext: 'exe',
        category: 'Development'
    }
];
