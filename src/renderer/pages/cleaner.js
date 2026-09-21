import { createNotifier } from '../notifications.js';
import { taskApi } from '../operations.js';
import { uiText } from '../ui-text.js';
import { createHelpButton } from '../tooltips.js';
import { formatBytes } from '../utils.js';
import { createStreamTerminal, closeOtherTerminals, openTerminal } from '../terminal.js';
import { getMaintenanceIcon } from '../ui.js';

const cleanerToast = createNotifier('system_cleaner');

const CLEANER_TASKS = [
    { id: 'temp', title: 'Clean Temporary Files', description: 'Remove system and user temporary files.', detail: 'Windows + user temp folders', icon: 'tempFile' },
    { id: 'prefetch', title: 'Clean Prefetch Files', description: 'Delete files from the Windows Prefetch folder.', detail: 'C:\\Windows\\Prefetch', icon: 'prefetch' },
    { id: 'recycle_bin', title: 'Empty Recycle Bin', description: 'Permanently remove files from the Recycle Bin.', detail: 'Recycle Bin', icon: 'recycle' },
    { id: 'windows_update', title: 'Clean Windows Update Cache', description: 'Remove Windows Update downloaded installation files.', detail: 'C:\\Windows\\SoftwareDistribution\\Download', icon: 'updateCache' },
    { id: 'thumbnail_cache', title: 'Clear Thumbnail Cache', description: 'Remove cached thumbnail images used by File Explorer.', detail: 'Explorer thumbnail and icon cache', icon: 'imageCache' },
    { id: 'error_reports', title: 'Clear Error Reports', description: 'Remove error report and crash dump files.', detail: 'CrashDumps + Windows Error Reporting', icon: 'crashReport' }
];

let cleanerT = {};

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

const cleanerState = {
    results: null,
    scanMode: '',
    scanning: false,
    scanPromise: null,
    cleaning: false,
    selected: new Map(),
    lastResult: null,
    adminEnabled: false,
    adminDeclined: false
};

let cleanerActiveRender = null;

