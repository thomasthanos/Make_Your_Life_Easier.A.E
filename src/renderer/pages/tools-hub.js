import { uiText } from '../ui-text.js';
import { button, element, icon, pageHeader } from '../ui.js';
import { helpContent, helpLink, openHelp } from '../overlays.js';

import { createNotifier, activities, subscribeActivity } from '../notifications.js';
import { manageDialog } from '../overlays.js';
import { taskApi } from '../operations.js';
import { getMaintenanceIcon } from '../ui.js';

const biosToast = createNotifier('bios');

export const TOOL_KEYS = ['christitus', 'debloat', 'activate_autologin', 'bios'];
const TOOL_ICONS = { christitus: 'terminal', debloat: 'layers', activate_autologin: 'key', bios: 'chip' };

export function buildToolsHub(translations, navigate) {
    const page = element('div', 'tools-hub');
    const help = button('?', () => openHelp('tools_hub'), 'help-button');
    help.setAttribute('aria-label', uiText('help', 'Help'));
    page.append(pageHeader(null, uiText('hub_description'), [help]));

    const grid = element('div', 'tools-hub-grid');
    const statuses = new Map();
    for (const key of TOOL_KEYS) {
        const info = translations.help?.[key] || {};
        const card = button('', () => navigate(key), 'hub-tool');
        card.dataset.tool = key;
        card.setAttribute('aria-label', translations.menu[key]);
        const copy = element('span', 'hub-tool-copy');
        copy.append(element('span', 'hub-tool-title', translations.menu[key]), element('span', 'hub-tool-desc', uiText('hub_desc_' + key)));
        if (Array.isArray(info.points) && info.points.length) {
            const points = element('span', 'hub-tool-points');
            for (const text of info.points) {
                const point = element('span', 'hub-tool-point');
                point.append(icon('check', 'hub-tool-point-mark'), element('span', '', text));
                points.append(point);
            }
            copy.append(points);
        }
        const status = element('span', 'hub-tool-status');
        statuses.set(key, status);
        copy.append(status);
        if (info.warning) copy.append(element('span', 'hub-tool-note', info.warning));
        card.append(icon(TOOL_ICONS[key], 'hub-tool-icon'), copy, icon('arrow', 'hub-tool-arrow'));
        grid.append(card);
    }
    page.append(grid);

    const stop = subscribeActivity(() => {
        for (const [key, status] of statuses) {
            const latest = activities().find(entry => entry.source === key);
            status.replaceChildren();
            status.className = 'hub-tool-status';
            if (latest) {
                const running = latest.status === 'running';
                status.classList.add(running ? 'is-running' : 'is-' + latest.type);
                status.append(icon(running ? 'activity' : latest.type === 'error' ? 'error' : 'check'),
                    element('span', '', running ? uiText('activity_running') : latest.type === 'error' ? uiText('operation_failed') : uiText('hub_used', 'Used this session')));
            }
        }
    });
    page._pageCleanup = [stop];
    return page;
}

export function wrapToolPage(key, page, translations, navigate) {
    const root = element('div', 'tool-workspace');
    const nav = element('nav', 'tools-tabs');
    nav.setAttribute('aria-label', translations.menu.tools_hub);
    for (const target of ['tools_hub', ...TOOL_KEYS]) {
        const tab = button(target === 'tools_hub' ? uiText('all_tools', 'All tools') : translations.menu[target], () => navigate(target), 'tool-tab');
        tab.classList.toggle('active', key === target);
        if (key === target) tab.setAttribute('aria-current', 'page');
        nav.append(tab);
    }
    const layout = element('div', 'tool-workspace-layout');
    const guide = element('aside', 'tool-guide');
    guide.append(element('h2', '', uiText('about_tool', 'About this tool')), helpContent(key, { compact: true }));
    const latest = element('p', 'tool-last-result');
    guide.append(element('h3', '', uiText('last_action', 'Last action')), latest, helpLink(key));
    const stop = subscribeActivity(() => {
        const entry = activities().find(item => item.source === key);
        latest.textContent = entry ? entry.message : uiText('no_activity', 'No actions in this session.');
    });
    layout.append(page, guide);
    root.append(nav, layout);
    root._pageCleanup = [() => { stop(); page._pageCleanup?.forEach(callback => callback()); }];
    return root;
}

