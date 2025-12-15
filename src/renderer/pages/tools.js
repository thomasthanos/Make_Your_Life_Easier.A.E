/**
 * Tools Page
 * Contains System Maintenance, Debloat, and BIOS pages
 * CSS classes match original renderer.js structure
 */

import { debug, escapeHtml, autoFadeStatus } from '../utils.js';
import { buttonStateManager } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// MAINTENANCE HELPER FUNCTIONS
// ============================================

/**
 * Creates a maintenance card with exact original CSS structure
 * @param {string} name - Card title
 * @param {string} description - Card description
 * @param {string} icon - Emoji icon
 * @param {string} buttonText - Button label
 * @param {Function} taskFunction - Function to execute
 * @param {boolean} requiresAdmin - Show admin warning
 * @param {boolean} hideStatus - Hide status element
 */
function createMaintenanceCard(name, description, icon, buttonText, taskFunction, requiresAdmin = false, hideStatus = false) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.classList.add('feature-card');

    const header = document.createElement('div');
    header.className = 'app-header';

    const iconEl = document.createElement('div');
    iconEl.classList.add('feature-card-icon');
    iconEl.textContent = icon;
    header.appendChild(iconEl);

    const text = document.createElement('div');
    const nameEl = document.createElement('h3');
    nameEl.textContent = name;
    nameEl.classList.add('feature-card-name');
    const descEl = document.createElement('p');
    descEl.textContent = description;
    descEl.classList.add('feature-card-desc');

    if (requiresAdmin) {
        const adminWarning = document.createElement('small');
        adminWarning.textContent = ' (Admin required)';
        adminWarning.classList.add('admin-warning');
        descEl.appendChild(adminWarning);
    }

    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);

    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = buttonText;
    button.classList.add('btn-full-width');

    const status = document.createElement('pre');
    status.className = 'status-pre';
    status.classList.remove('visible');

    if (hideStatus) {
        status.dataset.hideStatus = 'true';
    }

    button.addEventListener('click', async () => {
        await runMaintenanceTask(button, status, taskFunction, name, requiresAdmin);
    });

    card.appendChild(header);
    card.appendChild(button);
    card.appendChild(status);

    return card;
}

/**
 * Runs a maintenance task with proper button/status handling
 */
async function runMaintenanceTask(button, statusElement, taskFunction, taskName, requiresAdmin = false) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Running...';
    const hideStatus = statusElement && statusElement.dataset && statusElement.dataset.hideStatus === 'true';

    if (!hideStatus) {
        statusElement.classList.add('visible');
        if (requiresAdmin) {
            statusElement.textContent = `Running ${taskName}...\n⚠️ This task may require Administrator privileges\n`;
        } else {
            statusElement.textContent = `Running ${taskName}...\n`;
        }
        statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    }

    try {
        await taskFunction(statusElement, button);
    } catch (error) {
        if (!hideStatus) {
            statusElement.textContent += `\n❌ Error: ${error.message}`;
            statusElement.classList.add('status-error');
        }
        toast(`Error running ${taskName}`, { type: 'error', title: 'Maintenance' });
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        if (!hideStatus) {
            autoFadeStatus(statusElement, 8000);
        }
    }
}

// ============================================
// MAINTENANCE TASK FUNCTIONS
// ============================================

