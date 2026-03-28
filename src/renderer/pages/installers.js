/**
 * Installers Page
 * Contains Winget Install Page and Crack Installer Page
 */

import { debug, escapeHtml, debounce, getBaseName, getExtractedFolderPath } from '../utils.js';
import { buttonStateManager, trackProcess, completeProcess, registerDownload, getActiveDownload, attachDownloadUI, downloadStore } from '../managers.js';
import { toast } from '../components.js';
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
            oracle: 'virtualbox.org/wiki/Downloads',
            logitech: 'logitech.com',
            notepadplusplus: 'notepad-plus-plus.org',
            cpuid: 'cpuid.com',
            crystaldew: 'crystalmark.info',
            crystaldewworld: 'crystalmark.info',
            malwarebytes: 'malwarebytes.com',
            teamviewer: 'teamviewer.com',
            anydesk: 'anydesk.com',
            betterdiscord: 'betterdiscord.app',
            iobit: 'www.iobit.com/en/advancedsystemcarefree.php',
            blizzard: 'battle.net',
            ubisoft: 'ubisoft.com/en-gb/ubisoft-connect/download',
            guru3d: 'guru3d.com/download/rtss-rivatuner-statistics-server-download/',
            anthropic: 'claude.ai',
            techpowerup: 'techpowerup.com/gpuz/',
            realix: 'hwinfo.com',
            blenderfoundation: 'blender.org/download/',
            'notepad++': 'notepad-plus-plus.org/downloads/',
            florianheidenreich: 'mp3tag.de/en/download.html',
            rufus: 'rufus.ie',
            ventoy: 'ventoy.net/en/download.html',
            revouninstaller: 'revouninstaller.com/products/revo-uninstaller-free/',
            stremio: 'stremio.com/downloads',
            apple: 'apple.com/itunes/',
            nvidia: 'nvidia.com/en-us/geforce/geforce-experience/',
            amd: 'amd.com/en/support/download/drivers.html'
        };
        const domain = domainMap[publisher] || `${publisher}.com`;
        return `https://${domain}`;
    } catch {
        return '';
    }
}

