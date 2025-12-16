/**
 * Renderer Components
 * Contains UI components like header, modals, toasts, error cards
 */

import { escapeHtml } from './utils.js';
import { attachTooltipHandlers, tooltipManager } from './managers.js';
import { resizeWindowSmooth } from './services.js';

// ============================================
// ICON DEFINITIONS
// ============================================

export const SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
export const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path></svg>`;
export const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="11" y="10" width="2" height="10"/><rect x="11" y="6" width="2" height="2"/></svg>`;
export const MENU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="6" width="16" height="2"/><rect x="4" y="11" width="16" height="2"/><rect x="4" y="16" width="16" height="2"/></svg>`;

// ============================================
// MENU ICONS
// ============================================

export const MENU_ICONS = {
    settings: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings w-5 h-5 text-primary transition-colors"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>`,
    install_apps: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`,
    activate_autologin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>`,
    system_maintenance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    crack_installer: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"></path><path d="m7.5 4.27 9 5.15"></path></svg>`,
    spicetify: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    password_manager: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
    christitus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>`,
    dlc_unlocker: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gamepad2"><line x1="6" x2="10" y1="11" y2="11"></line><line x1="8" x2="8" y1="9" y2="13"></line><line x1="15" x2="15.01" y1="12" y2="12"></line><line x1="18" x2="18.01" y1="10" y2="10"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path></svg>`,
    bios: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-computer"><rect width="14" height="8" x="5" y="2" rx="2"></rect><rect width="20" height="8" x="2" y="14" rx="2"></rect><path d="M6 18h2"></path><path d="M12 18h6"></path></svg>`,
    debloat: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-broom"><path d="m13 11 9-9"></path><path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2z"></path><path d="m6.8 10.4 6.8 6.8"></path><path d="m5 17 1.4-1.4"></path></svg>`
};

// ============================================
// TOAST CONTAINER
// ============================================

/**
 * Ensure toast container exists
 * @returns {HTMLElement} The toast container
 */
export function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}

/**
 * Dismiss a toast element with animation
 * @param {HTMLElement} toastEl - The toast element
 */
export function dismissToast(toastEl) {
    toastEl.classList.add('toast-exit');
    setTimeout(() => {
        if (toastEl.parentNode) {
            toastEl.parentNode.removeChild(toastEl);
        }
    }, 300);
}

/**
 * Show a toast notification
 * @param {string} msg - Message to display
 * @param {Object} opts - Options (title, type, duration)
 * @returns {HTMLElement|null} The toast element or null
 */
export function toast(msg, opts = {}) {
    const { title = '', type = 'info', duration = 4000 } = opts;

    if (type === 'error') {
        showErrorCard(msg, { title: title || 'Error', duration });
        return null;
    }

    if (type !== 'success') {
        return null;
    }

    const container = ensureToastContainer();
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'toast-icon-wrapper';

    let svg;
    if (type === 'success') {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '1.5');
        svg.setAttribute('class', 'toast-svg-icon');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', 'm4.5 12.75 6 6 9-13.5');
        svg.appendChild(path);
    }
    if (svg) {
        iconWrapper.appendChild(svg);
    }

    const content = document.createElement('div');
    content.className = 'toast-content';
    if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'toast-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = msg;
    content.appendChild(messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => dismissToast(toastEl);

    toastEl.appendChild(iconWrapper);
    toastEl.appendChild(content);
    toastEl.appendChild(closeBtn);
    container.appendChild(toastEl);

    let timeout;
    if (duration > 0) {
        timeout = setTimeout(() => dismissToast(toastEl), duration);
    }

    toastEl.addEventListener('mouseenter', () => {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    });
    toastEl.addEventListener('mouseleave', () => {
        if (!timeout && duration > 0) {
            timeout = setTimeout(() => dismissToast(toastEl), duration);
        }
    });
    return toastEl;
}

// ============================================
// ERROR CARD
// ============================================

let currentErrorCard = null;
let errorPaletteIndex = 0;
const errorBulletColours = ['#575757', '#e34ba9', '#80b1ff', '#f59e0b', '#10b981'];

/**
 * Ensure error container exists
 * @returns {HTMLElement} The error container
 */
export function ensureErrorContainer() {
    let c = document.getElementById('error-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'error-container';
        document.body.appendChild(c);
    }
    return c;
}

/**
 * Show an error card notification
 * @param {string} msg - Error message
 * @param {Object} opts - Options (title, duration)
 */
export function showErrorCard(msg, opts = {}) {
    const { title = 'Error', duration = 6000 } = opts;

    msg = String(msg);
    if (msg.includes('\n')) {
        const parts = msg.split(/\n+/).filter(p => p.trim() !== '');
        for (const part of parts) {
            showErrorCard(part, opts);
        }
        return;
    }

    const container = ensureErrorContainer();

    // Append to existing error card if present
    if (currentErrorCard && currentErrorCard.isConnected) {
        const bulletColour = errorBulletColours[errorPaletteIndex % errorBulletColours.length];
        errorPaletteIndex++;

        const line = document.createElement('div');
        line.className = 'error-line';

        const dashSpan = document.createElement('span');
        dashSpan.textContent = '- ';
        dashSpan.style.color = bulletColour;
        const msgSpan = document.createElement('span');
        msgSpan.className = 'error-msg';
        msgSpan.textContent = msg;

        line.appendChild(dashSpan);
        line.appendChild(msgSpan);
        currentErrorCard.bodyEl.appendChild(line);

        currentErrorCard.copyBtn.onclick = () => {
            try {
                const text = currentErrorCard.bodyEl.innerText.replace(/\n+$/g, '');
                navigator.clipboard.writeText(text);
                toast('All error messages copied to clipboard!', { type: 'success', title: 'Clipboard' });
            } catch (e) {
                toast('Failed to copy', { type: 'error', title: 'Clipboard' });
            }
        };
        return;
    }

    // Create new error card
    const card = document.createElement('div');
    card.className = 'error-card';

    const wrap = document.createElement('div');
    wrap.className = 'error-wrap';

    const terminal = document.createElement('div');
    terminal.className = 'error-terminal';

    const head = document.createElement('div');
    head.className = 'error-head';
    const titleEl = document.createElement('p');
    titleEl.className = 'error-title';

    const termIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    termIcon.setAttribute('viewBox', '0 0 24 24');
    termIcon.setAttribute('width', '16px');
    termIcon.setAttribute('height', '16px');
    termIcon.setAttribute('stroke-linejoin', 'round');
    termIcon.setAttribute('stroke-linecap', 'round');
    termIcon.setAttribute('stroke-width', '2');
    termIcon.setAttribute('stroke', 'currentColor');
    termIcon.setAttribute('fill', 'none');
    const tPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tPath.setAttribute('d', 'M7 15L10 12L7 9M13 15H17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z');
    termIcon.appendChild(tPath);
    titleEl.appendChild(termIcon);
    titleEl.appendChild(document.createTextNode(' Terminal'));
    head.appendChild(titleEl);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'error-copy';

    const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    copySvg.setAttribute('viewBox', '0 0 24 24');
    copySvg.setAttribute('width', '16px');
    copySvg.setAttribute('height', '16px');
    copySvg.setAttribute('stroke-linejoin', 'round');
    copySvg.setAttribute('stroke-linecap', 'round');
    copySvg.setAttribute('stroke-width', '2');
    copySvg.setAttribute('stroke', 'currentColor');
    copySvg.setAttribute('fill', 'none');
    const cp1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cp1.setAttribute('d', 'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2');
    const cp2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cp2.setAttribute('d', 'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z');
    copySvg.appendChild(cp1);
    copySvg.appendChild(cp2);
    copyBtn.appendChild(copySvg);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-close';

    const closeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    closeSvg.setAttribute('viewBox', '0 0 24 24');
    closeSvg.setAttribute('width', '16px');
    closeSvg.setAttribute('height', '16px');
    closeSvg.setAttribute('stroke-linejoin', 'round');
    closeSvg.setAttribute('stroke-linecap', 'round');
    closeSvg.setAttribute('stroke-width', '2');
    closeSvg.setAttribute('stroke', 'currentColor');
    closeSvg.setAttribute('fill', 'none');
    const cPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cPath1.setAttribute('d', 'M6 6L18 18');
    const cPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cPath2.setAttribute('d', 'M6 18L18 6');
    closeSvg.appendChild(cPath1);
    closeSvg.appendChild(cPath2);
    closeBtn.appendChild(closeSvg);

    head.appendChild(copyBtn);
    head.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'error-body';

    const firstColour = errorBulletColours[errorPaletteIndex % errorBulletColours.length];
    errorPaletteIndex++;

    const firstLine = document.createElement('div');
    firstLine.className = 'error-line';
    const firstDash = document.createElement('span');
    firstDash.textContent = '- ';
    firstDash.style.color = firstColour;
    const firstMsg = document.createElement('span');
    firstMsg.className = 'error-msg';
    firstMsg.textContent = msg;
    firstLine.appendChild(firstDash);
    firstLine.appendChild(firstMsg);
    body.appendChild(firstLine);

    terminal.appendChild(head);
    terminal.appendChild(body);
    wrap.appendChild(terminal);
    card.appendChild(wrap);
    container.appendChild(card);

    card.bodyEl = body;
    card.copyBtn = copyBtn;

    copyBtn.onclick = () => {
        try {
            const text = card.bodyEl.innerText.replace(/\n+$/g, '');
            navigator.clipboard.writeText(text);
            toast('Error message copied to clipboard!', { type: 'success', title: 'Clipboard' });
        } catch (e) {
            toast('Failed to copy', { type: 'error', title: 'Clipboard' });
        }
    };

    closeBtn.onclick = () => {
        card.remove();
        currentErrorCard = null;
    };

    currentErrorCard = card;
}

// ============================================
// UPDATE OVERLAY
// ============================================

let updateOverlay = null;

/**
 * Show the update overlay with progress ring
 * @param {string} initialStatus - Initial status text
 */
export function showUpdateOverlay(initialStatus) {
    if (!updateOverlay) {
        updateOverlay = document.createElement('div');
        updateOverlay.id = 'update-overlay';
        Object.assign(updateOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: '100000'
        });

        const container = document.createElement('div');
        container.className = 'update-overlay-container';
        updateOverlay.appendChild(container);

        // Create SVG progress ring
        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.classList.add('update-overlay-svg');

        const bg = document.createElementNS(svgNS, 'circle');
        bg.setAttribute('cx', '50');
        bg.setAttribute('cy', '50');
        bg.setAttribute('r', '45');
        bg.setAttribute('stroke', 'rgba(255,255,255,0.1)');
        bg.setAttribute('stroke-width', '10');
        bg.setAttribute('fill', 'none');

        const progress = document.createElementNS(svgNS, 'circle');
        progress.setAttribute('cx', '50');
        progress.setAttribute('cy', '50');
        progress.setAttribute('r', '45');
        progress.setAttribute('stroke', '#5865F2');
        progress.setAttribute('stroke-width', '10');
        progress.setAttribute('fill', 'none');
        progress.setAttribute('stroke-linecap', 'round');
        const circumference = 2 * Math.PI * 45;
        progress.style.strokeDasharray = `${circumference}`;
        progress.style.strokeDashoffset = `${circumference}`;

        svg.appendChild(bg);
        svg.appendChild(progress);
        container.appendChild(svg);

        const text = document.createElement('p');
        text.className = 'update-status';
        container.appendChild(text);

        updateOverlay._progressCircle = progress;
        updateOverlay._statusEl = text;
        document.body.appendChild(updateOverlay);
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
 */
export function updateUpdateOverlay(percent, statusText) {
    if (!updateOverlay) return;
    const circumference = 2 * Math.PI * 45;
    if (typeof percent === 'number') {
        const offset = circumference - (percent / 100) * circumference;
        updateOverlay._progressCircle.style.strokeDashoffset = offset;
    }
    if (statusText) {
        updateOverlay._statusEl.textContent = statusText;
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

// Store previous window size for restoration
let previousWindowSize = null;

/**
 * Open the info modal with window resize
 */
export async function openInfoModal() {
    if (document.getElementById('info-modal-overlay')) return;
    
    // Get current window size before resizing
    try {
        if (window.api && typeof window.api.getWindowSize === 'function') {
            const size = await window.api.getWindowSize();
            // getWindowSize returns [width, height] array
            if (Array.isArray(size) && size.length >= 2) {
                previousWindowSize = { width: size[0], height: size[1] };
            } else {
                previousWindowSize = { width: 1100, height: 750 };
            }
        } else {
            // Fallback: assume current size based on window dimensions
            previousWindowSize = { width: window.outerWidth, height: window.outerHeight };
        }
    } catch {
        previousWindowSize = { width: 1100, height: 750 };
    }
    
    // Resize window to 1400px width for better info modal display
    const targetWidth = 1400;
    const targetHeight = 750;
    
    try {
        if (typeof resizeWindowSmooth === 'function') {
            await resizeWindowSmooth(targetWidth, targetHeight, 220);
        } else if (window.api && typeof window.api.setWindowSize === 'function') {
            window.api.setWindowSize(targetWidth, targetHeight);
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    } catch {
        // ignore resize errors
    }
    
    const overlay = document.createElement('div');
    overlay.id = 'info-modal-overlay';
    overlay.className = 'modal-overlay';

    const container = document.createElement('div');
    container.className = 'modal-container';

    const iframe = document.createElement('iframe');
    iframe.src = 'info/info.html';
    iframe.setAttribute('title', 'Information');
    iframe.className = 'content-iframe';
    iframe.addEventListener('error', () => {
        iframe.src = 'info-final.html';
    });

    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
    
    // Watch for overlay removal to restore window size
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const removedNode of mutation.removedNodes) {
                if (removedNode === overlay || removedNode.id === 'info-modal-overlay') {
                    observer.disconnect();
                    restoreWindowSize();
                    return;
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true });
}

/**
 * Restore window to previous size after info modal closes
 */
async function restoreWindowSize() {
    if (!previousWindowSize) return;
    
    const { width, height } = previousWindowSize;
    
    try {
        if (typeof resizeWindowSmooth === 'function') {
            await resizeWindowSmooth(width, height, 220);
        } else if (window.api && typeof window.api.setWindowSize === 'function') {
            window.api.setWindowSize(width, height);
        }
    } catch {
        // ignore resize errors
    }
    
    previousWindowSize = null;
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

// ============================================
// NOTIFICATION
// ============================================

/**
 * Show a notification (simple toast alternative)
 * @param {string} message - Message to display
 * @param {string} type - Type (info, error, success)
 */
export function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast status-${type}`;
    notification.textContent = message;
    notification.classList.add('notification');

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('slide-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Make toast available globally
if (typeof window !== 'undefined') {
    window.toast = toast;
    window.showToast = toast;
}
