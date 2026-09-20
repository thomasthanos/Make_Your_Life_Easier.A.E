
import { debug } from './utils.js';
import { showErrorCard } from './components.js';
import { init } from './core.js';


async function initializeApp() {
    try {
        debug('info', 'Starting modular renderer initialization...');

        await init();

        debug('info', 'Modular renderer initialization complete');

    } catch (err) {
        debug('error', 'Failed to initialize application:', err);

        showErrorCard(`Failed to initialize application: ${err.message}`, {
            title: 'Initialization Error'
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
