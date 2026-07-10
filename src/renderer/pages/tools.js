/**
 * Tools Page
 * Contains System Maintenance, Debloat, and BIOS pages
 * Maintenance uses dedicated component classes and synced layout settings.
 */

import { registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast, closeOtherTerminals } from '../components.js';

let maintenanceBusy = false;

// ============================================
// MAINTENANCE HELPER FUNCTIONS
// ============================================

const maintenanceIcon = (body) => `
    <svg class="maintenance-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        ${body}
    </svg>
`;

const maintenanceCustomIcon = (viewBox, body) => `
    <svg class="maintenance-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">
        ${body}
    </svg>
`;

const MAINTENANCE_ICONS = {
    cleaner: maintenanceIcon('<path d="M4 17h9"/><path d="M7 17l1-6.4A2.1 2.1 0 0 1 10.1 9h2.8a2.1 2.1 0 0 1 2.1 1.6l1 6.4"/><path d="M8.7 17v3"/><path d="M14.3 17v3"/><path d="M10 6h4"/><path d="M18 5l.5-1.3L20 3l-1.5-.7L18 1l-.5 1.3L16 3l1.5.7L18 5z"/><path d="M20 11l.4-1 1-.4-1-.4-.4-1-.4 1-1 .4 1 .4.4 1z"/>'),
    tempFile: maintenanceIcon('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9.5 13.5l5 5"/><path d="M14.5 13.5l-5 5"/>'),
    prefetch: maintenanceIcon('<path d="M5 17a7 7 0 1 1 14 0"/><path d="M12 17l4-5"/><path d="M8 17h8"/><path d="M8.5 9.5l1 1"/><path d="M15.5 9.5l-1 1"/>'),
    updateCache: maintenanceIcon('<path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M5 16.5A3.5 3.5 0 0 0 8.5 20h7a3.5 3.5 0 0 0 1-6.86A5 5 0 0 0 7 11.2"/>'),
    imageCache: maintenanceIcon('<rect x="4" y="5" width="16" height="14" rx="3"/><path d="m8 15 2.2-2.2a1.1 1.1 0 0 1 1.6 0L15 16"/><path d="m14 14 1-1a1.1 1.1 0 0 1 1.6 0L20 16"/><circle cx="9" cy="9.5" r="1.3"/>'),
    crashReport: maintenanceIcon('<path d="M8 4h8l3 3v13H8z"/><path d="M16 4v4h4"/><path d="M12 12v3"/><path d="M12 18h.01"/><path d="M9.5 9.5h5"/>'),
    scan: maintenanceIcon('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v6h-6"/>'),
    sparkle: maintenanceIcon('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z"/><path d="M5.5 16.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z"/>'),
    shield: maintenanceIcon('<path d="M12 3l7 3v5c0 4.4-2.9 8.1-7 9.5C7.9 19.1 5 15.4 5 11V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>'),
    selectAll: maintenanceIcon('<path d="M4 12l4 4 8-9"/><rect x="3" y="3" width="18" height="18" rx="4"/>'),
    cleanup: maintenanceIcon('<path d="M4 17h16"/><path d="M7 17l1.2-7.2A2.2 2.2 0 0 1 10.4 8h3.2a2.2 2.2 0 0 1 2.2 1.8L17 17"/><path d="M9 17v3"/><path d="M15 17v3"/><path d="M10 5h4"/>'),
    temp: maintenanceIcon('<path d="M8 3h8"/><path d="M10 3v5l-4.6 8A3.4 3.4 0 0 0 8.3 21h7.4a3.4 3.4 0 0 0 2.9-5L14 8V3"/><path d="M8.5 16h7"/><path d="M10 18h4"/>'),
    recycle: maintenanceIcon('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
    cache: maintenanceIcon('<path d="M5 7c0-2.2 3.1-4 7-4s7 1.8 7 4-3.1 4-7 4-7-1.8-7-4z"/><path d="M5 7v5c0 2.2 3.1 4 7 4s7-1.8 7-4V7"/><path d="M5 12v5c0 2.2 3.1 4 7 4s7-1.8 7-4v-5"/>'),
    thumbnail: maintenanceIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h3v3H8z"/><path d="M14 9h2"/><path d="M14 13h2"/><path d="M8 16h8"/>'),
    report: maintenanceIcon('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 12h6"/><path d="M10 16h4"/>'),
    disk: maintenanceCustomIcon('0 0 1024 1024', '<path fill="currentColor" d="M864.453 386.372H604.968V135.834c0-39.533-32.049-71.582-71.582-71.582h-35.791c-39.533 0-71.582 32.049-71.582 71.582v250.538H166.527c-34.592 0-62.634 28.042-62.634 62.634 0 30.327 21.556 55.617 50.181 61.392L85.997 833.761c0 49.417 35.791 90.596 89.478 89.478 53.687-1.118 85.893-53.687 156.91-53.687 172.801 0 397.852 53.687 397.852 53.687 49.417 0 89.478-40.061 89.478-89.478l68.827-326.927c22.634-9.439 38.547-31.772 38.547-57.828-0.001-34.591-28.043-62.634-62.636-62.634zM461.803 153.73c0-29.651 24.036-53.687 53.687-53.687 29.651 0 53.687 24.036 53.687 53.687v232.642H461.803V153.73z m319.456 662.753c-11.092 41.902-31.537 70.965-70.44 70.965 0 0-197.096-49.497-355.544-53.438l41.811-142.707c2.779-9.485-2.658-19.427-12.142-22.207-9.485-2.777-19.426 2.658-22.205 12.142l-45.103 153.939c-55.562 8.478-102.763 52.27-142.161 52.27-43.62 0-67.243-33.993-53.687-70.965 13.556-36.974 74.247-305.459 74.247-305.459l641.576 0.617c-0.001 0.001-45.261 262.941-56.352 304.843z m83.194-340.633H166.527c-14.825 0-26.843-12.019-26.843-26.843 0-14.825 12.019-26.843 26.843-26.843h697.927c14.825 0 26.843 12.019 26.843 26.843s-12.019 26.843-26.844 26.843z"/>'),
    network: maintenanceIcon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>'),
    dns: maintenanceIcon('<path d="M4 7h10"/><path d="M4 12h16"/><path d="M10 17h10"/><path d="M16 5l2 2-2 2"/><path d="M8 15l-2 2 2 2"/>'),
    ip: maintenanceCustomIcon('0 0 20.234 20.234', '<path fill="currentColor" d="M6.776 4.72h1.549v6.827H6.776V4.72zM11.751 4.669c-0.942 0-1.61 0.061-2.087 0.143v6.735h1.53V9.106c0.143 0.02 0.324 0.031 0.527 0.031 0.911 0 1.691-0.224 2.218-0.721 0.405-0.386 0.628-0.952 0.628-1.621 0-0.668-0.295-1.234-0.729-1.579-0.456-0.365-1.136-0.547-2.087-0.547zM11.709 7.95c-0.222 0-0.385-0.01-0.516-0.041V5.895c0.111-0.03 0.324-0.061 0.639-0.061 0.769 0 1.205 0.375 1.205 1.002 0 0.699-0.507 1.114-1.328 1.114zM10.117 0C5.523 0 1.8 3.723 1.8 8.316s8.317 11.918 8.317 11.918 8.317-7.324 8.317-11.917S14.711 0 10.117 0zM10.138 13.373c-3.05 0-5.522-2.473-5.522-5.524 0-3.05 2.473-5.522 5.522-5.522 3.051 0 5.522 2.473 5.522 5.522 0 3.05-2.472 5.524-5.522 5.524z"/>'),
    bluetooth: maintenanceIcon('<path d="M7 7l10 10-5 4V3l5 4L7 17"/>'),
    reset: maintenanceCustomIcon('0 0 1024 1024', '<path fill="currentColor" d="M372.288 745.792a394.048 394.048 0 0 0 113.728 102.848v-127.744a390.08 390.08 0 0 0-113.728 24.896z m-51.584 24.192a392.96 392.96 0 0 0-60.16 41.6h-1.28a390.336 390.336 0 0 0 205.696 89.6 450.24 450.24 0 0 1-144.256-131.2z m-24.704-230.016c3.968 56.768 20.096 110.208 45.696 157.696a445.696 445.696 0 0 1 144.32-32.896v-124.8h-190.08z m-56.128 0H120.96a390.4 390.4 0 0 0 98.56 233.024c22.208-19.2 46.272-36.224 71.808-50.752a445.312 445.312 0 0 1-51.456-182.272z m445.824 158.784c25.984-47.808 42.24-101.568 46.336-158.72H540.992v124.864c51.072 3.2 99.776 14.976 144.704 33.92z m50.24 24.96c24.448 14.08 47.552 30.464 68.928 48.896a390.4 390.4 0 0 0 98.176-232.576h-114.88a445.312 445.312 0 0 1-52.224 183.68z m-194.944 125.44a394.048 394.048 0 0 0 113.92-102.4 389.888 389.888 0 0 0-113.92-25.728v128.192z m23.104 51.392a390.4 390.4 0 0 0 200.704-88.96h-0.512a392.96 392.96 0 0 0-57.92-40.32 450.24 450.24 0 0 1-142.272 129.28zM341.76 326.144a389.632 389.632 0 0 0-45.76 157.824h190.016V358.976a445.696 445.696 0 0 1-144.256-32.768z m-50.368-24.576a449.216 449.216 0 0 1-71.808-50.56 390.4 390.4 0 0 0-98.56 232.96h118.848a445.312 445.312 0 0 1 51.52-182.4z m194.56-126.208A394.048 394.048 0 0 0 372.48 278.016a390.08 390.08 0 0 0 113.536 24.768V175.36z m-20.992-52.544a390.272 390.272 0 0 0-205.312 89.152h0.512c18.88 15.872 39.168 29.888 60.608 41.92a450.24 450.24 0 0 1 144.192-131.072z m189.76 154.048a394.048 394.048 0 0 0-113.728-102.08v127.808a389.952 389.952 0 0 0 113.728-25.728z m51.392-24.576a392.96 392.96 0 0 0 57.856-40.32h0.384A390.336 390.336 0 0 0 564.16 123.52a450.24 450.24 0 0 1 141.952 128.832z m25.92 231.68a389.632 389.632 0 0 0-46.528-159.168 445.568 445.568 0 0 1-144.512 33.92v125.248h191.04z m56.128 0h114.88a390.4 390.4 0 0 0-98.56-232.96 449.28 449.28 0 0 1-68.736 48.896c29.824 55.424 48.32 117.76 52.416 184.128zM512 960A448 448 0 1 1 512 64a448 448 0 0 1 0 896z"/>'),
    repair: maintenanceIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.8-2.8a5.5 5.5 0 0 1-7.1 7.1L7.1 20a2.1 2.1 0 0 1-3-3l6.3-6.3a5.5 5.5 0 0 1 7.1-7.1z"/>'),
    audio: maintenanceIcon('<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    tools: maintenanceCustomIcon('0 0 24 24', '<path d="M4 12A8 8 0 0 1 18.93 8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><path d="M20 12A8 8 0 0 1 5.07 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><polyline points="14 8 19 8 19 3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><polyline points="10 16 5 16 5 21" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>'),
    overview: maintenanceIcon('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>'),
    list: maintenanceIcon('<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>')
};

function getMaintenanceIcon(iconKey) {
    return MAINTENANCE_ICONS[iconKey] || MAINTENANCE_ICONS.tools;
}

function createMaintenanceBadge(text, tone = 'admin') {
    const badge = document.createElement('span');
    badge.className = `maintenance-card-badge maintenance-card-badge--${tone}`;
    badge.setAttribute('aria-label', text);
    badge.title = text;

    const icon = document.createElement('span');
    icon.className = 'maintenance-card-badge-icon';
    icon.innerHTML = getMaintenanceIcon(tone === 'admin' ? 'shield' : 'tools');

    const label = document.createElement('span');
    label.textContent = text;

    badge.appendChild(icon);
    badge.appendChild(label);
    return badge;
}

/**
 * Creates a self-contained maintenance action card.
 * @param {string} name - Card title
 * @param {string} description - Card description
 * @param {string} iconKey - Icon identifier
 * @param {string} buttonText - Button label
 * @param {Object} task - Streaming task descriptor { api, cmd, success, error }
 * @param {boolean} requiresAdmin - Show admin warning
 */
function createMaintenanceCard(name, description, iconKey, buttonText, task, requiresAdmin = false) {
    const card = document.createElement('div');
    card.className = 'maintenance-action-card';

    const header = document.createElement('div');
    header.className = 'maintenance-card-header';

    const iconEl = document.createElement('div');
    iconEl.className = 'maintenance-card-icon';
    iconEl.innerHTML = getMaintenanceIcon(iconKey);
    header.appendChild(iconEl);

    const text = document.createElement('div');
    text.className = 'maintenance-card-copy';
    const nameEl = document.createElement('h3');
    nameEl.textContent = name;
    nameEl.className = 'maintenance-card-title';
    const descEl = document.createElement('p');
    descEl.textContent = description;
    descEl.className = 'maintenance-card-description';

    if (requiresAdmin) {
        card.classList.add('maintenance-action-card--admin');
        card.appendChild(createMaintenanceBadge(createMaintenanceCard.adminBadgeText || 'Admin'));
    }

    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);

    const button = document.createElement('button');
    button.className = 'button maintenance-card-action';
    button.textContent = buttonText;
    button.dataset.loadingText = createMaintenanceCard.runningText || 'Running...';

    const term = createStreamTerminal('Stop');
    term.title.textContent = task.cmd;

    let running = false;
    let cancelled = false;

    button.addEventListener('click', async () => {
        if (running) return;
        if (maintenanceBusy) {
            toast(createMaintenanceCard.busyMessage || 'Another maintenance task is running.', {
                type: 'info', title: createMaintenanceCard.toastTitle || 'Maintenance'
            });
            return;
        }
        running = true;
        maintenanceBusy = true;
        cancelled = false;
        card.classList.add('is-running');

        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = button.dataset.loadingText || 'Running...';

        term.reset();
        closeOtherTerminals(term.terminal);
        term.terminal.classList.add('open', 'running');
        term.print(`> ${task.cmd}`, 'is-cmd');

        const unsubscribe = window.api.onSystemRepairOutput(({ stream, text }) => {
            term.append(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await task.api();
            if (result && result.success) {
                term.print(`✔ ${task.success}`, 'is-ok');
                toast(task.success, { type: 'success', title: createMaintenanceCard.toastTitle || 'Maintenance' });
            } else if (!result || !result.cancelled) {
                term.print(`✖ ${result?.error || `${name} exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                toast(result?.error || task.error, { type: 'error', title: createMaintenanceCard.toastTitle || 'Maintenance' });
            }
        } catch (error) {
            if (!cancelled) {
                term.print(`✖ ${error.message}`, 'is-err');
                toast(error.message || task.error, { type: 'error', title: createMaintenanceCard.toastTitle || 'Maintenance' });
            }
        } finally {
            unsubscribe();
            running = false;
            maintenanceBusy = false;
            card.classList.remove('is-running');
            term.terminal.classList.remove('running');
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    term.stopBtn.addEventListener('click', async () => {
        if (!running) return;
        cancelled = true;
        term.stopBtn.disabled = true;
        try {
            await window.api.cancelSystemRepair();
            term.print('■ Task cancelled.', 'is-warn');
        } finally {
            term.stopBtn.disabled = false;
        }
    });

    card.appendChild(header);
    card.appendChild(button);
    card.appendChild(term.terminal);

    return card;
}

// ============================================
// MAINTENANCE TASK FUNCTIONS
// ============================================

function createStreamTerminal(stopLabel) {
    const terminal = document.createElement('div');
    terminal.className = 'winget-terminal';

    const header = document.createElement('div');
    header.className = 'winget-terminal-header';

    const dots = document.createElement('div');
    dots.className = 'winget-terminal-dots';
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));

    const title = document.createElement('span');
    title.className = 'winget-terminal-title';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'winget-terminal-stop';
    stopBtn.textContent = stopLabel;

    header.appendChild(dots);
    header.appendChild(title);
    header.appendChild(stopBtn);

    const body = document.createElement('div');
    body.className = 'winget-terminal-body';

    terminal.appendChild(header);
    terminal.appendChild(body);

    let currentLine = null;
    let replaceCurrent = false;
    const MAX_LINES = 400;

    function newLine(className) {
        currentLine = document.createElement('div');
        currentLine.className = 'winget-terminal-line';
        if (className) currentLine.classList.add(className);
        body.appendChild(currentLine);
        while (body.childElementCount > MAX_LINES) {
            body.removeChild(body.firstElementChild);
        }
    }

    function append(text, className) {
        const clean = stripAnsiSequences(text).replace(/\r\n/g, '\n');
        for (const chunk of clean.split(/(\n|\r)/)) {
            if (chunk === '\n') {
                currentLine = null;
                replaceCurrent = false;
            } else if (chunk === '\r') {
                replaceCurrent = true;
            } else if (chunk) {
                if (!currentLine) newLine(className);
                if (replaceCurrent) {
                    currentLine.textContent = chunk;
                    replaceCurrent = false;
                } else {
                    currentLine.textContent += chunk;
                }
            }
        }
        body.scrollTop = body.scrollHeight;
    }

    function print(text, className) {
        currentLine = null;
        newLine(className);
        currentLine.textContent = text;
        currentLine = null;
        body.scrollTop = body.scrollHeight;
    }

    function reset() {
        body.innerHTML = '';
        currentLine = null;
        replaceCurrent = false;
    }

    return { terminal, title, stopBtn, append, print, reset };
}

const flushDnsCache = { api: () => window.api.flushDnsCache(), cmd: 'ipconfig /flushdns', success: 'DNS cache flushed!', error: 'Failed to flush DNS cache.' };
const releaseRenewIp = { api: () => window.api.releaseRenewIp(), cmd: 'ipconfig /release; ipconfig /renew', success: 'IP released & renewed!', error: 'Failed to release/renew IP.' };
const fixBluetooth = { api: () => window.api.fixBluetooth(), cmd: 'Restart Bluetooth services', success: 'Bluetooth fixed!', error: 'Failed to fix Bluetooth.' };
const checkDisk = { api: () => window.api.checkDisk(), cmd: 'chkdsk C:', success: 'Disk check completed!', error: 'Failed to check disk.' };
const networkReset = { api: () => window.api.networkReset(), cmd: 'netsh winsock reset; netsh int ip reset', success: 'Network reset completed! A restart may be required.', error: 'Failed to reset network.' };
const restartAudioSystem = { api: () => window.api.restartAudioSystem(), cmd: 'Restart Windows Audio services', success: 'Audio system restarted!', error: 'Failed to restart audio.' };

function stripAnsiSequences(text) {
    return String(text)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x08/g, '');
}

function buildWingetUpdaterCard(translations) {
    const card = document.createElement('div');
    card.className = 'maintenance-action-card maintenance-action-card--updater';
    card.appendChild(createMaintenanceBadge('Winget', 'info'));

    const header = document.createElement('div');
    header.className = 'maintenance-card-header';

    const iconEl = document.createElement('div');
    iconEl.className = 'maintenance-card-icon';
    iconEl.innerHTML = getMaintenanceIcon('tools');
    header.appendChild(iconEl);

    const text = document.createElement('div');
    text.className = 'maintenance-card-copy';
    const nameEl = document.createElement('h3');
    nameEl.textContent = translations.maintenance?.update_all_apps || 'Update All Apps';
    nameEl.className = 'maintenance-card-title';
    const descEl = document.createElement('p');
    descEl.textContent = translations.maintenance?.update_all_apps_desc || 'Upgrade every installed app in place with winget';
    descEl.className = 'maintenance-card-description';
    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);
    card.appendChild(header);

    const runBtn = document.createElement('button');
    runBtn.className = 'button maintenance-card-action';
    runBtn.textContent = translations.actions?.upgrade_all || 'Upgrade All';
    card.appendChild(runBtn);

    // Shown when winget (App Installer) is missing — offers a Store shortcut.
    const missing = document.createElement('div');
    missing.className = 'winget-missing';
    const missingText = document.createElement('span');
    missingText.className = 'winget-missing-text';
    missingText.textContent = translations.messages?.winget_missing
        || 'Winget (App Installer) is not installed. Install or update it from the Microsoft Store to continue.';
    const storeBtn = document.createElement('button');
    storeBtn.type = 'button';
    storeBtn.className = 'button-secondary winget-missing-store';
    storeBtn.textContent = translations.actions?.open_store || 'Open Microsoft Store';
    storeBtn.addEventListener('click', () => {
        try { window.api.openExternal('ms-windows-store://pdp/?productid=9NBLGGH4NNS1'); } catch { }
    });
    missing.appendChild(missingText);
    missing.appendChild(storeBtn);
    card.appendChild(missing);

    const terminal = document.createElement('div');
    terminal.className = 'winget-terminal';

    const termHeader = document.createElement('div');
    termHeader.className = 'winget-terminal-header';

    const dots = document.createElement('div');
    dots.className = 'winget-terminal-dots';
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));

    const termTitle = document.createElement('span');
    termTitle.className = 'winget-terminal-title';
    termTitle.textContent = 'winget upgrade --all';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'winget-terminal-stop';
    stopBtn.textContent = translations.actions?.stop || 'Stop';

    termHeader.appendChild(dots);
    termHeader.appendChild(termTitle);
    termHeader.appendChild(stopBtn);

    const termBody = document.createElement('div');
    termBody.className = 'winget-terminal-body';

    terminal.appendChild(termHeader);
    terminal.appendChild(termBody);
    card.appendChild(terminal);

    let running = false;
    let cancelled = false;
    let currentLine = null;
    let replaceCurrent = false;
    const MAX_LINES = 400;

    function newLine(className) {
        currentLine = document.createElement('div');
        currentLine.className = 'winget-terminal-line';
        if (className) currentLine.classList.add(className);
        termBody.appendChild(currentLine);
        while (termBody.childElementCount > MAX_LINES) {
            termBody.removeChild(termBody.firstElementChild);
        }
    }

    function appendOutput(text, className) {
        const clean = stripAnsiSequences(text).replace(/\r\n/g, '\n');
        for (const chunk of clean.split(/(\n|\r)/)) {
            if (chunk === '\n') {
                currentLine = null;
                replaceCurrent = false;
            } else if (chunk === '\r') {
                replaceCurrent = true;
            } else if (chunk) {
                if (!currentLine) newLine(className);
                if (replaceCurrent) {
                    currentLine.textContent = chunk;
                    replaceCurrent = false;
                } else {
                    currentLine.textContent += chunk;
                }
            }
        }
        termBody.scrollTop = termBody.scrollHeight;
    }

    function printLine(text, className) {
        currentLine = null;
        newLine(className);
        currentLine.textContent = text;
        currentLine = null;
        termBody.scrollTop = termBody.scrollHeight;
    }

    function showMissing(show) {
        card.classList.toggle('winget-unavailable', show);
    }

    runBtn.addEventListener('click', async () => {
        if (running) return;
        if (maintenanceBusy) {
            toast(translations.maintenance?.busy_message || 'Another maintenance task is running.', {
                type: 'info', title: translations.maintenance?.toast_title || 'Maintenance'
            });
            return;
        }
        running = true;
        maintenanceBusy = true;
        cancelled = false;
        card.classList.add('is-running');

        const originalText = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.classList.add('btn-loading');
        runBtn.textContent = translations.actions?.checking || 'Checking winget...';

        // Verify winget is present (and modern enough) before opening the terminal.
        try {
            const status = await window.api.checkWingetUpgrade();
            if (!status || !status.installed) {
                showMissing(true);
                toast(translations.messages?.winget_not_installed || 'Winget is not installed.', { type: 'error', title: 'Winget' });
                running = false;
                maintenanceBusy = false;
                card.classList.remove('is-running');
                runBtn.disabled = false;
                runBtn.classList.remove('btn-loading');
                runBtn.textContent = originalText;
                return;
            }
        } catch { /* fall through and let the run attempt surface the error */ }

        showMissing(false);
        runBtn.textContent = translations.actions?.upgrading || 'Upgrading...';

        termBody.innerHTML = '';
        currentLine = null;
        replaceCurrent = false;
        closeOtherTerminals(terminal);
        terminal.classList.add('open', 'running');
        printLine('> winget upgrade --all', 'is-cmd');

        const unsubscribe = window.api.onWingetUpgradeOutput(({ stream, text }) => {
            appendOutput(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await window.api.wingetUpgradeAll();
            if (result && result.success && result.partial) {
                printLine('⚠ Some packages could not be upgraded (see output above).', 'is-warn');
                toast('Upgrades finished — some packages were skipped or blocked.', { type: 'warning', title: 'Winget' });
            } else if (result && result.success) {
                printLine('✔ All upgrades completed.', 'is-ok');
                toast('All apps upgraded successfully!', { type: 'success', title: 'Winget' });
            } else if (result && result.cancelled) {
                // User stopped it — already reported by the stop handler, stay quiet.
            } else if (result && result.notInstalled) {
                showMissing(true);
                terminal.classList.remove('open');
                toast(translations.messages?.winget_not_installed || 'Winget is not installed.', { type: 'error', title: 'Winget' });
            } else {
                printLine(`✖ ${result?.error || `Winget exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                toast(result?.error || 'Winget upgrade finished with errors.', { type: 'error', title: 'Winget' });
            }
        } catch (error) {
            if (!cancelled) {
                printLine(`✖ ${error.message}`, 'is-err');
                toast(error.message || 'Winget upgrade failed.', { type: 'error', title: 'Winget' });
            }
        } finally {
            unsubscribe();
            running = false;
            maintenanceBusy = false;
            card.classList.remove('is-running');
            terminal.classList.remove('running');
            runBtn.disabled = false;
            runBtn.classList.remove('btn-loading');
            runBtn.textContent = originalText;
        }
    });

    stopBtn.addEventListener('click', async () => {
        if (!running) return;
        cancelled = true;
        stopBtn.disabled = true;
        try {
            await window.api.cancelWingetUpgrade();
            printLine('■ Upgrade cancelled.', 'is-warn');
        } finally {
            stopBtn.disabled = false;
        }
    });

    return card;
}

// ============================================
// SYSTEM MAINTENANCE PAGE
// ============================================

const MAINTENANCE_LAYOUT_SETTING_KEY = 'maintenance_layout';
const MAINTENANCE_LAYOUTS = ['overview', 'list'];

function syncMaintenanceLayout(layout) {
    if (!MAINTENANCE_LAYOUTS.includes(layout)) return;
    // The main-process settings store persists locally now and coalesces
    // rapid changes into one Supabase upsert after its 1.5 s quiet period.
    try {
        const request = window.api?.setSetting?.(MAINTENANCE_LAYOUT_SETTING_KEY, layout);
        if (request && typeof request.catch === 'function') request.catch(() => { });
    } catch { }
}

function setMaintenanceLayout(container, layout, buttons, persist = true) {
    const selected = MAINTENANCE_LAYOUTS.includes(layout) ? layout : 'overview';
    const changed = container.dataset.maintenanceView !== selected;
    for (const option of MAINTENANCE_LAYOUTS) {
        container.classList.toggle(`maintenance-view--${option}`, option === selected);
    }
    container.dataset.maintenanceView = selected;

    buttons.forEach((button) => {
        const active = button.dataset.maintenanceLayout === selected;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });

    if (persist && changed) {
        syncMaintenanceLayout(selected);
    }
}

async function loadMaintenanceLayoutPreference() {
    try {
        const synced = await window.api?.getSetting?.(MAINTENANCE_LAYOUT_SETTING_KEY);
        if (MAINTENANCE_LAYOUTS.includes(synced)) return synced;
    } catch { }

    return 'overview';
}

function createMaintenanceHero(translations, container, initialLayout) {
    const T = translations.maintenance || {};
    const hero = document.createElement('header');
    hero.className = 'maintenance-hero';

    const main = document.createElement('div');
    main.className = 'maintenance-hero-main';

    const heroIcon = document.createElement('div');
    heroIcon.className = 'maintenance-hero-icon';
    heroIcon.innerHTML = getMaintenanceIcon('sparkle');

    const copy = document.createElement('div');
    copy.className = 'maintenance-hero-copy';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'maintenance-hero-eyebrow';

    const kicker = document.createElement('span');
    kicker.textContent = T.page_kicker || 'Windows Care Center';

    const ready = document.createElement('span');
    ready.className = 'maintenance-ready-status';
    const readyDot = document.createElement('span');
    readyDot.className = 'maintenance-ready-dot';
    const readyText = document.createElement('span');
    readyText.textContent = T.ready || 'Ready';
    ready.appendChild(readyDot);
    ready.appendChild(readyText);

    eyebrow.appendChild(kicker);
    eyebrow.appendChild(ready);

    const title = document.createElement('h1');
    title.textContent = T.page_title || translations.menu?.system_maintenance || 'System Maintenance';

    const description = document.createElement('p');
    description.textContent = T.page_description
        || translations.menu_info?.system_maintenance
        || 'Repair connections, diagnose Windows, and keep your applications current.';

    copy.appendChild(eyebrow);
    copy.appendChild(title);
    copy.appendChild(description);

    const stats = document.createElement('div');
    stats.className = 'maintenance-hero-stats';

    const statItems = [
        { value: '9', label: T.actions_label || 'actions' },
        { value: '3', label: T.categories_label || 'categories' }
    ];

    for (const item of statItems) {
        const stat = document.createElement('div');
        stat.className = 'maintenance-hero-stat';
        const value = document.createElement('strong');
        value.textContent = item.value;
        const label = document.createElement('span');
        label.textContent = item.label;
        stat.appendChild(value);
        stat.appendChild(label);
        stats.appendChild(stat);
    }

    main.appendChild(heroIcon);
    main.appendChild(copy);
    main.appendChild(stats);

    const footer = document.createElement('div');
    footer.className = 'maintenance-hero-footer';

    const notice = document.createElement('div');
    notice.className = 'maintenance-hero-notice';
    const noticeIcon = document.createElement('span');
    noticeIcon.innerHTML = getMaintenanceIcon('shield');
    const noticeText = document.createElement('span');
    noticeText.textContent = T.one_task_notice
        || 'One task runs at a time. Admin actions may request permission.';
    notice.appendChild(noticeIcon);
    notice.appendChild(noticeText);

    const layoutControl = document.createElement('div');
    layoutControl.className = 'maintenance-layout-control';

    const layoutLabel = document.createElement('span');
    layoutLabel.className = 'maintenance-layout-label';
    layoutLabel.textContent = T.layout_label || 'Layout';

    const switcher = document.createElement('div');
    switcher.className = 'maintenance-layout-switcher';
    switcher.setAttribute('role', 'group');
    switcher.setAttribute('aria-label', T.layout_hint || 'Choose a maintenance layout');

    const layoutOptions = [
        { id: 'overview', icon: 'overview', label: T.view_overview || 'Overview' },
        { id: 'list', icon: 'list', label: T.view_list || 'List' }
    ];
    const buttons = [];

    for (const option of layoutOptions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'maintenance-layout-option';
        button.dataset.maintenanceLayout = option.id;

        const icon = document.createElement('span');
        icon.className = 'maintenance-layout-option-icon';
        icon.innerHTML = getMaintenanceIcon(option.icon);

        const label = document.createElement('span');
        label.textContent = option.label;

        button.appendChild(icon);
        button.appendChild(label);
        button.addEventListener('click', () => setMaintenanceLayout(container, option.id, buttons));
        buttons.push(button);
        switcher.appendChild(button);
    }

    layoutControl.appendChild(layoutLabel);
    layoutControl.appendChild(switcher);
    footer.appendChild(notice);
    footer.appendChild(layoutControl);
    hero.appendChild(main);
    hero.appendChild(footer);

    setMaintenanceLayout(container, initialLayout, buttons, false);

    return hero;
}

function createMaintenanceSection(titleText, descriptionText, iconKey, actionCount, actionLabel, tone) {
    const section = document.createElement('section');
    section.className = `maintenance-section maintenance-section--${tone}`;

    const header = document.createElement('header');
    header.className = 'maintenance-section-header';

    const heading = document.createElement('div');
    heading.className = 'maintenance-section-heading';

    const icon = document.createElement('span');
    icon.className = 'maintenance-section-icon';
    icon.innerHTML = getMaintenanceIcon(iconKey);

    const copy = document.createElement('div');
    copy.className = 'maintenance-section-copy';

    const title = document.createElement('h2');
    title.className = 'maintenance-section-title';
    title.textContent = titleText;

    const description = document.createElement('p');
    description.className = 'maintenance-section-description';
    description.textContent = descriptionText;

    copy.appendChild(title);
    copy.appendChild(description);
    heading.appendChild(icon);
    heading.appendChild(copy);

    const count = document.createElement('span');
    count.className = 'maintenance-section-count';
    count.textContent = String(actionCount);
    count.setAttribute('aria-label', `${actionCount} ${actionLabel}`);

    const grid = document.createElement('div');
    grid.className = 'maintenance-action-grid';

    header.appendChild(heading);
    header.appendChild(count);
    section.appendChild(header);
    section.appendChild(grid);

    return { section, grid };
}

const CLEANER_TASKS = [
    { id: 'temp', title: 'Clean Temporary Files', description: 'Remove system and user temporary files.', detail: 'Windows + user temp folders', icon: 'tempFile' },
    { id: 'prefetch', title: 'Clean Prefetch Files', description: 'Delete files from the Windows Prefetch folder.', detail: 'C:\\Windows\\Prefetch', icon: 'prefetch' },
    { id: 'recycle_bin', title: 'Empty Recycle Bin', description: 'Permanently remove files from the Recycle Bin.', detail: 'Recycle Bin', icon: 'recycle' },
    { id: 'windows_update', title: 'Clean Windows Update Cache', description: 'Remove Windows Update downloaded installation files.', detail: 'C:\\Windows\\SoftwareDistribution\\Download', icon: 'updateCache' },
    { id: 'thumbnail_cache', title: 'Clear Thumbnail Cache', description: 'Remove cached thumbnail images used by File Explorer.', detail: 'Explorer thumbnail and icon cache', icon: 'imageCache' },
    { id: 'error_reports', title: 'Clear Error Reports', description: 'Remove error report and crash dump files.', detail: 'CrashDumps + Windows Error Reporting', icon: 'crashReport' }
];

let cleanerT = {};

function formatCleanerBytes(bytes) {
    const value = Number(bytes || 0);
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);
    return `${amount.toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatCleanerDate(value) {
    const never = cleanerT.never_cleaned || 'Not cleaned yet.';
    if (!value) return never;
    try {
        return new Date(value).toLocaleString();
    } catch {
        return never;
    }
}

function setCleanerButtonContent(button, iconKey, label) {
    button.innerHTML = '';
    const icon = document.createElement('span');
    icon.className = 'cleaner-button-icon';
    icon.innerHTML = getMaintenanceIcon(iconKey);
    const text = document.createElement('span');
    text.textContent = label;
    button.appendChild(icon);
    button.appendChild(text);
}

// Cleaner scan state lives at module scope so it survives tab switches:
// results are cached and a single scan is shared/deduped across page rebuilds.
const cleanerState = {
    results: null,       // normalized items from the last completed scan, or null
    scanMode: '',        // current status text
    scanning: false,     // is a scan currently in flight
    scanPromise: null,   // the in-flight scan promise (dedupe handle)
    adminEnabled: false, // persistent elevated session is active
    adminDeclined: false // user declined UAC — don't ask again this session
};

// The render fn of the currently-mounted cleaner page (only one exists at a time).
let cleanerActiveRender = null;

function notifyCleaner() {
    if (cleanerActiveRender) {
        try { cleanerActiveRender(); } catch { }
    }
}

// On the first run this asks for admin ONCE (UAC). Accepting starts a persistent
// elevated session: this scan and every later scan/clean go through it with no
// further prompts. Declining locks the session to limited mode — protected
// folders show "Admin needed" and it never asks again.
function runCleanerScan() {
    if (cleanerState.scanPromise) return cleanerState.scanPromise;

    cleanerState.scanning = true;
    cleanerState.scanMode = cleanerT.scanning || 'Scanning...';

    const promise = (async () => {
        try {
            if (!cleanerState.adminEnabled && !cleanerState.adminDeclined) {
                cleanerState.scanMode = cleanerT.waiting_admin || 'Waiting for administrator approval...';
                notifyCleaner();
                try {
                    const res = await window.api.enableCleanerAdmin();
                    if (res && res.enabled) {
                        cleanerState.adminEnabled = true;
                    } else {
                        cleanerState.adminDeclined = true;
                    }
                } catch {
                    cleanerState.adminDeclined = true;
                }
                cleanerState.scanMode = cleanerT.scanning || 'Scanning...';
                notifyCleaner();
            }

            const result = await window.api.scanCleanerTasks({ elevated: cleanerState.adminEnabled });

            if (!result || !result.success) {
                toast((result && result.error) || cleanerT.scan_failed || 'Cleaner scan failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
                return;
            }

            cleanerState.results = result.items || [];
            cleanerState.scanMode = result.elevated
                ? (cleanerT.scan_full || 'Full scan completed with administrator access.')
                : (cleanerT.scan_limited || 'Limited scan. Protected items need admin — cleaned when you press Clean.');
        } catch (error) {
            toast((error && error.message) || cleanerT.scan_failed || 'Cleaner scan failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
        } finally {
            cleanerState.scanning = false;
            cleanerState.scanPromise = null;
            notifyCleaner();
        }
    })();

    cleanerState.scanPromise = promise;
    notifyCleaner();
    return promise;
}

export async function buildCleanerPage(translations = {}) {
    cleanerT = translations.cleaner_ui || {};
    const taskText = (task) => (cleanerT.tasks && cleanerT.tasks[task.id]) || {};
    const container = document.createElement('div');
    container.className = 'card cleaner-page';
    const taskState = new Map(CLEANER_TASKS.map((task) => [task.id, { ...task, sizeBytes: 0, path: task.detail, inaccessible: false }]));
    const rowControls = new Map();
    let scanning = false;
    let cleaning = false;

    const summary = document.createElement('section');
    summary.className = 'cleaner-summary';

    const summaryIcon = document.createElement('div');
    summaryIcon.className = 'cleaner-summary-icon';
    summaryIcon.innerHTML = getMaintenanceIcon('cleaner');

    const summaryText = document.createElement('div');
    summaryText.className = 'cleaner-summary-text';

    const title = document.createElement('h2');
    title.textContent = cleanerT.title || 'System Cleaner';

    const lastCleaned = document.createElement('p');
    lastCleaned.className = 'cleaner-last-cleaned';
    lastCleaned.textContent = `${cleanerT.last_cleaned || 'Last cleaned:'} ${formatCleanerDate(localStorage.getItem('cleanerLastCleaned'))}`;

    const totalLine = document.createElement('p');
    totalLine.className = 'cleaner-total-line';
    totalLine.textContent = `${cleanerT.total_size || 'Total size'} `;
    const totalValue = document.createElement('span');
    totalValue.textContent = cleanerT.scanning || 'Scanning...';
    totalLine.appendChild(totalValue);

    const scanMode = document.createElement('p');
    scanMode.className = 'cleaner-scan-mode';
    scanMode.textContent = cleanerT.scanning || 'Scanning...';

    summaryText.appendChild(title);
    summaryText.appendChild(lastCleaned);
    summaryText.appendChild(totalLine);
    summaryText.appendChild(scanMode);

    const summaryActions = document.createElement('div');
    summaryActions.className = 'cleaner-summary-actions';

    const scanBtn = document.createElement('button');
    scanBtn.type = 'button';
    scanBtn.className = 'button-secondary cleaner-scan-btn';
    setCleanerButtonContent(scanBtn, 'scan', cleanerT.scan || 'Scan');

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'button-secondary cleaner-select-btn';
    setCleanerButtonContent(selectAllBtn, 'selectAll', cleanerT.select_all || 'Select All');

    const cleanBtn = document.createElement('button');
    cleanBtn.type = 'button';
    cleanBtn.className = 'button cleaner-clean-btn';
    setCleanerButtonContent(cleanBtn, 'cleaner', cleanerT.clean_selected || 'Clean Selected');
    cleanBtn.disabled = true;

    summaryActions.appendChild(scanBtn);
    summaryActions.appendChild(selectAllBtn);
    summaryActions.appendChild(cleanBtn);
    summary.appendChild(summaryIcon);
    summary.appendChild(summaryText);
    summary.appendChild(summaryActions);
    container.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'cleaner-list';
    container.appendChild(list);

    const cleanTerm = createStreamTerminal('Stop');
    cleanTerm.stopBtn.remove();
    cleanTerm.title.textContent = 'cleaner';
    container.appendChild(cleanTerm.terminal);

    function updateTotals() {
        const totalBytes = Array.from(taskState.values()).reduce((sum, task) => sum + Number(task.sizeBytes || 0), 0);
        const selectedBytes = Array.from(rowControls.values()).reduce((sum, control) => {
            if (!control.checkbox.checked) return sum;
            const task = taskState.get(control.id);
            return sum + Number(task?.sizeBytes || 0);
        }, 0);
        const checkedCount = Array.from(rowControls.values()).filter((control) => control.checkbox.checked).length;

        const cleanLabel = cleanerT.clean_selected || 'Clean Selected';
        totalValue.textContent = scanning ? (cleanerT.scanning || 'Scanning...') : formatCleanerBytes(totalBytes);
        totalValue.classList.toggle('is-scanning', scanning);
        cleanBtn.disabled = scanning || cleaning || checkedCount === 0;
        setCleanerButtonContent(cleanBtn, 'cleaner', selectedBytes > 0 ? `${cleanLabel} (${formatCleanerBytes(selectedBytes)})` : cleanLabel);
        setCleanerButtonContent(selectAllBtn, 'selectAll', checkedCount === rowControls.size && checkedCount > 0 ? (cleanerT.unselect_all || 'Unselect All') : (cleanerT.select_all || 'Select All'));
    }

    function renderRows() {
        list.innerHTML = '';
        rowControls.clear();

        CLEANER_TASKS.forEach((task) => {
            const data = taskState.get(task.id) || task;
            // With the admin session active, protected items are selectable (the
            // session cleans them silently). If the user declined admin, they lock.
            const accessibleEmpty = !data.inaccessible && Number(data.sizeBytes || 0) <= 0;
            const adminBlocked = data.inaccessible && !cleanerState.adminEnabled;
            const isLocked = scanning || cleaning || accessibleEmpty || adminBlocked;

            const row = document.createElement('article');
            row.className = 'cleaner-row';
            if (isLocked && !scanning) row.classList.add('is-locked');
            if (data.inaccessible) row.classList.add('is-admin');

            const icon = document.createElement('div');
            icon.className = 'cleaner-row-icon';
            icon.innerHTML = getMaintenanceIcon(task.icon);

            const content = document.createElement('div');
            content.className = 'cleaner-row-content';

            const rowTitle = document.createElement('h3');
            rowTitle.textContent = taskText(task).title || task.title;

            const desc = document.createElement('p');
            desc.textContent = taskText(task).description || task.description;

            const meta = document.createElement('div');
            meta.className = 'cleaner-row-meta';

            const size = document.createElement('span');
            size.className = 'cleaner-size';
            if (scanning) {
                size.textContent = cleanerT.scanning || 'Scanning...';
                size.classList.add('is-scanning');
            } else if (data.inaccessible) {
                size.textContent = cleanerT.admin_needed || 'Admin needed';
                size.classList.add('is-warning');
            } else {
                size.textContent = formatCleanerBytes(data.sizeBytes);
            }

            const detail = document.createElement('span');
            detail.className = 'cleaner-path';
            detail.textContent = data.path || task.detail;

            meta.appendChild(size);
            meta.appendChild(detail);
            content.appendChild(rowTitle);
            content.appendChild(desc);
            content.appendChild(meta);

            const toggle = document.createElement('label');
            toggle.className = 'cleaner-toggle';
            if (isLocked) toggle.classList.add('is-disabled');

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = !isLocked && ((data.inaccessible && cleanerState.adminEnabled) || Number(data.sizeBytes || 0) > 0);
            checkbox.disabled = isLocked;
            checkbox.addEventListener('change', updateTotals);

            const track = document.createElement('span');
            toggle.appendChild(checkbox);
            toggle.appendChild(track);

            row.appendChild(icon);
            row.appendChild(content);
            row.appendChild(toggle);
            list.appendChild(row);
            rowControls.set(task.id, { id: task.id, checkbox, size, row });
        });

        updateTotals();
    }

    // Pull the shared module state into this instance's DOM. Called on mount and
    // whenever the shared scan changes phase (start / mode change / done).
    let wasMounted = false;
    function renderFromState() {
        if (container.isConnected) {
            wasMounted = true;
        } else if (wasMounted) {
            if (cleanerActiveRender === renderFromState) cleanerActiveRender = null;
            return;
        }

        scanning = cleanerState.scanning;

        if (Array.isArray(cleanerState.results)) {
            cleanerState.results.forEach((item) => {
                const existing = taskState.get(item.id);
                if (existing) {
                    taskState.set(item.id, {
                        ...existing,
                        sizeBytes: Number(item.sizeBytes || 0),
                        path: item.path || existing.detail,
                        inaccessible: Boolean(item.inaccessible)
                    });
                }
            });
        }

        if (cleanerState.scanMode) scanMode.textContent = cleanerState.scanMode;

        if (scanning) {
            scanBtn.classList.add('btn-loading');
            setCleanerButtonContent(scanBtn, 'scan', cleanerT.scanning || 'Scanning...');
        } else {
            scanBtn.classList.remove('btn-loading');
            setCleanerButtonContent(scanBtn, 'scan', cleanerT.scan || 'Scan');
        }
        scanBtn.disabled = scanning || cleaning;
        selectAllBtn.disabled = scanning || cleaning;

        renderRows();
    }

    selectAllBtn.addEventListener('click', () => {
        const controls = Array.from(rowControls.values());
        const shouldSelect = controls.some((control) => !control.checkbox.checked && !control.checkbox.disabled);
        controls.forEach((control) => {
            if (!control.checkbox.disabled) control.checkbox.checked = shouldSelect;
        });
        updateTotals();
    });

    scanBtn.addEventListener('click', () => runCleanerScan());

    cleanBtn.addEventListener('click', async () => {
        if (cleaning || scanning) return;
        const selectedIds = Array.from(rowControls.values())
            .filter((control) => control.checkbox.checked && !control.checkbox.disabled)
            .map((control) => control.id);

        if (selectedIds.length === 0) {
            toast(cleanerT.no_selection || 'No cleaner tasks selected.', { type: 'error', title: cleanerT.title || 'Cleaner' });
            return;
        }

        cleaning = true;
        scanBtn.disabled = true;
        selectAllBtn.disabled = true;
        cleanBtn.classList.add('btn-loading');
        setCleanerButtonContent(cleanBtn, 'cleaner', cleanerT.cleaning || 'Cleaning...');

        const bytesBefore = Array.from(taskState.values()).reduce((sum, task) => sum + Number(task.sizeBytes || 0), 0);

        cleanTerm.reset();
        closeOtherTerminals(cleanTerm.terminal);
        cleanTerm.terminal.classList.add('open', 'running');
        cleanTerm.print('> Clean selected items', 'is-cmd');

        const unsubscribe = window.api.onCleanerProgress(({ text }) => {
            cleanTerm.print(text);
        });

        try {
            // With the admin session: silent elevated clean + fresh sizes, no UAC.
            // Declined admin: non-elevated clean of the accessible items only.
            const result = await window.api.runCleanerTasks(selectedIds, { elevated: cleanerState.adminEnabled });
            if (result && result.success) {
                const now = new Date().toISOString();
                localStorage.setItem('cleanerLastCleaned', now);
                lastCleaned.textContent = `${cleanerT.last_cleaned || 'Last cleaned:'} ${formatCleanerDate(now)}`;
                let freedText = '';
                const cleanedIds = new Set(selectedIds);
                const zeroCleaned = (items) => items.map((item) => (
                    cleanedIds.has(item.id) ? { ...item, sizeBytes: 0, inaccessible: false } : item
                ));
                if (Array.isArray(result.items)) {
                    cleanerState.results = zeroCleaned(result.items);
                    cleanerState.scanMode = cleanerT.cleaned_refreshed || 'Cleaned. Sizes refreshed with administrator access.';
                    const bytesAfter = result.items.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
                    const freed = Math.max(0, bytesBefore - bytesAfter);
                    freedText = ` ${cleanerT.freed || 'Freed'} ${formatCleanerBytes(freed)}.`;
                } else if (Array.isArray(cleanerState.results)) {
                    cleanerState.results = zeroCleaned(cleanerState.results);
                }
                cleanTerm.print(`✔ ${cleanerT.clean_done || 'Cleaning completed.'}${freedText}`, 'is-ok');
                toast((cleanerT.clean_done || result.message || 'Cleaner completed.') + freedText, { type: 'success', title: cleanerT.title || 'Cleaner' });
            } else {
                cleanTerm.print(`✖ ${(result && result.error) || cleanerT.clean_failed || 'Cleaner failed.'}`, 'is-err');
                toast((result && result.error) || cleanerT.clean_failed || 'Cleaner failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
            }
        } catch (error) {
            cleanTerm.print(`✖ ${(error && error.message) || cleanerT.clean_failed || 'Cleaner failed.'}`, 'is-err');
            toast((error && error.message) || cleanerT.clean_failed || 'Cleaner failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
        } finally {
            unsubscribe();
            cleanTerm.terminal.classList.remove('running');
            cleaning = false;
            scanBtn.disabled = false;
            selectAllBtn.disabled = false;
            cleanBtn.classList.remove('btn-loading');
            renderFromState();
        }
    });

    // Become the live instance so an in-flight or future scan updates this DOM.
    cleanerActiveRender = renderFromState;

    renderFromState();

    // Only kick off a fresh scan if nothing is cached and none is already running.
    // Preserves results across navigation and avoids redundant re-scans.
    if (!cleanerState.scanning && !Array.isArray(cleanerState.results)) {
        runCleanerScan();
    }

    return container;
}

export async function buildMaintenancePage(translations, _settings) {
    createMaintenanceCard.adminBadgeText = translations.maintenance?.admin_badge || 'Admin';
    createMaintenanceCard.runningText = translations.actions?.running || 'Running...';
    createMaintenanceCard.busyMessage = translations.maintenance?.busy_message || 'Another maintenance task is running.';
    createMaintenanceCard.toastTitle = translations.maintenance?.toast_title || 'Maintenance';

    const T = translations.maintenance || {};
    const initialLayout = await loadMaintenanceLayoutPreference();
    const container = document.createElement('div');
    container.className = 'maintenance-page';
    container.appendChild(createMaintenanceHero(translations, container, initialLayout));

    // Network & Connectivity
    const networkSection = createMaintenanceSection(
        T.network_section || 'Network & Connectivity',
        T.network_section_desc || 'Quick fixes for connection, DNS, Bluetooth, and Windows networking.',
        'network', 4, T.actions_label || 'actions', 'network'
    );
    const networkRow = networkSection.grid;

    const dnsCard = createMaintenanceCard(
        translations.maintenance?.flush_dns || 'Flush DNS Cache',
        translations.maintenance?.flush_dns_desc || 'Clear the DNS resolver cache',
        'dns',
        translations.actions?.flush || 'Flush',
        flushDnsCache, false
    );

    const ipCard = createMaintenanceCard(
        translations.maintenance?.release_renew_ip || 'Release & Renew IP',
        translations.maintenance?.release_renew_ip_desc || 'Release and renew IP address',
        'ip',
        translations.actions?.run || 'Run',
        releaseRenewIp, false
    );

    const btCard = createMaintenanceCard(
        translations.maintenance?.fix_bluetooth || 'Fix Bluetooth',
        translations.maintenance?.fix_bluetooth_desc || 'Restart Bluetooth services and adapter',
        'bluetooth',
        translations.actions?.fix || 'Fix',
        fixBluetooth, true
    );

    const netResetCard = createMaintenanceCard(
        translations.maintenance?.network_reset || 'Network Reset',
        translations.maintenance?.network_reset_desc || 'Reset Winsock, IP stack, and flush DNS',
        'reset',
        translations.actions?.reset || 'Reset',
        networkReset, true
    );
    netResetCard.classList.add('maintenance-action-card--caution');

    networkRow.appendChild(dnsCard);
    networkRow.appendChild(ipCard);
    networkRow.appendChild(btCard);
    networkRow.appendChild(netResetCard);
    container.appendChild(networkSection.section);

    // ── SECTION 3: System Repair & Diagnostics ──
    const repairSection = createMaintenanceSection(
        T.repair_section || 'System Repair & Diagnostics',
        T.repair_section_desc || 'Check Windows integrity, disk health, and essential system services.',
        'repair', 4, T.actions_label || 'actions', 'repair'
    );
    const repairRow = repairSection.grid;

    // SFC/DISM Card (special dual-button card)
    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'maintenance-action-card maintenance-action-card--admin maintenance-action-card--featured';
    sfcDismCard.appendChild(createMaintenanceBadge(T.admin_badge || 'Admin'));

    const sfcDismHeader = document.createElement('div');
    sfcDismHeader.className = 'maintenance-card-header';

    const sfcDismIcon = document.createElement('div');
    sfcDismIcon.className = 'maintenance-card-icon';
    sfcDismIcon.innerHTML = getMaintenanceIcon('repair');
    sfcDismHeader.appendChild(sfcDismIcon);

    const sfcDismText = document.createElement('div');
    sfcDismText.className = 'maintenance-card-copy';
    const sfcDismName = document.createElement('h3');
    sfcDismName.textContent = translations.maintenance?.system_file_repair || 'System File Repair';
    sfcDismName.className = 'maintenance-card-title';
    const sfcDismDesc = document.createElement('p');
    sfcDismDesc.textContent = translations.maintenance?.system_file_desc || 'SFC Scan & DISM Repair system tools (Admin required)';
    sfcDismDesc.className = 'maintenance-card-description';
    sfcDismText.appendChild(sfcDismName);
    sfcDismText.appendChild(sfcDismDesc);
    sfcDismHeader.appendChild(sfcDismText);
    sfcDismCard.appendChild(sfcDismHeader);

    const sfcDismButtons = document.createElement('div');
    sfcDismButtons.classList.add('sfc-dism-buttons');

    const sfcButton = document.createElement('button');
    sfcButton.className = 'button maintenance-card-action';
    sfcButton.textContent = translations.actions?.run_sfc || 'Run SFC';

    const dismButton = document.createElement('button');
    dismButton.className = 'button maintenance-card-action';
    dismButton.textContent = translations.actions?.run_dism || 'Run DISM';

    const repairTerminal = document.createElement('div');
    repairTerminal.className = 'winget-terminal';

    const repairTermHeader = document.createElement('div');
    repairTermHeader.className = 'winget-terminal-header';

    const repairDots = document.createElement('div');
    repairDots.className = 'winget-terminal-dots';
    for (let i = 0; i < 3; i++) repairDots.appendChild(document.createElement('span'));

    const repairTermTitle = document.createElement('span');
    repairTermTitle.className = 'winget-terminal-title';

    const repairStopBtn = document.createElement('button');
    repairStopBtn.type = 'button';
    repairStopBtn.className = 'winget-terminal-stop';
    repairStopBtn.textContent = translations.actions?.stop || 'Stop';

    repairTermHeader.appendChild(repairDots);
    repairTermHeader.appendChild(repairTermTitle);
    repairTermHeader.appendChild(repairStopBtn);

    const repairTermBody = document.createElement('div');
    repairTermBody.className = 'winget-terminal-body';

    repairTerminal.appendChild(repairTermHeader);
    repairTerminal.appendChild(repairTermBody);

    let repairRunning = false;
    let repairCancelled = false;
    let repairLine = null;
    let repairReplace = false;
    const REPAIR_MAX_LINES = 400;

    function repairNewLine(className) {
        repairLine = document.createElement('div');
        repairLine.className = 'winget-terminal-line';
        if (className) repairLine.classList.add(className);
        repairTermBody.appendChild(repairLine);
        while (repairTermBody.childElementCount > REPAIR_MAX_LINES) {
            repairTermBody.removeChild(repairTermBody.firstElementChild);
        }
    }

    function repairAppend(text, className) {
        const clean = stripAnsiSequences(text).replace(/\r\n/g, '\n');
        for (const chunk of clean.split(/(\n|\r)/)) {
            if (chunk === '\n') {
                repairLine = null;
                repairReplace = false;
            } else if (chunk === '\r') {
                repairReplace = true;
            } else if (chunk) {
                if (!repairLine) repairNewLine(className);
                if (repairReplace) {
                    repairLine.textContent = chunk;
                    repairReplace = false;
                } else {
                    repairLine.textContent += chunk;
                }
            }
        }
        repairTermBody.scrollTop = repairTermBody.scrollHeight;
    }

    function repairPrint(text, className) {
        repairLine = null;
        repairNewLine(className);
        repairLine.textContent = text;
        repairLine = null;
        repairTermBody.scrollTop = repairTermBody.scrollHeight;
    }

    async function runRepairTask(button, apiFn, cmdLabel, taskName) {
        if (repairRunning) return;
        if (maintenanceBusy) {
            toast(T.busy_message || 'Another maintenance task is running.', {
                type: 'info', title: T.toast_title || 'Maintenance'
            });
            return;
        }
        repairRunning = true;
        maintenanceBusy = true;
        repairCancelled = false;
        sfcDismCard.classList.add('is-running');

        const originalText = button.textContent;
        sfcButton.disabled = true;
        dismButton.disabled = true;
        button.textContent = translations.general?.run ? (translations.general.run + '...') : 'Running...';

        repairTermTitle.textContent = cmdLabel;
        repairTermBody.innerHTML = '';
        repairLine = null;
        repairReplace = false;
        closeOtherTerminals(repairTerminal);
        repairTerminal.classList.add('open', 'running');
        repairPrint(`> ${cmdLabel}`, 'is-cmd');

        const unsubscribe = window.api.onSystemRepairOutput(({ stream, text }) => {
            repairAppend(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await apiFn();
            if (result && result.success) {
                repairPrint(`✔ ${taskName} completed.`, 'is-ok');
                toast(`${taskName} completed!`, { type: 'success', title: T.toast_title || 'Maintenance' });
            } else if (!result || !result.cancelled) {
                repairPrint(`✖ ${result?.error || `${taskName} exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                toast(result?.error || `${taskName} failed.`, { type: 'error', title: T.toast_title || 'Maintenance' });
            }
        } catch (error) {
            if (!repairCancelled) {
                repairPrint(`✖ ${error.message}`, 'is-err');
                toast(error.message || `${taskName} failed.`, { type: 'error', title: T.toast_title || 'Maintenance' });
            }
        } finally {
            unsubscribe();
            repairRunning = false;
            maintenanceBusy = false;
            sfcDismCard.classList.remove('is-running');
            repairTerminal.classList.remove('running');
            sfcButton.disabled = false;
            dismButton.disabled = false;
            button.textContent = originalText;
        }
    }

    sfcButton.addEventListener('click', () => {
        runRepairTask(sfcButton, () => window.api.runSfcScan(), 'sfc /scannow', translations.actions?.run_sfc || 'SFC scan');
    });

    dismButton.addEventListener('click', () => {
        runRepairTask(dismButton, () => window.api.runDismRepair(), 'DISM /Online /Cleanup-Image /RestoreHealth', translations.actions?.run_dism || 'DISM repair');
    });

    repairStopBtn.addEventListener('click', async () => {
        if (!repairRunning) return;
        repairCancelled = true;
        repairStopBtn.disabled = true;
        try {
            await window.api.cancelSystemRepair();
            repairPrint('■ Task cancelled.', 'is-warn');
        } finally {
            repairStopBtn.disabled = false;
        }
    });

    sfcDismButtons.appendChild(sfcButton);
    sfcDismButtons.appendChild(dismButton);
    sfcDismCard.appendChild(sfcDismButtons);
    sfcDismCard.appendChild(repairTerminal);

    const checkDiskCard = createMaintenanceCard(
        translations.maintenance?.check_disk || 'Check Disk',
        translations.maintenance?.check_disk_desc || 'Scan C: drive for errors (read-only)',
        'disk',
        translations.actions?.check || 'Check',
        checkDisk, true
    );
    checkDiskCard.classList.add('maintenance-action-card--read-only');

    const audioCard = createMaintenanceCard(
        translations.maintenance?.restart_audio || 'Restart Audio System',
        translations.maintenance?.restart_audio_desc || 'Restart Windows Audio services',
        'audio',
        translations.actions?.restart || 'Restart',
        restartAudioSystem, true
    );

    repairRow.appendChild(sfcDismCard);
    repairRow.appendChild(checkDiskCard);
    repairRow.appendChild(audioCard);
    container.appendChild(repairSection.section);

    // ── SECTION 4: Tools ──
    const toolsSection = createMaintenanceSection(
        T.tools_section || 'Application Updates',
        T.tools_section_desc || 'Keep installed applications current through Windows Package Manager.',
        'tools', 1, T.action_label || 'action', 'updates'
    );
    const toolsRow = toolsSection.grid;

    const updaterCard = buildWingetUpdaterCard(translations);

    toolsRow.appendChild(updaterCard);
    container.appendChild(toolsSection.section);

    return container;
}

// ============================================
// DEBLOAT PAGE
// ============================================

export async function buildDebloatPage(translations, _settings) {
    const T = translations.debloat_ui || {};
    const container = document.createElement('div');
    container.className = 'card debloat-page';

    const hero = document.createElement('section');
    hero.className = 'debloat-hero';

    const heroIcon = document.createElement('div');
    heroIcon.className = 'debloat-hero-icon';
    heroIcon.innerHTML = getMaintenanceIcon('sparkle');

    const heroText = document.createElement('div');
    heroText.className = 'debloat-hero-text';

    const heading = document.createElement('h2');
    heading.textContent = (translations.debloat && translations.debloat.heading) || 'Windows Debloat';

    const description = document.createElement('p');
    description.textContent = (translations.pages && translations.pages.debloat_raphi_desc) ||
        'Launch Sparkle debloat utility to remove bloatware and optimize your Windows system. ' +
        'The utility will be downloaded if not already available.';

    const status = document.createElement('p');
    status.className = 'debloat-status';
    status.textContent = T.checking || 'Checking Sparkle...';

    const progress = document.createElement('div');
    progress.className = 'debloat-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'debloat-progress-fill';
    progress.appendChild(progressFill);

    heroText.appendChild(heading);
    heroText.appendChild(description);
    heroText.appendChild(status);
    heroText.appendChild(progress);

    const heroActions = document.createElement('div');
    heroActions.className = 'debloat-hero-actions';

    hero.appendChild(heroIcon);
    hero.appendChild(heroText);
    hero.appendChild(heroActions);
    container.appendChild(hero);

    const setStatus = (text) => { status.textContent = text; };
    const setProgress = (percent) => {
        if (percent === null) {
            progress.classList.remove('active');
            progressFill.style.width = '0%';
        } else {
            progress.classList.add('active');
            progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }
    };

    const refreshStatus = async () => {
        try {
            const res = await window.api.sparkleStatus?.();
            if (res && res.available) {
                setStatus(T.ready || 'Sparkle is installed and ready to launch.');
            } else {
                setStatus(T.will_download || 'Sparkle will be downloaded from GitHub on first launch — portable, no installation.');
            }
        } catch {
            setStatus('');
        }
    };

    const isWindows = await window.api.isWindows();
    if (!isWindows) {
        setStatus(T.windows_only || 'Sparkle Debloat is only supported on Windows.');
        status.classList.add('is-warning');
        return container;
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'button debloat-run-btn';
    runBtn.textContent = T.launch_btn ||
        (translations.debloat && translations.debloat.buttons && translations.debloat.buttons.runRaphiScript) ||
        'Launch Sparkle Debloat';
    heroActions.appendChild(runBtn);

    const grid = document.createElement('div');
    grid.className = 'debloat-grid';
    const featureIcons = ['recycle', 'shield', 'prefetch', 'updateCache'];
    const featureTexts = (Array.isArray(T.features) && T.features.length === 4) ? T.features : [
        { title: 'Remove bloatware', text: 'Uninstalls preinstalled apps and OEM junk you never asked for.' },
        { title: 'Privacy & telemetry', text: 'Disables tracking, telemetry and advertising services.' },
        { title: 'Performance tweaks', text: 'Trims background services and startup load for a snappier PC.' },
        { title: 'Portable from GitHub', text: 'Fetched from the official Sparkle releases on first launch — nothing to install.' }
    ];
    const DEBLOAT_FEATURES = featureTexts.map((feature, index) => ({ ...feature, icon: featureIcons[index] }));
    DEBLOAT_FEATURES.forEach((feature) => {
        const row = document.createElement('article');
        row.className = 'debloat-feature';

        const icon = document.createElement('div');
        icon.className = 'debloat-feature-icon';
        icon.innerHTML = getMaintenanceIcon(feature.icon);

        const content = document.createElement('div');
        content.className = 'debloat-feature-content';
        const featureTitle = document.createElement('h3');
        featureTitle.textContent = feature.title;
        const featureText = document.createElement('p');
        featureText.textContent = feature.text;
        content.appendChild(featureTitle);
        content.appendChild(featureText);

        row.appendChild(icon);
        row.appendChild(content);
        grid.appendChild(row);
    });
    container.appendChild(grid);

    refreshStatus();

    runBtn.addEventListener('click', async () => {
        if (runBtn.disabled) return;

        const original = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.textContent = T.checking || 'Checking Sparkle...';
        setStatus(T.checking || 'Checking Sparkle...');

        try {
            const result = await window.api.runSparkleDebloat();
            
            if (!result) {
                throw new Error('No response from Sparkle handler');
            }

            // Case 1: Sparkle needs to be downloaded
            if (result.needsDownload) {
                runBtn.textContent = T.downloading || 'Downloading Sparkle from GitHub...';
                setStatus(T.downloading || 'Downloading Sparkle from GitHub...');
                setProgress(0);

                const downloadId = result.downloadId || `sparkle-${Date.now()}`;
                const downloadDest = result.downloadDest;

                const sparkleStoreKey = 'sparkle-debloat';
                registerDownload(sparkleStoreKey, downloadId, { name: 'Sparkle' });

                attachDownloadUI(sparkleStoreKey, (data) => {
                    switch (data.status) {
                        case 'progress':
                            runBtn.textContent = `${data.percent}%`;
                            setStatus(`${T.downloading || 'Downloading Sparkle from GitHub...'} ${data.percent}%`);
                            setProgress(data.percent);
                            break;
                        case 'complete': {
                            runBtn.textContent = T.extracting || 'Extracting Sparkle...';
                            setStatus(T.extracting || 'Extracting Sparkle...');
                            setProgress(null);
                            downloadStore.delete(sparkleStoreKey);

                            const extractWatchdog = setTimeout(() => {
                                runBtn.disabled = false;
                                runBtn.textContent = original;
                                refreshStatus();
                                toast('Sparkle is taking too long to extract/launch. Please try again.', {
                                    type: 'error',
                                    title: 'Debloat Error',
                                    duration: 8000
                                });
                            }, 120000);

                            // Extract the downloaded zip
                            window.api.processDownloadedSparkle(downloadDest)
                                .then(extractResult => {
                                    if (extractResult && extractResult.success) {
                                        runBtn.textContent = T.launching || 'Launching Sparkle...';
                                        setStatus(T.launching || 'Launching Sparkle...');
                                        // Now run it
                                        return window.api.runSparkleDebloat();
                                    } else {
                                        throw new Error(extractResult?.error || 'Extraction failed');
                                    }
                                })
                                .then(launchResult => {
                                    if (launchResult && launchResult.success && !launchResult.needsDownload) {
                                        toast('Sparkle Debloat launched successfully!', {
                                            type: 'success',
                                            title: 'Debloat',
                                            duration: 5000
                                        });
                                        runBtn.textContent = '✅ Launched!';
                                        runBtn.disabled = true;
                                        refreshStatus();
                                        setTimeout(() => {
                                            runBtn.textContent = original;
                                            runBtn.disabled = false;
                                        }, 2000);
                                    } else {
                                        throw new Error(launchResult?.error || 'Launch failed');
                                    }
                                })
                                .catch(err => {
                                    toast(err.message || 'Failed to extract or launch Sparkle', {
                                        type: 'error',
                                        title: 'Debloat Error',
                                        duration: 8000
                                    });
                                    runBtn.disabled = false;
                                    runBtn.textContent = original;
                                    refreshStatus();
                                })
                                .finally(() => clearTimeout(extractWatchdog));
                            break;
                        }
                        case 'error':
                            toast(data.error || 'Download failed', {
                                type: 'error',
                                title: 'Debloat Error',
                                duration: 8000
                            });
                            runBtn.disabled = false;
                            runBtn.textContent = original;
                            setProgress(null);
                            refreshStatus();
                            downloadStore.delete(sparkleStoreKey);
                            break;
                    }
                });

                // Start the download
                window.api.downloadStart(downloadId, result.downloadUrl, downloadDest);
                return;
            }

            // Case 2: Sparkle is already available and launched
            if (result.success) {
                toast(result.message || 'Sparkle Debloat launched successfully!', {
                    type: 'success',
                    title: 'Debloat',
                    duration: 5000
                });
                runBtn.textContent = '✅ Launched!';
                refreshStatus();
                setTimeout(() => {
                    runBtn.textContent = original;
                    runBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(result.error || 'Failed to launch Sparkle Debloat');
            }
        } catch (err) {
            toast(err.message || 'Failed to launch Sparkle Debloat', {
                type: 'error',
                title: 'Debloat Error',
                duration: 8000
            });
            runBtn.disabled = false;
            runBtn.textContent = original;
            setProgress(null);
            refreshStatus();
        }
    });

    return container;
}

// ============================================
// BIOS RESTART DIALOG
// ============================================

export function showRestartDialog(translations, menuKeys, loadPage) {
    const overlay = document.createElement('div');
    overlay.className = 'bios-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bios-dialog';

    const title = document.createElement('h2');
    title.className = 'bios-title';
    title.textContent = translations.menu?.bios || 'BIOS Settings';
    dialog.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'bios-description';
    desc.textContent = translations.messages?.bios_instructions || 'This action will restart your computer and boot into BIOS/UEFI settings. Make sure to save all your work before proceeding.';
    dialog.appendChild(desc);

    const whatTitle = document.createElement('h3');
    whatTitle.className = 'bios-section-title';
    whatTitle.textContent = (translations.messages && translations.messages.bios_what_happens) || 'What will happen:';
    dialog.appendChild(whatTitle);

    const steps = document.createElement('ol');
    steps.className = 'bios-steps';
    const defaultSteps = [
        'Save all your work and close applications',
        'System will restart automatically',
        'BIOS/UEFI setup will open on boot',
        'Configure your settings as needed'
    ];
    const steps_i18n = (translations.messages && translations.messages.bios_steps) || defaultSteps;
    (Array.isArray(steps_i18n) ? steps_i18n : defaultSteps).forEach((stepText) => {
        const li = document.createElement('li');
        li.textContent = stepText;
        steps.appendChild(li);
    });
    dialog.appendChild(steps);

    const warning = document.createElement('div');
    warning.className = 'bios-warning';
    const warningStrong = document.createElement('strong');
    warningStrong.textContent = translations.messages?.bios_important_notice || 'Important Notice';
    warning.appendChild(warningStrong);
    warning.appendChild(document.createElement('br'));
    warning.appendChild(document.createTextNode(
        translations.messages?.admin_warning || 'This operation requires administrator privileges and will restart your computer immediately.'
    ));
    dialog.appendChild(warning);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bios-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bios-cancel-btn';
    cancelBtn.textContent = translations.general?.cancel || 'Cancel';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'bios-restart-btn';
    restartBtn.textContent = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');

    // Escape key handler — cleaned up when dialog closes via cancel or success
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };

    cancelBtn.addEventListener('click', () => {
        document.removeEventListener('keydown', escapeHandler);
        dialog.classList.add('slide-down');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            const fallbackKey = (Array.isArray(menuKeys) && menuKeys.length > 0) ? menuKeys[0] : 'install_apps';
            loadPage(fallbackKey);
        }, 300);
    });

    restartBtn.addEventListener('click', async () => {
        restartBtn.disabled = true;
        restartBtn.textContent = '⏳ Processing...';
        restartBtn.classList.add('btn-opacity-low');

        try {
            const result = await window.api.restartToBios();

            if (result && result.success) {
                restartBtn.classList.remove('btn-opacity-low');
                restartBtn.textContent = '✅ Success!';
                restartBtn.classList.add('btn-success-gradient');

                toast('BIOS restart initiated! Computer will restart shortly.', { type: 'success', duration: 5000 });

                document.removeEventListener('keydown', escapeHandler);
                setTimeout(() => {
                    dialog.classList.add('slide-down');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            document.body.removeChild(overlay);
                        }
                    }, 300);
                }, 2000);
            } else {
                throw new Error((result && result.error) || 'Failed to restart to BIOS');
            }
        } catch (error) {
            restartBtn.classList.remove('btn-opacity-low');
            restartBtn.textContent = '❌ Failed';
            restartBtn.classList.add('btn-error-gradient');

            setTimeout(() => {
                restartBtn.disabled = false;
                restartBtn.textContent = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');
                restartBtn.classList.remove('btn-error-gradient');
            }, 2000);

            if (error.message && error.message.includes('Administrator')) {
                toast('🔒 Administrator Privileges Required\n\nPlease run the application as Administrator to access BIOS settings.', { type: 'error' });
            } else {
                toast('❌ ' + error.message, { type: 'error' });
            }
        }
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(restartBtn);
    dialog.appendChild(buttonContainer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    document.addEventListener('keydown', escapeHandler);
    cancelBtn.focus();
}
