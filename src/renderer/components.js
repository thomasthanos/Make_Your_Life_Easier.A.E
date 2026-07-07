/**
 * Renderer Components
 * Contains UI components like header, modals, toasts, error cards
 */

import { escapeHtml } from './utils.js';

// ============================================
// ICON DEFINITIONS
// ============================================

export const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="11" y="10" width="2" height="10"/><rect x="11" y="6" width="2" height="2"/></svg>`;
export const MENU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="6" width="16" height="2"/><rect x="4" y="11" width="16" height="2"/><rect x="4" y="16" width="16" height="2"/></svg>`;

// ============================================
// MENU ICONS
// ============================================

export const MENU_ICONS = {
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings w-5 h-5 text-primary transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    install_apps: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`,
    system_cleaner: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17h16"></path><path d="M7 17l1.2-7.2A2.2 2.2 0 0 1 10.4 8h3.2a2.2 2.2 0 0 1 2.2 1.8L17 17"></path><path d="M9 17v3"></path><path d="M15 17v3"></path><path d="M10 5h4"></path></svg>`,
    activate_autologin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>`,
    system_maintenance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    crack_installer: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"></path><path d="m7.5 4.27 9 5.15"></path></svg>`,
    spicetify: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    christitus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>`,
    bios: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-computer"><rect width="14" height="8" x="5" y="2" rx="2"></rect><rect width="20" height="8" x="2" y="14" rx="2"></rect><path d="M6 18h2"></path><path d="M12 18h6"></path></svg>`,
    debloat: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-broom"><path d="m13 11 9-9"></path><path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2z"></path><path d="m6.8 10.4 6.8 6.8"></path><path d="m5 17 1.4-1.4"></path></svg>`
};

// ============================================
// NOTIFICATIONS
// ============================================

export { toast, showErrorCard, dismissToast } from './notifications.js';

/**
 * Hide every finished in-app terminal except the given one
 * @param {HTMLElement} current - The terminal that should stay open
 */
export function closeOtherTerminals(current) {
    document.querySelectorAll('.winget-terminal.open').forEach((terminal) => {
        if (terminal !== current && !terminal.classList.contains('running')) {
            terminal.classList.remove('open');
        }
    });
}


// ============================================
// UPDATE OVERLAY
// ============================================

let updateOverlay = null;

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return mb.toFixed(2) + ' MB';
}

/**
 * Format speed in bytes/sec to MB/s
 * @param {number} bytesPerSec - Speed in bytes per second
 * @returns {string} Formatted speed
 */
function formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec === 0) return '0 MB/s';
    const mbps = bytesPerSec / (1024 * 1024);
    return mbps.toFixed(2) + ' MB/s';
}

/**
 * Format seconds to human-readable time
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
    if (!seconds || seconds <= 0 || !isFinite(seconds)) return '0s';
    if (seconds < 60) return Math.round(seconds) + 's';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
}

/**
 * Show the update overlay with progress ring
 * @param {string} initialStatus - Initial status text
 */
export function showUpdateOverlay(initialStatus) {
    if (!updateOverlay) {
        updateOverlay = document.createElement('div');
        updateOverlay.id = 'update-overlay';
        updateOverlay.classList.add('visible');

        const container = document.createElement('div');
        container.className = 'update-overlay-container';
        updateOverlay.appendChild(container);

        // Create download icon
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

        // Main title
        const title = document.createElement('h2');
        title.className = 'update-title';
        title.textContent = 'Downloading Update';
        container.appendChild(title);

        // Progress ring container
        const ringContainer = document.createElement('div');
        ringContainer.className = 'update-ring-container';

        // Create SVG progress ring
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

        // Add gradient definition
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

        // Percentage text in center
        const percentText = document.createElement('div');
        percentText.className = 'update-percent';
        percentText.textContent = '0%';

        ringContainer.appendChild(svg);
        ringContainer.appendChild(percentText);
        container.appendChild(ringContainer);

        // Info grid for details
        const infoGrid = document.createElement('div');
        infoGrid.className = 'update-info-grid';

        // Download info
        const downloadInfo = document.createElement('div');
        downloadInfo.className = 'update-info-item';
        downloadInfo.innerHTML = `
            <div class="update-info-label">Downloaded</div>
            <div class="update-info-value" id="update-downloaded">0 MB / 0 MB</div>
        `;

        // Speed info
        const speedInfo = document.createElement('div');
        speedInfo.className = 'update-info-item';
        speedInfo.innerHTML = `
            <div class="update-info-label">Speed</div>
            <div class="update-info-value" id="update-speed">0 MB/s</div>
        `;

        // ETA info
        const etaInfo = document.createElement('div');
        etaInfo.className = 'update-info-item';
        etaInfo.innerHTML = `
            <div class="update-info-label">Time Remaining</div>
            <div class="update-info-value" id="update-eta">Calculating...</div>
        `;

        infoGrid.appendChild(downloadInfo);
        infoGrid.appendChild(speedInfo);
        infoGrid.appendChild(etaInfo);
        container.appendChild(infoGrid);

        // Status text
        const statusText = document.createElement('p');
        statusText.className = 'update-status-text';
        statusText.textContent = initialStatus || 'Preparing download...';
        container.appendChild(statusText);

        updateOverlay._progressCircle = progress;
        updateOverlay._percentEl = percentText;
        updateOverlay._statusEl = statusText;
        document.body.appendChild(updateOverlay);
        // BUGFIX: getElementById calls MUST happen after appendChild so elements exist in DOM
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

/**
 * Update the update overlay progress
 * @param {number} percent - Progress percentage (0-100)
 * @param {string} statusText - Status text
 * @param {Object} details - Additional details (bytesPerSecond, transferred, total)
 */
export function updateUpdateOverlay(percent, statusText, details = {}) {
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

    // Update detailed information
    if (details.transferred !== undefined && details.total !== undefined) {
        updateOverlay._downloadedEl.textContent = `${formatBytes(details.transferred)} / ${formatBytes(details.total)}`;
    }

    if (details.bytesPerSecond !== undefined) {
        updateOverlay._speedEl.textContent = formatSpeed(details.bytesPerSecond);
        
        // Calculate ETA
        if (details.transferred && details.total && details.bytesPerSecond > 0) {
            const remaining = details.total - details.transferred;
            const eta = remaining / details.bytesPerSecond;
            updateOverlay._etaEl.textContent = formatTime(eta);
        }
    }
}

/**
 * Hide the update overlay
 */
export function hideUpdateOverlay() {
    if (updateOverlay) {
        updateOverlay.classList.add('hidden');
        updateOverlay.classList.remove('visible');
    }
}

// ============================================
// APP LOADER
// ============================================

let appLoaderInterval = null;

/**
 * Show the application loader overlay
 * @param {string} statusText - Status text to display
 */
export function showAppLoader(statusText) {
    const loader = document.getElementById('app-loader');
    if (!loader) return;
    const progressBar = loader.querySelector('.progress-bar');
    const statusEl = loader.querySelector('#loading-status');
    loader.classList.add('visible');
    loader.classList.remove('hidden');

    if (progressBar) progressBar.style.width = '0%';
    if (statusText && statusEl) {
        statusEl.textContent = statusText;
    }

    // Clear any existing interval to prevent leaks from double-show
    if (appLoaderInterval) {
        clearInterval(appLoaderInterval);
        appLoaderInterval = null;
    }

    let progress = 0;
    appLoaderInterval = setInterval(() => {
        progress = (progress + 1) % 101;
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
    }, 50);
}

/**
 * Hide the application loader
 */
export function hideAppLoader() {
    const loader = document.getElementById('app-loader');
    if (!loader) return;
    loader.classList.add('hidden');
    loader.classList.remove('visible');
    if (appLoaderInterval) {
        clearInterval(appLoaderInterval);
        appLoaderInterval = null;
    }
}

// ============================================
// INFO MODAL
// ============================================

/**
 * Open the info modal
 */
export async function openInfoModal() {
    if (document.getElementById('info-modal-overlay')) return;

    const sidebarToggle = document.getElementById('sidebar-collapse-toggle');
    const sidebarToggleWasDisabled = sidebarToggle?.disabled === true;
    if (sidebarToggle) {
        sidebarToggle.disabled = true;
        sidebarToggle.setAttribute('aria-disabled', 'true');
    }

    const overlay = document.createElement('div');
    overlay.id = 'info-modal-overlay';
    overlay.className = 'modal-overlay';

    const container = document.createElement('div');
    container.className = 'modal-container info-modal-container';

    const iframe = document.createElement('iframe');
    iframe.src = 'info/info.html';
    iframe.setAttribute('title', 'Information');
    iframe.className = 'content-iframe';
    iframe.addEventListener('error', () => {
        iframe.src = 'info-final.html';
    });

    let isClosing = false;
    const closeInfoModal = () => {
        if (isClosing) return;
        isClosing = true;
        window.removeEventListener('message', handleInfoFrameResize);
        overlay.classList.add('is-closing');

        const removeOverlay = () => {
            if (overlay.parentNode) {
                overlay.remove();
            }
            if (sidebarToggle) {
                sidebarToggle.disabled = sidebarToggleWasDisabled;
                if (!sidebarToggleWasDisabled) {
                    sidebarToggle.removeAttribute('aria-disabled');
                }
            }
        };

        overlay.addEventListener('animationend', removeOverlay, { once: true });
        window.setTimeout(removeOverlay, 220);
    };

    const handleInfoFrameResize = (event) => {
        if (!document.contains(overlay)) {
            window.removeEventListener('message', handleInfoFrameResize);
            return;
        }
        if (event.source !== iframe.contentWindow) return;
        if (event.data?.type === 'infoCloseRequest') {
            closeInfoModal();
            return;
        }
        if (event.data?.type !== 'infoFrameResize' || isClosing) return;

        const requestedHeight = Number(event.data.height);
        if (!Number.isFinite(requestedHeight) || requestedHeight <= 0) return;

        const rootStyles = getComputedStyle(document.documentElement);
        const titleBarHeight = parseFloat(rootStyles.getPropertyValue('--title-bar-height')) || 40;
        const overlayStyles = getComputedStyle(overlay);
        const overlayPaddingY = (parseFloat(overlayStyles.paddingTop) || 0) + (parseFloat(overlayStyles.paddingBottom) || 0);
        const maxHeight = Math.max(260, window.innerHeight - titleBarHeight - overlayPaddingY);
        const nextHeight = Math.min(Math.ceil(requestedHeight), maxHeight);
        const heightValue = `${nextHeight}px`;
        if (iframe.style.height === heightValue) return;

        container.style.height = heightValue;
        iframe.style.height = heightValue;
        iframe.contentWindow?.postMessage({ type: 'infoParentResized' }, '*');
    };

    window.addEventListener('message', handleInfoFrameResize);

    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
}

export function openAccountModal(profile, syncedItems = [], handlers = {}) {
    if (document.getElementById('account-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'account-modal-overlay';
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'account-modal';

    const providerLabel = profile.provider === 'google'
        ? 'Google'
        : profile.provider === 'discord' ? 'Discord' : (profile.provider || '');

    const rows = (syncedItems || []).map((item) => `
            <li class="account-sync-row">
                <span class="account-sync-label">${escapeHtml(item.label)}</span>
                <span class="account-sync-value">${escapeHtml(String(item.value))}</span>
            </li>
        `).join('');
    const syncedContent = rows
        ? `<ul class="account-sync-list">${rows}</ul>`
        : '<div class="account-sync-empty">No synced settings yet.</div>';

    const avatar = profile.avatar
        ? `<img class="account-avatar" src="${escapeHtml(profile.avatar)}" alt="avatar">`
        : `<div class="account-avatar account-avatar-fallback">${escapeHtml((profile.name || '?').slice(0, 1).toUpperCase())}</div>`;

    modal.innerHTML = `
        <div class="account-modal-header">
            <div>
                <span class="account-kicker">Account</span>
                <h3>Profile</h3>
            </div>
            <button class="account-close" type="button" aria-label="Close">
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                    <path d="M5.5 5.5l9 9M14.5 5.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
                </svg>
            </button>
        </div>
        <div class="account-profile">
            ${avatar}
            <div class="account-id">
                <span class="account-name">${escapeHtml(profile.name || 'User')}</span>
                <span class="account-provider">via ${escapeHtml(providerLabel || 'Account')}</span>
            </div>
        </div>
        <div class="account-synced">
            <div class="account-section-head">
                <h4>Synced</h4>
                <span>${(syncedItems || []).length} items</span>
            </div>
            ${syncedContent}
        </div>
        <div class="account-actions">
            <button class="account-reset" type="button">Reset synced settings</button>
            <button class="account-signout" type="button">Sign out</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const close = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

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

// ============================================
// MENU BUTTON CREATION
// ============================================

/**
 * Create a menu button element
 * @param {string} key - Menu key identifier
 * @param {string} label - Button label
 * @returns {HTMLLIElement} The list item containing the button
 */
export function createMenuButton(key, label) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = key;
    btn.innerHTML = `
    <span class="mi">${MENU_ICONS[key] || ''}</span>
    <span class="label">${escapeHtml(label)}</span>
    <span class="dot" aria-hidden="true"></span>
  `;
    li.appendChild(btn);
    return li;
}
