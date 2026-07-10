/**
 * Activation Page
 * Contains Windows Activation and Auto Login functionality
 */

import { buttonStateManager, registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast } from '../components.js';

const ACTIVATE_WINDOWS_ICON_PATH = 'm93.961 81.352-0.78516-1.8984c-0.375-0.90234-1.082-1.5898-2-1.9375l-0.27344-0.10156 0.046875-0.28516c0.25781-1.5117 0.35547-3.8047-0.62109-6.1641l-0.14453-0.35156 0.32812-0.13672c2.0781-0.85156 3.4219-2.8516 3.4219-5.0938v-54.086c0-3.0352-2.4688-5.5-5.5-5.5h-77.16c-3.0352 0-5.5 2.4688-5.5 5.5v54.086c0 3.0352 2.4688 5.5 5.5 5.5h24.438l-2.1328 5.5703-0.1875 0.042969c-1.957 0.4375-3.3789 2.2109-3.3789 4.2188 0 2.3828 1.9375 4.3203 4.3203 4.3203h30.055l0.097656 0.082032c0.89844 0.73437 1.8203 1.375 2.7422 1.9062l0.26953 0.15625-0.11719 0.28516c-0.35547 0.86328-0.35547 1.8164 0.003906 2.6758l0.78516 1.8984c0.54688 1.3164 1.8203 2.168 3.2461 2.168 0.46094 0 0.91016-0.089843 1.3398-0.26562l19.309-7.9961c0.86719-0.35937 1.5391-1.0352 1.8984-1.8984 0.35937-0.86719 0.35937-1.8203 0-2.6875zm-86.062-70.055c0-1.8633 1.5156-3.375 3.375-3.375h77.16c1.8633 0 3.375 1.5156 3.375 3.375v49.832h-5.5625l-1.5391-3.707c-0.59766-1.4414-1.9922-2.3711-3.5547-2.3711-0.50391 0-0.99609 0.097657-1.4648 0.29297-0.57422 0.23828-1.0664 0.59766-1.4648 1.0703l-0.21875 0.25781-0.26953-0.20703c-0.28125-0.21484-0.58203-0.38281-0.89453-0.5-0.39453-0.14844-0.82031-0.22266-1.2578-0.22266-0.53906 0-1.0781 0.10937-1.6055 0.32812-0.66797 0.27734-1.2383 0.73438-1.6562 1.3242l-0.1875 0.26172-0.28125-0.16016c-0.17187-0.097656-0.31641-0.17188-0.45703-0.23047-0.47266-0.19531-0.96484-0.29297-1.4688-0.29297-0.50391 0-0.99609 0.097656-1.4688 0.29297-0.38672 0.16016-0.74609 0.38672-1.0703 0.67188l-0.37109 0.32812-1.957-4.7188 0.39844-0.097656c2.0547-0.51172 3.4922-2.3516 3.4922-4.4688 0-1.1523-0.42969-2.2578-1.2148-3.1094l-0.15234-0.16797 2.7383-6.6055 0.22656-0.007812c2.4727-0.10547 4.4062-2.125 4.4062-4.5977 0-2.5391-2.0664-4.6055-4.6055-4.6055-2.0195 0-3.832 1.3516-4.4102 3.2891l-0.074219 0.25391h-5.8359l-0.042969-0.30859c-0.23438-1.75-0.92578-3.418-2-4.8242l-0.1875-0.24609 4.1289-4.1289 0.23438 0.125c0.66797 0.36328 1.4258 0.55469 2.1875 0.55469 2.5391 0 4.6055-2.0664 4.6055-4.6055 0-2.5391-2.0664-4.6055-4.6055-4.6055-1.3867 0-2.6914 0.62109-3.5703 1.7031l-0.16797 0.20312-6.2031-2.5703 0.027344-0.26172c0.015625-0.15625 0.023437-0.31641 0.023437-0.47266 0-2.5391-2.0664-4.6055-4.6055-4.6055-2.5391 0-4.6055 2.0664-4.6055 4.6055 0 2.0195 1.3516 3.832 3.2891 4.4102l0.25391 0.074218v5.8359l-0.30859 0.042969c-1.75 0.23438-3.418 0.92578-4.8242 2l-0.24609 0.1875-4.1289-4.1289 0.125-0.23437c0.36328-0.66797 0.55469-1.4258 0.55469-2.1875 0-2.5391-2.0664-4.6055-4.6055-4.6055-2.5391 0-4.6055 2.0664-4.6055 4.6055 0 1.2852 0.54297 2.5195 1.4961 3.3906l0.18359 0.16797-2.6289 6.3438-0.24609-0.011719c-0.066407-0.003906-0.13281-0.003906-0.19922-0.003906-2.5391 0-4.6055 2.0664-4.6055 4.6055s2.0664 4.6055 4.6055 4.6055c2.0195 0 3.832-1.3516 4.4102-3.2891l0.074219-0.25391h5.8359l0.042969 0.30859c0.23438 1.75 0.92578 3.418 2 4.8242l0.1875 0.24609-4.1289 4.1289-0.23438-0.125c-0.66797-0.36328-1.4258-0.55469-2.1875-0.55469-2.5391 0-4.6055 2.0664-4.6055 4.6055 0 2.5391 2.0664 4.6055 4.6055 4.6055 1.0469 0 2.0742-0.36328 2.8906-1.0234l0.16406-0.13281 6.8398 2.832 0.023438 0.21094c0.24609 2.3477 2.2148 4.1172 4.5781 4.1172 2.5391 0 4.6055-2.0664 4.6055-4.6055 0-2.0195-1.3516-3.832-3.2891-4.4102l-0.25391-0.074219v-5.8359l0.30859-0.042968c1.75-0.23438 3.418-0.92578 4.8242-2l0.24609-0.1875 4.1289 4.1289-0.125 0.23438c-0.19922 0.37109-0.35156 0.76953-0.44141 1.1836l-0.050781 0.22656-0.22656 0.042969c-0.25391 0.050781-0.50391 0.125-0.73438 0.21875-1.7422 0.72266-2.9922 2.6914-2.0117 5.0625l3.1484 7.5977h-52.082zm31.512 35.496-0.125-0.23438 4.1289-4.1289 0.24609 0.1875c1.4062 1.0742 3.0742 1.7656 4.8242 2l0.30859 0.042968v5.8359l-0.25391 0.074218c-1.1719 0.35156-2.1758 1.1758-2.7539 2.2617l-0.15234 0.28516-5.9688-2.4727 0.09375-0.30859c0.13672-0.4375 0.20313-0.89453 0.20313-1.3555 0-0.76172-0.19141-1.5195-0.55469-2.1875zm-7.5938-16.203 2.5234-6.0977 0.27734 0.042968c0.24609 0.039063 0.49609 0.058594 0.73828 0.058594 0.76562 0 1.5195-0.19141 2.1875-0.55469l0.23438-0.125 4.1289 4.1289-0.1875 0.24609c-1.0742 1.4062-1.7656 3.0742-2 4.8242l-0.042969 0.30859h-5.8359l-0.074219-0.25391c-0.28906-0.96484-0.89844-1.8242-1.7227-2.418l-0.22656-0.16406zm28.48-8.4062 0.125 0.23438-4.1289 4.1289-0.24609-0.1875c-1.4062-1.0742-3.0742-1.7656-4.8242-2l-0.30859-0.042969v-5.8359l0.25391-0.074219c0.88672-0.26562 1.668-0.78516 2.2539-1.5078l0.16797-0.20313 6.2031 2.5703-0.027344 0.26172c-0.015625 0.15625-0.023437 0.31641-0.023437 0.47266 0 0.76562 0.19141 1.5195 0.55469 2.1875zm-10.445 16.219c2.1602 0 3.9141-1.7578 3.9141-3.9141 0-1.2227-0.55859-2.3555-1.5273-3.1055-0.46484-0.35937-0.55078-1.0273-0.19141-1.4883 0.20312-0.26172 0.51172-0.41406 0.84375-0.41406 0.23438 0 0.46094 0.078125 0.64844 0.22266 1.4961 1.1523 2.3555 2.8984 2.3555 4.7891 0 3.332-2.7109 6.0391-6.0391 6.0391-3.332 0-6.0391-2.7109-6.0391-6.0391 0-1.8125 0.80469-3.5156 2.2031-4.668 0.19141-0.15625 0.42969-0.24219 0.67578-0.24219 0.32031 0 0.61719 0.14062 0.82031 0.38672 0.37109 0.45312 0.30859 1.125-0.14453 1.4961-0.91016 0.74609-1.4297 1.8516-1.4297 3.0273 0 2.1602 1.7578 3.9141 3.9141 3.9141zm1.0625-9.0938v4.6484c0 0.58594-0.47656 1.0625-1.0625 1.0625-0.58594 0-1.0625-0.47656-1.0625-1.0625v-4.6484c0-0.58594 0.47656-1.0625 1.0625-1.0625 0.58594 0 1.0625 0.47656 1.0625 1.0625zm7.0703 11.371c1.0742-1.4062 1.7656-3.0742 2-4.8242l0.042969-0.30859h5.8359l0.074219 0.25391c0.32812 1.0977 1.0508 2.0312 2.0352 2.625l0.26172 0.15625-2.4844 6-0.29688-0.074219c-0.36328-0.089843-0.73438-0.13672-1.1055-0.13672-0.76562 0-1.5195 0.19141-2.1875 0.55469l-0.23438 0.125-4.1289-4.1289 0.1875-0.24609zm-22.105 35.711 2.1094-5.5078h16.184l0.050781 0.29297c0.12891 0.74219 0.48438 1.4219 1.0195 1.9609 0.66016 0.66016 1.1602 1.4609 1.9219 2.7109l0.32813 0.53906h-21.617zm33.09 9.1562c-1.25-0.62891-4.4609-2.5352-7.2773-6.582-1.168-1.6797-1.9648-2.9883-2.6094-4.043-0.85156-1.3945-1.4648-2.4023-2.3359-3.2773-0.55469-0.55859-0.47266-1.2148-0.41016-1.4727 0.058593-0.25 0.27734-0.85547 0.99609-1.0898 0.36719-0.12109 0.6875-0.19922 1.0547-0.19922 1.2344 0 2.7969 0.89063 7.1289 5.4414 0.19922 0.21094 0.48047 0.32812 0.76953 0.32812 0.20703 0 0.40625-0.058594 0.57812-0.17188 0.42969-0.27734 0.59766-0.82422 0.40234-1.2969l-8.4766-20.461c-0.50391-1.2148 0.14844-1.9922 0.86328-2.2852 0.10547-0.042969 0.38281-0.14453 0.71484-0.14453 0.38672 0 1.0977 0.14062 1.4922 1.0977l6.9141 16.691c0.16406 0.39844 0.55078 0.65625 0.98047 0.65625 0.14062 0 0.27734-0.027343 0.40625-0.082031 0.26172-0.10938 0.46484-0.3125 0.57422-0.57422s0.10938-0.55078 0-0.8125l-2.3984-5.7891c-0.17578-0.42188-0.17578-0.89062 0-1.3125 0.17578-0.42188 0.50391-0.75391 0.92969-0.92969 0.21094-0.085937 0.42969-0.12891 0.65625-0.12891 0.69922 0 1.3203 0.41406 1.5859 1.0586l2.7852 6.7227c0.16406 0.39844 0.55078 0.65625 0.98047 0.65625 0.14062 0 0.27734-0.027344 0.40625-0.082031 0.26172-0.10938 0.46484-0.3125 0.57422-0.57422s0.10938-0.55078 0-0.8125l-2.3984-5.7891c-0.17578-0.42187-0.17578-0.89062 0-1.3125 0.17578-0.42187 0.50391-0.75391 0.92969-0.92969 0.26953-0.11328 0.53906-0.16797 0.79297-0.16797 0.18359 0 0.35938 0.03125 0.51562 0.089844 0.40625 0.15234 0.71875 0.49219 0.93359 1.0078l2.9766 7.1875c0.16406 0.39844 0.55078 0.65625 0.98438 0.65625 0.14062 0 0.27734-0.027343 0.40625-0.082031 0.26172-0.10938 0.46484-0.3125 0.57422-0.57422 0.10938-0.26172 0.10938-0.55078 0-0.8125l-2.3984-5.7891c-0.36328-0.875 0.054688-1.8789 0.92969-2.2422 0.21094-0.085937 0.42969-0.12891 0.65625-0.12891 0.69922 0 1.3203 0.41797 1.5859 1.0586l5.6211 13.543c0.92578 2.2344 0.63281 4.4375 0.375 5.5508l-0.039062 0.17969-19.434 8.0508-0.15625 0.0625-0.14453-0.074219z';

