/**
 * Tools Page
 * Contains System Maintenance, Debloat, and BIOS pages
 * CSS classes match original renderer.js structure
 */

import { autoFadeStatus } from '../utils.js';
import { registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast } from '../components.js';

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
    tools: maintenanceCustomIcon('0 0 24 24', '<path d="M4 12A8 8 0 0 1 18.93 8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><path d="M20 12A8 8 0 0 1 5.07 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><polyline points="14 8 19 8 19 3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><polyline points="10 16 5 16 5 21" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>')
};

function getMaintenanceIcon(iconKey) {
    return MAINTENANCE_ICONS[iconKey] || MAINTENANCE_ICONS.tools;
}

/**
 * Creates a maintenance card with exact original CSS structure
 * @param {string} name - Card title
 * @param {string} description - Card description
 * @param {string} iconKey - Icon identifier
 * @param {string} buttonText - Button label
 * @param {Function} taskFunction - Function to execute
 * @param {boolean} requiresAdmin - Show admin warning
 * @param {boolean} hideStatus - Hide status element
 */
function createMaintenanceCard(name, description, iconKey, buttonText, taskFunction, requiresAdmin = false, hideStatus = false) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.classList.add('feature-card');

    const header = document.createElement('div');
    header.className = 'app-header';

    const iconEl = document.createElement('div');
    iconEl.classList.add('feature-card-icon');
    iconEl.innerHTML = getMaintenanceIcon(iconKey);
    header.appendChild(iconEl);

    const text = document.createElement('div');
    const nameEl = document.createElement('h3');
    nameEl.textContent = name;
    nameEl.classList.add('feature-card-name');
    const descEl = document.createElement('p');
    descEl.textContent = description;
    descEl.classList.add('feature-card-desc');

    if (requiresAdmin) {
        const adminWarning = document.createElement('small');
        adminWarning.textContent = ` (${createMaintenanceCard.adminRequiredText || 'Admin required'})`;
        adminWarning.classList.add('admin-warning');
        descEl.appendChild(adminWarning);
    }

    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);

    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = buttonText;
    button.dataset.loadingText = createMaintenanceCard.runningText || 'Running...';
    button.classList.add('btn-full-width');

    const status = document.createElement('pre');
    status.className = 'status-pre';
    status.classList.remove('visible');

    if (hideStatus) {
        status.dataset.hideStatus = 'true';
    }

    button.addEventListener('click', async () => {
        await runMaintenanceTask(button, status, taskFunction, name, requiresAdmin);
    });

    card.appendChild(header);
    card.appendChild(button);
    card.appendChild(status);

    return card;
}

/**
 * Runs a maintenance task with proper button/status handling
 */
async function runMaintenanceTask(button, statusElement, taskFunction, taskName, requiresAdmin = false) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = button.dataset.loadingText || 'Running...';
    const hideStatus = statusElement && statusElement.dataset && statusElement.dataset.hideStatus === 'true';

    if (!hideStatus) {
        statusElement.classList.add('visible');
        if (requiresAdmin) {
            statusElement.textContent = `Running ${taskName}...\n⚠️ This task may require Administrator privileges\n`;
        } else {
            statusElement.textContent = `Running ${taskName}...\n`;
        }
        statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    }

    try {
        await taskFunction(statusElement, button);
    } catch (error) {
        if (!hideStatus) {
            statusElement.textContent += `\n❌ Error: ${error.message}`;
            statusElement.classList.add('status-error');
        }
        toast(`Error running ${taskName}`, { type: 'error', title: 'Maintenance' });
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        if (!hideStatus) {
            autoFadeStatus(statusElement, 8000);
        }
    }
}

// ============================================
// MAINTENANCE TASK FUNCTIONS
// ============================================

function createSimpleTask(apiFn, successMsg, errorMsg) {
    return async function (_statusElement) {
        try {
            const result = await apiFn();
            if (result && result.success) {
                toast(result.message || successMsg, { type: 'success', title: 'Maintenance' });
            } else {
                toast((result && result.error) || errorMsg, { type: 'error', title: 'Maintenance' });
            }
        } catch (error) {
            toast((error && error.message) || errorMsg, { type: 'error', title: 'Maintenance' });
        }
    };
}

