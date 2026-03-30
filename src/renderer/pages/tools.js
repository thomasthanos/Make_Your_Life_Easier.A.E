/**
 * Tools Page
 * Contains System Maintenance, Debloat, and BIOS pages
 * CSS classes match original renderer.js structure
 */

import { autoFadeStatus } from '../utils.js';
import { buttonStateManager, registerDownload, attachDownloadUI, downloadStore } from '../managers.js';
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

function createSimpleTask(apiFn, successMsg, errorMsg) {
    return async function (_statusElement) {
        try {
            const result = await apiFn();
            if (result && result.success) {
                toast(result.message || successMsg, { type: 'success', title: 'Maintenance' });
            } else {
                toast((result && result.error) || errorMsg, { type: 'error', title: 'Maintenance' });
            }
        } catch (error) {
            toast((error && error.message) || errorMsg, { type: 'error', title: 'Maintenance' });
        }
    };
}

const runSfcScan = createSimpleTask(() => window.api.runSfcScan(), 'SFC scan completed!', 'SFC scan failed.');
const runDismRepair = createSimpleTask(() => window.api.runDismRepair(), 'DISM repair completed!', 'DISM repair failed.');
const cleanTempFiles = createSimpleTask(() => window.api.runTempCleanup(), 'Temp files cleaned!', 'Temp cleanup failed.');
const cleanRecycleBin = createSimpleTask(() => window.api.cleanRecycleBin(), 'Recycle Bin emptied!', 'Failed to empty Recycle Bin.');
const cleanWindowsCache = createSimpleTask(() => window.api.cleanWindowsCache(), 'Windows cache cleaned!', 'Failed to clean Windows cache.');
const clearThumbnailCache = createSimpleTask(() => window.api.clearThumbnailCache(), 'Thumbnail cache cleared!', 'Failed to clear thumbnail cache.');
const clearErrorReports = createSimpleTask(() => window.api.clearErrorReports(), 'Error reports cleared!', 'Failed to clear error reports.');
const flushDnsCache = createSimpleTask(() => window.api.flushDnsCache(), 'DNS cache flushed!', 'Failed to flush DNS cache.');
const releaseRenewIp = createSimpleTask(() => window.api.releaseRenewIp(), 'IP released & renewed!', 'Failed to release/renew IP.');
const fixBluetooth = createSimpleTask(() => window.api.fixBluetooth(), 'Bluetooth fixed!', 'Failed to fix Bluetooth.');
const checkDisk = createSimpleTask(() => window.api.checkDisk(), 'Disk check completed!', 'Failed to check disk.');
const networkReset = createSimpleTask(() => window.api.networkReset(), 'Network reset completed!', 'Failed to reset network.');
const restartAudioSystem = createSimpleTask(() => window.api.restartAudioSystem(), 'Audio system restarted!', 'Failed to restart audio.');
const runDiskCleaner = createSimpleTask(() => window.api.runDiskCleaner(), 'Disk Cleanup launched!', 'Failed to launch Disk Cleanup.');

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

    const storeKey = 'patchmypc';
    registerDownload(storeKey, downloadId, { name: 'Patch My PC' });

    return new Promise((resolve) => {
        attachDownloadUI(storeKey, (data) => {
            switch (data.status) {
                case 'started':
                    button.textContent = 'Downloading Patch My PC... 0%';
                    break;
                case 'progress':
                    button.textContent = `Downloading Patch My PC... ${data.percent}%`;
                    break;
                case 'complete': {
                    button.textContent = 'Opening Patch My PC...';
                    downloadStore.delete(storeKey);
                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result && result.success) {
                                button.textContent = 'Patch My PC Started';
                            } else {
                                button.textContent = originalText;
                                toast('Failed to open Patch My PC', { type: 'error', title: 'Maintenance' });
                            }
                        })
                        .catch(() => {
                            button.textContent = originalText;
                            toast('Error opening Patch My PC', { type: 'error', title: 'Maintenance' });
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
                    toast('Download failed', { type: 'error', title: 'Maintenance' });
                    resolve();
                    break;
            }
        });

        try {
            window.api.downloadStart(downloadId, patchMyPCUrl, 'PatchMyPC.exe');
        } catch (e) {
            button.textContent = originalText;
            button.disabled = false;
            downloadStore.delete(storeKey);
            toast('Download failed', { type: 'error', title: 'Maintenance' });
            resolve();
        }
    });
}