const activationSvg = (body, options = {}) => {
    const viewBox = options.viewBox || '0 0 24 24';
    const attrs = options.stroke
        ? 'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"'
        : 'fill="currentColor"';

    return `
        <svg class="activation-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true" ${attrs}>
            ${body}
        </svg>
    `;
};

const ACTIVATION_ICONS = {
    windows: activationSvg(`<path d="${ACTIVATE_WINDOWS_ICON_PATH}"/>`, {
        viewBox: '4.099108108108108 3.9500089999999997 92.16216216216216 91.53'
    }),
    autologin: activationSvg('<path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M10 17l5-5-5-5"/><path d="M15 12H4"/><path d="M7 7V5a3 3 0 0 1 6 0v2"/>', { stroke: true }),
    hero: activationSvg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2"/><path d="M15 8l3 3"/><path d="M18 5l2 2"/>', { stroke: true })
};

// ============================================
// DOWNLOAD AND RUN HELPERS
// ============================================

async function downloadAndRun(button, config) {
    if (buttonStateManager && buttonStateManager.isLoading && buttonStateManager.isLoading(button)) return;

    const ui = config.ui || { setStatus: () => { }, setProgress: () => { } };

    button.disabled = true;
    const originalText = button.textContent;

    button.textContent = config.preparingText;
    ui.setStatus(config.preparingText);
    ui.setProgress(null);

    const downloadId = `${config.idPrefix}-${Date.now()}`;
    const storeKey = config.storeKey;
    registerDownload(storeKey, downloadId, { name: config.name });

    const fail = (message) => {
        button.textContent = originalText;
        button.disabled = false;
        ui.setStatus(message);
        ui.setProgress(null);
        toast(message, { type: 'error', title: config.name });
    };

    return new Promise((resolve) => {
        attachDownloadUI(storeKey, (data) => {
            switch (data.status) {
                case 'started':
                    button.textContent = `${config.downloadingText} 0%`;
                    ui.setStatus(`${config.downloadingText} 0%`);
                    ui.setProgress(0);
                    break;
                case 'progress':
                    button.textContent = `${config.downloadingText} ${data.percent}%`;
                    ui.setStatus(`${config.downloadingText} ${data.percent}%`);
                    ui.setProgress(data.percent);
                    break;
                case 'complete': {
                    button.textContent = config.runningText;
                    ui.setStatus(config.runningText);
                    ui.setProgress(null);
                    downloadStore.delete(storeKey);

                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                button.textContent = config.startedText;
                                ui.setStatus(config.startedText);
                                setTimeout(() => {
                                    button.textContent = originalText;
                                    ui.setStatus(config.idleText || '');
                                }, 3000);
                            } else {
                                button.textContent = originalText;
                                ui.setStatus(config.runFailMsg);
                                toast(config.runFailMsg, { type: 'error', title: config.name });
                            }
                        })
                        .catch(() => {
                            button.textContent = originalText;
                            ui.setStatus(config.runErrorMsg);
                            toast(config.runErrorMsg, { type: 'error', title: config.name });
                        })
                        .finally(() => {
                            button.disabled = false;
                            resolve();
                        });
                    break;
                }
                case 'error':
                    downloadStore.delete(storeKey);
                    fail('Download failed');
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, config.url, config.fileName);
        } catch (e) {
            downloadStore.delete(storeKey);
            fail('Download failed');
            resolve();
        }
    });
}

