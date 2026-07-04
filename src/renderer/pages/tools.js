/**
 * Tools Page
 * Contains System Maintenance, Debloat, and BIOS pages
 * CSS classes match original renderer.js structure
 */

import { autoFadeStatus } from '../utils.js';
import { buttonStateManager, registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// MAINTENANCE HELPER FUNCTIONS
// ============================================

const maintenanceIcon = (body) => `
    <svg class="maintenance-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
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
    disk: maintenanceIcon('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'),
    network: maintenanceIcon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>'),
    dns: maintenanceIcon('<path d="M4 7h10"/><path d="M4 12h16"/><path d="M10 17h10"/><path d="M16 5l2 2-2 2"/><path d="M8 15l-2 2 2 2"/>'),
    ip: maintenanceIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 14h8"/>'),
    bluetooth: maintenanceIcon('<path d="M7 7l10 10-5 4V3l5 4L7 17"/>'),
    reset: maintenanceIcon('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v6h-6"/><path d="M12 8v4l3 2"/>'),
    repair: maintenanceIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.8-2.8a5.5 5.5 0 0 1-7.1 7.1L7.1 20a2.1 2.1 0 0 1-3-3l6.3-6.3a5.5 5.5 0 0 1 7.1-7.1z"/>'),
    audio: maintenanceIcon('<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    tools: maintenanceIcon('<path d="M4 8l8-4 8 4-8 4-8-4z"/><path d="M4 8v8l8 4 8-4V8"/><path d="M12 12v8"/>')
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

async function downloadAndRunPatchMyPC(statusElement, button) {
    if (buttonStateManager.isLoading(button)) return;

    const downloadId = `patchmypc-${Date.now()}`;
    const patchMyPCUrl = 'https://www.dropbox.com/scl/fi/z66qn3wgiyvh8uy3fedu7/patch_my_pc.exe?rlkey=saht980hb3zfezv2ixve697jo&st=3ww4r4vy&dl=1';

    statusElement.textContent = '';
    statusElement.classList.remove('visible');
    statusElement.classList.add('status-element');
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    const originalText = button.textContent;
    if (!button.dataset.originalTextPatch) {
        button.dataset.originalTextPatch = originalText;
    }

    button.disabled = true;
    button.textContent = 'Preparing Patch My PC...';

    const storeKey = 'patchmypc';
    registerDownload(storeKey, downloadId, { name: 'Patch My PC' });

    return new Promise((resolve) => {
        attachDownloadUI(storeKey, (data) => {
            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading Patch My PC... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading Patch My PC... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Opening Patch My PC...';
                    downloadStore.delete(storeKey);
                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                button.textContent = 'Patch My PC Started';
                            } else {
                                button.textContent = originalText;
                                toast('Failed to open Patch My PC', { type: 'error', title: 'Maintenance' });
                            }
                        })
                        .catch(() => {
                            button.textContent = originalText;
                            toast('Error opening Patch My PC', { type: 'error', title: 'Maintenance' });
                        })
                        .finally(() => {
                            button.disabled = false;
                            resolve();
                        });
                    break;
                }
                case 'error':
                    button.textContent = originalText;
                    button.disabled = false;
                    downloadStore.delete(storeKey);
                    toast('Download failed', { type: 'error', title: 'Maintenance' });
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, patchMyPCUrl, 'PatchMyPC.exe');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            downloadStore.delete(storeKey);
            toast('Download failed', { type: 'error', title: 'Maintenance' });
            resolve();
        }
    });
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
    scanMode.textContent = 'Requesting administrator scan...';

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
            const isEmpty = Number(data.sizeBytes || 0) <= 0;
            const isLocked = scanning || cleaning || data.inaccessible || isEmpty;

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
            checkbox.checked = !isEmpty && !data.inaccessible;
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

    async function scanCleaner(preferElevated = false) {
        if (scanning || cleaning) return;
        scanning = true;
        selectAllBtn.disabled = true;
        cleanBtn.disabled = true;
        scanBtn.classList.add('btn-loading');
        setCleanerButtonContent(scanBtn, 'scan', 'Scanning...');
        scanMode.textContent = preferElevated ? 'Requesting administrator scan...' : 'Running limited scan...';
        renderRows();

        try {
            let result = await window.api.scanCleanerTasks({ elevated: preferElevated });
            if (preferElevated && (!result || !result.success)) {
                scanMode.textContent = 'Limited scan - administrator access was not granted.';
                result = await window.api.scanCleanerTasks({ elevated: false });
            }

            if (!result || !result.success) {
                toast((result && result.error) || 'Cleaner scan failed.', { type: 'error', title: 'Cleaner' });
                return;
            }

            scanMode.textContent = result.elevated
                ? 'Full scan completed with administrator access.'
                : 'Limited scan completed. Protected folders need administrator access.';

            (result.items || []).forEach((item) => {
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
        } catch (error) {
            toast((error && error.message) || 'Cleaner scan failed.', { type: 'error', title: 'Cleaner' });
        } finally {
            scanning = false;
            scanBtn.disabled = false;
            selectAllBtn.disabled = false;
            scanBtn.classList.remove('btn-loading');
            setCleanerButtonContent(scanBtn, 'scan', 'Scan');
            renderRows();
        }
    }

    selectAllBtn.addEventListener('click', () => {
        const controls = Array.from(rowControls.values());
        const shouldSelect = controls.some((control) => !control.checkbox.checked && !control.checkbox.disabled);
        controls.forEach((control) => {
            if (!control.checkbox.disabled) control.checkbox.checked = shouldSelect;
        });
        updateTotals();
    });

    scanBtn.addEventListener('click', () => scanCleaner(true));

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
            const result = await window.api.runCleanerTasks(selectedIds);
            if (result && result.success) {
                const now = new Date().toISOString();
                localStorage.setItem('cleanerLastCleaned', now);
                lastCleaned.textContent = `Last cleaned: ${formatCleanerDate(now)}`;
                toast(result.message || 'Cleaner completed.', { type: 'success', title: 'Cleaner' });
                cleaning = false;
                await scanCleaner(true);
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
            updateTotals();
        }
    });

    renderRows();
    scanCleaner(true);

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

    const patchCard = createMaintenanceCard(
        translations.maintenance?.patch_my_pc || 'Patch My PC',
        translations.maintenance?.patch_my_pc_desc || 'Update third-party applications automatically',
        'tools',
        translations.actions?.download_run || 'Download & Run',
        downloadAndRunPatchMyPC,
        false
    );
    patchCard.querySelector('button').classList.add('btn-standard-height');
    patchCard.classList.add('patch-card-full');

    toolsRow.appendChild(patchCard);
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
