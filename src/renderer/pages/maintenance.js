import { createNotifier } from '../notifications.js';
import { taskApi } from '../operations.js';
import { uiText } from '../ui-text.js';
import { createHelpButton } from '../tooltips.js';
import { createStreamTerminal, closeOtherTerminals, openTerminal } from '../terminal.js';
import { getMaintenanceIcon } from '../ui.js';

const maintenanceToast = createNotifier('system_maintenance');

let maintenanceBusy = false;

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

    const titleRow = document.createElement('div');
    titleRow.className = 'maintenance-card-title-row';
    titleRow.appendChild(nameEl);
    const help = uiText(iconKey + '_help', '');
    if (help) titleRow.appendChild(createHelpButton(help));
    if (requiresAdmin) {
        card.classList.add('maintenance-action-card--admin');
        titleRow.appendChild(createMaintenanceBadge(createMaintenanceCard.adminBadgeText || 'Admin'));
    }
    text.appendChild(titleRow);
    text.appendChild(descEl);
    header.appendChild(text);

    const button = document.createElement('button');
    button.className = 'button-secondary maintenance-card-action';
    button.textContent = buttonText;
    button.dataset.loadingText = createMaintenanceCard.runningText || 'Running...';

    const term = createStreamTerminal(uiText("stop", "Stop"));
    term.title.textContent = task.cmd;

    let running = false;
    let cancelled = false;

    button.addEventListener('click', async () => {
        if (running) return;
        if (maintenanceBusy) {
            maintenanceToast(createMaintenanceCard.busyMessage || 'Another maintenance task is running.', {
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
        openTerminal(term.terminal);
        term.print(`> ${task.cmd}`, 'is-cmd');

        const unsubscribe = taskApi.onSystemRepairOutput(({ stream, text }) => {
            term.append(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await task.api();
            if (result && result.success) {
                term.print('✔ ' + uiText('task_done', '', { name }), 'is-ok');
                maintenanceToast(uiText('task_done', '{name} completed.', { name }), { type: 'success', title: createMaintenanceCard.toastTitle || 'Maintenance' });
            } else if (!result || !result.cancelled) {
                term.print(`✖ ${result?.error || `${name} exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                maintenanceToast(result?.error || uiText('task_failed', '{name} failed.', { name }), { type: 'error', title: createMaintenanceCard.toastTitle || 'Maintenance' });
            }
        } catch (error) {
            if (!cancelled) {
                term.print(`✖ ${error.message}`, 'is-err');
                maintenanceToast(error.message || uiText('task_failed', '{name} failed.', { name }), { type: 'error', title: createMaintenanceCard.toastTitle || 'Maintenance' });
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
            await taskApi.cancelSystemRepair();
            term.print(uiText("task_cancelled", "■ Task cancelled."), 'is-warn');
        } finally {
            term.stopBtn.disabled = false;
        }
    });

    card.appendChild(header);
    const consequenceKeys = { ip: 'connection_warning', bluetooth: 'bluetooth_warning', reset: 'reset_warning', audio: 'audio_warning' };
    if (consequenceKeys[iconKey]) {
        const notice = document.createElement('p');
        notice.className = 'maintenance-consequence';
        const noticeIcon = document.createElement('span');
        noticeIcon.className = 'maintenance-consequence-icon';
        noticeIcon.innerHTML = getMaintenanceIcon('alert');
        notice.append(noticeIcon, document.createTextNode(uiText(consequenceKeys[iconKey])));
        card.appendChild(notice);
    }
    card.appendChild(button);
    card.appendChild(term.terminal);

    return card;
}


const flushDnsCache = { api: () => taskApi.flushDnsCache(), cmd: 'ipconfig /flushdns', success: 'DNS cache flushed!', error: 'Failed to flush DNS cache.' };
const releaseRenewIp = { api: () => taskApi.releaseRenewIp(), cmd: 'ipconfig /release; ipconfig /renew', success: 'IP released & renewed!', error: 'Failed to release/renew IP.' };
const fixBluetooth = { api: () => taskApi.fixBluetooth(), cmd: 'Restart Bluetooth services', success: 'Bluetooth fixed!', error: 'Failed to fix Bluetooth.' };
const checkDisk = { api: () => taskApi.checkDisk(), cmd: 'chkdsk C:', success: 'Disk check completed!', error: 'Failed to check disk.' };
const networkReset = { api: () => taskApi.networkReset(), cmd: 'netsh winsock reset; netsh int ip reset', success: 'Network reset completed! A restart may be required.', error: 'Failed to reset network.' };
const restartAudioSystem = { api: () => taskApi.restartAudioSystem(), cmd: 'Restart Windows Audio services', success: 'Audio system restarted!', error: 'Failed to restart audio.' };

function buildWingetUpdaterCard(translations) {
    const card = document.createElement('div');
    card.className = 'maintenance-action-card maintenance-action-card--updater';

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
    const titleRow = document.createElement('div');
    titleRow.className = 'maintenance-card-title-row';
    titleRow.appendChild(nameEl);
    const help = uiText('upgrade_help', '');
    if (help) titleRow.appendChild(createHelpButton(help));
    titleRow.appendChild(createMaintenanceBadge('Winget', 'info'));
    text.appendChild(titleRow);
    text.appendChild(descEl);
    header.appendChild(text);
    card.appendChild(header);

    const runBtn = document.createElement('button');
    runBtn.className = 'button maintenance-card-action';
    runBtn.textContent = translations.actions?.upgrade_all || 'Upgrade All';
    card.appendChild(runBtn);

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
        try { taskApi.openExternal('ms-windows-store://pdp/?productid=9NBLGGH4NNS1'); } catch { }
    });
    missing.appendChild(missingText);
    missing.appendChild(storeBtn);
    card.appendChild(missing);

    const term = createStreamTerminal(translations.actions?.stop || 'Stop');
    term.title.textContent = 'winget upgrade --all';
    const { terminal, stopBtn } = term;
    const appendOutput = term.append;
    const printLine = term.print;
    card.appendChild(terminal);

    let running = false;
    let cancelled = false;

    function showMissing(show) {
        card.classList.toggle('winget-unavailable', show);
    }

    runBtn.addEventListener('click', async () => {
        if (running) return;
        if (maintenanceBusy) {
            maintenanceToast(translations.maintenance?.busy_message || 'Another maintenance task is running.', {
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

        try {
            const status = await taskApi.checkWingetUpgrade();
            if (!status || !status.installed) {
                showMissing(true);
                maintenanceToast(translations.messages?.winget_not_installed || 'Winget is not installed.', { type: 'error', title: 'Winget' });
                running = false;
                maintenanceBusy = false;
                card.classList.remove('is-running');
                runBtn.disabled = false;
                runBtn.classList.remove('btn-loading');
                runBtn.textContent = originalText;
                return;
            }
        } catch {  }

        showMissing(false);
        runBtn.textContent = translations.actions?.upgrading || 'Upgrading...';

        term.reset();
        closeOtherTerminals(terminal);
        openTerminal(terminal);
        printLine('> winget upgrade --all', 'is-cmd');

        const unsubscribe = taskApi.onWingetUpgradeOutput(({ stream, text }) => {
            appendOutput(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await taskApi.wingetUpgradeAll();
            if (result && result.success && result.partial) {
                printLine(uiText("upgrade_partial_log", "⚠ Some packages could not be upgraded (see output above)."), 'is-warn');
                maintenanceToast(uiText("upgrade_partial", "Upgrades finished — some packages were skipped or blocked."), { type: 'warning', title: 'Winget' });
            } else if (result && result.success) {
                printLine(uiText("upgrade_done_log", "✔ All upgrades completed."), 'is-ok');
                maintenanceToast(uiText("upgrade_done", "All apps upgraded successfully!"), { type: 'success', title: 'Winget' });
            } else if (result && result.cancelled) {
                cancelled = true;
            } else if (result && result.notInstalled) {
                showMissing(true);
                terminal.classList.remove('open');
                maintenanceToast(translations.messages?.winget_not_installed || 'Winget is not installed.', { type: 'error', title: 'Winget' });
            } else {
                printLine(`✖ ${result?.error || `Winget exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                maintenanceToast(result?.error || uiText("upgrade_errors", "Winget upgrade finished with errors."), { type: 'error', title: 'Winget' });
            }
        } catch (error) {
            if (!cancelled) {
                printLine(`✖ ${error.message}`, 'is-err');
                maintenanceToast(error.message || uiText("upgrade_failed", "Winget upgrade failed."), { type: 'error', title: 'Winget' });
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
            await taskApi.cancelWingetUpgrade();
            printLine(uiText("upgrade_cancelled", "■ Upgrade cancelled."), 'is-warn');
        } finally {
            stopBtn.disabled = false;
        }
    });

    return card;
}


const MAINTENANCE_LAYOUT_SETTING_KEY = 'maintenance_layout';
const MAINTENANCE_LAYOUTS = ['overview', 'list'];

function syncMaintenanceLayout(layout) {
    if (!MAINTENANCE_LAYOUTS.includes(layout)) return;
    try {
        const request = taskApi?.setSetting?.(MAINTENANCE_LAYOUT_SETTING_KEY, layout);
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
        const synced = await taskApi?.getSetting?.(MAINTENANCE_LAYOUT_SETTING_KEY);
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

    const description = document.createElement('p');
    description.textContent = T.page_description
        || translations.menu_info?.system_maintenance
        || 'Repair connections, diagnose Windows, and keep your applications current.';

    copy.appendChild(description);

    main.appendChild(heroIcon);
    main.appendChild(copy);

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
    main.appendChild(layoutControl);
    hero.appendChild(main);
    hero.appendChild(footer);

    setMaintenanceLayout(container, initialLayout, buttons, false);

    return hero;
}

function createMaintenanceSection(titleText, descriptionText, iconKey, tone) {
    const section = document.createElement('section');
    section.className = `maintenance-section maintenance-section--${tone}`;

    const header = document.createElement('header');
    header.className = 'maintenance-section-header ui-section-head';

    const icon = document.createElement('span');
    icon.className = 'maintenance-section-icon';
    icon.innerHTML = getMaintenanceIcon(iconKey);

    const copy = document.createElement('div');
    copy.className = 'maintenance-section-copy';

    const title = document.createElement('h2');
    title.className = 'maintenance-section-title ui-section-title';
    title.textContent = titleText;

    const description = document.createElement('p');
    description.className = 'maintenance-section-description ui-section-desc';
    description.textContent = descriptionText;

    copy.append(title, description);
    header.append(icon, copy);

    const grid = document.createElement('div');
    grid.className = 'maintenance-action-grid';

    section.append(header, grid);

    return { section, grid };
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

    const networkSection = createMaintenanceSection(
        T.network_section || 'Network & Connectivity',
        T.network_section_desc || 'Quick fixes for connection, DNS, Bluetooth, and Windows networking.',
        'network', 'network'
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

    const repairSection = createMaintenanceSection(
        T.repair_section || 'System Repair & Diagnostics',
        T.repair_section_desc || 'Check Windows integrity, disk health, and essential system services.',
        'repair', 'repair'
    );
    const repairRow = repairSection.grid;

    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'maintenance-action-card maintenance-action-card--admin maintenance-action-card--primary';

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
    const sfcDismTitleRow = document.createElement('div');
    sfcDismTitleRow.className = 'maintenance-card-title-row';
    sfcDismTitleRow.append(sfcDismName, createHelpButton(uiText('sfc_help') + '\n\n' + uiText('dism_help')));
    sfcDismTitleRow.appendChild(createMaintenanceBadge(T.admin_badge || 'Admin'));
    sfcDismText.appendChild(sfcDismTitleRow);
    sfcDismText.appendChild(sfcDismDesc);
    sfcDismHeader.appendChild(sfcDismText);
    sfcDismCard.appendChild(sfcDismHeader);

    const sfcDismButtons = document.createElement('div');
    sfcDismButtons.classList.add('sfc-dism-buttons');

    const sfcButton = document.createElement('button');
    sfcButton.className = 'button maintenance-card-action';
    sfcButton.textContent = translations.actions?.run_sfc || 'Run SFC';

    const dismButton = document.createElement('button');
    dismButton.className = 'button-secondary maintenance-card-action';
    dismButton.textContent = translations.actions?.run_dism || 'Run DISM';

    const repairTerm = createStreamTerminal(translations.actions?.stop || 'Stop');
    const { terminal: repairTerminal, stopBtn: repairStopBtn, title: repairTermTitle } = repairTerm;
    const repairAppend = repairTerm.append;
    const repairPrint = repairTerm.print;

    let repairRunning = false;
    let repairCancelled = false;

    async function runRepairTask(button, apiFn, cmdLabel, taskName) {
        if (repairRunning) return;
        if (maintenanceBusy) {
            maintenanceToast(T.busy_message || 'Another maintenance task is running.', {
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
        repairTerm.reset();
        closeOtherTerminals(repairTerminal);
        openTerminal(repairTerminal);
        repairPrint(`> ${cmdLabel}`, 'is-cmd');

        const unsubscribe = taskApi.onSystemRepairOutput(({ stream, text }) => {
            repairAppend(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await apiFn();
            if (result && result.success) {
                repairPrint(`✔ ${taskName} completed.`, 'is-ok');
                maintenanceToast(uiText('task_done', '{name} completed.', { name: taskName }), { type: 'success', title: T.toast_title || 'Maintenance' });
            } else if (!result || !result.cancelled) {
                repairPrint(`✖ ${result?.error || `${taskName} exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                maintenanceToast(result?.error || uiText('task_failed', '{name} failed.', { name: taskName }), { type: 'error', title: T.toast_title || 'Maintenance' });
            }
        } catch (error) {
            if (!repairCancelled) {
                repairPrint(`✖ ${error.message}`, 'is-err');
                maintenanceToast(error.message || uiText('task_failed', '{name} failed.', { name: taskName }), { type: 'error', title: T.toast_title || 'Maintenance' });
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
        runRepairTask(sfcButton, () => taskApi.runSfcScan(), 'sfc /scannow', translations.actions?.run_sfc || 'SFC scan');
    });

    dismButton.addEventListener('click', () => {
        runRepairTask(dismButton, () => taskApi.runDismRepair(), 'DISM /Online /Cleanup-Image /RestoreHealth', translations.actions?.run_dism || 'DISM repair');
    });

    repairStopBtn.addEventListener('click', async () => {
        if (!repairRunning) return;
        repairCancelled = true;
        repairStopBtn.disabled = true;
        try {
            await taskApi.cancelSystemRepair();
            repairPrint(uiText("task_cancelled", "■ Task cancelled."), 'is-warn');
        } finally {
            repairStopBtn.disabled = false;
        }
    });

    sfcButton.setAttribute('data-tooltip', uiText('sfc_help'));
    dismButton.setAttribute('data-tooltip', uiText('dism_help'));
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

    const toolsSection = createMaintenanceSection(
        T.tools_section || 'Application Updates',
        T.tools_section_desc || 'Keep installed applications current through Windows Package Manager.',
        'tools', 'updates'
    );
    const toolsRow = toolsSection.grid;

    const updaterCard = buildWingetUpdaterCard(translations);

    toolsRow.appendChild(updaterCard);
    container.appendChild(toolsSection.section);

    return container;
}
