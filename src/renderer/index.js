/**
 * Main Entry Point - Renderer Module
 * Initializes the modular renderer system
 */

import { debug } from './utils.js';
import { showErrorCard } from './components.js';
import { init } from './core.js';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application when DOM is ready
 */
async function initializeApp() {
    try {
        debug('info', 'Starting modular renderer initialization...');

        // Initialize the core application (handles auto-updater, changelog, sidebar version internally)
        await init();

        debug('info', 'Modular renderer initialization complete');

    } catch (err) {
        debug('error', 'Failed to initialize application:', err);

        showErrorCard(`Failed to initialize application: ${err.message}`, {
            title: 'Initialization Error'
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
