import { manageDialog } from './overlays.js';
import { setUiTranslations, uiText } from './ui-text.js';

import { debug, escapeHtml, getAppVersionWithFallback, normalizeVersion, normalizeVersionTag } from './utils.js';
import { toast } from './notifications.js';
import { attachTooltipHandlers } from './tooltips.js';


let updateOverlay = null;

function formatMegabytes(bytes) {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
}

function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec === 0) return '0 MB/s';
    const mbps = bytesPerSec / (1024 * 1024);
    return mbps.toFixed(2) + ' MB/s';
}

function formatTime(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0s';
    if (seconds < 60) return Math.round(seconds) + 's';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

function showUpdateOverlay(initialStatus) {
    if (!updateOverlay) {
        updateOverlay = document.createElement('div');
        updateOverlay.id = 'update-overlay';
        updateOverlay.classList.add('visible');

        const container = document.createElement('div');
        container.className = 'update-overlay-container';
        updateOverlay.appendChild(container);

        const iconWrapper = document.createElement('div');
        iconWrapper.className = 'update-icon-wrapper';
        iconWrapper.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        container.appendChild(iconWrapper);

        const title = document.createElement('h2');
        title.className = 'update-title';
        title.textContent = uiText("update_download_title", "Downloading Update");
        container.appendChild(title);

        const ringContainer = document.createElement('div');
        ringContainer.className = 'update-ring-container';

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 120 120');
        svg.classList.add('update-overlay-svg');

        const bg = document.createElementNS(svgNS, 'circle');
        bg.setAttribute('cx', '60');
        bg.setAttribute('cy', '60');
        bg.setAttribute('r', '54');
        bg.setAttribute('stroke', 'rgba(255,255,255,0.1)');
        bg.setAttribute('stroke-width', '8');
        bg.setAttribute('fill', 'none');

        const progress = document.createElementNS(svgNS, 'circle');
        progress.setAttribute('cx', '60');
        progress.setAttribute('cy', '60');
        progress.setAttribute('r', '54');
        progress.setAttribute('stroke', 'url(#progressGradient)');
        progress.setAttribute('stroke-width', '8');
        progress.setAttribute('fill', 'none');
        progress.setAttribute('stroke-linecap', 'round');
        const circumference = 2 * Math.PI * 54;
        progress.style.strokeDasharray = `${circumference}`;
        progress.style.strokeDashoffset = `${circumference}`;
        progress.style.transform = 'rotate(-90deg)';
        progress.style.transformOrigin = '60px 60px';

        const defs = document.createElementNS(svgNS, 'defs');
        const gradient = document.createElementNS(svgNS, 'linearGradient');
        gradient.setAttribute('id', 'progressGradient');
        gradient.setAttribute('x1', '0%');
        gradient.setAttribute('y1', '0%');
        gradient.setAttribute('x2', '100%');
        gradient.setAttribute('y2', '100%');

        const stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('style', 'stop-color:#0a84ff;stop-opacity:1');

        const stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('style', 'stop-color:#3a9bff;stop-opacity:1');

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        svg.appendChild(defs);

        svg.appendChild(bg);
        svg.appendChild(progress);

        const percentText = document.createElement('div');
        percentText.className = 'update-percent';
        percentText.textContent = '0%';

        ringContainer.appendChild(svg);
        ringContainer.appendChild(percentText);
        container.appendChild(ringContainer);

        const infoGrid = document.createElement('div');
        infoGrid.className = 'update-info-grid';

        const downloadInfo = document.createElement('div');
        downloadInfo.className = 'update-info-item';
        downloadInfo.innerHTML = `
            <div class="update-info-label">${escapeHtml(uiText('downloaded'))}</div>
            <div class="update-info-value" id="update-downloaded">0 MB / 0 MB</div>
        `;

        const speedInfo = document.createElement('div');
        speedInfo.className = 'update-info-item';
        speedInfo.innerHTML = `
            <div class="update-info-label">${escapeHtml(uiText('speed'))}</div>
            <div class="update-info-value" id="update-speed">0 MB/s</div>
        `;

        const etaInfo = document.createElement('div');
        etaInfo.className = 'update-info-item';
        etaInfo.innerHTML = `
            <div class="update-info-label">${escapeHtml(uiText('remaining'))}</div>
            <div class="update-info-value" id="update-eta">${escapeHtml(uiText('calculating'))}</div>
        `;

        infoGrid.appendChild(downloadInfo);
        infoGrid.appendChild(speedInfo);
        infoGrid.appendChild(etaInfo);
        container.appendChild(infoGrid);

        const statusText = document.createElement('p');
        statusText.className = 'update-status-text';
        statusText.textContent = initialStatus || uiText("update_prepare", "Preparing download...");
        container.appendChild(statusText);

        updateOverlay._progressCircle = progress;
        updateOverlay._percentEl = percentText;
        updateOverlay._statusEl = statusText;
        document.body.appendChild(updateOverlay);
        updateOverlay._downloadedEl = document.getElementById('update-downloaded');
        updateOverlay._speedEl = document.getElementById('update-speed');
        updateOverlay._etaEl = document.getElementById('update-eta');
    }

    updateOverlay.classList.add('visible');
    updateOverlay.classList.remove('hidden');

    if (initialStatus) {
        updateOverlay._statusEl.textContent = initialStatus;
    }
}

function updateUpdateOverlay(percent, statusText, details = {}) {
    if (!updateOverlay) return;

    const circumference = 2 * Math.PI * 54;
    if (typeof percent === 'number') {
        const offset = circumference - (percent / 100) * circumference;
        updateOverlay._progressCircle.style.strokeDashoffset = offset;
        updateOverlay._percentEl.textContent = Math.round(percent) + '%';
    }

    if (statusText) {
        updateOverlay._statusEl.textContent = statusText;
    }

    if (details.transferred !== undefined && details.total !== undefined) {
        updateOverlay._downloadedEl.textContent = `${formatMegabytes(details.transferred)} / ${formatMegabytes(details.total)}`;
    }

    if (details.bytesPerSecond !== undefined) {
        updateOverlay._speedEl.textContent = formatSpeed(details.bytesPerSecond);

        if (details.transferred && details.total && details.bytesPerSecond > 0) {
            const remaining = details.total - details.transferred;
            const eta = remaining / details.bytesPerSecond;
            updateOverlay._etaEl.textContent = formatTime(eta);
        }
    }
}

function hideUpdateOverlay() {
    if (updateOverlay) {
        updateOverlay.classList.add('hidden');
        updateOverlay.classList.remove('visible');
    }
}



function isHttpUrl(value) {
    if (typeof value !== 'string' || !value) return false;
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

function attachAvatarFallback(img, name, fallbackClass, altSrc = null) {
    if (!img) return;

    const showPlaceholder = () => {
        const placeholder = document.createElement('div');
        placeholder.className = fallbackClass;
        placeholder.textContent = String(name || '?').trim().slice(0, 1).toUpperCase() || '?';
        img.replaceWith(placeholder);
    };

    const onError = () => {
        if (altSrc && isHttpUrl(altSrc) && img.src !== altSrc && !img.dataset.triedAlt) {
            debug('warn', 'Avatar failed, trying the still rendition:', img.src);
            img.dataset.triedAlt = '1';
            img.addEventListener('error', showPlaceholder, { once: true });
            img.src = altSrc;
            return;
        }
        debug('warn', 'Avatar image failed to load:', img.src);
        showPlaceholder();
    };

    img.addEventListener('error', onError, { once: true });
    if (img.complete && img.naturalWidth === 0) onError();
}

function openAccountModal(profile, syncedItems = [], handlers = {}, texts = {}) {
    if (document.getElementById('account-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'account-modal-overlay';
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'account-modal';

    const providerKey = profile.provider === 'google' ? 'google'
        : profile.provider === 'discord' ? 'discord' : '';
    const providerLabel = providerKey === 'google' ? 'Google'
        : providerKey === 'discord' ? 'Discord' : (profile.provider || '');

    const PROVIDER_ICONS = {
        google: '<svg viewBox="-3 0 262 262" width="12" height="12" aria-hidden="true" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>',
        discord: '<svg viewBox="0 -28.5 256 256" width="13" height="13" aria-hidden="true" preserveAspectRatio="xMidYMid"><path fill="#5865F2" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"/></svg>'
    };
    const providerIcon = PROVIDER_ICONS[providerKey] || '';

    const rows = (syncedItems || []).map((item) => `
            <li class="account-sync-row">
                <span class="account-sync-label">${escapeHtml(item.label)}</span>
                <span class="account-sync-value">${escapeHtml(String(item.value))}</span>
            </li>
        `).join('');
    const syncedContent = rows
        ? `<ul class="account-sync-list">${rows}</ul>`
        : `<div class="account-sync-empty">${escapeHtml(texts.empty || 'No synced settings yet.')}</div>`;

    const avatar = isHttpUrl(profile.avatar)
        ? `<img class="account-avatar" src="${escapeHtml(profile.avatar)}" alt="" width="72" height="72" decoding="async" referrerpolicy="no-referrer">`
        : `<div class="account-avatar account-avatar-fallback">${escapeHtml((profile.name || '?').slice(0, 1).toUpperCase())}</div>`;

    modal.innerHTML = `
        <button class="account-close" type="button" aria-label="${escapeHtml(uiText('close', 'Close'))}">
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
        </button>
        <div class="account-hero">
            <div class="account-avatar-ring">${avatar}</div>
            <span class="account-name">${escapeHtml(profile.name || 'User')}</span>
            <span class="account-provider">${providerIcon}<span>${escapeHtml(texts.via || 'via')} ${escapeHtml(providerLabel || texts.title || uiText("account", "Account"))}</span></span>
        </div>
        <div class="account-synced">
            <div class="account-section-head">
                <h4>${escapeHtml(texts.synced || 'Synced settings')}</h4>
                <span class="account-count">${(syncedItems || []).length}</span>
            </div>
            ${syncedContent}
        </div>
        <div class="account-actions">
            <button class="account-reset" type="button">${escapeHtml(texts.reset || 'Reset synced settings')}</button>
            <button class="account-signout" type="button">${escapeHtml(texts.signout || 'Sign out')}</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    attachAvatarFallback(
        modal.querySelector('img.account-avatar'),
        profile.name,
        'account-avatar account-avatar-fallback',
        profile.avatarFallback
    );

    let releaseFocus = () => {};
    const close = () => {
        releaseFocus();
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    releaseFocus = manageDialog(overlay, modal, close);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    modal.querySelector('.account-close').addEventListener('click', close);

    modal.querySelector('.account-signout').addEventListener('click', async () => {
        close();
        if (handlers.onSignOut) await handlers.onSignOut();
    });

    modal.querySelector('.account-reset').addEventListener('click', async () => {
        if (handlers.onReset) await handlers.onReset();
        close();
    });
}


const defaultSettings = {
    lang: 'en'
};

export function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('myAppSettings'));
        const normalized = { ...defaultSettings, ...(saved || {}) };
        delete normalized.theme;
        return normalized;
    } catch (e) {
        return { ...defaultSettings };
    }
}

export function saveSettings(settings) {
    const normalized = { ...(settings || {}) };
    delete normalized.theme;
    localStorage.setItem('myAppSettings', JSON.stringify(normalized));
}

export function applyTheme() {
    document.documentElement.setAttribute('data-theme', 'dark');
}

export function syncPref(key, value) {
    try { window.api?.setSetting?.(key, value); } catch { }
}

export async function hydratePrefsFromCloud() {
    try {
        const all = await window.api?.getAllSettings?.();
        if (!all || typeof all !== 'object') return null;
        if (all.lang === 'en' || all.lang === 'gr') {
            const s = loadSettings();
            s.lang = all.lang;
            saveSettings(s);
        }
        if (typeof all.sidebarExpanded === 'boolean') {
            try { localStorage.setItem('sidebarExpanded', all.sidebarExpanded ? '1' : '0'); } catch { }
        }
        return all;
    } catch {
        return null;
    }
}

function syncedSummary(all) {
    const A = translations.account_ui || {};
    const L = A.labels || {};
    const V = A.values || {};
    const I = translations.install_apps || {};
    const M = translations.maintenance || {};
    const s = all || {};
    const queue = Array.isArray(s.selected_apps) ? s.selected_apps.length : 0;
    const view = s.installer_view === 'grid' ? 'grid' : 'list';
    const sort = ['default', 'az', 'za', 'status'].includes(s.installer_sort)
        ? s.installer_sort
        : 'default';
    const viewLabel = view === 'grid'
        ? (I.grid_view || 'Grid view')
        : (I.list_view || 'List view');
    const sortLabels = {
        default: I.sort_default || 'Category',
        az: I.sort_az || 'A to Z',
        za: I.sort_za || 'Z to A',
        status: I.sort_status || 'Status'
    };
    const maintenanceLayout = s.maintenance_layout === 'list'
        ? (M.view_list || 'List')
        : (M.view_overview || 'Overview');
    const queueValue = queue
        ? `${queue} ${queue === 1 ? (V.app || 'app') : (V.apps || 'apps')}`
        : (V.empty || 'empty');
    return [
        { label: L.queue || 'Install queue', value: queueValue },
        { label: L.language || 'Language', value: (s.lang || 'en').toUpperCase() },
        { label: L.sidebar || 'Sidebar', value: s.sidebarExpanded ? (V.expanded || 'expanded') : (V.collapsed || 'collapsed') },
        { label: L.view || 'Installer view', value: `${viewLabel} · ${sortLabels[sort]}` },
        { label: L.maintenance_view || 'Maintenance layout', value: maintenanceLayout }
    ];
}


let translations = {};

const translationCache = new Map();

export async function loadTranslations(lang) {
    const cached = translationCache.get(lang);
    if (cached) {
        translations = cached;
        setUiTranslations(translations);
        document.documentElement.setAttribute('lang', lang === 'gr' ? 'el' : 'en');
        return translations;
    }

    const candidates = [`../i18n/${lang}.json`, `i18n/${lang}.json`, `${lang}.json`];
    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                translations = await res.json();
                translationCache.set(lang, translations);
                setUiTranslations(translations);
                document.documentElement.setAttribute('lang', lang === 'gr' ? 'el' : 'en');
                return translations;
            }
        } catch (e) {
        }
    }

    translations = {};
    setUiTranslations(translations);
    document.documentElement.setAttribute('lang', lang === 'gr' ? 'el' : 'en');
    return translations;
}

export function setTranslations(trans) {
    translations = trans;
    setUiTranslations(trans);
}


let autoUpdaterInitialized = false;

export function initializeAutoUpdater() {
    const updateBtn = document.getElementById('title-bar-update');

    if (typeof window === 'undefined' || typeof window.api === 'undefined') {
        console.warn('AutoUpdater: window.api not available; skipping update event handlers.');
        return;
    }

    if (typeof window.api.onUpdateStatus !== 'function') {
        console.warn('AutoUpdater: onUpdateStatus not available; skipping update event handlers.');
        return;
    }

    if (autoUpdaterInitialized) return;
    autoUpdaterInitialized = true;

    if (!updateBtn) {
        window.api.onUpdateStatus((data) => {
            switch (data.status) {
                case 'available':
                    showUpdateOverlay(uiText("update_prepare", "Preparing download..."));
                    break;
                case 'downloading': {
                    const percent = Math.round(data.percent || 0);
                    showUpdateOverlay();
                    updateUpdateOverlay(percent, uiText("update_download", "Downloading update..."), {
                        bytesPerSecond: data.bytesPerSecond,
                        transferred: data.transferred,
                        total: data.totalBytes
                    });
                    break;
                }
                case 'extracting':
                    showUpdateOverlay(uiText('update_apply', 'Applying update…'));
                    updateUpdateOverlay(100, uiText('update_apply', 'Applying update…'));
                    break;
                case 'error':
                    hideUpdateOverlay();
                    toast(uiText("update_error", "Update error"), { type: 'error', title: uiText("update_title", "Update") });
                    break;
            }
        });
        return;
    }

    updateBtn.classList.add('update-btn-hidden');

    let updateAvailable = false;

    attachTooltipHandlers(updateBtn);

    updateBtn.addEventListener('click', async () => {
        if (updateBtn.classList.contains('downloading')) return;
        if (!updateAvailable) return;

        updateBtn.classList.add('downloading');
        updateBtn.setAttribute('data-tooltip', uiText("update_download", "Downloading update..."));

        try {
            await window.api.downloadUpdate();
        } catch (error) {
            updateBtn.classList.remove('downloading');
            updateBtn.setAttribute('data-tooltip', uiText("update_available", "Update available"));
            toast(uiText("update_download_error", "Failed to download update"), { type: 'error', title: uiText("update_title", "Update") });
        }
    });

    window.api.onUpdateStatus((data) => {
        switch (data.status) {
            case 'available':
                updateAvailable = true;
                updateBtn.classList.add('available');
                updateBtn.setAttribute('data-tooltip', uiText("update_available", "Update available"));
                showUpdateOverlay(uiText("update_prepare", "Preparing download..."));
                break;

            case 'downloading': {
                updateBtn.classList.add('downloading');
                const percent = Math.round(data.percent || 0);

                const transferred = data.transferred || 0;
                const total = data.totalBytes || 0;
                const speed = data.bytesPerSecond || 0;

                const transferredMB = (transferred / (1024 * 1024)).toFixed(2);
                const totalMB = (total / (1024 * 1024)).toFixed(2);
                const speedMB = (speed / (1024 * 1024)).toFixed(2);

                let tooltipText = uiText('downloading_percent', '', { percent });
                if (total > 0) {
                    tooltipText += ` (${transferredMB}/${totalMB} MB)`;
                }
                if (speed > 0) {
                    tooltipText += ` • ${speedMB} MB/s`;
                }

                updateBtn.setAttribute('data-tooltip', tooltipText);

                const circle = updateBtn.querySelector('.progress-ring circle');
                if (circle) {
                    const circumference = 2 * Math.PI * 10;
                    const offset = circumference - (percent / 100) * circumference;
                    circle.style.strokeDashoffset = offset;
                }

                showUpdateOverlay();
                updateUpdateOverlay(percent, uiText("update_download", "Downloading update..."), {
                    bytesPerSecond: data.bytesPerSecond,
                    transferred: data.transferred,
                    total: data.totalBytes
                });
                break;
            }

            case 'extracting':
                updateBtn.classList.remove('downloading');
                updateBtn.classList.add('ready');
                updateBtn.setAttribute('data-tooltip', uiText("update_apply", "Applying update..."));
                showUpdateOverlay(uiText('update_apply', 'Applying update…'));
                updateUpdateOverlay(100, uiText('update_apply', 'Applying update…'));
                break;

            case 'error':
                updateBtn.classList.remove('downloading');
                updateBtn.setAttribute('data-tooltip', uiText("update_failed", "Update failed"));
                hideUpdateOverlay();
                toast(uiText("update_error", "Update error"), { type: 'error', title: uiText("update_title", "Update") });
                break;
        }
    });
}


function shouldShowChangelog(version) {
    const key = normalizeVersionTag(version);
    if (!key) return true;
    return localStorage.getItem('changelog_shown_version') !== key;
}

function markChangelogShown(version) {
    const key = normalizeVersionTag(version);
    if (key) {
        try {
            localStorage.setItem('changelog_shown_version', key);
        } catch { }
    }
}

async function fetchReleaseNotesFromGithub() {
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

function formatReleaseNotes(notes) {
    if (!notes) return '';

    let text = typeof notes === 'string' ? notes : String(notes);

    text = escapeHtml(text)
        .replace(/javascript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');

    text = text.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:(?!^>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\])(?:>\s?.*|\s*)\n?)*)/gmi, (match, type, content) => {
        const map = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'important', WARNING: 'warning', CAUTION: 'caution' };
        const cls = map[type] || 'note';
        const body = content
            .split('\n')
            .map((line) => line.replace(/^>\s?/, '').trim())
            .filter((line) => line && !/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i.test(line))
            .join('<br>');

        return `<div class="changelog-alert ${cls}">${body}</div>`;
    });

    text = text
        .replace(/^>\s*$/gm, '')
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
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="changelog-img">')
        .replace(/\[([^\]]+)\]\(([^)\n]+)\)/g, (match, text, url) => {
            const sanitizedUrl = url.trim();
            if (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://')) {
                return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
            return text;
        })
        .replace(/^- \[x\] (.+)$/gmi, '<li><input type="checkbox" disabled checked> $1</li>')
        .replace(/^- \[ \] (.+)$/gm, '<li><input type="checkbox" disabled> $1</li>')
        .replace(/^\* (.+)$/gm, '<li>$1</li>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/^\+ (.+)$/gm, '<li>$1</li>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/^---$/gm, '<hr>')
        .replace(/^___$/gm, '<hr>')
        .replace(/^\*\*\*$/gm, '<hr>')
        .replace(/\n\n+/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/<\/li>\s*<br\s*\/?>\s*<li/g, '</li><li');

    text = text.replace(/(<li(?:\s[^>]*)?>.*?<\/li>(?:\s*<li(?:\s[^>]*)?>.*?<\/li>)*)/gs, '<ul>$1</ul>');

    if (!/^\s*<\s*(h\d|ul|pre|blockquote|hr)/i.test(text)) {
        text = '<p>' + text + '</p>';
    }

    return text;
}

async function showChangelog(updateInfo) {
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
    title.textContent = uiText("update_installed", "Update Installed");

    const titleGroup = document.createElement('div');
    titleGroup.className = 'changelog-title-group';
    titleGroup.appendChild(title);

    if (updateInfo.releaseName) {
        const patchTitle = document.createElement('span');
        patchTitle.className = 'changelog-patch-title';
        patchTitle.textContent = updateInfo.releaseName;
        titleGroup.appendChild(patchTitle);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'changelog-close';
    closeBtn.setAttribute('aria-label', uiText("close", "Close"));
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/></svg>';
    header.appendChild(titleGroup);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'changelog-content';

    const versionBadge = document.createElement('div');
    versionBadge.className = 'changelog-version';
    versionBadge.textContent = uiText('version_label', '', { version: updateInfo.version || '—' });

    if (updateInfo.releaseNotes) {
        const notes = document.createElement('div');
        notes.className = 'changelog-notes';
        const formattedNotes = formatReleaseNotes(updateInfo.releaseNotes);
        notes.insertAdjacentHTML('beforeend', formattedNotes);
        notes.querySelectorAll('blockquote').forEach((quote) => {
            const text = quote.textContent.trim();
            if (!text || text === '>') {
                quote.remove();
                return;
            }
            quote.textContent = text.replace(/^(?:>|&gt;)\s*/, '');
        });
        notes.querySelectorAll('.changelog-alert').forEach((alert) => {
            alert.innerHTML = alert.innerHTML
                .replace(/^(?:&gt;|>)\s*/i, '')
                .replace(/<br\s*\/?>\s*(?:&gt;|>)\s*(?=<br\s*\/?>|$)/gi, '')
                .replace(/<br\s*\/?>\s*$/i, '');
        });
        notes.querySelectorAll('p, blockquote').forEach((node) => {
            if (/^(?:>|&gt;)\s*$/.test(node.innerHTML.trim()) || /^>\s*$/.test(node.textContent.trim())) {
                node.remove();
            }
        });
        notes.querySelectorAll('p, blockquote, div').forEach((node) => {
            if (node.closest('pre, code, .changelog-alert')) return;
            const text = node.textContent.trim();
            if (/^(?:>|&gt;)\s+\S/.test(text)) {
                node.textContent = text.replace(/^(?:>|&gt;)\s*/, '');
            }
        });
        notes.querySelectorAll('ul br, ol br').forEach((br) => br.remove());
        content.appendChild(notes);
    } else {
        const defaultMessage = document.createElement('p');
        defaultMessage.textContent = uiText("release_default", "This update includes bug fixes and performance improvements.");
        content.appendChild(defaultMessage);
    }

    let releaseFocus = () => {};
    const closeOverlay = () => {
        releaseFocus();
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
    };

    const footer = document.createElement('div');
    footer.className = 'changelog-footer';

    const copyright = document.createElement('span');
    copyright.className = 'changelog-copyright';
    copyright.textContent = '© KOLOKITHES A.E. — ThomasT';

    footer.appendChild(copyright);
    footer.appendChild(versionBadge);

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const escHandler = (e) => {
        if (e.key === 'Escape') closeOverlay();
    };
    document.addEventListener('keydown', escHandler);
    releaseFocus = manageDialog(overlay, modal, closeOverlay);

    closeBtn.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeOverlay();
    });
}

let changelogShown = false;
export async function checkForChangelog() {
    if (changelogShown) return;
    changelogShown = true;
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
            let info = result.info;
            if (!info.releaseNotes) {
                try {
                    const fetched = await fetchReleaseNotesFromGithub();
                    if (fetched && fetched.releaseNotes) {
                        info = {
                            ...info,
                            releaseNotes: fetched.releaseNotes,
                            releaseName: info.releaseName || fetched.releaseName
                        };
                    }
                } catch {  }
            }
            setTimeout(() => showChangelog(info), 1000);
            return;
        }

        const updateInfo = localStorage.getItem('pendingUpdateInfo');
        if (updateInfo) {
            let info;
            try {
                info = JSON.parse(updateInfo);
            } catch (parseErr) {
                console.error('Invalid pendingUpdateInfo in localStorage:', parseErr);
                localStorage.removeItem('pendingUpdateInfo');
                return;
            }
            localStorage.removeItem('pendingUpdateInfo');
            setTimeout(() => showChangelog(info), 1000);
            return;
        }

        const fetched = await fetchReleaseNotesFromGithub();
        if (fetched) {
            setTimeout(() => showChangelog(fetched), 1000);
        } else {
            changelogShown = false;
        }
    } catch (error) {
        changelogShown = false;
        console.error('Error checking changelog:', error);
    }
}


let refreshUserInfo = null;
let profileListenerAttached = false;

export async function ensureSidebarVersion(_state = {}) {
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

    sidebar.querySelector('.version-wrap')?.setAttribute('data-tooltip', uiText('app_version'));
    const setSafe = (txt) => {
        const el = document.getElementById('appVersion');
        if (el) el.textContent = txt;
    };

    setSafe(await getAppVersionWithFallback());
    setTimeout(async () => {
        try {
            const el = document.getElementById('appVersion');
            const raw = (el?.textContent || '').trim().replace(/^v/i, '');
            if (!raw || /^0+(?:\.0+){0,3}$/.test(raw)) {
                setSafe(await getAppVersionWithFallback());
            }
        } catch (err) {
            console.error('Failed to refresh app version:', err);
        }
    }, 800);

    async function updateUserInfo() {
        const userInfoEl = document.getElementById('userInfo');
        if (!userInfoEl) return;
        try {
            if (userInfoEl._toggleHandler) {
                userInfoEl.removeEventListener('click', userInfoEl._toggleHandler);
                userInfoEl._toggleHandler = null;
            }
            const profile = await (window.api?.getUserProfile?.());
            if (!userInfoEl.isConnected) return;
            userInfoEl.innerHTML = '';
            if (profile && profile.name) {
                if (isHttpUrl(profile.avatar)) {
                    const img = document.createElement('img');
                    img.width = 20;
                    img.height = 20;
                    img.decoding = 'async';
                    img.referrerPolicy = 'no-referrer';
                    img.alt = '';
                    img.src = profile.avatar;
                    userInfoEl.appendChild(img);
                    attachAvatarFallback(img, profile.name, 'user-avatar-fallback', profile.avatarFallback);
                }
                const span = document.createElement('span');
                span.textContent = profile.name;
                userInfoEl.appendChild(span);

                const handler = async () => {
                    const current = await window.api?.getUserProfile?.();
                    if (!current) {
                        await updateUserInfo();
                        return;
                    }
                    const all = (await (window.api?.getAllSettings?.())) || {};
                    openAccountModal(current, syncedSummary(all), {
                        onSignOut: async () => {
                            try {
                                const result = await window.api?.logout?.();
                                if (!result?.success) {
                                    throw new Error(result?.error || 'Sign out failed');
                                }
                                window.location.reload();
                            } catch (err) {
                                debug('error', 'Logout failed:', err);
                                toast(uiText("signout_error", "Could not sign out. Please try again."), { type: 'error', title: uiText("account", "Account") });
                            }
                        },
                        onReset: async () => {
                            try {
                                await window.api?.resetSettings?.();
                            } catch (err) {
                                debug('error', 'Reset failed:', err);
                            }
                            const A = translations.account_ui || {};
                            toast(A.reset_done || 'Synced settings reset.', { type: 'success', title: A.title || 'Account' });
                        }
                    }, translations.account_ui || {});
                };
                userInfoEl._toggleHandler = handler;
                userInfoEl.addEventListener('click', handler);
            } else {
                const card = document.createElement('div');
                card.className = 'login-card';

                const discordBtn = document.createElement('button');
                discordBtn.className = 'login-discord';
                discordBtn.setAttribute('data-tooltip', uiText("discord_signin", "Sign in with Discord"));
                discordBtn.innerHTML = `<svg fill="#000000" preserveAspectRatio="xMidYMid" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 -28.5 256 256"><g id="SVGRepo_iconCarrier"><g><path fill-rule="nonzero" fill="#5865F2" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"></path></g></g></svg>`;
                card.appendChild(discordBtn);

                const googleBtn = document.createElement('button');
                googleBtn.className = 'login-google';
                googleBtn.setAttribute('data-tooltip', uiText("google_signin", "Sign in with Google"));
                googleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 0 262 262" preserveAspectRatio="xMidYMid"><path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/><path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/><path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/><path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/></svg>`;
                card.appendChild(googleBtn);

                userInfoEl.appendChild(card);
                [discordBtn, googleBtn].forEach((btn) => {
                    attachTooltipHandlers(btn);
                });

                googleBtn.addEventListener('click', async () => {
                    try {
                        const res = await window.api?.loginGoogle?.();
                        if (res && res.name) { window.location.reload(); return; }
                    } catch (err) {
                        debug('error', 'Google login failed:', err);
                        const msg = String(err?.message || err);
                        if (msg && /not configured/i.test(msg)) {
                            toast(translations.messages?.oauth_not_configured || 'Login unavailable: OAuth credentials are not configured.', { type: 'error' });
                        }
                    }
                    updateUserInfo();
                });

                discordBtn.addEventListener('click', async () => {
                    try {
                        const res = await window.api?.loginDiscord?.();
                        if (res && res.name) { window.location.reload(); return; }
                    } catch (err) {
                        debug('error', 'Discord login failed:', err);
                        const msg = String(err?.message || err);
                        if (msg && /not configured/i.test(msg)) {
                            toast(translations.messages?.oauth_not_configured || 'Login unavailable: OAuth credentials are not configured.', { type: 'error' });
                        }
                    }
                    updateUserInfo();
                });
            }
        } catch (err) {
            debug('warn', 'Failed to update user info:', err);
        }
    }

    refreshUserInfo = updateUserInfo;
    if (!profileListenerAttached) {
        profileListenerAttached = true;
        window.api?.onUserProfileUpdated?.(() => { refreshUserInfo?.(); });
    }

    updateUserInfo();
}