function downloadAndRunActivate(button, ui, idleText) {
    return downloadAndRun(button, {
        ui,
        idleText,
        idPrefix: 'activate',
        url: 'https://www.dropbox.com/scl/fi/oqgye14tmcg97mxbphorp/activate.bat?rlkey=307wz4bzkzejip3os7iztt54l&st=oz6nh4pf&dl=1',
        fileName: 'activate.bat',
        storeKey: 'activate-script',
        name: 'Activation',
        preparingText: 'Preparing activation...',
        downloadingText: 'Downloading activation script...',
        runningText: 'Running activation script...',
        startedText: 'Activation Started',
        runFailMsg: 'Failed to run activation script',
        runErrorMsg: 'Error running activation script'
    });
}

function downloadAndRunAutologin(button, ui, idleText) {
    return downloadAndRun(button, {
        ui,
        idleText,
        idPrefix: 'autologin',
        url: 'https://www.dropbox.com/scl/fi/a0bphjru0qfnbsokk751h/auto-login.exe?rlkey=b3ogyjelioq49jyty1odi58x9&st=4o2oq4sc&dl=1',
        fileName: 'auto_login.exe',
        storeKey: 'autologin-tool',
        name: 'Auto Login',
        preparingText: 'Preparing auto login...',
        downloadingText: 'Downloading auto login tool...',
        runningText: 'Running auto login setup...',
        startedText: 'Auto Login Started',
        runFailMsg: 'Failed to run auto login tool',
        runErrorMsg: 'Error running auto login tool'
    });
}

