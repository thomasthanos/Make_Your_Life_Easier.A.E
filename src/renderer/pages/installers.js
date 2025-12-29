/**
 * Installers Page
 * Contains Winget Install Page and Crack Installer Page
 */

import { debug, escapeHtml, debounce, getDirectoryName, getBaseName, getExtractedFolderPath, autoFadeStatus, createModernButton } from '../utils.js';
import { buttonStateManager, trackProcess, completeProcess } from '../managers.js';
import { toast, showErrorCard } from '../components.js';
import { CUSTOM_APPS } from '../services.js';

// ============================================
// FAVICON CONFIG
// ============================================

function getFaviconUrl(pkgId, appName) {
    if (typeof FaviconConfig !== 'undefined') {
        return FaviconConfig.getFaviconUrl(pkgId, appName);
    }
    const slug = String(appName || pkgId || '').toLowerCase().replace(/\s+/g, '');
    return `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64`;
}

function getDeveloperUrl(pkgId) {
    try {
        // Custom URLs for specific Package IDs
        const customUrlMap = {
            'Proton.ProtonVPN': 'https://protonvpn.com/download?srsltid=AfmBOorCqPOivQW4nu912shSaLHNK2mrKj95FqK-_apNH6nFGY8aeFiX',
            'Proton.ProtonDrive': 'https://proton.me/drive/download',
            'Proton.ProtonMail': 'https://proton.me/mail/download',
            'Proton.ProtonAuthenticator': 'https://proton.me/authenticator/download',
            'Proton.Proton Authenticator': 'https://proton.me/authenticator/download',
            'Google.GoogleDrive': 'https://drive.google.com/drive/my-drive',
            'Google.Chrome': 'https://www.google.com/chrome/',
            'GitHub.GitHubDesktop': 'https://desktop.github.com/',
            'Microsoft.VisualStudioCode': 'https://code.visualstudio.com/download',
            'Guru3D.Afterburner': 'https://www.msi.com/Landing/afterburner/graphics-cards',
            'IObit.AdvancedSystemCare': 'https://www.iobit.com/en/advancedsystemcarefree.php',
            'IObit.DriverBooster': 'https://www.iobit.com/en/driver-booster.php',
            'IObit.SoftwareUpdater': 'https://www.iobit.com/en/iobit-software-updater.php',
            'IObit.IObitSysInfo': 'https://www.iobit.com/it/system-information.php',
            'IObit.SmartDefrag': 'https://www.iobit.com/en/iobitsmartdefrag.php',
            'IObit.Uninstaller': 'https://www.iobit.com/en/advanceduninstaller.php'
        };
        
        // Check custom URLs first
        if (customUrlMap[pkgId]) {
            return customUrlMap[pkgId];
        }
        
        const parts = String(pkgId).split('.');
        const publisher = (parts[0] || '').toLowerCase();
        const domainMap = {
            google: 'google.com',
            bitdefender: 'bitdefender.com/en-us/consumer/thank-you',
            brave: 'brave.com',
            discord: 'discord.com',
            dropbox: 'dropbox.com/install',
            electronicarts: 'ea.com/ea-app',
            elgato: 'elgato.com/us/en/s/downloads',
            epicgames: 'epicgames.com',
            git: 'git-scm.com',
            github: 'github.com',
            nordsecurity: 'nordvpn.com/download/windows/',
            mojang: 'minecraft.net/en-us/download',
            vivaldi: 'vivaldi.com',
            valve: 'steampowered.com',
            playstation: 'remoteplay.dl.playstation.net/remoteplay/lang/en/',
            python: 'python.org/downloads/',
            // Note: microsoft is for Visual Studio Professional only. Visual Studio Code uses custom URL above.
            microsoft: 'visualstudio.microsoft.com/downloads/',
            rarlab: 'win-rar.com',
            razerinc: 'razer.com/eu-en/synapse-4',
            softdeluxe: 'freedownloadmanager.org',
            spotify: 'spotify.com',
            surfshark: 'surfshark.com/download?srsltid=AfmBOorcPsSBR-wUna4MesO5XGZpsZggzmkT15omy-h-xpnLNQsXqZ8C',
            zwylair: 'github.com',
            proton: 'proton.me',
            openjs: 'nodejs.org',
            mozilla: 'mozilla.org',
            '7zip': '7-zip.org',
            vencord: 'vencord.dev/download/',
            obsproject: 'obsproject.com',
            videolan: 'videolan.org',
            oracle: 'oracle.com',
            logitech: 'logitech.com',
            notepadplusplus: 'notepad-plus-plus.org',
            cpuid: 'cpuid.com',
            crystaldew: 'crystalmark.info',
            malwarebytes: 'malwarebytes.com',
            teamviewer: 'teamviewer.com',
            anydesk: 'anydesk.com',
            betterdiscord: 'betterdiscord.app',
            iobit: 'www.iobit.com/en/advancedsystemcarefree.php',
            blizzard: 'battle.net',
            ubisoft: 'ubisoft.com/en-gb/ubisoft-connect/download',
            guru3d: 'guru3d.com',
            anthropic: 'claude.ai'
        };
        const domain = domainMap[publisher] || `${publisher}.com`;
        return `https://${domain}`;
    } catch {
        return '';
    }
}

function getCategoryForId(pkgId) {
    const lower = String(pkgId).toLowerCase();
    const mappings = [
        { key: 'Browsers', keywords: ['firefox', 'chrome', 'brave', 'opera', 'edge', 'vivaldi', 'tor', 'browser'] },
        { key: 'Games', keywords: ['steam', 'epic', 'battlenet', 'ubisoft', 'riot', 'gog', 'game', 'psremoteplay', 'playstation', 'xbox'] },
        { key: 'Music', keywords: ['spotify', 'music', 'tidal', 'mp3', 'audio', 'vlc', 'winamp'] },
        { key: 'Development', keywords: ['visualstudio', 'python', 'node', 'git', 'java', 'eclipse', 'intellij', 'jetbrains', 'studio', 'code', 'github', 'gitlab', 'docker', 'virtualbox', 'vmware', 'claude', 'anthropic'] },
        { key: 'Security', keywords: ['vpn', 'bitdefender', 'antivirus', 'security', 'surfshark', 'nord', 'protonvpn', 'authenticator', 'password', 'mail'] },
        { key: 'Utilities', keywords: ['7zip', 'rar', 'winrar', 'zip', 'freedownload', 'downloadmanager', 'driverbooster', 'softwareupdater', 'sysinfo', 'smartdefrag', 'uninstaller', 'afterburner', 'streamdeck', 'razer', 'synapse', 'iobit', 'manager', 'stream'] }
    ];
    for (const { key, keywords } of mappings) {
        if (keywords.some((kw) => lower.includes(kw))) {
            return key;
        }
    }
    return 'Others';
}

