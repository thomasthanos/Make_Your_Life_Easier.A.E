/**
 * Activation Page
 * Contains Windows Activation and Auto Login functionality
 */

import { buttonStateManager, registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// DOWNLOAD AND RUN HELPERS
// ============================================

async function downloadAndRunActivate(button) {
    if (buttonStateManager && buttonStateManager.isLoading && buttonStateManager.isLoading(button)) return;

    button.disabled = true;
    const originalText = button.textContent;

    button.textContent = 'Preparing activation...';

    const downloadId = `activate-${Date.now()}`;
    const activateUrl = 'https://www.dropbox.com/scl/fi/oqgye14tmcg97mxbphorp/activate.bat?rlkey=307wz4bzkzejip3os7iztt54l&st=oz6nh4pf&dl=1';

    const storeKey = 'activate-script';
    registerDownload(storeKey, downloadId, { name: 'Activation' });

    return new Promise((resolve) => {
        attachDownloadUI(storeKey, (data) => {
            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading activation script... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading activation script... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Running activation script...';
                    downloadStore.delete(storeKey);

                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                button.textContent = 'Activation Started';
                                setTimeout(() => { button.textContent = originalText; }, 3000);
                            } else {
                                button.textContent = originalText;
                                toast('Failed to run activation script', { type: 'error', title: 'Activation' });
                            }
                        })
                        .catch(() => {
                            button.textContent = originalText;
                            toast('Error running activation script', { type: 'error', title: 'Activation' });
                        })
                        .finally(() => {
                            button.disabled = false;
                            resolve();
                        });
                    break;
                }
                case 'error':
                    button.textContent = originalText;
                    button.disabled = false;
                    downloadStore.delete(storeKey);
                    toast('Download failed', { type: 'error', title: 'Activation' });
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, activateUrl, 'activate.bat');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            downloadStore.delete(storeKey);
            toast('Download failed', { type: 'error', title: 'Activation' });
            resolve();
        }
    });
}

async function downloadAndRunAutologin(button) {
    if (buttonStateManager && buttonStateManager.isLoading && buttonStateManager.isLoading(button)) return;

    button.disabled = true;
    const originalText = button.textContent;

    button.textContent = 'Preparing auto login...';

    const downloadId = `autologin-${Date.now()}`;
    const autologinUrl = 'https://www.dropbox.com/scl/fi/a0bphjru0qfnbsokk751h/auto-login.exe?rlkey=b3ogyjelioq49jyty1odi58x9&st=4o2oq4sc&dl=1';

    const storeKey = 'autologin-tool';
    registerDownload(storeKey, downloadId, { name: 'Auto Login' });

    return new Promise((resolve) => {
        attachDownloadUI(storeKey, (data) => {
            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading auto login tool... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading auto login tool... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Running auto login setup...';
                    downloadStore.delete(storeKey);

                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                button.textContent = 'Auto Login Started';
                                setTimeout(() => { button.textContent = originalText; }, 3000);
                            } else {
                                button.textContent = originalText;
                                toast('Failed to run auto login tool', { type: 'error', title: 'Auto Login' });
                            }
                        })
                        .catch(() => {
                            button.textContent = originalText;
                            toast('Error running auto login tool', { type: 'error', title: 'Auto Login' });
                        })
                        .finally(() => {
                            button.disabled = false;
                            resolve();
                        });
                    break;
                }
                case 'error':
                    button.textContent = originalText;
                    button.disabled = false;
                    downloadStore.delete(storeKey);
                    toast('Download failed', { type: 'error', title: 'Auto Login' });
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, autologinUrl, 'auto_login.exe');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            downloadStore.delete(storeKey);
            toast('Download failed', { type: 'error', title: 'Auto Login' });
            resolve();
        }
    });
}

// ============================================
// PAGE BUILDER
// ============================================

export async function buildActivateAutologinPage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const title = document.createElement('h2');
    title.textContent = (translations.pages && translations.pages.activate_title) || 'Windows Activation & Auto Login';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = (translations.pages && translations.pages.activate_desc) || 'Use these tools to activate Windows and configure automatic login without a password.';
    desc.classList.add('page-desc');
    container.appendChild(desc);

    // Activate Windows Card
    const activateCard = document.createElement('div');
    activateCard.className = 'app-card fixed-height';

    const activateHeader = document.createElement('div');
    activateHeader.className = 'app-header';

    const activateIcon = document.createElement('div');
    activateIcon.classList.add('feature-card-icon');
    activateIcon.textContent = '🔓';
    activateHeader.appendChild(activateIcon);

    const activateText = document.createElement('div');
    const activateName = document.createElement('h3');
    activateName.textContent = (translations.activation && translations.activation.activate_windows) || 'Activate Windows';
    activateName.classList.add('feature-card-name');
    if (settings.lang === 'gr') {
        activateName.classList.add('feature-card-name-gr');
    }
    const activateDesc = document.createElement('p');
    activateDesc.textContent = (translations.activation && translations.activation.activate_desc) || 'Downloads and runs the Windows activation script. Administrator rights required';
    activateDesc.classList.add('feature-card-desc-warning');
    activateText.appendChild(activateName);
    activateText.appendChild(activateDesc);
    activateHeader.appendChild(activateText);

    activateCard.appendChild(activateHeader);

    const activateActions = document.createElement('div');
    activateActions.className = 'feature-actions';

    const activateButton = document.createElement('button');
    activateButton.className = 'button';
    activateButton.textContent = (translations.actions && translations.actions.activate_windows) || 'Download & Activate Windows';
    activateButton.classList.add('btn-full-width');

    activateButton.addEventListener('click', async () => {
        await downloadAndRunActivate(activateButton);
    });

    activateActions.appendChild(activateButton);
    activateCard.appendChild(activateActions);

    // Auto Login Card
    const autologinCard = document.createElement('div');
    autologinCard.className = 'app-card fixed-height';

    const autologinHeader = document.createElement('div');
    autologinHeader.className = 'app-header';

    const autologinIcon = document.createElement('div');
    autologinIcon.classList.add('feature-card-icon');
    autologinIcon.textContent = '🚀';
    autologinHeader.appendChild(autologinIcon);

    const autologinText = document.createElement('div');
    const autologinName = document.createElement('h3');
    autologinName.textContent = (translations.activation && translations.activation.auto_login) || 'Auto Login';
    autologinName.classList.add('feature-card-name');
    const autologinDesc = document.createElement('p');
    autologinDesc.textContent = (translations.activation && translations.activation.auto_login_desc) || 'Downloads and sets up automatic login without a password';
    autologinDesc.classList.add('feature-card-desc');
    autologinText.appendChild(autologinName);
    autologinText.appendChild(autologinDesc);
    autologinHeader.appendChild(autologinText);

    autologinCard.appendChild(autologinHeader);

    const autologinActions = document.createElement('div');
    autologinActions.className = 'feature-actions';

    const autologinButton = document.createElement('button');
    autologinButton.className = 'button';
    autologinButton.textContent = (translations.actions && translations.actions.setup_autologin) || 'Download & Setup Auto Login';
    autologinButton.classList.add('btn-full-width');

    autologinButton.addEventListener('click', async () => {
        await downloadAndRunAutologin(autologinButton);
    });

    autologinActions.appendChild(autologinButton);
    autologinCard.appendChild(autologinActions);

    // Grid layout
    const grid = document.createElement('div');
    grid.className = 'install-grid';
    grid.classList.add('grid-2-col');

    grid.appendChild(activateCard);
    grid.appendChild(autologinCard);

    container.appendChild(grid);

    return container;
}