// ============================================
// PAGE BUILDER
// ============================================

function createActivationCard({ icon, title, description, badge, buttonText, readyHint, onRun }) {
    const card = document.createElement('article');
    card.className = 'activation-card';

    const header = document.createElement('div');
    header.className = 'activation-card-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = 'activation-card-icon';
    iconWrap.innerHTML = icon;

    const text = document.createElement('div');
    text.className = 'activation-card-text';

    const name = document.createElement('h3');
    name.textContent = title;

    const desc = document.createElement('p');
    desc.textContent = description;

    text.appendChild(name);
    text.appendChild(desc);
    header.appendChild(iconWrap);
    header.appendChild(text);
    card.appendChild(header);

    if (badge) {
        const badgeEl = document.createElement('span');
        badgeEl.className = 'activation-badge';
        badgeEl.textContent = badge;
        header.appendChild(badgeEl);
    }

    const idleHint = readyHint || 'Ready — one click to download and run.';
    const status = document.createElement('p');
    status.className = 'activation-status';
    status.textContent = idleHint;
    card.appendChild(status);

    const progress = document.createElement('div');
    progress.className = 'activation-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'activation-progress-fill';
    progress.appendChild(progressFill);
    card.appendChild(progress);

    const button = document.createElement('button');
    button.className = 'button activation-run-btn';
    button.textContent = buttonText;
    card.appendChild(button);

    const ui = {
        setStatus: (text) => { status.textContent = text || idleHint; },
        setProgress: (percent) => {
            if (percent === null) {
                progress.classList.remove('active');
                progressFill.style.width = '0%';
            } else {
                progress.classList.add('active');
                progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            }
        }
    };

    button.addEventListener('click', () => onRun(button, ui));

    return card;
}

