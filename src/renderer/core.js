import { emptyState, button } from './ui.js';
import { closePopups, bindMenu, configureHelp, openHelp } from './overlays.js';
import { openActivityPanel, setNotificationSource, toast, subscribeActivity, activities } from './notifications.js';
import { attachPageActivity } from './operations.js';
import { TOOL_KEYS, buildToolsHub, wrapToolPage, buildBiosPage, showRestartDialog } from './pages/tools-hub.js';
import { uiText } from './ui-text.js';
import { initTooltips, hideTooltips, attachTooltipHandlers } from './tooltips.js';

import { debug, escapeHtml } from './utils.js';
import { initDownloadListener } from './downloads.js';
import {
    loadSettings, saveSettings, applyTheme, loadTranslations, setTranslations,
    initializeAutoUpdater, ensureSidebarVersion, checkForChangelog,
    syncPref, hydratePrefsFromCloud
} from './services.js';

const INFO_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="11" y="10" width="2" height="10"/><rect x="11" y="6" width="2" height="2"/></svg>`;
const MENU_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="6" width="16" height="2"/><rect x="4" y="11" width="16" height="2"/><rect x="4" y="16" width="16" height="2"/></svg>`;


const MENU_ICONS = {
    install_apps: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>`,
    system_cleaner: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17h16"></path><path d="M7 17l1.2-7.2A2.2 2.2 0 0 1 10.4 8h3.2a2.2 2.2 0 0 1 2.2 1.8L17 17"></path><path d="M9 17v3"></path><path d="M15 17v3"></path><path d="M10 5h4"></path></svg>`,
    activate_autologin: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>`,
    system_maintenance: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`,
    crack_installer: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"></path><path d="m7.5 4.27 9 5.15"></path></svg>`,
    spicetify: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`,
    christitus: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>`,
    bios: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-computer"><rect width="14" height="8" x="5" y="2" rx="2"></rect><rect width="20" height="8" x="2" y="14" rx="2"></rect><path d="M6 18h2"></path><path d="M12 18h6"></path></svg>`,
    debloat: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-broom"><path d="m13 11 9-9"></path><path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2z"></path><path d="m6.8 10.4 6.8 6.8"></path><path d="m5 17 1.4-1.4"></path></svg>`,
    game_saves: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gamepad-2"><line x1="6" x2="10" y1="11" y2="11"></line><line x1="8" x2="8" y1="9" y2="13"></line><line x1="15" x2="15.01" y1="12" y2="12"></line><line x1="18" x2="18.01" y1="10" y2="10"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path></svg>`
};

function createMenuButton(key, label) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = key;
    btn.innerHTML = `
    <span class="menu-icon">${MENU_ICONS[key] || MENU_ICONS.christitus || ''}</span>
    <span class="label">${escapeHtml(label)}</span>
    <span class="dot" aria-hidden="true"></span>
  `;
    li.appendChild(btn);
    return li;
}

const DEFAULT_WINDOW_WIDTH = 1100;
const DEFAULT_WINDOW_HEIGHT = 750;


let currentPage = null;
let pageLoadGeneration = 0;
let translations = {};
let settings = {};


const menuGroups = [
    { key: 'nav_apps', label: 'Applications', pages: ['install_apps', 'crack_installer'] },
    { key: 'nav_system', label: 'System', pages: ['system_cleaner', 'system_maintenance'] },
    { key: 'nav_tools', label: 'Tools', pages: ['game_saves', 'spicetify', 'tools_hub'] }
];
const menuKeys = menuGroups.flatMap(group => group.pages);
// These pages draw their own progress and lock their own controls while a task runs.
const PAGES_WITH_OWN_PROGRESS = new Set(['install_apps', 'game_saves']);