async function runSfcScan(statusElement) {
    try {
        const result = await window.api.runSfcScan();
        if (result && result.success) {
            toast(result.message || 'SFC scan completed successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            toast((result && result.error) || 'SFC scan failed.', { type: 'error', title: 'Maintenance' });
        }
    } catch (error) {
        const msg = (error && error.message) || 'Error running SFC scan';
        toast(msg, { type: 'error', title: 'Maintenance' });
    }
}

async function runDismRepair(statusElement) {
    try {
        const result = await window.api.runDismRepair();
        if (result && result.success) {
            toast(result.message || 'DISM repair completed successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            toast((result && result.error) || 'DISM repair failed.', { type: 'error', title: 'Maintenance' });
        }
    } catch (error) {
        const msg = (error && error.message) || 'Error running DISM repair';
        toast(msg, { type: 'error', title: 'Maintenance' });
    }
}

async function cleanTempFiles(statusElement) {
    try {
        const result = await window.api.runTempCleanup();
        if (result && result.success) {
            toast(result.message || 'Temporary files cleanup completed successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            const errorMsg = (result && result.error) || 'Temporary files cleanup failed.';
            toast(errorMsg, { type: 'error', title: 'Maintenance' });
        }
    } catch (error) {
        const msg = (error && error.message) || 'Error running temp cleanup';
        toast(msg, { type: 'error', title: 'Maintenance' });
    }
}

async function downloadAndRunPatchMyPC(statusElement, button) {
    if (buttonStateManager.isLoading(button)) return;

    const downloadId = `patchmypc-${Date.now()}`;
    const patchMyPCUrl = 'https://www.dropbox.com/scl/fi/z66qn3wgiyvh8uy3fedu7/patch_my_pc.exe?rlkey=saht980hb3zfezv2ixve697jo&st=3ww4r4vy&dl=1';

    statusElement.textContent = '';
    statusElement.classList.remove('visible');
    statusElement.classList.add('status-element');
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    const originalText = button.textContent;
    if (!button.dataset.originalTextPatch) {
        button.dataset.originalTextPatch = originalText;
    }

    button.disabled = true;
    button.textContent = 'Preparing Patch My PC...';

    return new Promise((resolve) => {
        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== downloadId) return;

            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading Patch My PC... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading Patch My PC... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Opening Patch My PC...';
                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result.success) {
                                button.textContent = 'Patch My PC Started';
                            } else {
                                button.textContent = originalText;
                                toast('Failed to open Patch My PC', { type: 'error', title: 'Maintenance' });
                            }
                        })
                        .catch((error) => {
                            button.textContent = originalText;
                            toast('Error opening Patch My PC', { type: 'error', title: 'Maintenance' });
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
                    toast('Download failed', { type: 'error', title: 'Maintenance' });
                    unsubscribe();
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, patchMyPCUrl, 'PatchMyPC.exe');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            toast('Download failed', { type: 'error', title: 'Maintenance' });
            unsubscribe();
            resolve();
        }
    });
}

// ============================================
// SYSTEM MAINTENANCE PAGE
// ============================================