export async function buildActivateAutologinPage(translations, _settings) {
    const container = document.createElement('div');
    container.className = 'card activation-page';

    const hero = document.createElement('section');
    hero.className = 'activation-hero';

    const heroIcon = document.createElement('div');
    heroIcon.className = 'activation-hero-icon';
    heroIcon.innerHTML = ACTIVATION_ICONS.hero;

    const heroText = document.createElement('div');
    heroText.className = 'activation-hero-text';

    const title = document.createElement('h2');
    title.textContent = (translations.pages && translations.pages.activate_title) || 'Windows Activation & Auto Login';

    const heroDesc = document.createElement('p');
    heroDesc.textContent = (translations.pages && translations.pages.activate_desc) ||
        'Use these tools to activate Windows and configure automatic login without a password.';

    heroText.appendChild(title);
    heroText.appendChild(heroDesc);
    hero.appendChild(heroIcon);
    hero.appendChild(heroText);
    container.appendChild(hero);

    const grid = document.createElement('div');
    grid.className = 'activation-grid';

    const uiText = translations.activation_ui || {};
    const readyHint = uiText.ready_hint || 'Ready — one click to download and run.';

    grid.appendChild(createActivationCard({
        icon: ACTIVATION_ICONS.windows,
        title: (translations.activation && translations.activation.activate_windows) || 'Activate Windows',
        description: (translations.activation && translations.activation.activate_desc) || 'Downloads and runs the Windows activation script.',
        badge: uiText.admin_badge || 'Admin required',
        buttonText: (translations.actions && translations.actions.activate_windows) || 'Download & Activate Windows',
        readyHint,
        onRun: (button, ui) => downloadAndRunActivate(button, ui, readyHint)
    }));

    grid.appendChild(createActivationCard({
        icon: ACTIVATION_ICONS.autologin,
        title: (translations.activation && translations.activation.auto_login) || 'Auto Login',
        description: (translations.activation && translations.activation.auto_login_desc) || 'Downloads and sets up automatic login without a password.',
        buttonText: (translations.actions && translations.actions.setup_autologin) || 'Download & Setup Auto Login',
        readyHint,
        onRun: (button, ui) => downloadAndRunAutologin(button, ui, readyHint)
    }));

    container.appendChild(grid);

    return container;
}
