/**
 * Activation Page
 * Contains Windows Activation and Auto Login functionality
 */

import { debug } from '../utils.js';
import { buttonStateManager, trackProcess, completeProcess } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// DOWNLOAD AND RUN HELPERS
// ============================================

async function downloadAndRunActivate(button, statusElement) {
    // Race condition protection
    if (buttonStateManager && buttonStateManager.isLoading && buttonStateManager.isLoading(button)) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.dataset.originalTextActivate = originalText;

    statusElement.classList.remove('visible');
    statusElement.classList.add('status-element');
    statusElement.textContent = '';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    button.textContent = 'Preparing activation...';

    const downloadId = `activate-${Date.now()}`;
    const activateUrl = 'https://www.dropbox.com/scl/fi/oqgye14tmcg97mxbphorp/activate.bat?rlkey=307wz4bzkzejip3os7iztt54l&st=oz6nh4pf&dl=1';

    return new Promise((resolve) => {
        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== downloadId) return;

            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading activation script... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading activation script... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Running activation script...';

                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result.success) {
                                button.textContent = 'Activation Started';
                                statusElement.textContent = '';
                                statusElement.classList.remove('visible');
                                statusElement.classList.add('status-element');
                            } else {
                                button.textContent = originalText;
                                statusElement.textContent = '';
                                statusElement.classList.remove('visible');
                                statusElement.classList.add('status-element');
                                toast('Failed to run activation script', { type: 'error', title: 'Activation' });
                            }
                        })
                        .catch((err) => {
                            button.textContent = originalText;
                            statusElement.textContent = '';
                            statusElement.classList.remove('visible');
                            statusElement.classList.add('status-element');
                            toast('Error running activation script', { type: 'error', title: 'Activation' });
                        })
                        .finally(() => {
                            button.disabled = false;
                            unsubscribe();
                            resolve();
                        });
                    break;
                }
                case 'error':
                    button.textContent = originalText;
                    button.disabled = false;
                    statusElement.textContent = '';
                    statusElement.classList.remove('visible');
                    statusElement.classList.add('status-element');
                    toast('Download failed', { type: 'error', title: 'Activation' });
                    unsubscribe();
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, activateUrl, 'activate.bat');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            statusElement.textContent = '';
            statusElement.classList.remove('visible');
            statusElement.classList.add('status-element');
            toast('Download failed', { type: 'error', title: 'Activation' });
            unsubscribe();
            resolve();
        }
    });
}

async function downloadAndRunAutologin(button, statusElement) {
    // Race condition protection
    if (buttonStateManager && buttonStateManager.isLoading && buttonStateManager.isLoading(button)) return;

    button.disabled = true;
    const originalText = button.textContent;
    button.dataset.originalTextAutologin = originalText;

    statusElement.classList.remove('visible');
    statusElement.classList.add('status-element');
    statusElement.textContent = '';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    button.textContent = 'Preparing auto login...';

    const downloadId = `autologin-${Date.now()}`;
    const autologinUrl = 'https://www.dropbox.com/scl/fi/a0bphjru0qfnbsokk751h/auto-login.exe?rlkey=b3ogyjelioq49jyty1odi58x9&st=4o2oq4sc&dl=1';

    return new Promise((resolve) => {
        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== downloadId) return;

            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading auto login tool... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading auto login tool... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Running auto login setup...';

                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result.success) {
                                button.textContent = 'Auto Login Started';
                                statusElement.textContent = '';
                                statusElement.classList.remove('visible');
                                statusElement.classList.add('status-element');
                            } else {
                                button.textContent = originalText;
                                statusElement.textContent = '';
                                statusElement.classList.remove('visible');
                                statusElement.classList.add('status-element');
                                toast('Failed to run auto login tool', { type: 'error', title: 'Auto Login' });
                            }
                        })
                        .catch((err) => {
                            button.textContent = originalText;
                            statusElement.textContent = '';
                            statusElement.classList.remove('visible');
                            statusElement.classList.add('status-element');
                            toast('Error running auto login tool', { type: 'error', title: 'Auto Login' });
                        })
                        .finally(() => {
                            button.disabled = false;
                            unsubscribe();
                            resolve();
                        });
                    break;
                }
                case 'error':
                    button.textContent = originalText;
                    button.disabled = false;
                    statusElement.textContent = '';
                    statusElement.classList.remove('visible');
                    statusElement.classList.add('status-element');
                    toast('Download failed', { type: 'error', title: 'Auto Login' });
                    unsubscribe();
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, autologinUrl, 'auto_login.exe');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            statusElement.textContent = '';
            statusElement.classList.remove('visible');
            statusElement.classList.add('status-element');
            toast('Download failed', { type: 'error', title: 'Auto Login' });
            unsubscribe();
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

    const activateStatus = document.createElement('pre');
    activateStatus.className = 'status-pre';
    activateStatus.classList.add('status-element');

    activateButton.addEventListener('click', async () => {
        await downloadAndRunActivate(activateButton, activateStatus);
    });

    activateActions.appendChild(activateButton);
    activateActions.appendChild(activateStatus);
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

    const autologinStatus = document.createElement('pre');
    autologinStatus.className = 'status-pre';
    autologinStatus.classList.add('status-element');

    autologinButton.addEventListener('click', async () => {
        await downloadAndRunAutologin(autologinButton, autologinStatus);
    });

    autologinActions.appendChild(autologinButton);
    autologinActions.appendChild(autologinStatus);
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

export { downloadAndRunActivate, downloadAndRunAutologin };