export async function buildMaintenancePage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const title = document.createElement('h2');
    title.textContent = translations.pages?.maintenance_title || 'System Maintenance';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = translations.pages?.maintenance_desc || 'Perform various system maintenance tasks to keep your computer running smoothly.';
    desc.classList.add('desc-margin-large');
    container.appendChild(desc);

    // First Row - Temp Files + SFC/DISM
    const firstRow = document.createElement('div');
    firstRow.className = 'maintenance-row';
    firstRow.classList.add('grid-2-col-margin');

    // Temp Files Card
    const tempCard = createMaintenanceCard(
        translations.maintenance?.delete_temp_files || 'Delete Temp Files',
        translations.maintenance?.temp_files_desc || 'Clean TEMP, %TEMP%, and Prefetch folders',
        '🧹',
        translations.actions?.clean_temp_files || 'Clean Temp Files',
        cleanTempFiles,
        false,
        true
    );
    const tempButton = tempCard.querySelector('button');
    tempButton.classList.add('btn-standard-height');

    // SFC/DISM Card (special dual-button card)
    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'app-card';
    sfcDismCard.classList.add('feature-card');

    const sfcDismHeader = document.createElement('div');
    sfcDismHeader.className = 'app-header';

    const sfcDismIcon = document.createElement('div');
    sfcDismIcon.classList.add('feature-card-icon');
    sfcDismIcon.textContent = '🛠️';
    sfcDismHeader.appendChild(sfcDismIcon);

    const sfcDismText = document.createElement('div');
    const sfcDismName = document.createElement('h3');
    sfcDismName.textContent = translations.maintenance?.system_file_repair || 'System File Repair';
    sfcDismName.classList.add('feature-card-name');
    const sfcDismDesc = document.createElement('p');
    sfcDismDesc.textContent = translations.maintenance?.system_file_desc || 'SFC Scan & DISM Repair system tools (Admin required)';
    sfcDismDesc.classList.add('feature-card-desc-warning');
    sfcDismText.appendChild(sfcDismName);
    sfcDismText.appendChild(sfcDismDesc);
    sfcDismHeader.appendChild(sfcDismText);
    sfcDismCard.appendChild(sfcDismHeader);

    const sfcDismButtons = document.createElement('div');
    sfcDismButtons.classList.add('sfc-dism-buttons');

    const sfcButton = document.createElement('button');
    sfcButton.className = 'button';
    sfcButton.textContent = translations.actions?.run_sfc || 'Run SFC';
    sfcButton.classList.add('btn-half');

    const dismButton = document.createElement('button');
    dismButton.className = 'button';
    dismButton.textContent = translations.actions?.run_dism || 'Run DISM';
    dismButton.classList.add('btn-half');

    const sfcDismStatus = document.createElement('pre');
    sfcDismStatus.className = 'status-pre';
    sfcDismStatus.classList.add('sfc-dism-status');
    sfcDismStatus.dataset.hideStatus = 'true';

    sfcButton.addEventListener('click', async () => {
        await runMaintenanceTask(sfcButton, sfcDismStatus, runSfcScan, translations.actions?.run_sfc || 'SFC', true);
    });

    dismButton.addEventListener('click', async () => {
        await runMaintenanceTask(dismButton, sfcDismStatus, runDismRepair, translations.actions?.run_dism || 'DISM', true);
    });

    sfcDismButtons.appendChild(sfcButton);
    sfcDismButtons.appendChild(dismButton);
    sfcDismCard.appendChild(sfcDismButtons);
    sfcDismCard.appendChild(sfcDismStatus);

    firstRow.appendChild(tempCard);
    firstRow.appendChild(sfcDismCard);
    container.appendChild(firstRow);

    // Second Row - Patch My PC
    const secondRow = document.createElement('div');

    const patchCard = createMaintenanceCard(
        translations.maintenance?.patch_my_pc || 'Patch My PC',
        translations.maintenance?.patch_my_pc_desc || 'Update third-party applications automatically',
        '📦',
        translations.actions?.download_run || 'Download & Run',
        downloadAndRunPatchMyPC,
        false
    );
    const patchButton = patchCard.querySelector('button');
    patchButton.classList.add('btn-standard-height');
    patchCard.classList.add('patch-card-full');

    secondRow.appendChild(patchCard);
    container.appendChild(secondRow);

    return container;
}

// ============================================
// DEBLOAT PAGE
// ============================================