// ============================================
// SYSTEM MAINTENANCE PAGE
// ============================================

/**
 * Creates a section title element
 */
function createSectionTitle(text) {
    const title = document.createElement('h3');
    title.textContent = text;
    title.classList.add('maintenance-section-title');
    return title;
}

export async function buildMaintenancePage(translations, _settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const title = document.createElement('h2');
    title.textContent = translations.pages?.maintenance_title || 'System Maintenance';
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = translations.pages?.maintenance_desc || 'Perform various system maintenance tasks to keep your computer running smoothly.';
    desc.classList.add('desc-margin-large');
    container.appendChild(desc);

    // ── SECTION 1: Cleanup ──
    container.appendChild(createSectionTitle('🧹 ' + (translations.maintenance?.cleanup_section || 'Cleanup')));

    const cleanupRow = document.createElement('div');
    cleanupRow.className = 'maintenance-row';
    cleanupRow.classList.add('grid-2-col-margin');

    const tempCard = createMaintenanceCard(
        translations.maintenance?.delete_temp_files || 'Clean Temp Files',
        translations.maintenance?.temp_files_desc || 'Clean TEMP, %TEMP%, and Prefetch folders',
        '🧹',
        translations.actions?.clean_temp_files || 'Clean',
        cleanTempFiles, false, true
    );
    tempCard.querySelector('button').classList.add('btn-standard-height');

    const recycleBinCard = createMaintenanceCard(
        translations.maintenance?.recycle_bin || 'Clean Recycle Bin',
        translations.maintenance?.recycle_bin_desc || 'Empty the Windows Recycle Bin',
        '🗑️',
        translations.actions?.clean || 'Clean',
        cleanRecycleBin, false, true
    );
    recycleBinCard.querySelector('button').classList.add('btn-standard-height');

    const winCacheCard = createMaintenanceCard(
        translations.maintenance?.windows_cache || 'Clean Windows Cache',
        translations.maintenance?.windows_cache_desc || 'Clean Windows Update download cache',
        '💾',
        translations.actions?.clean || 'Clean',
        cleanWindowsCache, true, true
    );
    winCacheCard.querySelector('button').classList.add('btn-standard-height');

    const thumbCard = createMaintenanceCard(
        translations.maintenance?.thumbnail_cache || 'Clear Thumbnail Cache',
        translations.maintenance?.thumbnail_cache_desc || 'Clear icon and thumbnail cache files',
        '🖼️',
        translations.actions?.clear || 'Clear',
        clearThumbnailCache, false, true
    );
    thumbCard.querySelector('button').classList.add('btn-standard-height');

    const errorReportsCard = createMaintenanceCard(
        translations.maintenance?.error_reports || 'Clear Error Reports',
        translations.maintenance?.error_reports_desc || 'Clean crash dumps and error reports',
        '📋',
        translations.actions?.clear || 'Clear',
        clearErrorReports, false, true
    );
    errorReportsCard.querySelector('button').classList.add('btn-standard-height');

    const diskCleanerCard = createMaintenanceCard(
        translations.maintenance?.disk_cleaner || 'Disk Cleanup',
        translations.maintenance?.disk_cleaner_desc || 'Launch Windows Disk Cleanup utility (cleanmgr)',
        '🧽',
        translations.actions?.launch || 'Launch',
        runDiskCleaner, true, true
    );
    diskCleanerCard.querySelector('button').classList.add('btn-standard-height');

    cleanupRow.appendChild(tempCard);
    cleanupRow.appendChild(recycleBinCard);
    cleanupRow.appendChild(winCacheCard);
    cleanupRow.appendChild(thumbCard);
    cleanupRow.appendChild(errorReportsCard);
    cleanupRow.appendChild(diskCleanerCard);
    container.appendChild(cleanupRow);

    // ── SECTION 2: Network & Connectivity ──
    container.appendChild(createSectionTitle('🌐 ' + (translations.maintenance?.network_section || 'Network & Connectivity')));

    const networkRow = document.createElement('div');
    networkRow.className = 'maintenance-row';
    networkRow.classList.add('grid-2-col-margin');

    const dnsCard = createMaintenanceCard(
        translations.maintenance?.flush_dns || 'Flush DNS Cache',
        translations.maintenance?.flush_dns_desc || 'Clear the DNS resolver cache',
        '🔄',
        translations.actions?.flush || 'Flush',
        flushDnsCache, false, true
    );
    dnsCard.querySelector('button').classList.add('btn-standard-height');

    const ipCard = createMaintenanceCard(
        translations.maintenance?.release_renew_ip || 'Release & Renew IP',
        translations.maintenance?.release_renew_ip_desc || 'Release and renew IP address',
        '📡',
        translations.actions?.run || 'Run',
        releaseRenewIp, false, true
    );
    ipCard.querySelector('button').classList.add('btn-standard-height');

    const btCard = createMaintenanceCard(
        translations.maintenance?.fix_bluetooth || 'Fix Bluetooth',
        translations.maintenance?.fix_bluetooth_desc || 'Restart Bluetooth services and adapter',
        '📶',
        translations.actions?.fix || 'Fix',
        fixBluetooth, true, true
    );
    btCard.querySelector('button').classList.add('btn-standard-height');

    const netResetCard = createMaintenanceCard(
        translations.maintenance?.network_reset || 'Network Reset',
        translations.maintenance?.network_reset_desc || 'Reset Winsock, IP stack, and flush DNS',
        '🔌',
        translations.actions?.reset || 'Reset',
        networkReset, true, true
    );
    netResetCard.querySelector('button').classList.add('btn-standard-height');

    networkRow.appendChild(dnsCard);
    networkRow.appendChild(ipCard);
    networkRow.appendChild(btCard);
    networkRow.appendChild(netResetCard);
    container.appendChild(networkRow);

    // ── SECTION 3: System Repair & Diagnostics ──
    container.appendChild(createSectionTitle('🛠️ ' + (translations.maintenance?.repair_section || 'System Repair & Diagnostics')));

    const repairRow = document.createElement('div');
    repairRow.className = 'maintenance-row';
    repairRow.classList.add('grid-2-col-margin');

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

    const checkDiskCard = createMaintenanceCard(
        translations.maintenance?.check_disk || 'Check Disk',
        translations.maintenance?.check_disk_desc || 'Scan C: drive for errors (read-only)',
        '💿',
        translations.actions?.check || 'Check',
        checkDisk, true, true
    );
    checkDiskCard.querySelector('button').classList.add('btn-standard-height');

    const audioCard = createMaintenanceCard(
        translations.maintenance?.restart_audio || 'Restart Audio System',
        translations.maintenance?.restart_audio_desc || 'Restart Windows Audio services',
        '🔊',
        translations.actions?.restart || 'Restart',
        restartAudioSystem, true, true
    );
    audioCard.querySelector('button').classList.add('btn-standard-height');

    repairRow.appendChild(sfcDismCard);
    repairRow.appendChild(checkDiskCard);
    repairRow.appendChild(audioCard);
    container.appendChild(repairRow);

    // ── SECTION 4: Tools ──
    container.appendChild(createSectionTitle('📦 ' + (translations.maintenance?.tools_section || 'Tools')));

    const toolsRow = document.createElement('div');

    const patchCard = createMaintenanceCard(
        translations.maintenance?.patch_my_pc || 'Patch My PC',
        translations.maintenance?.patch_my_pc_desc || 'Update third-party applications automatically',
        '📦',
        translations.actions?.download_run || 'Download & Run',
        downloadAndRunPatchMyPC,
        false
    );
    patchCard.querySelector('button').classList.add('btn-standard-height');
    patchCard.classList.add('patch-card-full');

    toolsRow.appendChild(patchCard);
    container.appendChild(toolsRow);

    return container;
}