export function buildBiosPage(translations, confirm) {
    const page = element('div', 'bios-page');
    page.append(pageHeader(null, translations.help?.bios?.description));
    page.append(element('p', 'ui-warning', translations.messages.bios_instructions));
    page.append(button(translations.messages.restart_to_bios, confirm, 'button'));
    return page;
}

export function showRestartDialog(translations, menuKeys, loadPage, options = {}) {
    const overlay = document.createElement('div');
    overlay.className = 'bios-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bios-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'bios-dialog-title');

    const header = document.createElement('div');
    header.className = 'bios-dialog-header';

    const headerIcon = document.createElement('div');
    headerIcon.className = 'bios-dialog-icon';
    headerIcon.setAttribute('aria-hidden', 'true');
    headerIcon.innerHTML = getMaintenanceIcon('bios');

    const headerCopy = document.createElement('div');
    headerCopy.className = 'bios-dialog-copy';

    const title = document.createElement('h2');
    title.className = 'bios-title';
    title.id = 'bios-dialog-title';
    title.textContent = translations.menu?.bios || 'BIOS Settings';

    const desc = document.createElement('p');
    desc.className = 'bios-description';
    desc.textContent = translations.messages?.bios_instructions || 'This action will restart your computer and boot into BIOS/UEFI settings. Make sure to save all your work before proceeding.';

    const firmwareBadge = document.createElement('span');
    firmwareBadge.className = 'bios-firmware-badge';
    firmwareBadge.textContent = 'BIOS / UEFI';

    headerCopy.appendChild(title);
    headerCopy.appendChild(desc);
    header.appendChild(headerIcon);
    header.appendChild(headerCopy);
    header.appendChild(firmwareBadge);
    dialog.appendChild(header);

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
    restartBtn.textContent = translations.messages?.restart_to_bios || 'Restart to BIOS';

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };

    let releaseFocus = () => {};
    cancelBtn.addEventListener('click', () => {
        releaseFocus();
        document.removeEventListener('keydown', escapeHandler);
        dialog.classList.add('slide-down');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            const fallbackKey = (Array.isArray(menuKeys) && menuKeys.length > 0) ? menuKeys[0] : 'install_apps';
            if (!options.stayOnPage) loadPage(fallbackKey);
        }, 300);
    });

    restartBtn.addEventListener('click', async () => {
        restartBtn.disabled = true;
        restartBtn.textContent = uiText("processing", "⏳ Processing...");
        restartBtn.classList.add('btn-opacity-low');

        try {
            const result = await taskApi.restartToBios();

            if (result && result.success) {
                restartBtn.classList.remove('btn-opacity-low');
                restartBtn.textContent = uiText("success", "✅ Success!");
                restartBtn.classList.add('btn-success-gradient');

                biosToast(uiText("bios_started", "BIOS restart initiated! Computer will restart shortly."), { type: 'success', duration: 5000 });

                document.removeEventListener('keydown', escapeHandler);
                setTimeout(() => {
                    dialog.classList.add('slide-down');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        releaseFocus();
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
            restartBtn.textContent = uiText("failed_icon", "❌ Failed");
            restartBtn.classList.add('btn-error-gradient');

            setTimeout(() => {
                restartBtn.disabled = false;
                restartBtn.textContent = translations.messages?.restart_to_bios || 'Restart to BIOS';
                restartBtn.classList.remove('btn-error-gradient');
            }, 2000);

            if (error.message && error.message.includes('Administrator')) {
                biosToast(uiText("bios_admin", "🔒 Administrator Privileges Required\n\nPlease run the application as Administrator to access BIOS settings."), { type: 'error' });
            } else {
                biosToast('❌ ' + error.message, { type: 'error' });
            }
        }
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(restartBtn);
    dialog.appendChild(buttonContainer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    document.addEventListener('keydown', escapeHandler);
    releaseFocus = manageDialog(overlay, dialog, () => cancelBtn.click());
    overlay._cleanup = () => { releaseFocus(); document.removeEventListener('keydown', escapeHandler); };
    cancelBtn.focus();
}
