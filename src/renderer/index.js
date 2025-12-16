/**
 * Main Entry Point - Renderer Module
 * Initializes the modular renderer system
 */

// Core Utilities
import {
    debug,
    escapeHtml,
    debounce,
    getDirectoryName,
    getBaseName,
    getExtractedFolderPath,
    normalizeVersion,
    normalizeVersionTag,
    getAppVersionWithFallback,
    svgDataUrl,
    autoFadeStatus,
    createModernButton,
    createCard
} from './utils.js';

// Managers
import {
    ButtonStateManager,
    EventListenerManager,
    tooltipManager,
    attachTooltipHandlers,
    processStates,
    trackProcess,
    completeProcess,
    buttonStateManager
} from './managers.js';

// Components
import {
    SUN_ICON,
    MOON_ICON,
    INFO_ICON,
    MENU_ICON,
    MENU_ICONS,
    toast,
    ensureToastContainer,
    dismissToast,
    showErrorCard,
    ensureErrorContainer,
    showUpdateOverlay,
    updateUpdateOverlay,
    hideUpdateOverlay,
    showAppLoader,
    hideAppLoader,
    openInfoModal,
    createMenuButton,
    showNotification
} from './components.js';

// Services
import {
    loadSettings,
    saveSettings,
    applyTheme,
    loadTranslations,
    getTranslations,
    setTranslations,
    resizeWindowSmooth,
    initializeAutoUpdater,
    shouldShowChangelog,
    markChangelogShown,
    fetchReleaseNotesFromGithub,
    parseMarkdown,
    formatReleaseNotes,
    showChangelog,
    checkForChangelog,
    ensureSidebarVersion,
    CUSTOM_APPS
} from './services.js';

// Core
import {
    getCurrentPage,
    getSettings,
    getButtonStateManager,
    getPageEventManager,
    renderMenu,
    loadPage,
    init,
    translations,
    settings,
    pageEventManager,
    menuKeys,
    updateHeader,
    setHeader
} from './core.js';

// Page Modules - Import for reference (used dynamically in core.js)
// These are loaded dynamically to avoid circular dependencies
// import { buildActivateAutologinPage } from './pages/activation.js';
// import { buildInstallPageWingetWithCategories, buildCrackInstallerPage } from './pages/installers.js';
// import { buildMaintenancePage, buildDebloatPage, buildBiosPage } from './pages/tools.js';
// import { buildSpicetifyPage, buildDlcUnlockerPage } from './pages/media.js';
// import { buildPasswordManagerPage, buildChrisTitusPage } from './pages/utilities.js';

// ============================================
// GLOBAL EXPORTS (for backward compatibility)
// ============================================

// Make key functions available globally
if (typeof window !== 'undefined') {
    // Toast system
    window.toast = toast;
    window.showToast = toast;
    window.dismissToast = dismissToast;

    // Notifications
    window.showNotification = showNotification;

    // Error handling
    window.showErrorCard = showErrorCard;

    // Debugging
    window.debug = debug;

    // Settings
    window.loadSettings = loadSettings;
    window.saveSettings = saveSettings;
    window.applyTheme = applyTheme;

    // Translations
    window.loadTranslations = loadTranslations;
    window.getTranslations = getTranslations;

    // App Loader
    window.showAppLoader = showAppLoader;
    window.hideAppLoader = hideAppLoader;

    // Update Overlay
    window.showUpdateOverlay = showUpdateOverlay;
    window.updateUpdateOverlay = updateUpdateOverlay;
    window.hideUpdateOverlay = hideUpdateOverlay;

    // Changelog
    window.showChangelog = showChangelog;
    window.checkForChangelog = checkForChangelog;

    // Page Navigation
    window.loadPage = loadPage;
    window.renderMenu = renderMenu;

    // Utilities
    window.escapeHtml = escapeHtml;
    window.debounce = debounce;

    // Version utilities
    window.normalizeVersion = normalizeVersion;
    window.getAppVersionWithFallback = getAppVersionWithFallback;
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application when DOM is ready
 */
async function initializeApp() {
    try {
        debug('info', 'Starting modular renderer initialization...');

        // Show app loader during initialization
        showAppLoader();

        // Initialize the core application
        await init();

        // Initialize auto-updater if available
        if (typeof initializeAutoUpdater === 'function') {
            initializeAutoUpdater();
        }

        // Check for changelog to show
        if (typeof checkForChangelog === 'function') {
            await checkForChangelog();
        }

        // Ensure sidebar version is displayed
        if (typeof ensureSidebarVersion === 'function') {
            ensureSidebarVersion();
        }

        // Hide app loader
        hideAppLoader();

        debug('info', 'Modular renderer initialization complete');

    } catch (err) {
        debug('error', 'Failed to initialize application:', err);
        hideAppLoader();

        showErrorCard({
            title: 'Initialization Error',
            message: `Failed to initialize application: ${err.message}`,
            details: err.stack
        });
    }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM already loaded
    initializeApp();
}

// ============================================
// EXPORTS
// ============================================

export {
    // Utils
    debug,
    escapeHtml,
    debounce,
    getDirectoryName,
    getBaseName,
    getExtractedFolderPath,
    normalizeVersion,
    normalizeVersionTag,
    getAppVersionWithFallback,
    svgDataUrl,
    autoFadeStatus,
    createModernButton,
    createCard,

    // Managers
    ButtonStateManager,
    EventListenerManager,
    tooltipManager,
    attachTooltipHandlers,
    processStates,
    trackProcess,
    completeProcess,
    MENU_ICONS,

    // Components
    SUN_ICON,
    MOON_ICON,
    INFO_ICON,
    MENU_ICON,
    toast,
    ensureToastContainer,
    dismissToast,
    showErrorCard,
    ensureErrorContainer,
    showUpdateOverlay,
    updateUpdateOverlay,
    hideUpdateOverlay,
    showAppLoader,
    hideAppLoader,
    openInfoModal,
    createMenuButton,
    showNotification,

    // Services
    loadSettings,
    saveSettings,
    applyTheme,
    loadTranslations,
    getTranslations,
    setTranslations,
    resizeWindowSmooth,
    initializeAutoUpdater,
    shouldShowChangelog,
    markChangelogShown,
    fetchReleaseNotesFromGithub,
    parseMarkdown,
    formatReleaseNotes,
    showChangelog,
    checkForChangelog,
    ensureSidebarVersion,
    CUSTOM_APPS,

    // Core
    getCurrentPage,
    getSettings,
    getButtonStateManager,
    getPageEventManager,
    renderMenu,
    loadPage,
    init,
    translations,
    settings,
    buttonStateManager,
    pageEventManager,
    menuKeys,
    updateHeader,
    setHeader,

    // App Initialization
    initializeApp
};