export async function buildDebloatPage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const heading = document.createElement('h2');
    heading.textContent = (translations.debloat && translations.debloat.heading) || 'Windows Debloat';
    heading.classList.add('script-heading');
    container.appendChild(heading);

    const description = document.createElement('p');
    description.classList.add('script-description');
    description.textContent = (translations.pages && translations.pages.debloat_raphi_desc) ||
        'This will download and run an external debloat script (Raphi) via PowerShell. ' +
        'Administrator privileges and an active internet connection are required. ' +
        'The script may make significant changes to your system. Use at your own risk.';
    container.appendChild(description);

    const isWindows = await window.api.isWindows();
    if (!isWindows) {
        const warn = document.createElement('p');
        warn.textContent = 'The debloat script is only supported on Windows.';
        warn.classList.add('script-warning');
        container.appendChild(warn);
        return container;
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'button';
    runBtn.textContent = (translations.debloat && translations.debloat.buttons && translations.debloat.buttons.runRaphiScript) ||
        'Run Debloat Script';
    runBtn.classList.add('btn-run');

    runBtn.addEventListener('click', async () => {
        if (runBtn.disabled) return;
        const original = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.textContent = 'Processing...';

        try {
            const info = await window.api.ensureSparkle();
            if (!info) {
                throw new Error('Unable to check for Sparkle release');
            }

            const { needsDownload, id, url, dest } = info;

            const extractAndRun = async () => {
                try {
                    const lastSep = Math.max(dest.lastIndexOf('\\'), dest.lastIndexOf('/'));
                    const parentDir = lastSep >= 0 ? dest.substring(0, lastSep) : '';
                    const uniqueExtractDir = `${parentDir}\\debloat-temp-${Date.now()}`;
                    const targetDir = `${parentDir}\\debloat-sparkle`;

                    const extractRes = await window.api.extractArchive(dest, '', uniqueExtractDir);
                    if (!extractRes || !extractRes.success) {
                        throw new Error((extractRes && extractRes.error) || 'Extraction failed');
                    }

                    let runDir = uniqueExtractDir;
                    try {
                        const renameRes = await window.api.renameDirectory(uniqueExtractDir, targetDir);
                        if (renameRes && renameRes.success) {
                            runDir = targetDir;
                        }
                    } catch {
                        runDir = uniqueExtractDir;
                    }

                    const sparkleExePath = `${runDir}\\sparkle.exe`;
                    let exeToRun = null;

                    try {
                        const exists = await window.api.fileExists(sparkleExePath);
                        if (exists) {
                            exeToRun = sparkleExePath;
                        }
                    } catch {
                        exeToRun = null;
                    }

                    if (!exeToRun) {
                        let exeFiles;
                        try {
                            exeFiles = await window.api.findExeFiles(runDir);
                        } catch {
                            exeFiles = [];
                        }
                        if (exeFiles && exeFiles.length > 0) {
                            const sparkleIndex = exeFiles.findIndex((p) => p.toLowerCase().endsWith('sparkle.exe'));
                            if (sparkleIndex >= 0) {
                                exeToRun = exeFiles[sparkleIndex];
                            } else {
                                exeToRun = exeFiles[0];
                            }
                        }
                    }

                    if (!exeToRun) {
                        throw new Error('No executable found in extracted Sparkle archive');
                    }

                    const runRes = await window.api.runInstaller(exeToRun);

                    try {
                        await window.api.deleteFile(dest);
                    } catch {
                        // ignore deletion errors
                    }

                    if (!runRes || !runRes.success) {
                        throw new Error((runRes && runRes.error) || 'Failed to launch Sparkle');
                    }

                    toast('Sparkle executed successfully.', { type: 'success', title: 'Debloat', duration: 7000 });
                    runBtn.disabled = false;
                    runBtn.textContent = original;
                } catch (err) {
                    toast(err.message || 'An error occurred while extracting or running Sparkle.', { type: 'error', title: 'Debloat Error', duration: 8000 });
                    runBtn.disabled = false;
                    runBtn.textContent = original;
                }
            };

            const runExistingSparkle = async () => {
                try {
                    const lastSepIdx = Math.max(dest.lastIndexOf('\\'), dest.lastIndexOf('/'));
                    const parent = lastSepIdx >= 0 ? dest.substring(0, lastSepIdx) : '';
                    const targetDir = `${parent}\\debloat-sparkle`;
                    let exePath = null;

                    const sparkleExe = `${targetDir}\\sparkle.exe`;
                    try {
                        if (await window.api.fileExists(sparkleExe)) {
                            exePath = sparkleExe;
                        }
                    } catch {
                        // ignore
                    }

                    if (!exePath) {
                        let exes = [];
                        try {
                            exes = await window.api.findExeFiles(targetDir);
                        } catch {
                            exes = [];
                        }
                        if (exes && exes.length > 0) {
                            const idx = exes.findIndex((p) => p.toLowerCase().endsWith('sparkle.exe'));
                            exePath = idx >= 0 ? exes[idx] : exes[0];
                        }
                    }

                    if (!exePath) {
                        throw new Error('No Sparkle executable found');
                    }

                    const runRes = await window.api.runInstaller(exePath);
                    if (!runRes || !runRes.success) {
                        throw new Error((runRes && runRes.error) || 'Failed to launch Sparkle');
                    }

                    toast('Sparkle launched successfully.', { type: 'success', title: 'Debloat' });
                    runBtn.disabled = false;
                    runBtn.textContent = original;
                } catch (err) {
                    toast(err.message || 'Failed to run existing Sparkle', { type: 'error', title: 'Debloat Error' });
                    runBtn.disabled = false;
                    runBtn.textContent = original;
                }
            };

            if (needsDownload) {
                runBtn.textContent = 'Downloading Sparkle...';
                const downloadId = id || `sparkle-${Date.now()}`;

                const unsubscribe = window.api.onDownloadEvent((data) => {
                    if (data.id !== downloadId) return;

                    switch (data.status) {
                        case 'progress':
                            runBtn.textContent = `Downloading... ${data.percent}%`;
                            break;
                        case 'complete':
                            runBtn.textContent = 'Extracting...';
                            unsubscribe();
                            extractAndRun();
                            break;
                        case 'error':
                            toast(data.error || 'Download failed', { type: 'error', title: 'Debloat' });
                            runBtn.disabled = false;
                            runBtn.textContent = original;
                            unsubscribe();
                            break;
                    }
                });

                window.api.downloadStart(downloadId, url, dest.split(/[/\\]/).pop());
            } else {
                await runExistingSparkle();
            }
        } catch (err) {
            toast(err.message || 'Failed to start debloat', { type: 'error', title: 'Debloat Error' });
            runBtn.disabled = false;
            runBtn.textContent = original;
        }
    });

    container.appendChild(runBtn);
    return container;
}

