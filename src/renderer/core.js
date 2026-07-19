/**
 * Renderer Core
 * Contains page loading, initialization, and main application state
 */

import { debug } from './utils.js';
import { attachTooltipHandlers, buttonStateManager, detachAllDownloadUI, initDownloadListener } from './managers.js';
import { INFO_ICON, MENU_ICON, toast, openInfoModal, createMenuButton, hideAppLoader } from './components.js';
import {
    loadSettings, saveSettings, applyTheme, loadTranslations, setTranslations,
    initializeAutoUpdater, ensureSidebarVersion, checkForChangelog,
    syncPref, hydratePrefsFromCloud
} from './services.js';

// Default window dimensions (must match window-manager.js MAIN_WINDOW)
const DEFAULT_WINDOW_WIDTH = 1100;
const DEFAULT_WINDOW_HEIGHT = 750;

// ============================================
// APPLICATION STATE
// ============================================

let currentPage = null;
let translations = {};
let settings = {};

// Use singleton buttonStateManager from managers.js (imported above)

// Menu keys for sidebar navigation
const menuKeys = [
    'install_apps',
    'system_cleaner',
    'crack_installer',
    'system_maintenance',
    'activate_autologin',
    'bios',
    'spicetify',
    'christitus',
    'debloat'
];

// ============================================
// HEADER UPDATE
// ============================================

function updateHeader() {
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
        infoToggle.removeAttribute('data-tooltip');
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

// ============================================
// MENU RENDERING
// ============================================

function renderMenu() {
    const menuList = document.getElementById('menu-list');
    if (!menuList) return;

    menuList.innerHTML = '';
    const separatorsAfter = {
        crack_installer: 'large',
        bios: 'small',
        debloat: 'small'
    };

    menuKeys.forEach((key) => {
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
        const sepType = separatorsAfter[key];
        if (sepType) {
            const sepLi = document.createElement('li');
            sepLi.className = 'menu-separator';
            if (sepType === 'large') sepLi.classList.add('menu-separator-large');
            menuList.appendChild(sepLi);
        }
    });

    if (!menuList._boundClick) {
        menuList.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-key]');
            if (!btn) return;
            document.querySelectorAll('#menu-list button.active')
                .forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
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
        }
    }

    updateHeader();
}

// ============================================
// PAGE LOADING
// ============================================

export async function loadPage(key) {
    // Detach download UI callbacks before destroying DOM (downloads continue in background)
    detachAllDownloadUI();

    // Cleanup previous page's button states
    buttonStateManager.resetAll();

    document.querySelectorAll('.bios-overlay').forEach((el) => el.remove());

    // Cleanup any pending debounced functions from previous page
    const prevSearchInput = document.querySelector('.search-input-styled');
    if (prevSearchInput && typeof prevSearchInput._searchCleanup === 'function') {
        prevSearchInput._searchCleanup();
    }

    currentPage = key;

    const content = document.getElementById('content');
    if (!content) return;
    
    // Single consistent window width (no per-page resize)
    const targetWidth = DEFAULT_WINDOW_WIDTH;
    const targetHeight = DEFAULT_WINDOW_HEIGHT;
    
    // Resize BEFORE changing content so old content fills the new size
    try {
        if (window.api && typeof window.api.setWindowSize === 'function') {
            await window.api.setWindowSize(targetWidth, targetHeight);
            // Small delay to let window resize complete
            await new Promise(resolve => setTimeout(resolve, 16));
        }
    } catch { }

    // Now clear and load new content
    content.innerHTML = '';
    try {
    // Import page builders dynamically to avoid circular dependencies
    const { buildInstallPageWingetWithCategories, buildCrackInstallerPage } = await import('./pages/installers.js');
    const { buildActivateAutologinPage } = await import('./pages/activation.js');
    const { buildCleanerPage, buildMaintenancePage, buildDebloatPage, showRestartDialog } = await import('./pages/tools.js');
    const { buildSpicetifyPage } = await import('./pages/media.js');
    const { buildChrisTitusPage } = await import('./pages/utilities.js');

    switch (key) {
        case 'install_apps': {
            content.appendChild(await buildInstallPageWingetWithCategories(translations, settings, buttonStateManager));
            break;
        }

        case 'activate_autologin': {
            content.appendChild(await buildActivateAutologinPage(translations, settings, buttonStateManager));
            break;
        }

        case 'system_maintenance': {
            content.appendChild(await buildMaintenancePage(translations, settings, buttonStateManager));
            break;
        }

        case 'system_cleaner': {
            content.appendChild(await buildCleanerPage(translations, settings, buttonStateManager));
            break;
        }

        case 'crack_installer': {
            content.appendChild(await buildCrackInstallerPage(translations, settings, buttonStateManager));
            break;
        }

        case 'spicetify': {
            content.appendChild(await buildSpicetifyPage(translations, settings, buttonStateManager));
            break;
        }

        case 'debloat': {
            content.appendChild(await buildDebloatPage(translations, settings, buttonStateManager));
            break;
        }

        case 'christitus': {
            content.appendChild(await buildChrisTitusPage(translations, settings, buttonStateManager));
            break;
        }

        case 'bios': {
            content.innerHTML = '';
            showRestartDialog(translations, menuKeys, loadPage);
            break;
        }

        default:
            content.textContent = '';
    }
    } catch (err) {
        debug('error', 'Failed to load page:', err);
        toast('Failed to load this page.', { type: 'error', title: 'Error' });
    }
}

