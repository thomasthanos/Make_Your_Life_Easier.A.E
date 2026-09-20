import { uiText } from './ui-text.js';
import { initTooltips, hideTooltips } from './tooltips.js';

import { debug } from './utils.js';
import { attachTooltipHandlers, buttonStateManager, detachAllDownloadUI, initDownloadListener } from './managers.js';
import { INFO_ICON, MENU_ICON, toast, openInfoModal, createMenuButton } from './components.js';
import {
    loadSettings, saveSettings, applyTheme, loadTranslations, setTranslations,
    initializeAutoUpdater, ensureSidebarVersion, checkForChangelog,
    syncPref, hydratePrefsFromCloud
} from './services.js';

const DEFAULT_WINDOW_WIDTH = 1100;
const DEFAULT_WINDOW_HEIGHT = 750;


let currentPage = null;
let pageLoadGeneration = 0;
let translations = {};
let settings = {};


const menuGroups = [
    { key: 'nav_apps', label: 'Applications', pages: ['install_apps', 'crack_installer'] },
    { key: 'nav_system', label: 'System', pages: ['system_cleaner', 'system_maintenance', 'activate_autologin', 'bios'] },
    { key: 'nav_tools', label: 'Tools', pages: ['spicetify', 'christitus', 'debloat', 'game_saves'] }
];
const menuKeys = menuGroups.flatMap(group => group.pages);


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
            if (dropdown) dropdown.classList.add('hidden');
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
            if (dropdown) dropdown.classList.add('hidden');
            openInfoModal();
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

        if (menuToggleBtn._clickListener) {
            menuToggleBtn.removeEventListener('click', menuToggleBtn._clickListener);
        }
        const menuToggleListener = (e) => {
            e.stopPropagation();
            menuDropdown.classList.toggle('hidden');
        };
        menuToggleBtn._clickListener = menuToggleListener;
        menuToggleBtn.addEventListener('click', menuToggleListener);
    }

    if (!document._menuOutsideHandler) {
        document._menuOutsideHandler = (event) => {
            const dropdownEl = document.getElementById('titlebar-menu-dropdown');
            const menuBtnEl = document.getElementById('menu-toggle');
            if (!dropdownEl || dropdownEl.classList.contains('hidden')) return;
            if (!dropdownEl.contains(event.target) && event.target !== menuBtnEl) {
                dropdownEl.classList.add('hidden');
            }
        };
        document.addEventListener('click', document._menuOutsideHandler);
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
    document.querySelectorAll('#menu-list button[data-key]').forEach(button => {
        const active = button.dataset.key === key;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    const generation = ++pageLoadGeneration;

    detachAllDownloadUI();

    buttonStateManager.resetAll();

    document.querySelectorAll('.bios-overlay').forEach((el) => {
        if (typeof el._cleanup === 'function') {
            try { el._cleanup(); } catch {  }
        }
        el.remove();
    });

    currentPage = key;

    const content = document.getElementById('content');
    if (!content) return;

    if (content.firstChild) {
        content.classList.add('page-leaving');
        await new Promise(resolve => setTimeout(resolve, 140));
        if (generation !== pageLoadGeneration) return;
    }

    const targetWidth = DEFAULT_WINDOW_WIDTH;
    const targetHeight = DEFAULT_WINDOW_HEIGHT;

    try {
        if (window.api && typeof window.api.setWindowSize === 'function') {
            await window.api.setWindowSize(targetWidth, targetHeight);
        }
    } catch { }

    if (generation !== pageLoadGeneration) return;

    runPageCleanup(content.firstElementChild);

    content.replaceChildren();
    content.classList.remove('page-leaving');
    try {
        let page = null;

        switch (key) {
            case 'install_apps': {
                const { buildInstallPageWingetWithCategories } = await import('./pages/installers.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildInstallPageWingetWithCategories(translations, settings, buttonStateManager);
                break;
            }

            case 'activate_autologin': {
                const { buildActivateAutologinPage } = await import('./pages/activation.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildActivateAutologinPage(translations, settings, buttonStateManager);
                break;
            }

            case 'system_maintenance': {
                const { buildMaintenancePage } = await import('./pages/tools.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildMaintenancePage(translations, settings, buttonStateManager);
                break;
            }

            case 'system_cleaner': {
                const { buildCleanerPage } = await import('./pages/tools.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildCleanerPage(translations, settings, buttonStateManager);
                break;
            }

            case 'crack_installer': {
                const { buildCrackInstallerPage } = await import('./pages/installers.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildCrackInstallerPage(translations, settings, buttonStateManager);
                break;
            }

            case 'spicetify': {
                const { buildSpicetifyPage } = await import('./pages/media.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildSpicetifyPage(translations, settings, buttonStateManager);
                break;
            }

            case 'debloat': {
                const { buildDebloatPage } = await import('./pages/tools.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildDebloatPage(translations, settings, buttonStateManager);
                break;
            }

            case 'christitus': {
                const { buildChrisTitusPage } = await import('./pages/utilities.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildChrisTitusPage(translations, settings, buttonStateManager);
                break;
            }

            case 'game_saves': {
                const { buildGameSavesPage } = await import('./pages/game-saves.js');
                if (generation !== pageLoadGeneration) return;
                page = await buildGameSavesPage(translations, settings, buttonStateManager);
                break;
            }

            case 'bios': {
                const { showRestartDialog } = await import('./pages/tools.js');
                if (generation !== pageLoadGeneration) return;
                showRestartDialog(translations, menuKeys, loadPage);
                return;
            }

            default:
                return;
        }

        if (generation === pageLoadGeneration && page) {
            content.appendChild(page);
        } else if (page) {
            runPageCleanup(page);
        }
    } catch (err) {
        if (generation !== pageLoadGeneration) return;
        debug('error', 'Failed to load page:', err);
        toast(uiText("page_failed", "Failed to load this page."), { type: 'error', title: uiText("error", "Error") });
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