function getCategoryForId(pkgId) {
    const lower = String(pkgId).toLowerCase();
    // Order matters! More specific categories first
    const mappings = [
        // Hardware FIRST - to catch CPU-Z, HWMonitor etc before anything else
        { key: 'Hardware', keywords: ['cpu-z', 'gpu-z', 'hwinfo', 'hwmonitor', 'cpuid.', 'techpowerup', 'realix', 'afterburner', 'rtss', 'guru3d', 'crystaldisk', 'razer', 'synapse', 'streamdeck', 'elgato.', 'nvidia', 'geforce', 'amd.adrenalin', 'radeon'] },
        // Communication - Discord, Vesktop, etc
        { key: 'Communication', keywords: ['discord', 'vesktop', 'vencord', 'betterdiscord', 'slack', 'teams', 'zoom', 'telegram', 'signal', 'skype'] },
        // Then browsers
        { key: 'Browsers', keywords: ['firefox', 'google.chrome', 'brave.brave', 'opera', 'edge', 'vivaldi', 'tor', 'browser'] },
        // Games
        { key: 'Games', keywords: ['steam', 'epicgames', 'battlenet', 'ubisoft', 'riot', 'gog', 'psremoteplay', 'playstation', 'xbox', 'minecraft', 'mojang', 'eadesktop', 'electronicarts'] },
        // Media
        { key: 'Media', keywords: ['spotify', 'music', 'tidal', 'mp3tag', 'audio', 'vlc', 'winamp', 'itunes', 'obsstudio', 'obsproject', 'stremio', 'blender', 'video'] },
        // Development
        { key: 'Development', keywords: ['visualstudio', 'python', 'nodejs', 'openjs', 'git.git', 'github', 'gitlab', 'java', 'eclipse', 'intellij', 'jetbrains', 'vscode', 'docker', 'virtualbox', 'vmware', 'claude', 'anthropic', 'notepad'] },
        // Security
        { key: 'Security', keywords: ['vpn', 'bitdefender', 'antivirus', 'security', 'surfshark', 'nordsecurity', 'protonvpn', 'authenticator', 'password', 'malwarebytes', 'protonmail', 'protondrive', 'proton.proton'] },
        // Utilities last
        { key: 'Utilities', keywords: ['7zip', 'rarlab', 'winrar', 'freedownload', 'downloadmanager', 'driverbooster', 'softwareupdater', 'sysinfo', 'smartdefrag', 'uninstaller', 'iobit', 'rufus', 'ventoy', 'anydesk', 'dropbox.dropbox', 'googledrive', 'revo'] }
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

        statusElement.textContent = 'Starting Advanced Installer setup...';

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


// Parse winget list output to extract installed package IDs
function parseWingetColumns(rawOutput) {
    // Strip ANSI escape sequences, then handle \r correctly.
    // Winget uses bare \r (no \n) for progress spinners — overwriting the same line.
    // Split on \r\n first (real line endings), then for each chunk keep only the
    // last \r-segment (the final overwrite wins), replicating terminal behaviour.
    const cleaned = rawOutput
        .replace(/\x1b\[[0-9;]*m/g, '')
        .split('\r\n')
        .map(chunk => { const parts = chunk.split('\r'); return parts[parts.length - 1]; })
        .join('\n');
    const lines = cleaned.split('\n');

    let headerIdx = -1;
    let cols = null;

    // Find header: a line containing 'version' and a standalone 'id' word
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lc = line.toLowerCase();
        if (!lc.includes('version')) continue;

        // Match standalone 'id' surrounded by spaces (handles multiple spaces)
        const idMatch = /\s+(id)\s+/i.exec(line);
        if (!idMatch) continue;

        const idIdx = idMatch.index + idMatch[0].indexOf(idMatch[1]);
        const versionIdx = lc.indexOf('version');
        if (versionIdx <= idIdx) continue;

        const availIdx = lc.indexOf('available');
        const sourceIdx = lc.indexOf('source');

        cols = {
            id: idIdx,
            version: versionIdx,
            available: availIdx > versionIdx ? availIdx : -1,
            source: sourceIdx > versionIdx ? sourceIdx : -1
        };
        headerIdx = i;
        break;
    }

    if (!cols || headerIdx < 0) {
        // Regex fallback: match lines that contain a package ID pattern (e.g., Publisher.Package)
        const entries = [];
        const idRegex = /(?:^|\s)((?:[A-Za-z0-9_-]+\.){1,}[A-Za-z0-9_-]+)\s+([\d][^\s]*)/;
        for (const line of lines) {
            const m = idRegex.exec(line);
            if (m) {
                const id = m[1].trim();
                const version = m[2].trim();
                if (id.length >= 4) {
                    entries.push({ id, version, available: null });
                }
            }
        }
        return entries;
    }

    const entries = [];

    // Find separator line (dashes) after header — data starts after it
    let dataStart = headerIdx + 1;
    if (dataStart < lines.length && /^[\s\-─═]+$/.test(lines[dataStart]) && lines[dataStart].trim().length > 5) {
        dataStart = headerIdx + 2;
    }

    for (let i = dataStart; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        // Skip separator lines (dashes or box-drawing chars)
        if (/^[\s\-─═]+$/.test(line) && line.trim().length > 5) continue;

        const colEnd = (start, ...nexts) => {
            const valid = nexts.filter(n => n > start && n >= 0).sort((a, b) => a - b);
            return valid.length ? Math.min(valid[0], line.length) : line.length;
        };
        const extract = (start, ...nexts) => {
            if (start < 0 || line.length <= start) return '';
            return line.substring(start, colEnd(start, ...nexts)).trim().replace(/[…\.]+$/, '').trim();
        };

        const endPoints = [cols.version, cols.available, cols.source].filter(n => n >= 0);
        const id = extract(cols.id, ...endPoints);
        const versionEnd = [cols.available, cols.source].filter(n => n >= 0);
        const version = extract(cols.version, ...versionEnd);
        const available = cols.available >= 0
            ? extract(cols.available, ...[cols.source].filter(n => n >= 0))
            : '';

        if (id && id.length >= 2 && (id.includes('.') || id.startsWith('{') || id.startsWith('ARP'))) {
            entries.push({ id, version, available: available || null });
        }
    }

    return entries;
}

function matchWingetId(appId, pkgId) {
    const a = appId.toLowerCase();
    const p = pkgId.toLowerCase();
    if (a === p) return true;
    if (p.startsWith(a) || a.startsWith(p)) return true;
    const aParts = a.split('.');
    const pParts = p.split('.');
    if (aParts.length >= 2 && pParts.length >= 2) {
        if (aParts[0] === pParts[0] && aParts[1] === pParts[1]) return true;
    }
    return false;
}

// Make processAdvancedInstaller available globally for custom packages
if (typeof window !== 'undefined') {
    window.processAdvancedInstaller = processAdvancedInstaller;
}

// ============================================
// WINGET AVAILABILITY CHECK
// ============================================

async function checkWingetAvailable() {
    try {
        const result = await window.api.runCommand('winget --version');

        // Explicit "not found" signals — winget is genuinely missing
        const combined = ((result.stdout || '') + (result.stderr || '') + (result.error || '')).toLowerCase();
        const notFound =
            combined.includes('is not recognized') ||
            combined.includes('was not found') ||
            combined.includes('cannot find') ||
            combined.includes('no such file') ||
            combined.includes('winget: command not found');

        if (notFound) return { available: false };

        // Any other response (stdout present, no error, or just a non-zero exit
        // for unrelated reasons) → treat winget as available
        return { available: true };
    } catch {
        // spawn itself failed — winget not on PATH
        return { available: false };
    }
}

function showWingetMissingUI(container, translations) {
    // Remove any existing warning
    const existing = container.querySelector('.winget-missing-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'winget-missing-banner';
    banner.style.cssText = 'padding:16px 20px;margin:12px 0;border-radius:10px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:var(--text-primary,#fff);display:flex;align-items:center;gap:14px;';

    const icon = document.createElement('span');
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    icon.style.flexShrink = '0';

    const textWrap = document.createElement('div');
    textWrap.style.flex = '1';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600;font-size:14px;margin-bottom:4px;color:#ef4444;';
    title.textContent = (translations.messages && translations.messages.winget_not_installed) || 'Winget Not Installed';

    const desc = document.createElement('div');
    desc.style.cssText = 'font-size:13px;opacity:0.85;';
    desc.textContent = (translations.messages && translations.messages.winget_missing)
        || 'Winget (App Installer) is not found on this PC. Install it to use the app installer features.';

    const storeBtn = document.createElement('button');
    storeBtn.textContent = (translations.actions && translations.actions.open_store) || '📦 Open Microsoft Store';
    storeBtn.style.cssText = 'margin-top:10px;padding:6px 14px;border-radius:6px;border:none;background:#ef4444;color:#fff;font-size:13px;font-weight:500;cursor:pointer;';
    storeBtn.addEventListener('click', () => {
        try { window.api.openExternal('ms-windows-store://pdp/?productid=9NBLGGH4NNS1'); } catch { }
    });

    textWrap.appendChild(title);
    textWrap.appendChild(desc);
    textWrap.appendChild(storeBtn);
    banner.appendChild(icon);
    banner.appendChild(textWrap);

    // Insert after search wrapper
    const searchWrapper = container.querySelector('.search-wrapper');
    if (searchWrapper && searchWrapper.nextSibling) {
        container.insertBefore(banner, searchWrapper.nextSibling);
    } else {
        container.prepend(banner);
    }
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

    function makeButton(text, { danger = false } = {}) {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.textContent = text;
        if (danger) {
            btn.classList.add('danger');
        }
        return btn;
    }

    const installIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;
    const exportIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/><circle cx="12" cy="3" r="1.5" fill="currentColor" opacity="0.3"/><path d="M8 15h8" opacity="0.4"/></svg>`;
    const importIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/><path d="M16 7H8" opacity="0.4"/><circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;
    const checkInstalledIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/><circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.3"/></svg>`;

    const installText = (translations.actions && translations.actions.install_selected) || 'Install Selected';
    const exportText = (translations.actions && translations.actions.export_list) || 'Export List';
    const importText = (translations.actions && translations.actions.import_list) || 'Import List';
    const checkInstalledText = (translations.actions && translations.actions.check_installed) || 'Check Installed';
    const uncheckAllText = (translations.actions && translations.actions.uncheck_all) || 'Uncheck All';

    const uncheckAllIcon = `<svg class="action-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9l6 6m0-6l-6 6"/></svg>`;

    const installBtn = makeButton(installText);
    const exportBtn = makeButton(exportText);
    const importBtn = makeButton(importText);
    const checkInstalledBtn = makeButton(checkInstalledText);
    const uncheckAllBtn = makeButton(uncheckAllText);

    installBtn.innerHTML = `${installIcon}<span class="btn-label" >${escapeHtml(installText)}</span>`;
    exportBtn.innerHTML = `${exportIcon}<span class="btn-label" >${escapeHtml(exportText)}</span>`;
    importBtn.innerHTML = `${importIcon}<span class="btn-label" >${escapeHtml(importText)}</span>`;
    checkInstalledBtn.innerHTML = `${checkInstalledIcon}<span class="btn-label" >${escapeHtml(checkInstalledText)}</span>`;
    uncheckAllBtn.innerHTML = `${uncheckAllIcon}<span class="btn-label" >${escapeHtml(uncheckAllText)}</span>`;

    installBtn.classList.add('btn-install', 'bulk-action-btn', 'bulk-install');
    exportBtn.classList.add('btn-export', 'bulk-action-btn', 'bulk-export');
    importBtn.classList.add('btn-import', 'bulk-action-btn', 'bulk-import');
    checkInstalledBtn.classList.add('btn-check-installed', 'bulk-action-btn', 'bulk-check-installed');
    uncheckAllBtn.classList.add('btn-uncheck-all', 'bulk-action-btn', 'bulk-uncheck-all');

    actionsWrapper.appendChild(installBtn);
    actionsWrapper.appendChild(checkInstalledBtn);
    actionsWrapper.appendChild(uncheckAllBtn);
    container.appendChild(actionsWrapper);

    // Create second row for export/import
    const actionsWrapper2 = document.createElement('div');
    actionsWrapper2.classList.add('actions-wrapper', 'actions-wrapper-secondary');
    actionsWrapper2.appendChild(exportBtn);
    actionsWrapper2.appendChild(importBtn);
    container.appendChild(actionsWrapper2);

    // ── Controls bar: view toggle + sort ──────────────────────────
    const controlsBar = document.createElement('div');
    controlsBar.className = 'install-controls-bar';

    // View toggle
    const viewToggleGroup = document.createElement('div');
    viewToggleGroup.className = 'view-toggle-group';

    const listViewBtn = document.createElement('button');
    listViewBtn.className = 'view-toggle-btn active';
    listViewBtn.title = 'List view';
    listViewBtn.dataset.view = 'list';
    listViewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

    const gridViewBtn = document.createElement('button');
    gridViewBtn.className = 'view-toggle-btn';
    gridViewBtn.title = 'Grid view';
    gridViewBtn.dataset.view = 'grid';
    gridViewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;

    viewToggleGroup.appendChild(listViewBtn);
    viewToggleGroup.appendChild(gridViewBtn);

    // Sort button group (custom segmented control)
    const sortGroup = document.createElement('div');
    sortGroup.className = 'sort-btn-group';

    const sortOptions = [
        {
            value: 'default',
            label: (translations.actions && translations.actions.sort_default) || 'Category',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
        },
        {
            value: 'az',
            label: (translations.actions && translations.actions.sort_az) || 'A → Z',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="14" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/><polyline points="15 15 18 18 21 15"/><line x1="18" y1="6" x2="18" y2="18"/></svg>`
        },
        {
            value: 'za',
            label: (translations.actions && translations.actions.sort_za) || 'Z → A',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="14" y2="6"/><line x1="4" y1="12" x2="11" y2="12"/><line x1="4" y1="18" x2="8" y2="18"/><polyline points="15 9 18 6 21 9"/><line x1="18" y1="6" x2="18" y2="18"/></svg>`
        },
        {
            value: 'status',
            label: (translations.actions && translations.actions.sort_status) || 'Status',
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
        },
    ];

    sortOptions.forEach(({ value, label, icon }) => {
        const btn = document.createElement('button');
        btn.className = 'sort-btn';
        btn.dataset.sort = value;
        btn.innerHTML = `${icon}<span class="sort-btn-label">${escapeHtml(label)}</span>`;
        if (value === 'default') btn.classList.add('active');
        btn.addEventListener('click', () => {
            sortGroup.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applySort(value);
        });
        sortGroup.appendChild(btn);
    });

    controlsBar.appendChild(viewToggleGroup);
    controlsBar.appendChild(sortGroup);
    container.appendChild(controlsBar);

    // View + sort helpers
    let currentView = 'list';
    let currentSort = 'default';

    function applyView(view) {
        currentView = view;
        listContainer.dataset.view = view;
        listViewBtn.classList.toggle('active', view === 'list');
        gridViewBtn.classList.toggle('active', view === 'grid');
    }

    function applySort(value) {
        currentSort = value;
        const groups = listContainer.querySelectorAll(':scope > div');
        groups.forEach(group => {
            const ul = group.querySelector('.category-list');
            if (!ul) return;
            const items = Array.from(ul.querySelectorAll('li'));
            const statusOrder = { installed: 0, 'update-available': 1, failed: 2, unknown: 3, 'not-installed': 4 };
            items.sort((a, b) => {
                if (value === 'az') return (a.dataset.appName || '').localeCompare(b.dataset.appName || '');
                if (value === 'za') return (b.dataset.appName || '').localeCompare(a.dataset.appName || '');
                if (value === 'status') {
                    const as = a.querySelector('.app-status-badge')?.dataset?.status || 'unknown';
                    const bs = b.querySelector('.app-status-badge')?.dataset?.status || 'unknown';
                    const diff = (statusOrder[as] ?? 2) - (statusOrder[bs] ?? 2);
                    return diff !== 0 ? diff : (a.dataset.appName || '').localeCompare(b.dataset.appName || '');
                }
                // default: alphabetical (as originally built)
                return (a.dataset.appName || '').localeCompare(b.dataset.appName || '');
            });
            items.forEach(item => ul.appendChild(item));
        });
    }

    listViewBtn.addEventListener('click', () => applyView('list'));
    gridViewBtn.addEventListener('click', () => applyView('grid'));
    // ─────────────────────────────────────────────────────────────

    function updateActionButtonsState() {
        const anyChecked = container.querySelectorAll('input[type="checkbox"]:checked').length > 0;
        installBtn.disabled = !anyChecked;
        exportBtn.disabled = !anyChecked;
        uncheckAllBtn.disabled = !anyChecked;
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
        const orderedCats = ['Browsers', 'Communication', 'Games', 'Media', 'Development', 'Security', 'Hardware', 'Utilities', 'Others'];

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

                // Status badge
                const statusBadge = document.createElement('span');
                statusBadge.className = 'app-status-badge';
                statusBadge.dataset.status = 'unknown';

                // Progress bar with percentage label
                const progressWrap = document.createElement('div');
                progressWrap.className = 'app-progress-wrap hidden';
                const progressFill = document.createElement('div');
                progressFill.className = 'app-progress-fill';
                const progressLabel = document.createElement('span');
                progressLabel.className = 'app-progress-label';
                progressWrap.appendChild(progressFill);
                progressWrap.appendChild(progressLabel);

                li.appendChild(checkbox);
                li.appendChild(label);
                li.appendChild(statusBadge);
                li.appendChild(progressWrap);

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
        [installBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        try {
            // Check winget availability first
            const wingetCheck = await checkWingetAvailable();
            if (!wingetCheck.available) {
                showWingetMissingUI(container, translations);
                throw new Error('Winget is not installed on this PC. Click "Open Microsoft Store" to install App Installer.');
            }

            // Run winget list and winget upgrade in parallel
            const [listResult, upgradeResult] = await Promise.all([
                window.api.runCommand('winget list --accept-source-agreements --source winget'),
                window.api.runCommand('winget upgrade --include-unknown --accept-source-agreements --source winget')
            ]);

            if (listResult.error && !listResult.stdout && !listResult.stderr) {
                throw new Error('Winget command failed to execute. Make sure Winget is installed.');
            }

            const listOutput = (listResult.stdout || '') + (listResult.stderr || '');
            const upgradeOutput = (upgradeResult.stdout || '') + (upgradeResult.stderr || '');

            const installedPackages = parseWingetColumns(listOutput);
            const upgradablePackages = parseWingetColumns(upgradeOutput);

            // Update checkboxes for installed packages
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            let checkedCount = 0;
            let updateCount = 0;

            checkboxes.forEach((cb) => {
                const li = cb.closest('li');
                if (!li || !li.dataset.appId) return;
                const appId = li.dataset.appId;
                const badge = li.querySelector('.app-status-badge');

                const installedEntry = installedPackages.find(e => matchWingetId(appId, e.id));
                const upgradeEntry = upgradablePackages.find(e => matchWingetId(appId, e.id));

                if (installedEntry) {
                    checkedCount++;
                    if (upgradeEntry && upgradeEntry.available) {
                        updateCount++;
                        if (badge) {
                            badge.dataset.status = 'update-available';
                            badge.textContent = 'Update available';
                        }
                    } else {
                        if (badge) {
                            badge.dataset.status = 'installed';
                            badge.textContent = 'Installed';
                        }
                    }
                } else {
                    if (badge) {
                        badge.dataset.status = 'not-installed';
                        badge.textContent = 'Not installed';
                    }
                }
            });

            updateActionButtonsState();

            const updateMsg = updateCount > 0 ? `, ${updateCount} update${updateCount !== 1 ? 's' : ''} available` : '';
            toast(`Found ${checkedCount} installed application${checkedCount !== 1 ? 's' : ''}${updateMsg}.`, {
                type: 'success',
                title: 'Check Installed',
                duration: 4000
            });

            // Re-apply sort so status sort works immediately
            if (currentSort === 'status') applySort('status');

        } catch (error) {
            debug('error', 'Failed to check installed packages:', error);
            toast(`Failed to check installed applications: ${error.message}`, {
                type: 'error',
                title: 'Check Installed'
            });
        } finally {
            buttonStateManager.resetState(checkInstalledBtn);
            [installBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
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
    // Install handler (simple and install-only)
    async function runWingetInstallSelected() {
        const actionBtn = installBtn;

        if (buttonStateManager.isLoading(actionBtn)) return;

        const wingetCheck = await checkWingetAvailable();
        if (!wingetCheck.available) {
            showWingetMissingUI(container, translations);
            toast('Winget is not installed. Install App Installer from the Microsoft Store.', {
                type: 'error',
                title: 'Winget Not Found',
                duration: 6000
            });
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

        buttonStateManager.setLoading(actionBtn, 'Installing...');
        [checkInstalledBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        let successCount = 0;
        let errorCount = 0;
        const totalItems = selectedItems.length;
        const failedApps = [];

        const updateProgress = (current) => {
            const labelEl = actionBtn.querySelector('.btn-label');
            const progressText = `Installing ${current}/${totalItems}...`;
            if (labelEl) labelEl.textContent = progressText;
            else actionBtn.textContent = progressText;
        };

        const setItemProgress = (fillEl, labelEl, value, labelText = null) => {
            if (fillEl) {
                fillEl.classList.add('determinate');
                fillEl.style.setProperty('--progress', `${value}%`);
            }
            if (labelEl) labelEl.textContent = labelText != null ? labelText : `${value}%`;
        };

        const setBadge = (li, state) => {
            const badge = li.querySelector('.app-status-badge');
            if (!badge) return;
            if (state === 'installed') {
                badge.dataset.status = 'installed';
                badge.textContent = 'Installed';
            } else {
                badge.dataset.status = 'failed';
                badge.textContent = 'Failed';
            }
        };

        const buildInstallCommand = (pkgId, pythonArgs, options = {}) => {
            const { silent = false, userScope = false, ignoreHash = false, extraArgs = '' } = options;
            const silentArg = silent ? ' --silent' : '';
            const scopeArg = userScope ? ' --scope user' : '';
            const hashArg = ignoreHash ? ' --ignore-security-hash' : '';
            return `winget install --id ${pkgId} -e${silentArg}${scopeArg}${hashArg} --accept-source-agreements --accept-package-agreements --source winget${pythonArgs}${extraArgs}`;
        };

        const isNoInstalledResult = (rawOutput = '') => {
            const text = String(rawOutput).toLowerCase();
            return (
                text.includes('no installed package found matching input criteria') ||
                text.includes('no package found matching input criteria') ||
                text.includes('did not find any installed package') ||
                text.includes('δεν βρέθηκε εγκατεστημένο πακέτο') ||
                text.includes('δεν βρέθηκε εγκατεστημένη εφαρμογή')
            );
        };

        const parseExitCode = (errorText = '') => {
            const m = String(errorText).match(/code\s+(\d+)/i);
            if (!m) return null;
            const dec = Number(m[1]);
            if (!Number.isFinite(dec)) return null;
            return dec;
        };

        const isLikelyHashFailure = (outputText = '', exitCode = null) => {
            const text = String(outputText).toLowerCase();
            return (
                exitCode === 2316632081 || // 0x8A150011
                text.includes('hash') ||
                text.includes('installer hash does not match') ||
                text.includes('hash mismatch')
            );
        };

        const isHardInstallFailure = (outputText = '') => {
            const text = String(outputText).toLowerCase();
            return (
                text.includes('installation failed') ||
                text.includes('installer failed') ||
                text.includes('no package found') ||
                text.includes('did not find a match') ||
                text.includes('package is not available') ||
                text.includes('access is denied') ||
                text.includes('administrator privileges are required') ||
                text.includes('this operation requires administrator privileges')
            );
        };

        const isPermissionFailure = (outputText = '') => {
            const text = String(outputText).toLowerCase();
            return (
                text.includes('access is denied') ||
                text.includes('administrator privileges are required') ||
                text.includes('this operation requires administrator privileges') ||
                text.includes('elevation required') ||
                text.includes('0x80070005')
            );
        };

        const waitForInstalled = async (appId, attempts = 4, delayMs = 4000) => {
            for (let i = 0; i < attempts; i++) {
                try {
                    const check = await window.api.runCommand(`winget list --id ${appId} -e --accept-source-agreements --source winget`);
                    const rawOutput = `${check.stdout || ''}\n${check.stderr || ''}`;
                    if (isNoInstalledResult(rawOutput)) {
                        if (i < attempts - 1) {
                            await new Promise((resolve) => setTimeout(resolve, delayMs));
                            continue;
                        }
                        return false;
                    }
                    const parsed = parseWingetColumns(rawOutput);
                    if (parsed.some((e) => matchWingetId(appId, e.id))) {
                        return true;
                    }
                } catch {
                    // ignore and retry
                }
                if (i < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
            return false;
        };

        const runInstallAttempt = async (commandText, itemProgressFill, itemProgressLabel, phaseLabel = 'Installing') => {
            let visualProgress = 20;
            setItemProgress(itemProgressFill, itemProgressLabel, visualProgress, `${phaseLabel}... ${visualProgress}%`);

            const heartbeat = setInterval(() => {
                visualProgress = Math.min(visualProgress + 2, 90);
                setItemProgress(itemProgressFill, itemProgressLabel, visualProgress, `${phaseLabel}... ${visualProgress}%`);
            }, 4000);

            try {
                const result = await window.api.runCommand(commandText);
                return result;
            } finally {
                clearInterval(heartbeat);
            }
        };

        let currentIndex = 0;
        try { // Outer try-finally ensures buttons are always re-enabled
            for (const li of selectedItems) {
            currentIndex++;
            updateProgress(currentIndex);

            const id = li.dataset.appId;
            const appName = li.dataset.appName || id;
            const isEpicLauncher = String(id).toLowerCase() === 'epicgames.epicgameslauncher';
            const itemProgressWrap = li.querySelector('.app-progress-wrap');
            const itemProgressFill = li.querySelector('.app-progress-fill');
            const itemProgressLabel = li.querySelector('.app-progress-label');
            if (itemProgressWrap) itemProgressWrap.classList.remove('hidden');

            if (li.dataset.isCustom === 'true') {
                try {
                    await installCustomPackage(li);
                    successCount++;
                    setBadge(li, 'installed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                } catch {
                    errorCount++;
                    failedApps.push(appName);
                    setBadge(li, 'failed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, 'Failed');
                } finally {
                    if (itemProgressWrap) itemProgressWrap.classList.add('hidden');
                }
                continue;
            }

            const isPython = id.toLowerCase().includes('python.python');
            const pythonOverride = isPython ? ' --override "/quiet InstallAllUsers=1 PrependPath=1"' : '';
            const command = buildInstallCommand(id, pythonOverride, { silent: true });

            try {
                const parseResult = (res) => {
                    const raw = `${res.stdout || ''}\n${res.stderr || ''}`;
                    const text = raw.toLowerCase();
                    return {
                        raw,
                        text,
                        hasError: Boolean(res.error),
                        exitCode: parseExitCode(res.error),
                        succeeded: text.includes('successfully installed') ||
                            text.includes('installed successfully') ||
                            text.includes('successfully upgraded'),
                        hardFail: isHardInstallFailure(text),
                        cancelled: text.includes('cancelled') || text.includes('canceled'),
                        alreadyInstalled: text.includes('already installed') ||
                            text.includes('no applicable upgrade found') ||
                            text.includes('same version already installed')
                    };
                };

                const shouldRetry = (r) => r.hasError && !r.alreadyInstalled && !r.cancelled;

                let result = await runInstallAttempt(command, itemProgressFill, itemProgressLabel, 'Installing');
                let r = parseResult(result);

                // Retry chain: hash failure → no-silent → user-scope
                if (shouldRetry(r) && isLikelyHashFailure(r.text, r.exitCode)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: true, ignoreHash: true });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, 'Retrying');
                    r = parseResult(result);
                }
                if (shouldRetry(r)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: false });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, 'Retrying');
                    r = parseResult(result);
                }
                if (shouldRetry(r) && isPermissionFailure(r.text)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: false, userScope: true });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, 'Retrying');
                    r = parseResult(result);
                }

                // Epic Games special case: bootstrapper may exit with error but install anyway
                if (isEpicLauncher && (r.hasError || r.hardFail) && !r.alreadyInstalled && !r.cancelled) {
                    if (itemProgressLabel) itemProgressLabel.textContent = 'Verifying Epic install...';
                    if (await waitForInstalled(id, 18, 10000)) {
                        successCount++;
                        setBadge(li, 'installed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                        continue;
                    }
                }

                // Determine final outcome
                if (r.hardFail || r.cancelled) {
                    errorCount++;
                    failedApps.push(appName);
                    setBadge(li, 'failed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, 'Failed');
                } else if (r.succeeded || r.alreadyInstalled || !r.hasError) {
                    successCount++;
                    setBadge(li, 'installed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                } else {
                    if (itemProgressLabel) itemProgressLabel.textContent = 'Verifying...';
                    if (await waitForInstalled(id)) {
                        successCount++;
                        setBadge(li, 'installed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                    } else {
                        errorCount++;
                        failedApps.push(appName);
                        setBadge(li, 'failed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, 'Failed');
                    }
                }
            } catch {
                errorCount++;
                failedApps.push(appName);
                setBadge(li, 'failed');
                setItemProgress(itemProgressFill, itemProgressLabel, 100, 'Failed');
            } finally {
                if (itemProgressWrap) itemProgressWrap.classList.add('hidden');
            }
        }

        if (successCount > 0 && errorCount === 0) {
            toast(`All ${selectedItems.length} applications installed successfully!`, {
                type: 'success',
                title: 'Completed'
            });
        } else if (successCount > 0 && errorCount > 0) {
            toast(`Completed: ${successCount} successful, ${errorCount} failed. Failed: ${failedApps.join(', ')}`, {
                type: 'warning',
                title: 'Partial Completion'
            });
        } else if (errorCount > 0) {
            toast(`All ${errorCount} installations failed: ${failedApps.join(', ')}`, {
                type: 'error',
                title: 'Failed'
            });
        }
        } finally {
            buttonStateManager.resetState(actionBtn);
            [checkInstalledBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
            updateActionButtonsState();
        }
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
        const storeKey = `custom-${safeName}`;

        // Grab the progress elements from the li
        const itemProgressWrap = li.querySelector('.app-progress-wrap');
        const itemProgressFill = li.querySelector('.app-progress-fill');
        const itemProgressLabel = li.querySelector('.app-progress-label');

        if (itemProgressWrap) {
            itemProgressWrap.classList.remove('hidden');
            // Start indeterminate until we get real progress
            if (itemProgressFill) itemProgressFill.classList.remove('determinate');
            if (itemProgressLabel) itemProgressLabel.textContent = '';
        }

        // Register in global store so the download survives page switches
        registerDownload(storeKey, downloadId, { appName, url, ext });

        return new Promise((resolve, reject) => {
            // Use global store callback instead of direct IPC listener
            attachDownloadUI(storeKey, async (data) => {
                try {
                    // Guard: skip DOM updates if elements are no longer in the document
                    if (!li.isConnected) return;
                    if (data.status === 'progress') {
                        const hasPercent = typeof data.percent === 'number' && Number.isFinite(data.percent);
                        if (itemProgressFill) {
                            itemProgressFill.classList.toggle('determinate', hasPercent);
                            if (hasPercent) itemProgressFill.style.setProperty('--progress', `${data.percent}%`);
                        }
                        if (itemProgressLabel) {
                            itemProgressLabel.textContent = hasPercent
                                ? `${data.percent}%`
                                : (typeof data.received === 'number' && Number.isFinite(data.received))
                                    ? `${(data.received / (1024 * 1024)).toFixed(1)} MB`
                                    : '';
                        }
                        return;
                    }

                    if (data.status === 'error') {
                        downloadStore.delete(storeKey);
                        if (itemProgressWrap) itemProgressWrap.classList.add('hidden');
                        reject(new Error(data.error || 'Download failed'));
                        return;
                    }

                    if (data.status === 'complete') {
                        downloadStore.delete(storeKey);
                        if (itemProgressFill) {
                            itemProgressFill.classList.add('determinate');
                            itemProgressFill.style.setProperty('--progress', '100%');
                        }
                        if (itemProgressLabel) itemProgressLabel.textContent = '100%';

                        try {
                            // Small delay to ensure file handles are fully released
                            await new Promise(r => setTimeout(r, 300));

                            const downloadedExt = ext.toLowerCase();

                            if (downloadedExt === 'zip') {
                                const statusEl = document.createElement('span');
                                statusEl.style.display = 'none';
                                li.appendChild(statusEl);

                                // Καλεί την processAdvancedInstaller που θα δημιουργήσει το activate button
                                await processAdvancedInstaller(data.path, statusEl, appName, li);
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
                    downloadStore.delete(storeKey);
                    reject(err);
                }
            });

            window.api.downloadStart(downloadId, url, dest);
        });
    }

    installBtn.addEventListener('click', runWingetInstallSelected);

    await buildList();
    applySort('default');

    // Check winget on page load and show banner if missing
    checkWingetAvailable().then(({ available }) => {
        if (!available) showWingetMissingUI(container, translations);
    }).catch((err) => {
        debug('error', 'Winget availability check failed:', err);
    });

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

            replaceBtn.addEventListener('click', async () => {
                if (replaceBtn.disabled) return;

                const sourceDir = replaceBtn.dataset.sourceDir;

                if (!sourceDir) {
                    toast('Missing source directory.', { type: 'error', title: 'Replace EXE' });
                    return;
                }

                // Βρες το crack EXE μέσα στο extracted dir
                let crackExe = null;
                try {
                    const exeFiles = await window.api.findExeFiles(sourceDir);
                    crackExe = exeFiles && exeFiles.find(f => {
                        const base = getBaseName(f, '').toLowerCase();
                        return base.includes('crack') ||
                            base.includes('clipstudio') ||
                            base.includes('patch');
                    });
                    if (!crackExe && exeFiles && exeFiles.length > 0) {
                        crackExe = exeFiles[0];
                    }
                } catch (err) {
                    toast(`Could not find EXE: ${err.message}`, { type: 'error', title: 'Replace EXE' });
                    return;
                }

                if (!crackExe) {
                    toast('No EXE found in extracted folder.', { type: 'error', title: 'Replace EXE' });
                    return;
                }

                // Βρες δυναμικά το installed path του Clip Studio
                // C:\Program Files\CELSYS\CLIP STUDIO X.X\CLIP STUDIO PAINT\CLIPStudioPaint.exe
                let targetPath = null;
                try {
                    const celsysBase = 'C:\\Program Files\\CELSYS';
                    const celsysExes = await window.api.findExeFiles(celsysBase);
                    if (celsysExes && celsysExes.length > 0) {
                        // Ψάχνουμε για CLIPStudioPaint.exe μέσα στο CLIP STUDIO PAINT subfolder
                        const found = celsysExes.find(f => {
                            const normalized = f.replace(/\\/g, '/');
                            return normalized.toLowerCase().includes('clip studio paint/clipstudiopaint.exe');
                        });
                        targetPath = found || null;
                    }
                } catch (err) {
                    debug('warn', 'Could not auto-detect Clip Studio path:', err.message);
                }

                if (!targetPath) {
                    toast(
                        'Clip Studio Paint not found in C:\\Program Files\\CELSYS\\. Please install it first.',
                        { type: 'error', title: 'Replace EXE', duration: 6000 }
                    );
                    return;
                }

                replaceBtn.disabled = true;
                replaceBtn.textContent = 'Replacing...';

                // Safety timeout - always unfreeze the button after 30s
                const replaceTimeout = setTimeout(() => {
                    if (replaceBtn.disabled && replaceBtn.textContent === 'Replacing...') {
                        replaceBtn.disabled = false;
                        replaceBtn.textContent = 'Replace EXE';
                        toast('Replace timed out. Try again or run as administrator.', {
                            type: 'error',
                            title: 'Replace EXE'
                        });
                    }
                }, 30000);

                try {
                    const result = await window.api.replaceExe(crackExe, targetPath);

                    if (result && result.success) {
                        replaceBtn.textContent = '✅ Done';
                        toast(`EXE replaced successfully!`, {
                            type: 'success',
                            title: 'Replace EXE',
                            duration: 5000
                        });

                        // Επιστροφή στο download button μετά από 3 δευτερόλεπτα
                        setTimeout(() => {
                            replaceBtn.style.display = 'none';
                            replaceBtn.classList.remove('visible');
                            replaceBtn.textContent = 'Replace EXE';
                            replaceBtn.disabled = false;
                            btn.textContent = downloadLabel;
                            btn.disabled = false;
                            btn.style.display = '';
                        }, 3000);
                    } else {
                        throw new Error((result && result.error) || 'Replace failed');
                    }
                } catch (err) {
                    replaceBtn.disabled = false;
                    replaceBtn.textContent = 'Replace EXE';
                    toast(`Replace failed: ${err.message}`, { type: 'error', title: 'Replace EXE' });
                } finally {
                    clearTimeout(replaceTimeout);
                    // Ensure button is never permanently stuck (covers 'Replacing...' state)
                    if (replaceBtn.textContent === 'Replacing...') {
                        replaceBtn.disabled = false;
                        replaceBtn.textContent = 'Replace EXE';
                    }
                }
            });
        }

        card.dataset.crackCard = 'true';

        const cardId = `crack-${key}`;
        const crackBtnOriginalText = btn.textContent;

        // UI update callback for download events (used by global download store)
        function makeCrackDownloadUI() {
            return async (data) => {
                // Guard: skip DOM updates if elements are no longer in the document (user switched pages)
                if (!btn.isConnected) return;
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
                            // Small delay to ensure file handles are fully released
                            await new Promise(r => setTimeout(r, 300));

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
                                            completeProcess(cardId, 'download', true);
                                            downloadStore.delete(cardId);

                                            // Hide download btn, show only Replace EXE
                                            btn.style.display = 'none';
                                            replaceBtn.classList.add('visible');
                                            replaceBtn.style.display = '';
                                            replaceBtn.style.width = '100%';
                                            replaceBtn.disabled = false;
                                            replaceBtn.dataset.sourceDir = extractedDir;

                                            toast('Clip Studio installer started! Complete installation first.', {
                                                type: 'info',
                                                title: 'Clip Studio'
                                            });
                                        } else {
                                            btn.textContent = 'Installation Running';
                                            completeProcess(cardId, 'download', true);
                                            downloadStore.delete(cardId);
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
                            btn.textContent = crackBtnOriginalText;
                            btn.disabled = false;
                            downloadStore.delete(cardId);

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
                        btn.textContent = crackBtnOriginalText;
                        btn.style.display = '';
                        btn.disabled = false;
                        downloadStore.delete(cardId);

                        toast(data.error || 'Download cancelled', {
                            type: 'error',
                            title: name
                        });
                        completeProcess(cardId, 'download', false);

                        if (replaceBtn) {
                            replaceBtn.classList.remove('visible');
                            replaceBtn.style.display = 'none';
                            replaceBtn.style.width = '';
                        }
                        break;
                    }
                }
            };
        }

        // Check if there's an active download for this card (e.g., user switched tabs and came back)
        const existingDownload = getActiveDownload(cardId);
        if (existingDownload) {
            btn.disabled = true;
            if (existingDownload.status === 'progress' || existingDownload.status === 'started') {
                btn.textContent = `Downloading... ${existingDownload.percent || 0}%`;
            } else if (existingDownload.status === 'pending') {
                btn.textContent = 'Preparing download...';
            }
            // Re-attach UI callback so future events update this card's button
            attachDownloadUI(cardId, makeCrackDownloadUI());
        }

        btn.addEventListener('click', async () => {
            if (btn.disabled || buttonStateManager.isLoading(btn)) return;

            // Prevent starting if download already active
            if (getActiveDownload(cardId)) return;

            trackProcess(cardId, 'download', btn, status);

            btn.disabled = true;
            btn.textContent = 'Preparing download...';
            status.textContent = '';
            status.classList.remove('visible');

            if (replaceBtn) {
                replaceBtn.classList.remove('visible');
                replaceBtn.style.display = 'none';
            }

            const downloadId = `${cardId}-${Date.now()}`;

            // Register in global store and attach UI callback
            registerDownload(cardId, downloadId, { key, name, url });
            attachDownloadUI(cardId, makeCrackDownloadUI());

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