function updateHeader() {
    const labels = {
        'sidebar-collapse-toggle': ['toggle_sidebar', 'Expand or collapse navigation'],
        'title-bar-minimize': ['minimize', 'Minimize'],
        'title-bar-maximize': ['maximize', 'Maximize or restore'],
        'title-bar-close': ['close', 'Close'],
        'info-toggle': ['help', 'Help']
    };
    for (const [id, [key, fallback]] of Object.entries(labels)) {
        const element = document.getElementById(id);
        if (element) {
            element.setAttribute('aria-label', uiText(key, fallback));
            element.setAttribute('data-tooltip', uiText(key, fallback));
        }
    }
    document.getElementById('sidebar')?.setAttribute('aria-label', uiText('navigation', 'Navigation'));
    const titleEl = document.querySelector('.app-title');
    const subtitleEl = document.querySelector('.app-subtitle');

    if (titleEl) {
        let fullTitle = 'Make Life Easier';
        if (translations.app) {
            if (translations.app.title) {
                fullTitle = translations.app.title;
            } else if (translations.app.title_high || translations.app.title_rest) {
                fullTitle = `${translations.app.title_high || ''}${translations.app.title_rest ? ' ' + translations.app.title_rest : ''}`.trim();
            }
        }
        titleEl.textContent = fullTitle;
    }

    if (subtitleEl) {
        subtitleEl.textContent = (translations.app && translations.app.subtitle) || 'System Management Tools';
    }

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) {
        const currentLangCode = (settings.lang === 'gr' || settings.lang === 'en') ? settings.lang.toUpperCase() : 'EN';
        langToggle.textContent = currentLangCode;

        if (langToggle._toggleListener) {
            langToggle.removeEventListener('click', langToggle._toggleListener);
        }
        const langListener = async () => {
            const newLang = (settings.lang === 'en') ? 'gr' : 'en';
            settings.lang = newLang;
            saveSettings(settings);
            syncPref('lang', newLang);
            const dropdown = document.getElementById('titlebar-menu-dropdown');
            if (dropdown) closePopups();
            translations = await loadTranslations(newLang);
            setTranslations(translations);
            applyTheme();
            renderMenu();
            await ensureSidebarVersion({ settings });
            if (typeof currentPage === 'string' && currentPage) {
                loadPage(currentPage);
            }
        };
        langToggle._toggleListener = langListener;
        langToggle.addEventListener('click', langListener);
    }

    let infoToggle = document.getElementById('info-toggle');
    if (infoToggle) {
        infoToggle.innerHTML = INFO_ICON;
        infoToggle.setAttribute('data-tooltip', uiText('help', 'Help'));
        if (infoToggle._tooltipAttached) {
            const clone = infoToggle.cloneNode(true);
            infoToggle.parentNode.replaceChild(clone, infoToggle);
            infoToggle = clone;
        }

        if (infoToggle._clickListener) {
            infoToggle.removeEventListener('click', infoToggle._clickListener);
        }
        const infoListener = () => {
            const dropdown = document.getElementById('titlebar-menu-dropdown');
            if (dropdown) closePopups();
            openHelp();
        };
        infoToggle._clickListener = infoListener;
        infoToggle.addEventListener('click', infoListener);
    }

    const menuToggleBtn = document.getElementById('menu-toggle');
    const menuDropdown = document.getElementById('titlebar-menu-dropdown');
    if (menuToggleBtn && menuDropdown) {
        menuToggleBtn.innerHTML = MENU_ICON;
        menuToggleBtn.setAttribute('data-tooltip', (translations.pages && translations.pages.menu) || 'Menu');
        attachTooltipHandlers(menuToggleBtn);

        if (!menuToggleBtn._menuBound) {
            menuDropdown.classList.remove('hidden');
            bindMenu(menuToggleBtn, menuDropdown);
            menuToggleBtn._menuBound = true;
        }
    }
    const activityButton = document.getElementById('activity-toggle');
    if (activityButton) {
        activityButton.textContent = uiText('activity', 'Activity');
        if (!activityButton._bound) {
            activityButton.addEventListener('click', openActivityPanel);
            subscribeActivity(() => {
                const count = activities().filter(entry => entry.status === 'running').length;
                activityButton.textContent = uiText('activity', 'Activity') + (count ? ' (' + count + ')' : '');
            });
            activityButton._bound = true;
        }
    }
}