// ============================================
// BIOS RESTART DIALOG
// ============================================

export function showRestartDialog(translations, menuKeys, loadPage) {
    const overlay = document.createElement('div');
    overlay.className = 'bios-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'bios-dialog';

    const title = document.createElement('h2');
    title.className = 'bios-title';
    title.innerHTML = '⚙️ ' + (translations.menu?.bios || 'BIOS Settings');
    dialog.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'bios-description';
    desc.textContent = translations.messages?.bios_instructions || 'This action will restart your computer and boot into BIOS/UEFI settings. Make sure to save all your work before proceeding.';
    dialog.appendChild(desc);

    const whatTitle = document.createElement('h3');
    whatTitle.className = 'bios-section-title';
    whatTitle.textContent = '📋 What will happen:';
    dialog.appendChild(whatTitle);

    const steps = document.createElement('ol');
    steps.className = 'bios-steps';
    [
        'Save all your work and close applications',
        'System will restart automatically',
        'BIOS/UEFI setup will open on boot',
        'Configure your settings as needed'
    ].forEach((stepText) => {
        const li = document.createElement('li');
        li.textContent = stepText;
        steps.appendChild(li);
    });
    dialog.appendChild(steps);

    const warning = document.createElement('div');
    warning.className = 'bios-warning';
    warning.innerHTML = `
    <strong>⚠️ Important Notice</strong><br>
    ${escapeHtml(translations.messages?.admin_warning || 'This operation requires administrator privileges and will restart your computer immediately.')}
  `;
    dialog.appendChild(warning);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bios-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bios-cancel-btn';
    cancelBtn.textContent = translations.general?.cancel || 'Cancel';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'bios-restart-btn';
    restartBtn.innerHTML = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');

    cancelBtn.addEventListener('click', () => {
        dialog.classList.add('slide-down');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
            const fallbackKey = (Array.isArray(menuKeys) && menuKeys.length > 0) ? menuKeys[0] : 'install_apps';
            loadPage(fallbackKey);
        }, 300);
    });

    restartBtn.addEventListener('click', async () => {
        restartBtn.disabled = true;
        restartBtn.innerHTML = '⏳ Processing...';
        restartBtn.classList.add('btn-opacity-low');

        try {
            const result = await window.api.restartToBios();

            if (result.success) {
                restartBtn.innerHTML = '✅ Success!';
                restartBtn.classList.add('btn-success-gradient');

                toast('BIOS restart initiated! Computer will restart shortly.', { type: 'success', duration: 5000 });

                setTimeout(() => {
                    dialog.classList.add('slide-down');
                    overlay.classList.add('fade-out');
                    setTimeout(() => {
                        if (overlay.parentNode) {
                            document.body.removeChild(overlay);
                        }
                    }, 300);
                }, 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            restartBtn.innerHTML = '❌ Failed';
            restartBtn.classList.add('btn-error-gradient');

            setTimeout(() => {
                restartBtn.disabled = false;
                restartBtn.innerHTML = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');
                restartBtn.classList.remove('btn-opacity-low');
                restartBtn.classList.add('btn-warning-gradient');
            }, 2000);

            if (error.message && error.message.includes('Administrator')) {
                toast('🔒 Administrator Privileges Required\n\nPlease run the application as Administrator to access BIOS settings.', { type: 'error' });
            } else {
                toast('❌ ' + error.message, { type: 'error' });
            }
        }
    });

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(restartBtn);
    dialog.appendChild(buttonContainer);

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            cancelBtn.click();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    cancelBtn.focus();
}