// ============================================
// INITIALIZATION
// ============================================

export async function init() {
    try {
        // Report progress: Loading settings
        if (window.api?.updateLoadingProgress) {
            await window.api.updateLoadingProgress(20, 'Loading settings...').catch(() => {});
        }

        await hydratePrefsFromCloud();

        // Load settings
        settings = loadSettings();

        // Initialize persistent download event listener (survives page switches)
        initDownloadListener();

        // Apply theme
        applyTheme();
        
        // Report progress: Loading translations
        if (window.api?.updateLoadingProgress) {
            await window.api.updateLoadingProgress(40, 'Loading translations...').catch(() => {});
        }

        // Load translations
        translations = await loadTranslations(settings.lang);
        setTranslations(translations);
        
        // Report progress: Building UI
        if (window.api?.updateLoadingProgress) {
            await window.api.updateLoadingProgress(60, 'Building interface...').catch(() => {});
        }

        // Render menu
        renderMenu();

        // Ensure sidebar version is displayed
        await ensureSidebarVersion({ settings });
        
        // Report progress: Initializing
        if (window.api?.updateLoadingProgress) {
            await window.api.updateLoadingProgress(80, 'Initializing...').catch(() => {});
        }

        // Initialize auto-updater
        initializeAutoUpdater();

        // Load default page
        const menuList = document.getElementById('menu-list');
        const defaultButton = menuList?.querySelector('button[data-key]');
        if (defaultButton) {
            await loadPage(defaultButton.dataset.key);
        }
        
        // Report progress: Almost ready
        if (window.api?.updateLoadingProgress) {
            await window.api.updateLoadingProgress(95, 'Almost ready...').catch(() => {});

            // Small delay to allow 95% to render before jumping to 100%
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Signal to main process that app is ready FIRST (for updater window transition)
        if (window.api && typeof window.api.signalAppReady === 'function') {
            try {
                // Determine target size for the default page so main can size the window before showing it
                const targetWidthDefault = DEFAULT_WINDOW_WIDTH;
                const targetHeightDefault = DEFAULT_WINDOW_HEIGHT;
                await window.api.signalAppReady(targetWidthDefault, targetHeightDefault);
                debug('info', 'Signaled app ready to main process');
            } catch (err) {
                debug('warn', 'Failed to signal app ready:', err);
            }
        }
        
        // Check for changelog after everything is ready
        setTimeout(() => {
            checkForChangelog();
        }, 1500);
    } catch (error) {
        debug('error', 'Initialization error:', error);
        
        // Signal app ready even on error, to close update window
        if (window.api && typeof window.api.signalAppReady === 'function') {
            try {
                await window.api.signalAppReady();
            } catch { }
        }
        
        hideAppLoader();
        toast('Failed to initialize application', { type: 'error', title: 'Error' });
    }
}

// Export for global access
export {
    translations,
    settings,
    menuKeys
};