function renderMenu() {
    const menuList = document.getElementById('menu-list');
    if (!menuList) return;

    menuList.innerHTML = '';
    menuGroups.forEach((group) => {
        const heading = document.createElement('li');
        heading.className = 'menu-group-label';
        heading.textContent = uiText(group.key, group.label);
        heading.setAttribute('role', 'presentation');
        menuList.appendChild(heading);
        group.pages.forEach((key) => {
            const label = (translations.menu && translations.menu[key]) || key;
            const li = createMenuButton(key, label);
            const btn = li.querySelector('button[data-key]');
            if (btn) {
                const info = translations.menu_info && translations.menu_info[key];
                btn.setAttribute('data-tooltip', info ? `${label}\n${info}` : label);
                btn.setAttribute('aria-label', label);
                attachTooltipHandlers(btn);
            }
            menuList.appendChild(li);
        });
    });

    if (!menuList._boundClick) {
        menuList.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-key]');
            if (!btn) return;
            loadPage(btn.dataset.key);
        });
        menuList._boundClick = true;
    }

    const defaultButton = menuList.querySelector('button[data-key]');
    const keyToActivate = (typeof currentPage === 'string' && currentPage) ? currentPage : (defaultButton && defaultButton.dataset.key);
    if (keyToActivate) {
        const btnToActivate = menuList.querySelector(`button[data-key="${keyToActivate}"]`);
        if (btnToActivate) {
            btnToActivate.classList.add('active');
            btnToActivate.setAttribute('aria-current', 'page');
        }
    }

    updateHeader();
}


function runPageCleanup(pageRoot) {
    const callbacks = pageRoot && pageRoot._pageCleanup;
    if (!Array.isArray(callbacks)) return;
    pageRoot._pageCleanup = null;
    for (const fn of callbacks) {
        try { fn(); } catch (err) { debug('warn', 'Page cleanup failed:', err); }
    }
}