function notifyCleaner() {
    if (cleanerActiveRender) {
        try { cleanerActiveRender(); } catch { }
    }
}

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
                    const res = await taskApi.enableCleanerAdmin();
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

            const result = await taskApi.scanCleanerTasks({ elevated: cleanerState.adminEnabled });

            if (!result || !result.success) {
                cleanerToast((result && result.error) || cleanerT.scan_failed || 'Cleaner scan failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
                return;
            }

            cleanerState.results = result.items || [];
            cleanerState.scanMode = result.elevated
                ? (cleanerT.scan_full || 'Full scan completed with administrator access.')
                : (cleanerT.scan_limited || 'Limited scan. Protected items need admin — cleaned when you press Clean.');
        } catch (error) {
            cleanerToast((error && error.message) || cleanerT.scan_failed || 'Cleaner scan failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
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
    container.className = 'cleaner-page';
    const taskState = new Map(CLEANER_TASKS.map((task) => [task.id, { ...task, sizeBytes: 0, path: task.detail, inaccessible: false }]));
    const rowControls = new Map();
    let scanning = false;
    let cleaning = false;

    const summary = document.createElement('section');
    summary.className = 'cleaner-summary';

    const summaryText = document.createElement('div');
    summaryText.className = 'cleaner-summary-text';

    const lastCleaned = document.createElement('p');
    lastCleaned.className = 'cleaner-last-cleaned';
    lastCleaned.textContent = `${cleanerT.last_cleaned || 'Last cleaned:'} ${formatCleanerDate(localStorage.getItem('cleanerLastCleaned'))}`;

    const titleRow = document.createElement('div');
    titleRow.className = 'cleaner-title-row';
    titleRow.append(lastCleaned, createHelpButton(uiText('cleaner_help')));

    const totalLine = document.createElement('p');
    totalLine.className = 'cleaner-total-line';
    totalLine.textContent = `${cleanerT.total_size || 'Total size'} `;
    const totalValue = document.createElement('span');
    totalValue.textContent = cleanerT.scanning || 'Scanning...';
    totalLine.appendChild(totalValue);
    const selectedValue = document.createElement('span');
    totalLine.appendChild(selectedValue);

    const lastResult = document.createElement('p');
    lastResult.className = 'cleaner-last-result';

    const scanMode = document.createElement('p');
    scanMode.className = 'cleaner-scan-mode';
    scanMode.textContent = cleanerT.scanning || 'Scanning...';

    summaryText.appendChild(titleRow);
    summaryText.appendChild(totalLine);
    summaryText.appendChild(scanMode);
    summaryText.appendChild(lastResult);

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
    summary.appendChild(summaryText);
    summary.appendChild(summaryActions);
    container.append(summary);

    const list = document.createElement('div');
    list.className = 'cleaner-list';
    container.appendChild(list);

    const cleanTerm = createStreamTerminal(uiText("stop", "Stop"));
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
        totalValue.textContent = scanning ? (cleanerT.scanning || 'Scanning...') : formatBytes(totalBytes);
        totalValue.classList.toggle('is-scanning', scanning);
        selectedValue.textContent = ' · ' + uiText('selected_size', 'Selected: {size}', { size: formatBytes(selectedBytes) });
        cleanBtn.disabled = scanning || cleaning || checkedCount === 0;
        setCleanerButtonContent(cleanBtn, 'cleaner', cleanLabel);
        setCleanerButtonContent(selectAllBtn, 'selectAll', checkedCount === rowControls.size && checkedCount > 0 ? (cleanerT.unselect_all || 'Unselect All') : (cleanerT.select_all || 'Select All'));
    }

    function applyRowState(task, refs) {
        const data = taskState.get(task.id) || task;
        const accessibleEmpty = !data.inaccessible && Number(data.sizeBytes || 0) <= 0;
        const adminBlocked = data.inaccessible && !cleanerState.adminEnabled;
        const isLocked = scanning || cleaning || accessibleEmpty || adminBlocked;

        refs.row.classList.toggle('is-locked', isLocked && !scanning);
        refs.row.classList.toggle('is-admin', Boolean(data.inaccessible));
        refs.toggle.classList.toggle('is-disabled', isLocked);

        refs.size.classList.remove('is-scanning', 'is-warning');
        if (scanning) {
            refs.size.textContent = cleanerT.scanning || 'Scanning...';
            refs.size.classList.add('is-scanning');
        } else if (data.inaccessible) {
            refs.size.textContent = cleanerT.admin_needed || 'Admin needed';
            refs.size.classList.add('is-warning');
        } else {
            refs.size.textContent = formatBytes(data.sizeBytes);
        }

        refs.detail.textContent = data.path || task.detail;
        refs.checkbox.disabled = isLocked;
        refs.checkbox.checked = !accessibleEmpty && !adminBlocked && (cleanerState.selected.get(task.id) ?? true);
    }

    function renderRows() {
        if (rowControls.size === CLEANER_TASKS.length) {
            CLEANER_TASKS.forEach((task) => {
                const refs = rowControls.get(task.id);
                if (refs) applyRowState(task, refs);
            });
            updateTotals();
            return;
        }

        list.innerHTML = '';
        rowControls.clear();

        CLEANER_TASKS.forEach((task) => {
            const data = taskState.get(task.id) || task;
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
                size.textContent = formatBytes(data.sizeBytes);
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
            checkbox.checked = !accessibleEmpty && !adminBlocked && (cleanerState.selected.get(task.id) ?? true);
            checkbox.disabled = isLocked;
            checkbox.setAttribute('aria-label', rowTitle.textContent);
            checkbox.addEventListener('change', () => {
                cleanerState.selected.set(task.id, checkbox.checked);
                updateTotals();
            });

            const track = document.createElement('span');
            toggle.appendChild(checkbox);
            toggle.appendChild(track);

            row.appendChild(icon);
            row.appendChild(content);
            row.appendChild(toggle);
            list.appendChild(row);
            rowControls.set(task.id, { id: task.id, checkbox, size, row, detail, toggle });
        });

        updateTotals();
    }

    let wasMounted = false;
    function renderFromState() {
        if (container.isConnected) {
            wasMounted = true;
        } else if (wasMounted) {
            if (cleanerActiveRender === renderFromState) cleanerActiveRender = null;
            return;
        }

        scanning = cleanerState.scanning;
        cleaning = cleanerState.cleaning;
        lastCleaned.textContent = `${cleanerT.last_cleaned || 'Last cleaned:'} ${formatCleanerDate(localStorage.getItem('cleanerLastCleaned'))}`;
        lastResult.hidden = !cleanerState.lastResult;
        lastResult.textContent = cleanerState.lastResult == null ? '' : uiText('cleaner_last_result', 'Last result: {size} freed.', { size: formatBytes(cleanerState.lastResult) });

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
            if (!control.checkbox.disabled) {
                control.checkbox.checked = shouldSelect;
                cleanerState.selected.set(control.id, shouldSelect);
            }
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
            cleanerToast(cleanerT.no_selection || 'No cleaner tasks selected.', { type: 'error', title: cleanerT.title || 'Cleaner' });
            return;
        }

        cleaning = true;
        cleanerState.cleaning = true;
        scanBtn.disabled = true;
        selectAllBtn.disabled = true;
        cleanBtn.classList.add('btn-loading');
        setCleanerButtonContent(cleanBtn, 'cleaner', cleanerT.cleaning || 'Cleaning...');

        const bytesBefore = Array.from(taskState.values()).reduce((sum, task) => sum + Number(task.sizeBytes || 0), 0);

        cleanTerm.reset();
        closeOtherTerminals(cleanTerm.terminal);
        openTerminal(cleanTerm.terminal);
        cleanTerm.print('> Clean selected items', 'is-cmd');

        const unsubscribe = taskApi.onCleanerProgress(({ text }) => {
            cleanTerm.print(text);
        });

        try {
            const result = await taskApi.runCleanerTasks(selectedIds, { elevated: cleanerState.adminEnabled });
            if (result && result.success) {
                const now = new Date().toISOString();
                localStorage.setItem('cleanerLastCleaned', now);
                lastCleaned.textContent = `${cleanerT.last_cleaned || 'Last cleaned:'} ${formatCleanerDate(now)}`;
                let freedText = '';
                if (Array.isArray(result.items)) {
                    cleanerState.results = result.items;
                    cleanerState.scanMode = cleanerT.cleaned_refreshed || 'Cleaned. Sizes refreshed with administrator access.';
                    const bytesAfter = result.items.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0);
                    const freed = Math.max(0, bytesBefore - bytesAfter);
                    cleanerState.lastResult = freed;
                    freedText = ` ${cleanerT.freed || 'Freed'} ${formatBytes(freed)}.`;
                }
                cleanTerm.print(`✔ ${cleanerT.clean_done || 'Cleaning completed.'}${freedText}`, 'is-ok');
                cleanerToast((cleanerT.clean_done || result.message || 'Cleaner completed.') + freedText, { type: 'success', title: cleanerT.title || 'Cleaner' });
            } else {
                cleanTerm.print(`✖ ${(result && result.error) || cleanerT.clean_failed || 'Cleaner failed.'}`, 'is-err');
                cleanerToast((result && result.error) || cleanerT.clean_failed || 'Cleaner failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
            }
        } catch (error) {
            cleanTerm.print(`✖ ${(error && error.message) || cleanerT.clean_failed || 'Cleaner failed.'}`, 'is-err');
            cleanerToast((error && error.message) || cleanerT.clean_failed || 'Cleaner failed.', { type: 'error', title: cleanerT.title || 'Cleaner' });
        } finally {
            unsubscribe();
            cleanTerm.terminal.classList.remove('running');
            cleaning = false;
            cleanerState.cleaning = false;
            scanBtn.disabled = false;
            selectAllBtn.disabled = false;
            cleanBtn.classList.remove('btn-loading');
            notifyCleaner();
        }
    });

    cleanerActiveRender = renderFromState;
    (container._pageCleanup ||= []).push(() => {
        if (cleanerActiveRender === renderFromState) cleanerActiveRender = null;
    });

    renderFromState();

    if (!cleanerState.scanning && !Array.isArray(cleanerState.results)) {
        runCleanerScan();
    }

    return container;
}