const runSfcScan = createSimpleTask(() => window.api.runSfcScan(), 'SFC scan completed!', 'SFC scan failed.');
const runDismRepair = createSimpleTask(() => window.api.runDismRepair(), 'DISM repair completed!', 'DISM repair failed.');
const flushDnsCache = createSimpleTask(() => window.api.flushDnsCache(), 'DNS cache flushed!', 'Failed to flush DNS cache.');
const releaseRenewIp = createSimpleTask(() => window.api.releaseRenewIp(), 'IP released & renewed!', 'Failed to release/renew IP.');
const fixBluetooth = createSimpleTask(() => window.api.fixBluetooth(), 'Bluetooth fixed!', 'Failed to fix Bluetooth.');
const checkDisk = createSimpleTask(() => window.api.checkDisk(), 'Disk check completed!', 'Failed to check disk.');
const networkReset = createSimpleTask(() => window.api.networkReset(), 'Network reset completed!', 'Failed to reset network.');
const restartAudioSystem = createSimpleTask(() => window.api.restartAudioSystem(), 'Audio system restarted!', 'Failed to restart audio.');

function stripAnsiSequences(text) {
    return String(text)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x08/g, '');
}

function buildWingetUpdaterCard(translations) {
    const card = document.createElement('div');
    card.className = 'app-card feature-card patch-card-full';

    const header = document.createElement('div');
    header.className = 'app-header';

    const iconEl = document.createElement('div');
    iconEl.classList.add('feature-card-icon');
    iconEl.innerHTML = getMaintenanceIcon('tools');
    header.appendChild(iconEl);

    const text = document.createElement('div');
    const nameEl = document.createElement('h3');
    nameEl.textContent = translations.maintenance?.update_all_apps || 'Update All Apps';
    nameEl.classList.add('feature-card-name');
    const descEl = document.createElement('p');
    descEl.textContent = translations.maintenance?.update_all_apps_desc || 'Upgrade every installed app in place with winget';
    descEl.classList.add('feature-card-desc');
    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);
    card.appendChild(header);

    const runBtn = document.createElement('button');
    runBtn.className = 'button btn-standard-height';
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
        running = true;
        cancelled = false;

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
        terminal.classList.add('open', 'running');
        printLine('> winget upgrade --all', 'is-cmd');

        const unsubscribe = window.api.onWingetUpgradeOutput(({ stream, text }) => {
            appendOutput(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await window.api.wingetUpgradeAll();
            if (result && result.success) {
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

/**
 * Creates a section title element
 */
function createSectionTitle(text, iconKey) {
    const title = document.createElement('h3');
    title.classList.add('maintenance-section-title');
    const icon = document.createElement('span');
    icon.className = 'maintenance-section-icon';
    icon.innerHTML = getMaintenanceIcon(iconKey);
    const label = document.createElement('span');
    label.textContent = text;
    title.appendChild(icon);
    title.appendChild(label);
    return title;
}

const CLEANER_TASKS = [
    { id: 'temp', title: 'Clean Temporary Files', description: 'Remove system and user temporary files.', detail: 'Windows + user temp folders', icon: 'tempFile' },
    { id: 'prefetch', title: 'Clean Prefetch Files', description: 'Delete files from the Windows Prefetch folder.', detail: 'C:\\Windows\\Prefetch', icon: 'prefetch' },
    { id: 'recycle_bin', title: 'Empty Recycle Bin', description: 'Permanently remove files from the Recycle Bin.', detail: 'Recycle Bin', icon: 'recycle' },
    { id: 'windows_update', title: 'Clean Windows Update Cache', description: 'Remove Windows Update downloaded installation files.', detail: 'C:\\Windows\\SoftwareDistribution\\Download', icon: 'updateCache' },
    { id: 'thumbnail_cache', title: 'Clear Thumbnail Cache', description: 'Remove cached thumbnail images used by File Explorer.', detail: 'Explorer thumbnail and icon cache', icon: 'imageCache' },
    { id: 'error_reports', title: 'Clear Error Reports', description: 'Remove error report and crash dump files.', detail: 'CrashDumps + Windows Error Reporting', icon: 'crashReport' }
];

function formatCleanerBytes(bytes) {
    const value = Number(bytes || 0);
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / Math.pow(1024, index);
    return `${amount.toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatCleanerDate(value) {
    if (!value) return 'Not cleaned yet.';
    try {
        return new Date(value).toLocaleString();
    } catch {
        return 'Not cleaned yet.';
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
    results: null,      // normalized items from the last completed scan, or null
    scanMode: '',       // current status text
    scanning: false,    // is a scan currently in flight
    scanPromise: null,  // the in-flight scan promise (dedupe handle)
};

// The render fn of the currently-mounted cleaner page (only one exists at a time).
let cleanerActiveRender = null;

function notifyCleaner() {
    if (cleanerActiveRender) {
        try { cleanerActiveRender(); } catch { }
    }
}

// Runs a non-elevated (limited) scan — no UAC. Protected folders come back as
// `inaccessible` and are shown as "Admin needed"; their real sizes appear after
// a Clean, which elevates once and returns fresh sizes for everything.
function runCleanerScan() {
    if (cleanerState.scanPromise) return cleanerState.scanPromise;

    cleanerState.scanning = true;
    cleanerState.scanMode = 'Scanning...';

    const promise = (async () => {
        try {
            const result = await window.api.scanCleanerTasks({ elevated: false });

            if (!result || !result.success) {
                toast((result && result.error) || 'Cleaner scan failed.', { type: 'error', title: 'Cleaner' });
                return;
            }

            cleanerState.results = result.items || [];
            cleanerState.scanMode = 'Scan completed. Protected items need admin — cleaned when you press Clean.';
        } catch (error) {
            toast((error && error.message) || 'Cleaner scan failed.', { type: 'error', title: 'Cleaner' });
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

export async function buildCleanerPage() {
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
    title.textContent = 'System Cleaner';

    const lastCleaned = document.createElement('p');
    lastCleaned.className = 'cleaner-last-cleaned';
    lastCleaned.textContent = `Last cleaned: ${formatCleanerDate(localStorage.getItem('cleanerLastCleaned'))}`;

    const totalLine = document.createElement('p');
    totalLine.className = 'cleaner-total-line';
    totalLine.textContent = 'Total size ';
    const totalValue = document.createElement('span');
    totalValue.textContent = 'Scanning...';
    totalLine.appendChild(totalValue);

    const scanMode = document.createElement('p');
    scanMode.className = 'cleaner-scan-mode';
    scanMode.textContent = 'Scanning...';

    summaryText.appendChild(title);
    summaryText.appendChild(lastCleaned);
    summaryText.appendChild(totalLine);
    summaryText.appendChild(scanMode);

    const summaryActions = document.createElement('div');
    summaryActions.className = 'cleaner-summary-actions';

    const scanBtn = document.createElement('button');
    scanBtn.type = 'button';
    scanBtn.className = 'button-secondary cleaner-scan-btn';
    setCleanerButtonContent(scanBtn, 'scan', 'Scan');

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'button-secondary cleaner-select-btn';
    setCleanerButtonContent(selectAllBtn, 'selectAll', 'Select All');

    const cleanBtn = document.createElement('button');
    cleanBtn.type = 'button';
    cleanBtn.className = 'button cleaner-clean-btn';
    setCleanerButtonContent(cleanBtn, 'cleaner', 'Clean Selected');
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

    function updateTotals() {
        const totalBytes = Array.from(taskState.values()).reduce((sum, task) => sum + Number(task.sizeBytes || 0), 0);
        const selectedBytes = Array.from(rowControls.values()).reduce((sum, control) => {
            if (!control.checkbox.checked) return sum;
            const task = taskState.get(control.id);
            return sum + Number(task?.sizeBytes || 0);
        }, 0);
        const checkedCount = Array.from(rowControls.values()).filter((control) => control.checkbox.checked).length;

        totalValue.textContent = scanning ? 'Scanning...' : formatCleanerBytes(totalBytes);
        totalValue.classList.toggle('is-scanning', scanning);
        cleanBtn.disabled = scanning || cleaning || checkedCount === 0;
        setCleanerButtonContent(cleanBtn, 'cleaner', selectedBytes > 0 ? `Clean Selected (${formatCleanerBytes(selectedBytes)})` : 'Clean Selected');
        setCleanerButtonContent(selectAllBtn, 'selectAll', checkedCount === rowControls.size && checkedCount > 0 ? 'Unselect All' : 'Select All');
    }

    function renderRows() {
        list.innerHTML = '';
        rowControls.clear();

        CLEANER_TASKS.forEach((task) => {
            const data = taskState.get(task.id) || task;
            // "Admin needed" items stay selectable — Clean elevates once and handles
            // them. Only lock truly-empty accessible folders (nothing to remove).
            const accessibleEmpty = !data.inaccessible && Number(data.sizeBytes || 0) <= 0;
            const isLocked = scanning || cleaning || accessibleEmpty;

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
            rowTitle.textContent = task.title;

            const desc = document.createElement('p');
            desc.textContent = task.description;

            const meta = document.createElement('div');
            meta.className = 'cleaner-row-meta';

            const size = document.createElement('span');
            size.className = 'cleaner-size';
            if (scanning) {
                size.textContent = 'Scanning...';
                size.classList.add('is-scanning');
            } else if (data.inaccessible) {
                size.textContent = 'Admin needed';
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
            // Default-check anything with content, plus protected items (unknown size).
            checkbox.checked = data.inaccessible || Number(data.sizeBytes || 0) > 0;
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
    function renderFromState() {
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
            setCleanerButtonContent(scanBtn, 'scan', 'Scanning...');
        } else {
            scanBtn.classList.remove('btn-loading');
            setCleanerButtonContent(scanBtn, 'scan', 'Scan');
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
            toast('No cleaner tasks selected.', { type: 'error', title: 'Cleaner' });
            return;
        }

        cleaning = true;
        scanBtn.disabled = true;
        selectAllBtn.disabled = true;
        cleanBtn.classList.add('btn-loading');
        setCleanerButtonContent(cleanBtn, 'cleaner', 'Cleaning...');

        try {
            // Single elevated call: deletes AND returns a fresh (elevated) scan,
            // so there is exactly one UAC prompt for the whole clean flow.
            const result = await window.api.runCleanerTasks(selectedIds);
            if (result && result.success) {
                const now = new Date().toISOString();
                localStorage.setItem('cleanerLastCleaned', now);
                lastCleaned.textContent = `Last cleaned: ${formatCleanerDate(now)}`;
                if (Array.isArray(result.items)) {
                    cleanerState.results = result.items;
                    cleanerState.scanMode = 'Cleaned. Sizes refreshed with administrator access.';
                }
                toast(result.message || 'Cleaner completed.', { type: 'success', title: 'Cleaner' });
            } else {
                toast((result && result.error) || 'Cleaner failed.', { type: 'error', title: 'Cleaner' });
            }
        } catch (error) {
            toast((error && error.message) || 'Cleaner failed.', { type: 'error', title: 'Cleaner' });
        } finally {
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
    createMaintenanceCard.adminRequiredText = translations.messages?.admin_required || 'Admin required';
    createMaintenanceCard.runningText = translations.actions?.running || 'Running...';

    const container = document.createElement('div');
    container.className = 'card';

    const title = document.createElement('h2');
    title.textContent = translations.pages?.maintenance_title || 'System Maintenance';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = translations.pages?.maintenance_desc || 'Perform various system maintenance tasks to keep your computer running smoothly.';
    desc.classList.add('desc-margin-large');
    container.appendChild(desc);

    // Network & Connectivity
    container.appendChild(createSectionTitle(translations.maintenance?.network_section || 'Network & Connectivity', 'network'));

    const networkRow = document.createElement('div');
    networkRow.className = 'maintenance-row';
    networkRow.classList.add('grid-2-col-margin');

    const dnsCard = createMaintenanceCard(
        translations.maintenance?.flush_dns || 'Flush DNS Cache',
        translations.maintenance?.flush_dns_desc || 'Clear the DNS resolver cache',
        'dns',
        translations.actions?.flush || 'Flush',
        flushDnsCache, false, true
    );
    dnsCard.querySelector('button').classList.add('btn-standard-height');

    const ipCard = createMaintenanceCard(
        translations.maintenance?.release_renew_ip || 'Release & Renew IP',
        translations.maintenance?.release_renew_ip_desc || 'Release and renew IP address',
        'ip',
        translations.actions?.run || 'Run',
        releaseRenewIp, false, true
    );
    ipCard.querySelector('button').classList.add('btn-standard-height');

    const btCard = createMaintenanceCard(
        translations.maintenance?.fix_bluetooth || 'Fix Bluetooth',
        translations.maintenance?.fix_bluetooth_desc || 'Restart Bluetooth services and adapter',
        'bluetooth',
        translations.actions?.fix || 'Fix',
        fixBluetooth, true, true
    );
    btCard.querySelector('button').classList.add('btn-standard-height');

    const netResetCard = createMaintenanceCard(
        translations.maintenance?.network_reset || 'Network Reset',
        translations.maintenance?.network_reset_desc || 'Reset Winsock, IP stack, and flush DNS',
        'reset',
        translations.actions?.reset || 'Reset',
        networkReset, true, true
    );
    netResetCard.querySelector('button').classList.add('btn-standard-height');

    networkRow.appendChild(dnsCard);
    networkRow.appendChild(ipCard);
    networkRow.appendChild(btCard);
    networkRow.appendChild(netResetCard);
    container.appendChild(networkRow);

    // ── SECTION 3: System Repair & Diagnostics ──
    container.appendChild(createSectionTitle(translations.maintenance?.repair_section || 'System Repair & Diagnostics', 'repair'));

    const repairRow = document.createElement('div');
    repairRow.className = 'maintenance-row';
    repairRow.classList.add('grid-2-col-margin');

    // SFC/DISM Card (special dual-button card)
    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'app-card';
    sfcDismCard.classList.add('feature-card');

    const sfcDismHeader = document.createElement('div');
    sfcDismHeader.className = 'app-header';

    const sfcDismIcon = document.createElement('div');
    sfcDismIcon.classList.add('feature-card-icon');
    sfcDismIcon.innerHTML = getMaintenanceIcon('repair');
    sfcDismHeader.appendChild(sfcDismIcon);

    const sfcDismText = document.createElement('div');
    const sfcDismName = document.createElement('h3');
    sfcDismName.textContent = translations.maintenance?.system_file_repair || 'System File Repair';
    sfcDismName.classList.add('feature-card-name');
    const sfcDismDesc = document.createElement('p');
    sfcDismDesc.textContent = translations.maintenance?.system_file_desc || 'SFC Scan & DISM Repair system tools (Admin required)';
    sfcDismDesc.classList.add('feature-card-desc-warning');
    sfcDismText.appendChild(sfcDismName);
    sfcDismText.appendChild(sfcDismDesc);
    sfcDismHeader.appendChild(sfcDismText);
    sfcDismCard.appendChild(sfcDismHeader);

    const sfcDismButtons = document.createElement('div');
    sfcDismButtons.classList.add('sfc-dism-buttons');

    const sfcButton = document.createElement('button');
    sfcButton.className = 'button';
    sfcButton.textContent = translations.actions?.run_sfc || 'Run SFC';
    sfcButton.classList.add('btn-half');

    const dismButton = document.createElement('button');
    dismButton.className = 'button';
    dismButton.textContent = translations.actions?.run_dism || 'Run DISM';
    dismButton.classList.add('btn-half');

    const sfcDismStatus = document.createElement('pre');
    sfcDismStatus.className = 'status-pre';
    sfcDismStatus.classList.add('sfc-dism-status');
    sfcDismStatus.dataset.hideStatus = 'true';

    sfcButton.addEventListener('click', async () => {
        await runMaintenanceTask(sfcButton, sfcDismStatus, runSfcScan, translations.actions?.run_sfc || 'SFC', true);
    });

    dismButton.addEventListener('click', async () => {
        await runMaintenanceTask(dismButton, sfcDismStatus, runDismRepair, translations.actions?.run_dism || 'DISM', true);
    });

    sfcDismButtons.appendChild(sfcButton);
    sfcDismButtons.appendChild(dismButton);
    sfcDismCard.appendChild(sfcDismButtons);
    sfcDismCard.appendChild(sfcDismStatus);

    const checkDiskCard = createMaintenanceCard(
        translations.maintenance?.check_disk || 'Check Disk',
        translations.maintenance?.check_disk_desc || 'Scan C: drive for errors (read-only)',
        'disk',
        translations.actions?.check || 'Check',
        checkDisk, true, true
    );
    checkDiskCard.querySelector('button').classList.add('btn-standard-height');

    const audioCard = createMaintenanceCard(
        translations.maintenance?.restart_audio || 'Restart Audio System',
        translations.maintenance?.restart_audio_desc || 'Restart Windows Audio services',
        'audio',
        translations.actions?.restart || 'Restart',
        restartAudioSystem, true, true
    );
    audioCard.querySelector('button').classList.add('btn-standard-height');

    repairRow.appendChild(sfcDismCard);
    repairRow.appendChild(checkDiskCard);
    repairRow.appendChild(audioCard);
    container.appendChild(repairRow);

    // ── SECTION 4: Tools ──
    container.appendChild(createSectionTitle(translations.maintenance?.tools_section || 'Tools', 'tools'));

    const toolsRow = document.createElement('div');

    const updaterCard = buildWingetUpdaterCard(translations);

    toolsRow.appendChild(updaterCard);
    container.appendChild(toolsRow);

    return container;
}

// ============================================
// DEBLOAT PAGE
// ============================================

export async function buildDebloatPage(translations, _settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const heading = document.createElement('h2');
    heading.textContent = (translations.debloat && translations.debloat.heading) || 'Windows Debloat';
    heading.classList.add('script-heading');
    container.appendChild(heading);

    const description = document.createElement('p');
    description.classList.add('script-description');
    description.textContent = (translations.pages && translations.pages.debloat_raphi_desc) ||
        'Launch Sparkle debloat utility to remove bloatware and optimize your Windows system. ' +
        'The utility will be downloaded if not already available.';
    container.appendChild(description);

    const isWindows = await window.api.isWindows();
    if (!isWindows) {
        const warn = document.createElement('p');
        warn.textContent = 'Sparkle Debloat is only supported on Windows.';
        warn.classList.add('script-warning');
        container.appendChild(warn);
        return container;
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'button';
    runBtn.textContent = (translations.debloat && translations.debloat.buttons && translations.debloat.buttons.runRaphiScript) ||
        'Launch Sparkle Debloat';
    runBtn.classList.add('btn-run');

    runBtn.addEventListener('click', async () => {
        if (runBtn.disabled) return;
        
        const original = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.textContent = 'Checking Sparkle...';

        try {
            const result = await window.api.runSparkleDebloat();
            
            if (!result) {
                throw new Error('No response from Sparkle handler');
            }

            // Case 1: Sparkle needs to be downloaded
            if (result.needsDownload) {
                runBtn.textContent = 'Downloading Sparkle...';
                
                const downloadId = result.downloadId || `sparkle-${Date.now()}`;
                const downloadDest = result.downloadDest;

                const sparkleStoreKey = 'sparkle-debloat';
                registerDownload(sparkleStoreKey, downloadId, { name: 'Sparkle' });

                attachDownloadUI(sparkleStoreKey, (data) => {
                    switch (data.status) {
                        case 'progress':
                            runBtn.textContent = `Downloading Sparkle... ${data.percent}%`;
                            break;
                        case 'complete':
                            runBtn.textContent = 'Extracting Sparkle...';
                            downloadStore.delete(sparkleStoreKey);

                            // Extract the downloaded zip
                            window.api.processDownloadedSparkle(downloadDest)
                                .then(extractResult => {
                                    if (extractResult && extractResult.success) {
                                        runBtn.textContent = 'Launching Sparkle...';
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
                                });
                            break;
                        case 'error':
                            toast(data.error || 'Download failed', {
                                type: 'error',
                                title: 'Debloat Error',
                                duration: 8000
                            });
                            runBtn.disabled = false;
                            runBtn.textContent = original;
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
        }
    });

    container.appendChild(runBtn);
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
