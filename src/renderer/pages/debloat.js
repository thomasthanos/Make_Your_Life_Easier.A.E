import { createNotifier } from '../notifications.js';
import { taskApi } from '../operations.js';
import { uiText } from '../ui-text.js';
import { registerDownload, attachDownloadUI, downloadStore } from '../downloads.js';
import { getMaintenanceIcon } from '../ui.js';

const debloatToast = createNotifier('debloat');

export async function buildDebloatPage(translations, _settings) {
    const T = translations.debloat_ui || {};
    const container = document.createElement('div');
    container.className = 'debloat-page';

    const mainPanel = document.createElement('section');
    mainPanel.className = 'debloat-main-panel';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'debloat-panel-header';

    const heroIcon = document.createElement('div');
    heroIcon.className = 'debloat-panel-icon';
    heroIcon.innerHTML = getMaintenanceIcon('sparkle');

    const heroText = document.createElement('div');
    heroText.className = 'debloat-panel-copy';

    const description = document.createElement('p');
    description.textContent = (translations.pages && translations.pages.debloat_raphi_desc) ||
        'Launch Sparkle debloat utility to remove bloatware and optimize your Windows system. ' +
        'The utility will be downloaded if not already available.';

    const status = document.createElement('p');
    status.className = 'debloat-status';
    status.textContent = T.checking || 'Checking Sparkle...';

    const progress = document.createElement('div');
    progress.className = 'debloat-progress';
    const progressFill = document.createElement('div');
    progressFill.className = 'debloat-progress-fill';
    progress.appendChild(progressFill);

    heroText.appendChild(description);

    const toolBadge = document.createElement('span');
    toolBadge.className = 'debloat-tool-badge';
    toolBadge.textContent = T.portable_label || 'Portable tool';

    panelHeader.appendChild(heroIcon);
    panelHeader.appendChild(heroText);
    panelHeader.appendChild(toolBadge);

    const capabilities = document.createElement('div');
    capabilities.className = 'debloat-capabilities';
    const capabilityIcons = ['recycle', 'shield', 'prefetch', 'updateCache'];
    const capabilityTexts = (Array.isArray(T.features) && T.features.length === 4) ? T.features : [
        { title: 'Remove bloatware', text: 'Uninstalls preinstalled apps and OEM junk you never asked for.' },
        { title: 'Privacy & telemetry', text: 'Disables tracking, telemetry and advertising services.' },
        { title: 'Performance tweaks', text: 'Trims background services and startup load for a snappier PC.' },
        { title: 'Portable from GitHub', text: 'Fetched from the official Sparkle releases on first launch — nothing to install.' }
    ];

    capabilityTexts.forEach((capability, index) => {
        const item = document.createElement('div');
        item.className = 'debloat-capability';

        const icon = document.createElement('span');
        icon.className = 'debloat-capability-icon';
        icon.innerHTML = getMaintenanceIcon(capabilityIcons[index]);

        const content = document.createElement('div');
        content.className = 'debloat-capability-copy';

        const capabilityTitle = document.createElement('h3');
        capabilityTitle.textContent = capability.title;

        const capabilityText = document.createElement('p');
        capabilityText.textContent = capability.text;

        content.appendChild(capabilityTitle);
        content.appendChild(capabilityText);
        item.appendChild(icon);
        item.appendChild(content);
        capabilities.appendChild(item);
    });

    const heroActions = document.createElement('div');
    heroActions.className = 'debloat-panel-actions';

    const panelFooter = document.createElement('div');
    panelFooter.className = 'debloat-panel-footer';

    const state = document.createElement('div');
    state.className = 'debloat-panel-state';
    state.appendChild(status);
    state.appendChild(progress);

    panelFooter.appendChild(state);
    panelFooter.appendChild(heroActions);

    mainPanel.appendChild(panelHeader);
    mainPanel.appendChild(capabilities);
    mainPanel.appendChild(panelFooter);
    container.appendChild(mainPanel);

    const setStatus = (text) => { status.textContent = text; };
    const setProgress = (percent) => {
        if (percent === null) {
            progress.classList.remove('active');
            progressFill.style.width = '0%';
        } else {
            progress.classList.add('active');
            progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
        }
    };

    const refreshStatus = async () => {
        try {
            const res = await taskApi.sparkleStatus?.();
            if (res && res.available) {
                setStatus(T.ready || 'Sparkle is installed and ready to launch.');
            } else {
                setStatus(T.will_download || 'Sparkle will be downloaded from GitHub on first launch — portable, no installation.');
            }
        } catch {
            setStatus('');
        }
    };

    const isWindows = await taskApi.isWindows();
    if (!isWindows) {
        setStatus(T.windows_only || 'Sparkle Debloat is only supported on Windows.');
        status.classList.add('is-warning');
        return container;
    }

    const runBtn = document.createElement('button');
    runBtn.className = 'button debloat-run-btn';
    runBtn.textContent = T.launch_btn ||
        (translations.debloat && translations.debloat.buttons && translations.debloat.buttons.runRaphiScript) ||
        'Launch Sparkle Debloat';
    heroActions.appendChild(runBtn);

    refreshStatus();

    runBtn.addEventListener('click', async () => {
        if (runBtn.disabled) return;

        const original = runBtn.textContent;
        runBtn.disabled = true;
        runBtn.textContent = T.checking || 'Checking Sparkle...';
        setStatus(T.checking || 'Checking Sparkle...');

        try {
            const result = await taskApi.runSparkleDebloat();

            if (!result) {
                throw new Error('No response from Sparkle handler');
            }

            if (result.needsDownload) {
                runBtn.textContent = T.downloading || 'Downloading Sparkle from GitHub...';
                setStatus(T.downloading || 'Downloading Sparkle from GitHub...');
                setProgress(0);

                const downloadId = result.downloadId || `sparkle-${Date.now()}`;
                const downloadDest = result.downloadDest;

                const sparkleStoreKey = 'sparkle-debloat';
                registerDownload(sparkleStoreKey, downloadId, { name: 'Sparkle' });

                attachDownloadUI(sparkleStoreKey, (data) => {
                    switch (data.status) {
                        case 'progress':
                            runBtn.textContent = `${data.percent}%`;
                            setStatus(`${T.downloading || 'Downloading Sparkle from GitHub...'} ${data.percent}%`);
                            setProgress(data.percent);
                            break;
                        case 'complete': {
                            runBtn.textContent = T.extracting || 'Extracting Sparkle...';
                            setStatus(T.extracting || 'Extracting Sparkle...');
                            setProgress(null);
                            downloadStore.delete(sparkleStoreKey);

                            const extractWatchdog = setTimeout(() => {
                                runBtn.disabled = false;
                                runBtn.textContent = original;
                                refreshStatus();
                                debloatToast(uiText("sparkle_timeout", "Sparkle is taking too long to extract/launch. Please try again."), {
                                    type: 'error',
                                    title: 'Debloat Error',
                                    duration: 8000
                                });
                            }, 120000);

                            taskApi.processDownloadedSparkle(downloadDest)
                                .then(extractResult => {
                                    if (extractResult && extractResult.success) {
                                        runBtn.textContent = T.launching || 'Launching Sparkle...';
                                        setStatus(T.launching || 'Launching Sparkle...');
                                        return taskApi.runSparkleDebloat();
                                    } else {
                                        throw new Error(extractResult?.error || 'Extraction failed');
                                    }
                                })
                                .then(launchResult => {
                                    if (launchResult && launchResult.success && !launchResult.needsDownload) {
                                        debloatToast(uiText("sparkle_done", "Sparkle Debloat launched successfully!"), {
                                            type: 'success',
                                            title: 'Debloat',
                                            duration: 5000
                                        });
                                        runBtn.textContent = uiText("launched", "✅ Launched!");
                                        runBtn.disabled = true;
                                        refreshStatus();
                                        setTimeout(() => {
                                            runBtn.textContent = original;
                                            runBtn.disabled = false;
                                        }, 2000);
                                    } else {
                                        throw new Error(launchResult?.error || 'Launch failed');
                                    }
                                })
                                .catch(err => {
                                    debloatToast(err.message || uiText("sparkle_extract_error", "Failed to extract or launch Sparkle"), {
                                        type: 'error',
                                        title: 'Debloat Error',
                                        duration: 8000
                                    });
                                    runBtn.disabled = false;
                                    runBtn.textContent = original;
                                    refreshStatus();
                                })
                                .finally(() => clearTimeout(extractWatchdog));
                            break;
                        }
                        case 'error':
                            debloatToast(data.error || uiText("download_failed", "Download failed"), {
                                type: 'error',
                                title: 'Debloat Error',
                                duration: 8000
                            });
                            runBtn.disabled = false;
                            runBtn.textContent = original;
                            setProgress(null);
                            refreshStatus();
                            downloadStore.delete(sparkleStoreKey);
                            break;
                    }
                });

                taskApi.downloadStart(downloadId, result.downloadUrl, downloadDest);
                return;
            }

            if (result.success) {
                debloatToast(uiText("sparkle_done", "Sparkle Debloat launched successfully!"), {
                    type: 'success',
                    title: 'Debloat',
                    duration: 5000
                });
                runBtn.textContent = uiText("launched", "✅ Launched!");
                refreshStatus();
                setTimeout(() => {
                    runBtn.textContent = original;
                    runBtn.disabled = false;
                }, 2000);
            } else {
                throw new Error(result.error || uiText("sparkle_launch_error", "Failed to launch Sparkle Debloat"));
            }
        } catch (err) {
            debloatToast(err.message || uiText("sparkle_launch_error", "Failed to launch Sparkle Debloat"), {
                type: 'error',
                title: 'Debloat Error',
                duration: 8000
            });
            runBtn.disabled = false;
            runBtn.textContent = original;
            setProgress(null);
            refreshStatus();
        }
    });

    return container;
}