// ============================================
// DEBLOAT PAGE
// ============================================

export async function buildDebloatPage(translations, _settings) {
    const container = document.createElement('div');
    container.className = 'card';

    const heading = document.createElement('h2');
    heading.textContent = (translations.debloat && translations.debloat.heading) || 'Windows Debloat';
    heading.classList.add('script-heading');
    container.appendChild(heading);

    const description = document.createElement('p');
    description.classList.add('script-description');
    description.textContent = (translations.pages && translations.pages.debloat_raphi_desc) ||
        'Launch Sparkle debloat utility to remove bloatware and optimize your Windows system. ' +
        'The utility will be downloaded if not already available.';
    container.appendChild(description);

    const isWindows = await window.api.isWindows();
    if (!isWindows) {
        const warn = document.createElement('p');
        warn.textContent = 'Sparkle Debloat is only supported on Windows.';
        warn.classList.add('script-warning');
        container.appendChild(warn);
        return container;
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'button';
    runBtn.textContent = (translations.debloat && translations.debloat.buttons && translations.debloat.buttons.runRaphiScript) ||
        'Launch Sparkle Debloat';
    runBtn.classList.add('btn-run');

    runBtn.addEventListener('click', async () => {
        if (runBtn.disabled) return;
        
        const original = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.textContent = 'Checking Sparkle...';

        try {
            const result = await window.api.runSparkleDebloat();
            
            if (!result) {
                throw new Error('No response from Sparkle handler');
            }

            // Case 1: Sparkle needs to be downloaded
            if (result.needsDownload) {
                runBtn.textContent = 'Downloading Sparkle...';
                
                const downloadId = result.downloadId || `sparkle-${Date.now()}`;
                const downloadDest = result.downloadDest;

                const sparkleStoreKey = 'sparkle-debloat';
                registerDownload(sparkleStoreKey, downloadId, { name: 'Sparkle' });

                attachDownloadUI(sparkleStoreKey, (data) => {
                    switch (data.status) {
                        case 'progress':
                            runBtn.textContent = `Downloading Sparkle... ${data.percent}%`;
                            break;
                        case 'complete':
                            runBtn.textContent = 'Extracting Sparkle...';
                            downloadStore.delete(sparkleStoreKey);

                            // Extract the downloaded zip
                            window.api.processDownloadedSparkle(downloadDest)
                                .then(extractResult => {
                                    if (extractResult && extractResult.success) {
                                        runBtn.textContent = 'Launching Sparkle...';
                                        // Now run it
                                        return window.api.runSparkleDebloat();
                                    } else {
                                        throw new Error(extractResult?.error || 'Extraction failed');
                                    }
                                })
                                .then(launchResult => {
                                    if (launchResult && launchResult.success && !launchResult.needsDownload) {
                                        toast('Sparkle Debloat launched successfully!', {
                                            type: 'success',
                                            title: 'Debloat',
                                            duration: 5000
                                        });
                                        runBtn.textContent = '✅ Launched!';
                                        runBtn.disabled = true;
                                        setTimeout(() => {
                                            runBtn.textContent = original;
                                            runBtn.disabled = false;
                                        }, 2000);
                                    } else {
                                        throw new Error(launchResult?.error || 'Launch failed');
                                    }
                                })
                                .catch(err => {
                                    toast(err.message || 'Failed to extract or launch Sparkle', {
                                        type: 'error',
                                        title: 'Debloat Error',
                                        duration: 8000
                                    });
                                    runBtn.disabled = false;
                                    runBtn.textContent = original;
                                });
                            break;
                        case 'error':
                            toast(data.error || 'Download failed', {
                                type: 'error',
                                title: 'Debloat Error',
                                duration: 8000
                            });
                            runBtn.disabled = false;
                            runBtn.textContent = original;
                            downloadStore.delete(sparkleStoreKey);
                            break;
                    }
                });

                // Start the download
                window.api.downloadStart(downloadId, result.downloadUrl, downloadDest);
                return;
            }

            // Case 2: Sparkle is already available and launched
            if (result.success) {
                toast(result.message || 'Sparkle Debloat launched successfully!', { 
                    type: 'success', 
                    title: 'Debloat', 
                    duration: 5000 
                });
                runBtn.textContent = '✅ Launched!';
                setTimeout(() => {
                    runBtn.textContent = original;
                    runBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(result.error || 'Failed to launch Sparkle Debloat');
            }
        } catch (err) {
            toast(err.message || 'Failed to launch Sparkle Debloat', { 
                type: 'error', 
                title: 'Debloat Error',
                duration: 8000
            });
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
    title.textContent = '⚙️ ' + (translations.menu?.bios || 'BIOS Settings');
    dialog.appendChild(title);

    const desc = document.createElement('p');
    desc.className = 'bios-description';
    desc.textContent = translations.messages?.bios_instructions || 'This action will restart your computer and boot into BIOS/UEFI settings. Make sure to save all your work before proceeding.';
    dialog.appendChild(desc);

    const whatTitle = document.createElement('h3');
    whatTitle.className = 'bios-section-title';
    whatTitle.textContent = '📋 ' + ((translations.messages && translations.messages.bios_what_happens) || 'What will happen:');
    dialog.appendChild(whatTitle);

    const steps = document.createElement('ol');
    steps.className = 'bios-steps';
    const defaultSteps = [
        'Save all your work and close applications',
        'System will restart automatically',
        'BIOS/UEFI setup will open on boot',
        'Configure your settings as needed'
    ];
    const steps_i18n = (translations.messages && translations.messages.bios_steps) || defaultSteps;
    (Array.isArray(steps_i18n) ? steps_i18n : defaultSteps).forEach((stepText) => {
        const li = document.createElement('li');
        li.textContent = stepText;
        steps.appendChild(li);
    });
    dialog.appendChild(steps);

    const warning = document.createElement('div');
    warning.className = 'bios-warning';
    const warningStrong = document.createElement('strong');
    warningStrong.textContent = '⚠️ Important Notice';
    warning.appendChild(warningStrong);
    warning.appendChild(document.createElement('br'));
    warning.appendChild(document.createTextNode(
        translations.messages?.admin_warning || 'This operation requires administrator privileges and will restart your computer immediately.'
    ));
    dialog.appendChild(warning);

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'bios-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'bios-cancel-btn';
    cancelBtn.textContent = translations.general?.cancel || 'Cancel';

    const restartBtn = document.createElement('button');
    restartBtn.className = 'bios-restart-btn';
    restartBtn.textContent = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');

    // Escape key handler — cleaned up when dialog closes via cancel or success
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            cancelBtn.click();
        }
    };

    cancelBtn.addEventListener('click', () => {
        document.removeEventListener('keydown', escapeHandler);
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
        restartBtn.textContent = '⏳ Processing...';
        restartBtn.classList.add('btn-opacity-low');

        try {
            const result = await window.api.restartToBios();

            if (result && result.success) {
                restartBtn.classList.remove('btn-opacity-low');
                restartBtn.textContent = '✅ Success!';
                restartBtn.classList.add('btn-success-gradient');

                toast('BIOS restart initiated! Computer will restart shortly.', { type: 'success', duration: 5000 });

                document.removeEventListener('keydown', escapeHandler);
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
                throw new Error((result && result.error) || 'Failed to restart to BIOS');
            }
        } catch (error) {
            restartBtn.classList.remove('btn-opacity-low');
            restartBtn.textContent = '❌ Failed';
            restartBtn.classList.add('btn-error-gradient');

            setTimeout(() => {
                restartBtn.disabled = false;
                restartBtn.textContent = '🔄 ' + (translations.messages?.restart_to_bios || 'Restart to BIOS');
                restartBtn.classList.remove('btn-error-gradient');
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

    document.addEventListener('keydown', escapeHandler);
    cancelBtn.focus();
}