export async function loadPage(key) {
    hideTooltips();
    closePopups();
    document.querySelectorAll('.ui-drawer-overlay').forEach(node => node._close?.());
    document.querySelectorAll('#menu-list button[data-key]').forEach(button => {
        const active = button.dataset.key === (TOOL_KEYS.includes(key) ? 'tools_hub' : key);
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    const generation = ++pageLoadGeneration;


    document.querySelectorAll('.bios-overlay').forEach((el) => {
        if (typeof el._cleanup === 'function') {
            try { el._cleanup(); } catch {  }
        }
        el.remove();
    });

    currentPage = key;
    setNotificationSource(key);
    configureHelp(translations, key);
    const title = document.getElementById('title-bar-page');
    if (title) {
        const titleIcon = document.createElement('span');
        titleIcon.className = 'title-bar-page-icon';
        titleIcon.innerHTML = MENU_ICONS[key] || MENU_ICONS.christitus;
        const titleLabel = document.createElement('span');
        titleLabel.className = 'title-bar-page-label';
        titleLabel.textContent = translations.menu?.[key] || key;
        title.replaceChildren(titleIcon, titleLabel);
    }

    const content = document.getElementById('content');
    if (!content) return;

    if (content.firstChild) {
        content.classList.add('page-leaving');
        await new Promise(resolve => setTimeout(resolve, 140));
        if (generation !== pageLoadGeneration) return;
    }

    runPageCleanup(content.firstElementChild);

    content.replaceChildren();
    content.classList.remove('page-leaving');
    try {
        let page = null;

        switch (key) {
            case 'tools_hub': { page = buildToolsHub(translations, loadPage); break; }
            case 'install_apps': {
                const { buildInstallPageWingetWithCategories } = await import('./pages/installers.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildInstallPageWingetWithCategories(translations, settings);
                break;
            }

            case 'activate_autologin': {
                const { buildActivateAutologinPage } = await import('./pages/activation.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildActivateAutologinPage(translations, settings);
                break;
            }

            case 'system_maintenance': {
                const { buildMaintenancePage } = await import('./pages/maintenance.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildMaintenancePage(translations, settings);
                break;
            }

            case 'system_cleaner': {
                const { buildCleanerPage } = await import('./pages/cleaner.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildCleanerPage(translations, settings);
                break;
            }

            case 'crack_installer': {
                const { buildCrackInstallerPage } = await import('./pages/installers.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildCrackInstallerPage(translations, settings);
                break;
            }

            case 'spicetify': {
                const { buildSpicetifyPage } = await import('./pages/media.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildSpicetifyPage(translations, settings);
                break;
            }

            case 'debloat': {
                const { buildDebloatPage } = await import('./pages/debloat.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildDebloatPage(translations, settings);
                break;
            }

            case 'christitus': {
                const { buildChrisTitusPage } = await import('./pages/utilities.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildChrisTitusPage(translations, settings);
                break;
            }

            case 'game_saves': {
                const { buildGameSavesPage } = await import('./pages/game-saves.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildGameSavesPage(translations, settings);
                break;
            }

            case 'bios': {
                page = buildBiosPage(translations, () => showRestartDialog(translations, menuKeys, () => {}, { stayOnPage: true }));
                break;
            }

            default:
                return;
        }

        if (generation === pageLoadGeneration && page) {
            if (!PAGES_WITH_OWN_PROGRESS.has(key)) attachPageActivity(page, key);
            if (TOOL_KEYS.includes(key)) page = wrapToolPage(key, page, translations, loadPage);
            content.appendChild(page);
        } else if (page) {
            runPageCleanup(page);
        }
    } catch (err) {
        if (generation !== pageLoadGeneration) return;
        debug('error', 'Failed to load page:', err);
        const fallback = emptyState(uiText('page_failed', 'Failed to load this page.'));
        fallback.append(button(uiText('retry', 'Retry'), () => loadPage(key)));
        content.replaceChildren(fallback);
        toast(uiText('page_failed', 'Failed to load this page.'), { type: 'error', title: translations.menu?.[key] || key, details: err.message });
    }
}


function reportBootProgress(percent, message) {
    try {
        window.api?.updateLoadingProgress?.(percent, message)?.catch?.(() => {});
    } catch {  }
}

export async function init() {
    try {
        reportBootProgress(20, 'Loading settings...');

        await hydratePrefsFromCloud();

        settings = loadSettings();

        initDownloadListener();

        applyTheme();

        reportBootProgress(40, 'Loading translations...');

        translations = await loadTranslations(settings.lang);
        setTranslations(translations);

        reportBootProgress(60, 'Building interface...');

        initTooltips();
        renderMenu();

        await ensureSidebarVersion({ settings });

        reportBootProgress(80, 'Initializing...');

        initializeAutoUpdater();

        const menuList = document.getElementById('menu-list');
        const defaultButton = menuList?.querySelector('button[data-key]');
        if (defaultButton) {
            await loadPage(defaultButton.dataset.key);
        }

        reportBootProgress(95, 'Almost ready...');

        if (window.api && typeof window.api.signalAppReady === 'function') {
            try {
                const targetWidthDefault = DEFAULT_WINDOW_WIDTH;
                const targetHeightDefault = DEFAULT_WINDOW_HEIGHT;
                await window.api.signalAppReady(targetWidthDefault, targetHeightDefault);
                debug('info', 'Signaled app ready to main process');
            } catch (err) {
                debug('warn', 'Failed to signal app ready:', err);
            }
        }

        setTimeout(() => {
            checkForChangelog();
        }, 1500);
    } catch (error) {
        debug('error', 'Initialization error:', error);

        if (window.api && typeof window.api.signalAppReady === 'function') {
            try {
                await window.api.signalAppReady(undefined, undefined, false);
            } catch { }
        }

        toast(uiText("init_failed", "Failed to initialize application"), { type: 'error', title: uiText("error", "Error") });
    }
}

export {
    translations,
    settings,
    menuKeys
};