// ============================================
// CRACK INSTALLER HELPERS
// ============================================

async function findClipStudioInstaller(extractedDir) {
    return new Promise((resolve) => {
        window.api.findExeFiles(extractedDir)
            .then(files => {
                if (!files || files.length === 0) {
                    resolve(null);
                    return;
                }

                const priorityFiles = files.filter(file => {
                    const fileName = getBaseName(file, '').toLowerCase();
                    return fileName.includes('clipstudio_crack') ||
                        fileName.includes('install') ||
                        fileName.includes('setup') ||
                        fileName.includes('crack');
                });

                if (priorityFiles.length > 0) {
                    resolve(priorityFiles[0]);
                } else {
                    resolve(files[0]);
                }
            })
            .catch(() => resolve(null));
    });
}

async function findProjectInstaller(extractedDir, projectName) {
    try {
        const exeFiles = await window.api.findExeFiles(extractedDir);
        if (!exeFiles || exeFiles.length === 0) {
            return null;
        }
        const lowerName = (projectName || '').toLowerCase();

        if (lowerName.includes('office')) {
            const exact = exeFiles.find(f => getBaseName(f, '').toLowerCase() === 'oinstall_x64');
            if (exact) return exact;
            const prefix = exeFiles.find(f => getBaseName(f, '').toLowerCase().startsWith('oinstall'));
            if (prefix) return prefix;
            return null;
        }

        const hyphenated = exeFiles.find(f => getBaseName(f, '').toLowerCase().includes('set-up'));
        if (hyphenated) return hyphenated;

        const setup = exeFiles.find(f => {
            const base = getBaseName(f, '').toLowerCase();
            return base.includes('setup') &&
                !base.includes('crack') &&
                !base.includes('patch') &&
                !base.includes('unlock') &&
                !base.includes('pop');
        });
        if (setup) return setup;

        const install = exeFiles.find(f => {
            const base = getBaseName(f, '').toLowerCase();
            return base.includes('install') &&
                !base.includes('crack') &&
                !base.includes('patch') &&
                !base.includes('unlock') &&
                !base.includes('pop');
        });
        if (install) return install;

        return null;
    } catch {
        return null;
    }
}

async function processAdvancedInstaller(zipPath, statusElement, appName, li) {
    statusElement.textContent = 'Extracting Advanced Installer...';

    try {
        const extractResult = await window.api.extractArchive(zipPath, '');

        if (!extractResult.success) {
            throw new Error(`Extraction failed: ${extractResult.error}`);
        }

        statusElement.textContent = 'Extraction complete!';

        const extractedDir = getExtractedFolderPath(zipPath);
        const msiPath = `${extractedDir}\\advinst.msi`;
        const activatorPath = `${extractedDir}\\Advanced Installer Activator.exe`;

        debug('info', 'MSI Path:', msiPath);
        debug('info', 'Activator Path:', activatorPath);

        statusElement.textContent = 'Starting Advanced Installer setup...';

        debug('info', 'Running MSI installer...');
        const installResult = await window.api.runInstaller(msiPath);

        if (!installResult.success) {
            throw new Error(`Failed to run MSI installer: ${installResult.error}`);
        }

        statusElement.textContent = '✅ Advanced Installer setup started! Complete the installation.';
        statusElement.classList.add('status-success');

        // Δημιουργία activate button μετά την εγκατάσταση
        if (li) {
            createActivateButtonForAdvancedInstaller(li, activatorPath, appName);
        }

        toast('Advanced Installer setup started! Complete the installation then click "Activate".', {
            type: 'info',
            title: 'Advanced Installer',
            duration: 5000
        });

        // Επιστροφή του activatorPath για να χρησιμοποιηθεί αργότερα
        return { activatorPath };

    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
        throw error;
    }
}

// Βοηθητική συνάρτηση για δημιουργία activate button για Advanced Installer
function createActivateButtonForAdvancedInstaller(li, activatorPath, appName) {
    // Ψάξε για υπάρχον activate button
    let activateBtn = li.querySelector('.activate-btn');
    
    if (activateBtn) {
        // Αν υπάρχει ήδη, ενημέρωσε το path
        activateBtn.dataset.activatorPath = activatorPath;
        activateBtn.style.display = 'inline-flex';
        return;
    }
    
    // Δημιούργησε νέο activate button
    const label = li.querySelector('label.app-label');
    if (!label) return;
    
    // Δημιούργησε ένα container για τα κουμπιά
    let buttonContainer = li.querySelector('.app-actions');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'app-actions';
        
        // Βάλε το container μετά το label
        const labelContainer = li.querySelector('.label-container');
        if (labelContainer) {
            labelContainer.appendChild(buttonContainer);
        } else {
            li.appendChild(buttonContainer);
        }
    }
    
    activateBtn = document.createElement('button');
    activateBtn.className = 'activate-btn';
    activateBtn.textContent = 'Activate';
    activateBtn.dataset.activatorPath = activatorPath;
    activateBtn.dataset.appName = appName;
    activateBtn.title = `Activate ${appName}`;
    
    activateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        try {
            // Απλά απενεργοποίησε το κουμπί και άλλαξε το κείμενο
            activateBtn.disabled = true;
            activateBtn.textContent = 'Activating...';
            
            const runResult = await window.api.runInstaller(activatorPath);
            
            if (runResult.success) {
                // Success state
                activateBtn.classList.add('success');
                activateBtn.textContent = 'Activated';
                activateBtn.disabled = true;
                
                // Προσπάθεια cleanup μετά από 2 δευτερόλεπτα
                setTimeout(() => {
                    try {
                        window.api.cleanupFile(activatorPath);
                    } catch (err) {
                        console.log('Cleanup optional:', err.message);
                    }
                }, 2000);
                
                toast('Advanced Installer activated successfully!', {
                    type: 'success',
                    title: 'Advanced Installer',
                    duration: 3000
                });
            } else {
                throw new Error(runResult.error || 'Activation failed');
            }
        } catch (error) {
            // Error state
            activateBtn.classList.add('error');
            activateBtn.textContent = 'Retry';
            activateBtn.disabled = false;
            
            toast(`Activation failed: ${error.message}`, {
                type: 'error',
                title: 'Advanced Installer'
            });
        }
    });
    
    buttonContainer.appendChild(activateBtn);
}


async function retryCleanup(filePath, maxRetries = 3) {
    const fs = window.api.fs;
    const path = window.api.path;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Έλεγξε αν το αρχείο υπάρχει
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`File deleted successfully on attempt ${i + 1}`);
                
                // Προσπάθησε να διαγράψεις και τον φάκελο αν είναι άδειος
                const dir = path.dirname(filePath);
                try {
                    const files = fs.readdirSync(dir);
                    if (files.length === 0) {
                        fs.rmdirSync(dir);
                        console.log('Empty directory deleted');
                    }
                } catch (dirErr) {
                    // Μην ενοχλείς αν δεν μπορείς να διαγράψεις τον φάκελο
                    console.log('Could not delete directory:', dirErr.message);
                }
            }
            return; // Επιτυχία
        } catch (error) {
            if (error.code === 'EBUSY' && i < maxRetries - 1) {
                // Περίμενε πριν από το επόμενο retry
                const delay = (i + 1) * 1000; // 1, 2, 3 δευτερόλεπτα
                console.log(`File busy, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error; // Ρίξε το error αν δεν είναι EBUSY ή τελείωσαν τα retries
            }
        }
    }
}
// Parse winget list output to extract installed package IDs
function parseWingetListOutput(output) {
    const lines = output.split('\n');
    const installedPackages = [];

    // Find the header line to determine where data starts
    let headerLineIndex = -1;
    let idColumnStart = -1;
    let versionColumnStart = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.includes('name') && lowerLine.includes('id') && lowerLine.includes('version')) {
            headerLineIndex = i;
            // Find column positions - look for "Id" (capital I) in header
            idColumnStart = line.indexOf('Id');
            if (idColumnStart === -1) {
                idColumnStart = lowerLine.indexOf('id');
            }
            versionColumnStart = lowerLine.indexOf('version');
            break;
        }
    }

    if (headerLineIndex === -1) {
        debug('warn', 'Could not find winget list header');
        return installedPackages;
    }

    if (idColumnStart === -1 || versionColumnStart === -1) {
        debug('warn', 'Could not find ID or Version column positions');
        return installedPackages;
    }

    debug('info', 'Header found at line', headerLineIndex, 'ID column:', idColumnStart, 'Version column:', versionColumnStart);
    debug('info', 'Header line:', lines[headerLineIndex]);

    // Parse package lines starting from 2 lines after header (skip header and separator line)
    for (let i = headerLineIndex + 2; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Skip separator lines (dashes) or empty lines
        if (trimmedLine.startsWith('-') || trimmedLine.length < 5) {
            continue;
        }

        // First, try to extract ID using regex patterns (more reliable)
        // Priority: Publisher.Package format (most common winget format)
        let idPart = null;
        
        // Try to find Publisher.Package pattern in the line
        const dotPattern = /([A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9][A-Za-z0-9._-]*(?:\.[A-Za-z0-9][A-Za-z0-9._-]*)?)/;
        const dotMatch = line.match(dotPattern);
        if (dotMatch && dotMatch[1]) {
            idPart = dotMatch[1];
        } else {
            // Try fixed-width column parsing as fallback
            if (line.length > idColumnStart) {
                const endPos = Math.min(versionColumnStart, line.length);
                idPart = line.substring(idColumnStart, endPos).trim();
                idPart = idPart.replace(/[.…]+$/, '').trim();
            }
        }

        // Skip if empty or invalid
        if (!idPart || idPart.length < 2 || /^[.…\s]+$/.test(idPart)) {
            continue;
        }

        // Additional validation: should contain at least one dot (for Publisher.Package format)
        // or be an ARP\... format
        if (idPart.includes('.') || idPart.startsWith('ARP\\')) {
            installedPackages.push(idPart);
        }
    }

    debug('info', `Found ${installedPackages.length} installed packages:`, installedPackages.slice(0, 10));
    return installedPackages;
}

// Make processAdvancedInstaller available globally for custom packages
if (typeof window !== 'undefined') {
    window.processAdvancedInstaller = processAdvancedInstaller;
}

// ============================================
// WINGET INSTALL PAGE
// ============================================

export async function buildInstallPageWingetWithCategories(translations, settings, buttonStateManager) {
    const container = document.createElement('div');
    container.className = 'card';

    const searchWrapper = document.createElement('div');
    searchWrapper.classList.add('search-wrapper');

    const searchContainer = document.createElement('div');
    searchContainer.classList.add('search-container');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = (translations.messages && translations.messages.search_apps) || 'Search apps...';
    searchInput.className = 'search-input-styled';

    searchContainer.appendChild(searchInput);
    searchWrapper.appendChild(searchContainer);
    container.appendChild(searchWrapper);

    const actionsWrapper = document.createElement('div');
    actionsWrapper.classList.add('actions-wrapper');

    function makeButton(text, color) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = text;
        if (color) {
            const c = String(color).toLowerCase();
            if (c === '#dc2626' || c === 'dc2626') {
                btn.classList.add('danger');
            } else {
                btn.style.backgroundColor = color;
                btn.style.borderColor = color;
            }
        }
        return btn;
    }

    const installIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;
    const uninstallIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/><path d="M9 6l1-2h4l1 2" opacity="0.3"/></svg>`;
    const exportIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><circle cx="12" cy="3" r="1.5" fill="currentColor" opacity="0.3"/><path d="M8 15h8" opacity="0.4"/></svg>`;
    const importIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M16 7H8" opacity="0.4"/><circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;
    const checkInstalledIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/><circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;

    const installText = (translations.actions && translations.actions.install_selected) || 'Install Selected';
    const uninstallText = (translations.actions && translations.actions.uninstall_selected) || 'Uninstall Selected';
    const exportText = (translations.actions && translations.actions.export_list) || 'Export List';
    const importText = (translations.actions && translations.actions.import_list) || 'Import List';
    const checkInstalledText = (translations.actions && translations.actions.check_installed) || 'Check Installed';
    const uncheckAllText = (translations.actions && translations.actions.uncheck_all) || 'Uncheck All';

    const uncheckAllIcon = `<svg class="action-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6m0-6l-6 6"/></svg>`;

    const installBtn = makeButton(installText, '');
    const uninstallBtn = makeButton(uninstallText, '#dc2626');
    const exportBtn = makeButton(exportText, '');
    const importBtn = makeButton(importText, '');
    const checkInstalledBtn = makeButton(checkInstalledText, '');
    const uncheckAllBtn = makeButton(uncheckAllText, '');

    installBtn.innerHTML = `${installIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(installText)}</span>`;
    uninstallBtn.innerHTML = `${uninstallIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(uninstallText)}</span>`;
    exportBtn.innerHTML = `${exportIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(exportText)}</span>`;
    importBtn.innerHTML = `${importIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(importText)}</span>`;
    checkInstalledBtn.innerHTML = `${checkInstalledIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(checkInstalledText)}</span>`;
    uncheckAllBtn.innerHTML = `${uncheckAllIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(uncheckAllText)}</span>`;

    installBtn.classList.add('btn-install', 'bulk-action-btn', 'bulk-install');
    uninstallBtn.classList.add('btn-uninstall', 'bulk-action-btn', 'bulk-uninstall');
    exportBtn.classList.add('btn-export', 'bulk-action-btn', 'bulk-export');
    importBtn.classList.add('btn-import', 'bulk-action-btn', 'bulk-import');
    checkInstalledBtn.classList.add('btn-check-installed', 'bulk-action-btn', 'bulk-check-installed');
    uncheckAllBtn.classList.add('btn-uncheck-all', 'bulk-action-btn', 'bulk-uncheck-all');

    actionsWrapper.appendChild(installBtn);
    actionsWrapper.appendChild(uninstallBtn);
    actionsWrapper.appendChild(checkInstalledBtn);
    actionsWrapper.appendChild(uncheckAllBtn);
    container.appendChild(actionsWrapper);

    // Create second row for export/import
    const actionsWrapper2 = document.createElement('div');
    actionsWrapper2.classList.add('actions-wrapper', 'actions-wrapper-secondary');
    actionsWrapper2.appendChild(exportBtn);
    actionsWrapper2.appendChild(importBtn);
    container.appendChild(actionsWrapper2);

    function updateActionButtonsState() {
        const anyChecked = container.querySelectorAll('input[type="checkbox"]:checked').length > 0;
        installBtn.disabled = !anyChecked;
        uninstallBtn.disabled = !anyChecked;
        exportBtn.disabled = !anyChecked;
    }

    updateActionButtonsState();

    container.addEventListener('change', (e) => {
        if (e.target && e.target.type === 'checkbox') {
            updateActionButtonsState();
        }
    });

    const listContainer = document.createElement('div');
    listContainer.classList.add('list-container');
    container.appendChild(listContainer);

    async function buildList() {
        let appsData;
        try {
            const response = await fetch('installer.json');
            appsData = await response.json();
        } catch (err) {
            debug('error', 'Failed to load installer.json:', err);
            toast('Failed to load app list.', { type: 'error', title: 'Install' });
            return;
        }

        const ids = Array.isArray(appsData?.apps) ? appsData.apps : [];
        const categories = {};

        ids.forEach((id) => {
            let name;
            if (typeof id === 'string') {
                const parts = id.split('.');
                name = parts.slice(1).join(' ') || id;
            } else {
                name = String(id);
            }
            const cat = getCategoryForId(id);
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ id, name });
        });

        (CUSTOM_APPS || []).forEach((cApp) => {
            const cat = cApp.category || 'Utilities';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({
                id: cApp.id,
                name: cApp.name,
                custom: true,
                url: cApp.url,
                ext: cApp.ext
            });
        });

        const total = ids.length + (CUSTOM_APPS ? CUSTOM_APPS.length : 0);
        const plural = total !== 1 ? 's' : '';
        const template = (translations.messages && translations.messages.search_for_total) || 'Search for {total} app{plural}...';
        searchInput.placeholder = template
            .replace('{total}', total)
            .replace('{plural}', plural);

        listContainer.innerHTML = '';
        const orderedCats = ['Browsers', 'Games', 'Music', 'Development', 'Security', 'Utilities', 'Others'];

        orderedCats.forEach((cat) => {
            const items = categories[cat];
            if (!items || !items.length) return;

            const group = document.createElement('div');
            const heading = document.createElement('h3');
            heading.textContent = cat;
            heading.classList.add('category-heading');
            group.appendChild(heading);

            const ul = document.createElement('ul');
            ul.className = 'install-grid';
            ul.classList.add('category-list');

            items.sort((a, b) => a.name.localeCompare(b.name)).forEach((app, index) => {
                const li = document.createElement('li');
                li.classList.add('app-list-item');
                li.dataset.appId = app.id;
                li.dataset.appName = app.name;
                if (app.custom) {
                    li.dataset.isCustom = 'true';
                    if (app.url) li.dataset.customUrl = app.url;
                    if (app.ext) li.dataset.customExt = app.ext;
                }

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                const cbId = `pkg-${cat}-${index}`;
                checkbox.id = cbId;
                checkbox.classList.add('app-checkbox');

                const fav = document.createElement('img');
                fav.classList.add('app-favicon');
                fav.src = getFaviconUrl(app.id, app.name);
                fav.onerror = async () => {
                    if (!fav.dataset.fallback) {
                        fav.dataset.fallback = '1';
                        try {
                            const iconPath = await window.api.getAssetPath('icons/hacker.ico');
                            fav.src = iconPath;
                        } catch (err) {
                            fav.src = 'src/assets/icons/hacker.ico';
                        }
                    }
                };

                const label = document.createElement('label');
                label.setAttribute('for', cbId);
                label.classList.add('app-label');

                const textContainer = document.createElement('div');
                textContainer.classList.add('app-text-container');

                const nameEl = document.createElement('span');
                nameEl.textContent = app.name;
                nameEl.classList.add('app-name');

                const idEl = document.createElement('span');
                idEl.textContent = app.id;
                idEl.classList.add('app-id');

                textContainer.appendChild(nameEl);
                textContainer.appendChild(idEl);

                label.appendChild(fav);
                label.appendChild(textContainer);

                li.appendChild(checkbox);
                li.appendChild(label);

                const devUrl = app.custom ? '' : getDeveloperUrl(app.id);
                if (devUrl) {
                    const linkEl = document.createElement('a');
                    linkEl.href = '#';
                    linkEl.target = '_blank';
                    linkEl.rel = 'noopener noreferrer';
                    linkEl.classList.add('app-link');
                    linkEl.setAttribute('aria-label', 'Open developer site');
                    linkEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="13 6 19 12 13 18"></polyline></svg>';
                    linkEl.addEventListener('click', (event) => {
                        event.preventDefault();
                        try {
                            if (window.api && typeof window.api.openExternal === 'function') {
                                window.api.openExternal(devUrl);
                            } else {
                                window.open(devUrl, '_blank');
                            }
                        } catch (err) {
                            // Ignore
                        }
                    });
                    li.appendChild(linkEl);
                }
                ul.appendChild(li);
            });
            group.appendChild(ul);
            listContainer.appendChild(group);
        });
    }

    function applySearchFilter() {
        const query = searchInput.value.trim().toLowerCase();
        const groups = listContainer.children;
        Array.from(groups).forEach((group) => {
            let visible = false;
            const items = group.querySelectorAll('li');
            items.forEach((li) => {
                const name = li.dataset.appName.toLowerCase();
                const id = li.dataset.appId.toLowerCase();
                const match = !query || name.includes(query) || id.includes(query);
                li.classList.toggle('hidden', !match);
                if (match) visible = true;
            });
            group.classList.toggle('hidden', !visible);
        });
    }

    const debouncedSearch = debounce(applySearchFilter, 250);
    searchInput.addEventListener('input', debouncedSearch);
    searchInput._searchCleanup = () => {
        debouncedSearch.cancel();
    };

    // Import button handler
    importBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.classList.add('file-input-hidden');
        document.body.appendChild(fileInput);

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
                document.body.removeChild(fileInput);
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const ids = JSON.parse(reader.result);
                    if (!Array.isArray(ids)) {
                        throw new Error('Invalid file format');
                    }
                    const idSet = new Set(ids.map((x) => String(x)));
                    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach((cb) => {
                        const li = cb.closest('li');
                        if (li && li.dataset.appId) {
                            cb.checked = idSet.has(li.dataset.appId);
                        }
                    });
                    toast('List imported.', { type: 'success', title: 'Import' });
                } catch (err) {
                    debug('error', 'Failed to import list:', err);
                    toast('Failed to import list.', { type: 'error', title: 'Import' });
                } finally {
                    document.body.removeChild(fileInput);
                }
            };
            reader.onerror = () => {
                debug('error', 'File read error');
                toast('Failed to read file.', { type: 'error', title: 'Import' });
                document.body.removeChild(fileInput);
            };
            reader.readAsText(file);
        });
        fileInput.click();
    });

    // Check Installed button handler
    checkInstalledBtn.addEventListener('click', async () => {
        if (buttonStateManager.isLoading(checkInstalledBtn)) {
            return;
        }

        buttonStateManager.setLoading(checkInstalledBtn, 'Checking...');

        // Disable other buttons during check
        [installBtn, uninstallBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        try {
            // Run winget list command
            const result = await window.api.runCommand('winget list --accept-source-agreements');

            if (result.error && !result.stdout && !result.stderr) {
                throw new Error('Winget command failed to execute. Make sure Winget is installed.');
            }

            const output = (result.stdout || '') + (result.stderr || '');
            const installedPackages = parseWingetListOutput(output);

            debug('info', 'Parsed installed packages:', installedPackages.slice(0, 20));

            // Update checkboxes for installed packages
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            let checkedCount = 0;
            const allAppIds = [];

            checkboxes.forEach((cb) => {
                const li = cb.closest('li');
                if (li && li.dataset.appId) {
                    const appId = li.dataset.appId;
                    allAppIds.push(appId);
                    const appIdLower = appId.toLowerCase();
                    const isInstalled = installedPackages.some(pkgId => {
                        const pkgIdLower = pkgId.toLowerCase();
                        return pkgIdLower === appIdLower;
                    });
                    if (isInstalled) {
                        cb.checked = true;
                        checkedCount++;
                        debug('info', `Matched installed package: ${appId}`);
                    }
                }
            });

            debug('info', `Total app IDs in list: ${allAppIds.length}, Installed packages found: ${installedPackages.length}, Matched: ${checkedCount}`);

            updateActionButtonsState();

            toast(`Found ${checkedCount} installed applications and marked them as selected.`, {
                type: 'success',
                title: 'Check Installed',
                duration: 4000
            });

        } catch (error) {
            debug('error', 'Failed to check installed packages:', error);
            toast(`Failed to check installed applications: ${error.message}`, {
                type: 'error',
                title: 'Check Installed'
            });
        } finally {
            buttonStateManager.resetState(checkInstalledBtn);
            [installBtn, uninstallBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
        }
    });

    // Uncheck All button handler
    uncheckAllBtn.addEventListener('click', () => {
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        let uncheckedCount = 0;
        
        checkboxes.forEach((cb) => {
            if (cb.checked) {
                cb.checked = false;
                uncheckedCount++;
            }
        });

        updateActionButtonsState();

        if (uncheckedCount > 0) {
            toast(`Unchecked ${uncheckedCount} application${uncheckedCount !== 1 ? 's' : ''}.`, {
                type: 'success',
                title: 'Uncheck All'
            });
        }
    });

    // Export button handler
    exportBtn.addEventListener('click', () => {
        const selectedIds = [];
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach((cb) => {
            if (cb.checked) {
                const li = cb.closest('li');
                if (li && li.dataset.appId) {
                    selectedIds.push(li.dataset.appId);
                }
            }
        });
        try {
            const json = JSON.stringify(selectedIds, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            a.download = `selected-packages-${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 0);
            toast('List exported.', { type: 'success', title: 'Export' });
        } catch (err) {
            debug('error', 'Failed to export list:', err);
            toast('Failed to export list.', { type: 'error', title: 'Export' });
        }
    });

    // Apps that need to be launched after installation to complete setup
    const APPS_REQUIRING_LAUNCH = [
        'Valve.Steam',
        'EpicGames.EpicGamesLauncher',
        'ElectronicArts.EADesktop',
        'Ubisoft.Connect',
        'Blizzard.BattleNet',
        'Mojang.MinecraftLauncher'
    ];

    // Install/uninstall handlers
    async function runWingetForSelected(action) {
        const isInstall = action === 'install';
        const actionBtn = isInstall ? installBtn : uninstallBtn;

        if (buttonStateManager.isLoading(actionBtn)) {
            return;
        }

        const selectedItems = [];
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');

        checkboxes.forEach((cb) => {
            if (cb.checked) {
                const li = cb.closest('li');
                if (li) selectedItems.push(li);
            }
        });

        if (selectedItems.length === 0) {
            toast('No applications selected.', { type: 'info', title: 'Install' });
            return;
        }

        const loadingText = isInstall ? 'Installing...' : 'Uninstalling...';
        buttonStateManager.setLoading(actionBtn, loadingText);

        const otherBtn = isInstall ? uninstallBtn : installBtn;
        [otherBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        let successCount = 0;
        let errorCount = 0;
        const totalItems = selectedItems.length;
        const results = [];
        const appsToLaunch = [];

        const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

        const updateProgress = (current) => {
            const labelEl = actionBtn.querySelector('.btn-label');
            const progressText = isInstall
                ? `Installing ${current}/${totalItems}...`
                : `Uninstalling ${current}/${totalItems}...`;
            if (labelEl) {
                labelEl.textContent = progressText;
            } else {
                actionBtn.textContent = progressText;
            }
        };

        let currentIndex = 0;
        for (const li of selectedItems) {
            currentIndex++;
            updateProgress(currentIndex);
            await yieldToUI();

            const id = li.dataset.appId;
            const appName = li.dataset.appName || id;

            if (li.dataset.isCustom === 'true') {
                if (!isInstall) {
                    results.push({ name: appName, success: false, error: 'Cannot uninstall automatically', type: 'custom' });
                    errorCount++;
                    continue;
                }
                try {
                    await installCustomPackage(li);
                    results.push({ name: appName, success: true, type: 'custom' });
                    successCount++;
                } catch (err) {
                    results.push({ name: appName, success: false, error: err.message, type: 'custom' });
                    errorCount++;
                }
                continue;
            }

            const command = isInstall
                ? `winget install --id ${id} -e --silent --accept-source-agreements --accept-package-agreements`
                : `winget uninstall --id ${id} -e --silent`;

            try {
                let result = await window.api.runCommand(command);
                let output = ((result.stdout || '') + (result.stderr || '')).toLowerCase();

                // Check for hash mismatch and retry with --ignore-security-hash
                if (isInstall && output.includes('hash') && (output.includes('does not match') || output.includes('mismatch'))) {
                    // Enable the hash override setting with elevated privileges
                    try {
                        await window.api.runElevatedWinget('winget settings --enable InstallerHashOverride');
                    } catch (enableErr) {
                        // Continue anyway, might already be enabled
                    }
                    
                    // Retry with --ignore-security-hash
                    const retryCommand = `${command} --ignore-security-hash`;
                    result = await window.api.runCommand(retryCommand);
                    output = ((result.stdout || '') + (result.stderr || '')).toLowerCase();
                }

                // Check for winget-specific exit codes that aren't real failures
                // Extract exit code from error message if present
                let exitCode = null;
                if (result.error && result.error.includes('code')) {
                    const codeMatch = result.error.match(/code\s+(\d+)/);
                    if (codeMatch) {
                        exitCode = parseInt(codeMatch[1], 10);
                    }
                }

                // Winget exit codes that indicate success or partial success:
                // 0x8A15002B (2316632107) - Restart required to complete
                // 0x8A150056 (2316632150) - Package already installed  
                // Note: 0x8A150011 (2316632081) means installer failed, NOT success
                const successExitCodes = [0, 2316632107, 2316632150];
                const restartRequiredCodes = [2316632107];
                const isSuccessExitCode = exitCode !== null && successExitCodes.includes(exitCode);

                if (isInstall) {
                    // Success indicators
                    const installSuccess = output.includes('successfully installed') ||
                        output.includes('installation successful') ||
                        output.includes('installer hash verified');

                    const alreadyInstalled = output.includes('no applicable upgrade found') ||
                        output.includes('already installed') ||
                        output.includes('no newer package versions') ||
                        output.includes('same version already installed');

                    // Failure indicators
                    const installFailed = output.includes('installation failed') ||
                        output.includes('no package found') ||
                        output.includes('did not find a match') ||
                        output.includes('installer failed') ||
                        output.includes('package is not available');

                    // User cancelled or needs interaction
                    const userCancelled = output.includes('cancelled by user') ||
                        output.includes('canceled by user') ||
                        output.includes('operation was cancelled');

                    // Check for restart required in output
                    const restartRequired = output.includes('restart') || 
                        output.includes('reboot') ||
                        exitCode === 2316632081 ||
                        exitCode === 2316632107;

                    if (installSuccess || (isSuccessExitCode && !installFailed)) {
                        if (restartRequired) {
                            results.push({ name: appName, success: true, status: 'restart_required' });
                        } else {
                            results.push({ name: appName, success: true, status: 'installed' });
                        }
                        successCount++;

                        // Track apps that need to be launched
                        if (APPS_REQUIRING_LAUNCH.includes(id)) {
                            appsToLaunch.push({ id, name: appName });
                        }
                    } else if (alreadyInstalled) {
                        results.push({ name: appName, success: true, status: 'already_installed' });
                        successCount++;
                    } else if (userCancelled) {
                        results.push({ name: appName, success: false, status: 'cancelled', error: 'Cancelled by user' });
                        errorCount++;
                    } else if (installFailed && !isSuccessExitCode) {
                        results.push({ name: appName, success: false, status: 'failed', error: result.error || 'Installation failed' });
                        errorCount++;
                    } else if (result && result.error && !isSuccessExitCode) {
                        // Has error but no clear failure message - might be a false positive
                        // Check if there's any indication it might have worked
                        if (output.includes('starting package install') || output.includes('downloading')) {
                            results.push({ name: appName, success: true, status: 'launched' });
                            successCount++;
                        } else {
                            results.push({ name: appName, success: false, status: 'failed', error: result.error });
                            errorCount++;
                        }
                    } else {
                        // No error or success exit code, assume success
                        results.push({ name: appName, success: true, status: 'installed' });
                        successCount++;
                    }
                } else {
                    const uninstallSuccess = output.includes('successfully uninstalled');
                    const notInstalled = output.includes('no installed package found') ||
                        (output.includes('did not find') && output.includes('installed'));
                    const cancelled = output.includes('cancelled') || output.includes('canceled');

                    if (uninstallSuccess) {
                        results.push({ name: appName, success: true, status: 'uninstalled' });
                        successCount++;
                    } else if (notInstalled) {
                        results.push({ name: appName, success: true, status: 'not_installed' });
                        successCount++;
                    } else if (cancelled) {
                        results.push({ name: appName, success: false, status: 'cancelled' });
                        errorCount++;
                    } else {
                        results.push({ name: appName, success: true, status: 'launched' });
                        successCount++;
                    }
                }
            } catch (err) {
                results.push({ name: appName, success: false, error: err.message });
                errorCount++;
            }

            await yieldToUI();
        }

        const failedApps = results.filter(r => !r.success);

        const restartNeeded = results.some(r => r.status === 'restart_required');

        // Launch apps that require it for setup completion
        if (isInstall && appsToLaunch.length > 0) {
            // Wait a bit to ensure installation is fully complete
            await new Promise(resolve => setTimeout(resolve, 3000));

            const launchMap = {
                'Valve.Steam': 'steam://open/main',
                'EpicGames.EpicGamesLauncher': 'com.epicgames.launcher://apps',
                'ElectronicArts.EADesktop': 'origin://',
                'Ubisoft.Connect': 'uplay://',
                'Blizzard.BattleNet': 'battlenet://',
                'Mojang.MinecraftLauncher': 'minecraft://'
            };

            for (const app of appsToLaunch) {
                try {
                    const uri = launchMap[app.id];
                    if (uri) {
                        // Try using the protocol URL first
                        try {
                            await window.api.openExternal(uri);
                            debug('info', `Launched ${app.name} via protocol for setup completion`);
                        } catch (protocolErr) {
                            // Fallback to start command
                            debug('warn', `Protocol launch failed for ${app.name}, trying start command`);
                            await window.api.runCommand(`start "" "${app.id.split('.').pop()}"`);
                        }
                    } else {
                        // Generic start command based on package name
                        const appExe = app.id.split('.').pop();
                        await window.api.runCommand(`start "" "${appExe}"`);
                        debug('info', `Launched ${app.name} for setup completion`);
                    }
                } catch (err) {
                    debug('warn', `Could not auto-launch ${app.name}:`, err);
                    // Don't fail the whole process, just log and continue
                }
            }

            if (appsToLaunch.length > 0) {
                const appNames = appsToLaunch.map(a => a.name).join(', ');
                toast(`Launched ${appNames} to complete setup. Please complete the first-time setup in the application.`, {
                    type: 'info',
                    title: 'Setup Required',
                    duration: 6000
                });
            }
        }

        if (successCount > 0 && errorCount === 0) {
            let message = `All ${selectedItems.length} applications ${isInstall ? 'installed' : 'uninstalled'} successfully!`;
            if (restartNeeded) {
                message += ' Some may require a restart to complete.';
            }
            toast(message, {
                type: 'success',
                title: 'Completed'
            });
        } else if (successCount > 0 && errorCount > 0) {
            const failedNames = failedApps.map(f => f.name).join(', ');
            toast(`Completed: ${successCount} successful, ${errorCount} failed. Failed: ${failedNames}`, {
                type: 'warning',
                title: 'Partial Completion'
            });
        } else if (errorCount > 0) {
            const failedNames = failedApps.map(f => f.name).join(', ');
            toast(`All ${errorCount} ${isInstall ? 'installations' : 'uninstallations'} failed: ${failedNames}`, {
                type: 'error',
                title: 'Failed'
            });
        }

        buttonStateManager.resetState(actionBtn);
        [otherBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
        updateActionButtonsState();
    }

    async function installCustomPackage(li) {
        const appName = li.dataset.appName || li.dataset.appId;
        const url = li.dataset.customUrl;
        const ext = li.dataset.customExt || 'zip';

        if (!url) {
            throw new Error('Download URL missing for custom package');
        }

        const safeName = String(appName).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
        const dest = `${safeName}.${ext}`;
        const downloadId = `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

        return new Promise((resolve, reject) => {
            const unsubscribe = window.api.onDownloadEvent(async (data) => {
                try {
                    if (data.id !== downloadId) return;

                    if (data.status === 'error') {
                        unsubscribe();
                        reject(new Error(data.error || 'Download failed'));
                        return;
                    }

                    if (data.status === 'complete') {
                        unsubscribe();

                        try {
                            const downloadedExt = ext.toLowerCase();

                            if (downloadedExt === 'zip') {
                                const statusEl = document.createElement('span');
                                statusEl.style.display = 'none';
                                li.appendChild(statusEl);
                                
                                // Καλεί την processAdvancedInstaller που θα δημιουργήσει το activate button
                                await processAdvancedInstaller(data.path, statusEl, appName, li);
                            } else if (downloadedExt === 'exe') {
                                const runRes = await window.api.runInstaller(data.path);
                                if (!runRes || !runRes.success) {
                                    throw new Error((runRes && runRes.error) || 'Failed to run installer');
                                }
                            } else {
                                const runRes = await window.api.runInstaller(data.path);
                                if (!runRes || !runRes.success) {
                                    throw new Error((runRes && runRes.error) || 'Failed to run installer');
                                }
                            }

                            resolve();
                        } catch (err) {
                            reject(err);
                        }
                    }
                } catch (err) {
                    unsubscribe();
                    reject(err);
                }
            });

            window.api.downloadStart(downloadId, url, dest);
        });
    }

    installBtn.addEventListener('click', () => runWingetForSelected('install'));
    uninstallBtn.addEventListener('click', () => runWingetForSelected('uninstall'));

    await buildList();
    return container;
}

// ============================================
// CRACK INSTALLER PAGE
// ============================================

export async function buildCrackInstallerPage(translations, settings, buttonStateManager) {
    const crackDesc = (translations.pages && translations.pages.crack_desc) || 'Download backups of your projects from Dropbox';

    const container = document.createElement('div');
    container.className = 'card';

    const pageDesc = document.createElement('p');
    pageDesc.textContent = crackDesc;
    pageDesc.classList.add('page-desc');
    container.appendChild(pageDesc);

    const projects = [
        {
            key: 'clip_studio_paint',
            fallbackName: 'Clip Studio Paint',
            desc: 'Digital painting and illustration software',
            url: 'https://www.dropbox.com/scl/fi/kx8gqow9zfian7g8ocqg3/Clip-Studio-Paint.zip?rlkey=wz4b7kfkchzgnsq9tpnp40rcw&st=rmp98tmo&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.clipstudio : 'https://i.postimg.cc/HLrJgc2G/clipstudio.png'
        },
        {
            key: 'encoder',
            fallbackName: 'Media Encoder',
            desc: 'Tool for encoding multimedia content',
            url: 'https://www.dropbox.com/scl/fi/mw4sk0dvdk2r8ux9g1lfc/encoder.zip?rlkey=qwnelw8d920jlum14n1x44zku&st=70gqw7ba&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.mediaencoder : 'https://i.postimg.cc/tCGFN5zh/mediaencoder.png'
        },
        {
            key: 'illustrator',
            fallbackName: 'Illustrator',
            desc: 'Vector graphics and illustration tool',
            url: 'https://www.dropbox.com/scl/fi/aw95btp46onbyhk50gn7b/Illustrator.zip?rlkey=mvklovmenagfasuhr6clorbfj&st=0ds5v39w&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.illustrator : 'https://i.postimg.cc/W1nm3kg2/illustrator.png'
        },
        {
            key: 'lightroom_classic',
            fallbackName: 'Adobe Lightroom Classic',
            desc: 'Photo editing and organising application',
            url: 'https://www.dropbox.com/scl/fi/0p9rln704lc3qgqtjad9n/Lightroom-Classic.zip?rlkey=gp29smsg6t8oxhox80661k4gu&st=cdv50zpy&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.lightroom : 'https://i.postimg.cc/K8rfMVSR/lightroom-classic.png'
        },
        {
            key: 'office',
            fallbackName: 'Office',
            desc: 'Microsoft Office suite (Word, Excel, etc.)',
            url: 'https://www.dropbox.com/scl/fi/pcfv8ft3egcq4x6jzigny/Office2024.zip?rlkey=qbic04ie56dvoxzk1smri0hoo&st=1r1veinx&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.office : 'https://i.postimg.cc/fb8JmWgm/office.png'
        },
        {
            key: 'photoshop',
            fallbackName: 'Photoshop',
            desc: 'Image editing and graphic design software',
            url: 'https://www.dropbox.com/scl/fi/8vf3d46sq1wj1rb55r4jz/Photoshop.zip?rlkey=6u0dpbfnqopfndwcwq1082f7a&st=5u4v6m3x&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.photoshop : 'https://i.postimg.cc/HnzW5d2w/photoshop.png'
        },
        {
            key: 'premiere',
            fallbackName: 'Premiere',
            desc: 'Video editing software',
            url: 'https://www.dropbox.com/scl/fi/1yqqufgow2v4rc93l6wu4/premiere.zip?rlkey=49ymly6zgzufwtijnf2se35tc&st=5i77afac&dl=1',
            icon: typeof FaviconConfig !== 'undefined' ? FaviconConfig.projectIcons?.premiere : 'https://i.postimg.cc/g2JjVX1j/premiere-pro.png'
        }
    ];

    const grid = document.createElement('div');
    grid.className = 'install-grid crack-grid';
    grid.classList.add('grid-auto-fit');

    projects.forEach((project) => {
        const { key, fallbackName, url, icon } = project;
        const name = (translations.apps && translations.apps[key] && translations.apps[key].name) || fallbackName;

        const card = document.createElement('div');
        card.className = 'app-card';

        const header = document.createElement('div');
        header.className = 'app-header';

        const img = document.createElement('img');
        img.src = icon;
        img.alt = name;
        img.className = 'app-icon';
        img.classList.add('download-card-img');
        header.appendChild(img);

        const h3 = document.createElement('h3');
        h3.textContent = name;
        header.appendChild(h3);
        card.appendChild(header);

        const p = document.createElement('p');
        p.textContent = '';

        const btn = document.createElement('button');
        btn.className = 'button';
        const downloadLabel = (translations.actions && translations.actions.download) || 'Download';
        btn.textContent = downloadLabel;
        btn.dataset.originalText = btn.textContent;

        const status = document.createElement('pre');
        status.className = 'status-pre';

        const isClipStudio = key === 'clip_studio_paint';
        let replaceBtn = null;

        if (isClipStudio) {
            replaceBtn = document.createElement('button');
            replaceBtn.className = 'button button-secondary';
            replaceBtn.textContent = 'Replace EXE';
            replaceBtn.classList.add('download-replace-btn');
            replaceBtn.style.display = 'none';
        }

        card.dataset.crackCard = 'true';

        btn.addEventListener('click', async () => {
            if (btn.disabled || buttonStateManager.isLoading(btn)) return;

            const cardId = `crack-${key}`;
            trackProcess(cardId, 'download', btn, status);

            btn.disabled = true;

            if (!btn.dataset.originalTextCrack) {
                btn.dataset.originalTextCrack = btn.textContent;
            }

            btn.textContent = 'Preparing download...';
            status.textContent = '';
            status.classList.remove('visible');

            if (replaceBtn) {
                replaceBtn.classList.remove('visible');
                replaceBtn.style.display = 'none';
            }

            const downloadId = `${cardId}-${Date.now()}`;

            const unsubscribe = window.api.onDownloadEvent(async (data) => {
                if (data.id !== downloadId) return;

                switch (data.status) {
                    case 'started':
                        btn.textContent = 'Downloading... 0%';
                        break;

                    case 'progress':
                        btn.textContent = `Downloading... ${data.percent}%`;
                        break;

                    case 'complete': {
                        btn.textContent = 'Download complete! Extracting...';

                        try {
                            const extractResult = await window.api.extractArchive(data.path, '123');

                            if (extractResult.success) {
                                btn.textContent = 'Extraction complete! Running installer...';
                                const extractedDir = getExtractedFolderPath(data.path);

                                let installerExe;
                                if (isClipStudio) {
                                    installerExe = await findClipStudioInstaller(extractedDir);
                                } else {
                                    installerExe = await findProjectInstaller(extractedDir, name);
                                }

                                if (installerExe) {
                                    const openResult = await window.api.openFile(installerExe);
                                    if (openResult.success) {
                                        if (isClipStudio) {
                                            btn.textContent = 'Installation in Progress';
                                            completeProcess(cardId, 'download', true);

                                            replaceBtn.classList.add('visible');
                                            replaceBtn.style.display = '';
                                            replaceBtn.disabled = false;
                                            replaceBtn.dataset.sourceDir = extractedDir;
                                            replaceBtn.dataset.targetPath = 'C:/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO PAINT/CLIPStudioPaint.exe';

                                            toast('Clip Studio installer started! Complete installation first.', {
                                                type: 'info',
                                                title: 'Clip Studio'
                                            });
                                        } else {
                                            btn.textContent = 'Installation Running';
                                            completeProcess(cardId, 'download', true);
                                            toast(`${name} installer started!`, {
                                                type: 'info',
                                                title: name
                                            });
                                        }
                                    } else {
                                        throw new Error('Could not start installer automatically');
                                    }
                                } else {
                                    throw new Error('Installer not found in extracted files');
                                }
                            } else {
                                throw new Error(extractResult.error || 'Extraction failed');
                            }
                        } catch (error) {
                            btn.textContent = btn.dataset.originalTextCrack || btn.textContent;
                            btn.disabled = false;

                            toast(error.message || 'An error occurred during installation', {
                                type: 'error',
                                title: name
                            });
                            completeProcess(cardId, 'download', false);
                        }
                        break;
                    }

                    case 'error':
                    case 'cancelled': {
                        btn.textContent = btn.dataset.originalTextCrack || btn.textContent;
                        btn.disabled = false;

                        toast(data.error || 'Download cancelled', {
                            type: 'error',
                            title: name
                        });
                        completeProcess(cardId, 'download', false);

                        if (replaceBtn) {
                            replaceBtn.classList.remove('visible');
                            replaceBtn.style.display = 'none';
                        }
                        unsubscribe();
                        break;
                    }
                }
            });

            window.api.downloadStart(downloadId, url, name);
        });

        const buttonWrapper = document.createElement('div');
        buttonWrapper.classList.add('button-wrapper');
        buttonWrapper.appendChild(btn);
        if (replaceBtn) {
            buttonWrapper.appendChild(replaceBtn);
        }

        card.appendChild(p);
        card.appendChild(buttonWrapper);
        card.appendChild(status);
        grid.appendChild(card);
    });

    container.appendChild(grid);
    return container;
}

export { getFaviconUrl, getDeveloperUrl, getCategoryForId, processAdvancedInstaller };