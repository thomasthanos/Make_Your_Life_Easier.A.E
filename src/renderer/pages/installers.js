import { uiText } from '../ui-text.js';
import { createHelpButton } from '../tooltips.js';
import { installerActivity } from '../installer-activity.js';

import { debug, escapeHtml, debounce, getBaseName, getExtractedFolderPath } from '../utils.js';
import { trackProcess, completeProcess, registerDownload, getActiveDownload, attachDownloadUI, attachDownloadLifecycle, downloadStore } from '../managers.js';
import { toast } from '../components.js';
import { CUSTOM_APPS } from '../services.js';
import { parseWingetColumns, parseWingetSearch, matchWingetId, sanitizeSearchQuery } from '../winget-parse.js';

const INSTALLED_TTL_MS = 5 * 60 * 1000;
const installedState = { at: 0, installed: new Map(), upgradable: new Map() };
let installedCheckInFlight = null;
const catalogCache = new Map();
const CATALOG_RESULT_LIMIT = 40;


function getFaviconUrl(pkgId, appName) {
    if (typeof FaviconConfig !== 'undefined') {
        return FaviconConfig.getFaviconUrl(pkgId, appName);
    }
    const slug = String(appName || pkgId || '').toLowerCase().replace(/\s+/g, '');
    return 'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL'
        + `&url=${encodeURIComponent(`http://${slug}.com`)}&size=64`;
}

let fallbackIconPromise = null;
function getFallbackIconPath() {
    if (!fallbackIconPromise) {
        fallbackIconPromise = Promise.resolve(window.api?.getAssetPath?.('icons/hacker.ico'))
            .then((p) => p || '../assets/icons/hacker.ico')
            .catch(() => '../assets/icons/hacker.ico');
    }
    return fallbackIconPromise;
}

function createAppFavicon(app) {
    const fav = document.createElement('img');
    fav.classList.add('app-favicon');
    fav.alt = '';
    fav.width = 26;
    fav.height = 26;
    fav.loading = 'lazy';
    fav.decoding = 'async';
    fav.fetchPriority = 'low';
    fav.referrerPolicy = 'no-referrer';
    fav.addEventListener('error', () => {
        if (fav.dataset.fallback) return;
        fav.dataset.fallback = '1';
        getFallbackIconPath().then((iconPath) => { fav.src = iconPath; });
    });
    fav.src = getFaviconUrl(app.id, app.name);
    return fav;
}

const DEVELOPER_URL_OVERRIDES = {
    'Proton.ProtonVPN': 'https://protonvpn.com/download?srsltid=AfmBOorCqPOivQW4nu912shSaLHNK2mrKj95FqK-_apNH6nFGY8aeFiX',
    'Proton.ProtonDrive': 'https://proton.me/drive/download',
    'Proton.ProtonMail': 'https://proton.me/mail/download',
    'Proton.ProtonAuthenticator': 'https://proton.me/authenticator/download',
    'Proton.Proton Authenticator': 'https://proton.me/authenticator/download',
    'NordSecurity.NordPass': 'https://nordpass.com/download/',
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
};;

const PUBLISHER_DOMAINS = {
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
    nvidia: 'nvidia.com/en-us/software/nvidia-app/',
    amd: 'amd.com/en/support/download/drivers.html'
};

const CATEGORY_KEYWORDS = [
    { key: 'Hardware', keywords: ['cpu-z', 'gpu-z', 'hwinfo', 'hwmonitor', 'cpuid.', 'techpowerup', 'realix', 'afterburner', 'rtss', 'guru3d', 'crystaldisk', 'razer', 'synapse', 'streamdeck', 'elgato.', 'nvidia', 'geforce', 'amd.adrenalin', 'radeon'] },
    { key: 'Communication', keywords: ['discord', 'vesktop', 'vencord', 'betterdiscord', 'slack', 'teams', 'zoom', 'telegram', 'signal', 'skype'] },
    { key: 'Browsers', keywords: ['firefox', 'google.chrome', 'brave.brave', 'opera', 'edge', 'vivaldi', 'tor', 'browser'] },
    { key: 'Games', keywords: ['steam', 'epicgames', 'battlenet', 'ubisoft', 'riot', 'gog', 'psremoteplay', 'playstation', 'xbox', 'minecraft', 'mojang', 'eadesktop', 'electronicarts', 'bluestack'] },
    { key: 'Media', keywords: ['spotify', 'music', 'tidal', 'mp3tag', 'audio', 'vlc', 'winamp', 'itunes', 'obsstudio', 'obsproject', 'stremio', 'blender', 'video'] },
    { key: 'Development', keywords: ['visualstudio', 'python', 'nodejs', 'openjs', 'git.git', 'github', 'gitlab', 'java', 'eclipse', 'intellij', 'jetbrains', 'vscode', 'docker', 'virtualbox', 'vmware', 'claude', 'anthropic', 'notepad'] },
    { key: 'Security', keywords: ['vpn', 'bitdefender', 'antivirus', 'security', 'surfshark', 'nordsecurity', 'protonvpn', 'authenticator', 'password', 'malwarebytes', 'protonmail', 'protondrive', 'proton.proton'] },
    { key: 'Utilities', keywords: ['7zip', 'rarlab', 'winrar', 'freedownload', 'downloadmanager', 'driverbooster', 'softwareupdater', 'sysinfo', 'smartdefrag', 'uninstaller', 'iobit', 'rufus', 'ventoy', 'anydesk', 'dropbox.dropbox', 'googledrive', 'revo'] }
];

function getDeveloperUrl(pkgId) {
    try {

        if (DEVELOPER_URL_OVERRIDES[pkgId]) {
            return DEVELOPER_URL_OVERRIDES[pkgId];
        }

        const parts = String(pkgId).split('.');
        const publisher = (parts[0] || '').toLowerCase();
        const domain = PUBLISHER_DOMAINS[publisher] || `${publisher}.com`;
        return `https://${domain}`;
    } catch {
        return '';
    }
}

function getCategoryForId(pkgId) {
    const lower = String(pkgId).toLowerCase();
    for (const { key, keywords } of CATEGORY_KEYWORDS) {
        if (keywords.some((kw) => lower.includes(kw))) {
            return key;
        }
    }
    return 'Others';
}

function getCategoryLabel(categoryKey, translations) {
    return (translations.categories && translations.categories[categoryKey]) || categoryKey;
}

function getStatusLabel(statusKey, translations) {
    return (translations.statuses && translations.statuses[statusKey]) || statusKey;
}


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
    statusElement.textContent = uiText("advanced_extract", "Extracting Advanced Installer...");

    try {
        const extractResult = await window.api.extractArchive(zipPath, '');

        if (!extractResult.success) {
            throw new Error(`Extraction failed: ${extractResult.error}`);
        }

        statusElement.textContent = uiText("extraction_complete", "Extraction complete!");

        const extractedDir = getExtractedFolderPath(zipPath);
        const msiPath = `${extractedDir}\\advinst.msi`;
        const activatorPath = `${extractedDir}\\Advanced Installer Activator.exe`;

        statusElement.textContent = uiText("advanced_start", "Starting Advanced Installer setup...");

        const installResult = await window.api.runInstaller(msiPath);

        if (!installResult.success) {
            throw new Error(`Failed to run MSI installer: ${installResult.error}`);
        }

        statusElement.textContent = uiText("advanced_started", "✅ Advanced Installer setup started! Complete the installation.");
        statusElement.classList.add('status-success');

        if (li) {
            createActivateButtonForAdvancedInstaller(li, activatorPath, appName);
        }

        toast(uiText("advanced_next", "Advanced Installer setup started! Complete the installation then click \"Activate\"."), {
            type: 'info',
            title: 'Advanced Installer',
            duration: 5000
        });

        return { activatorPath };

    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
        throw error;
    }
}

function createActivateButtonForAdvancedInstaller(li, activatorPath, appName) {
    let activateBtn = li.querySelector('.activate-btn');

    if (activateBtn) {
        activateBtn.dataset.activatorPath = activatorPath;
        activateBtn.style.display = 'inline-flex';
        return;
    }

    const label = li.querySelector('label.app-label');
    if (!label) return;

    let buttonContainer = li.querySelector('.app-actions');
    if (!buttonContainer) {
        buttonContainer = document.createElement('div');
        buttonContainer.className = 'app-actions';

        const labelContainer = li.querySelector('.label-container');
        if (labelContainer) {
            labelContainer.appendChild(buttonContainer);
        } else {
            li.appendChild(buttonContainer);
        }
    }

    activateBtn = document.createElement('button');
    activateBtn.className = 'activate-btn';
    activateBtn.textContent = uiText("activate", "Activate");
    activateBtn.dataset.activatorPath = activatorPath;
    activateBtn.dataset.appName = appName;
    activateBtn.title = `Activate ${appName}`;

    activateBtn.addEventListener('click', async (e) => {
        e.stopPropagation();

        try {
            activateBtn.disabled = true;
            activateBtn.textContent = uiText("activating", "Activating...");

            const runResult = await window.api.runInstaller(activatorPath);

            if (runResult.success) {
                activateBtn.classList.add('success');
                activateBtn.textContent = uiText("activated", "Activated");
                activateBtn.disabled = true;

                setTimeout(() => {
                    try {
                        window.api.deleteFile(activatorPath);
                    } catch {
                    }
                }, 2000);

                toast(uiText("advanced_activated", "Advanced Installer activated successfully!"), {
                    type: 'success',
                    title: 'Advanced Installer',
                    duration: 3000
                });
            } else {
                throw new Error(runResult.error || 'Activation failed');
            }
        } catch (error) {
            activateBtn.classList.add('error');
            activateBtn.textContent = uiText("retry", "Retry");
            activateBtn.disabled = false;

            toast(uiText('activation_failed_detail', '', { error: error.message }), {
                type: 'error',
                title: 'Advanced Installer'
            });
        }
    });

    buttonContainer.appendChild(activateBtn);
}




const PYTHON_ID_PREFIX = 'Python.Python.3.';
const PYTHON_LINE_RE = /^Python\.Python\.3\.(\d+)$/i;
const PRERELEASE_RE = /\d+(?:a|b|rc)\d+/i;

let pythonIdPromise = null;

async function resolveLatestPythonId(fallbackId) {
    const fallbackMinor = Number((String(fallbackId).match(PYTHON_LINE_RE) || [])[1] ?? -1);

    try {
        const result = await window.api.runCommand(
            `winget search --id ${PYTHON_ID_PREFIX} --source winget --accept-source-agreements`
        );
        const raw = `${result.stdout || ''}\n${result.stderr || ''}`;

        let best = null;
        for (const entry of parseWingetColumns(raw)) {
            const m = PYTHON_LINE_RE.exec(entry.id);
            if (!m) continue;
            if (entry.version && PRERELEASE_RE.test(entry.version)) continue;
            const minor = Number(m[1]);
            if (minor > (best ?? fallbackMinor)) best = minor;
        }

        if (best !== null) return `${PYTHON_ID_PREFIX}${best}`;
    } catch (err) {
        debug('warn', 'Failed to resolve latest Python line:', err);
    }

    return fallbackId;
}

function getLatestPythonId(fallbackId) {
    if (!pythonIdPromise) pythonIdPromise = resolveLatestPythonId(fallbackId);
    return pythonIdPromise;
}


async function checkWingetAvailable() {
    try {
        const result = await window.api.runCommand('winget --version');

        const combined = ((result.stdout || '') + (result.stderr || '') + (result.error || '')).toLowerCase();
        const notFound =
            combined.includes('is not recognized') ||
            combined.includes('was not found') ||
            combined.includes('cannot find') ||
            combined.includes('no such file') ||
            combined.includes('winget: command not found');

        if (notFound) return { available: false };

        return { available: true };
    } catch {
        return { available: false };
    }
}

function showWingetMissingUI(container, translations) {
    const existing = container.querySelector('.winget-missing-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.className = 'winget-missing-banner';

    const icon = document.createElement('span');
    icon.className = 'winget-missing-banner-icon';
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    const textWrap = document.createElement('div');
    textWrap.className = 'winget-missing-banner-copy';

    const title = document.createElement('div');
    title.className = 'winget-missing-banner-title';
    title.textContent = (translations.messages && translations.messages.winget_not_installed) || 'Winget Not Installed';

    const desc = document.createElement('div');
    desc.className = 'winget-missing-banner-description';
    desc.textContent = (translations.messages && translations.messages.winget_missing)
        || 'Winget (App Installer) is not found on this PC. Install it to use the app installer features.';

    const storeBtn = document.createElement('button');
    storeBtn.className = 'winget-missing-banner-action';
    storeBtn.textContent = (translations.actions && translations.actions.open_store) || '📦 Open Microsoft Store';
    storeBtn.addEventListener('click', () => {
        try { window.api.openExternal('ms-windows-store://pdp/?productid=9NBLGGH4NNS1'); } catch { }
    });

    textWrap.appendChild(title);
    textWrap.appendChild(desc);
    textWrap.appendChild(storeBtn);
    banner.appendChild(icon);
    banner.appendChild(textWrap);

    const searchWrapper = container.querySelector('.search-wrapper');
    if (searchWrapper?.parentNode && searchWrapper.nextSibling) {
        searchWrapper.parentNode.insertBefore(banner, searchWrapper.nextSibling);
    } else if (searchWrapper?.parentNode) {
        searchWrapper.parentNode.appendChild(banner);
    } else {
        container.prepend(banner);
    }
}


export async function buildInstallPageWingetWithCategories(translations, settings, buttonStateManager) {
    const initialActivity = installerActivity.snapshot();
    let observedInstall = initialActivity.busy && initialActivity.kind === 'install';
    const container = document.createElement('div');
    container.className = 'installer-page';

    const hero = document.createElement('section');
    hero.className = 'installer-hero';

    const heroMain = document.createElement('div');
    heroMain.className = 'installer-hero-main';

    const heroCopy = document.createElement('div');
    heroCopy.className = 'installer-hero-copy';

    const heroTitle = document.createElement('h2');
    heroTitle.textContent = translations.menu?.install_apps || 'Install Apps';

    const installerCount = document.createElement('span');
    installerCount.className = 'installer-count-badge';
    installerCount.textContent = settings?.lang === 'gr' ? 'Φόρτωση εφαρμογών...' : 'Loading apps...';

    heroCopy.appendChild(heroTitle);
    heroMain.appendChild(heroCopy);
    heroMain.appendChild(createHelpButton(uiText('selection_help')));
    hero.appendChild(heroMain);
    hero.appendChild(installerCount);
    container.appendChild(hero);

    const toolbar = document.createElement('section');
    toolbar.className = 'installer-toolbar';
    container.appendChild(toolbar);

    const searchWrapper = document.createElement('div');
    searchWrapper.classList.add('search-wrapper');

    const searchContainer = document.createElement('div');
    searchContainer.classList.add('search-container');

    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = (translations.messages && translations.messages.search_apps) || 'Search apps...';
    searchInput.setAttribute('aria-label', searchInput.placeholder);
    searchInput.className = 'search-input-styled';

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);
    searchWrapper.appendChild(searchContainer);
    toolbar.appendChild(searchWrapper);

    function makeButton(text) {
        const btn = document.createElement('button');
        btn.className = 'bulk-action-btn';
        btn.textContent = text;
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

    installBtn.classList.add('bulk-install');
    exportBtn.classList.add('bulk-export');
    importBtn.classList.add('bulk-import');
    checkInstalledBtn.classList.add('bulk-check-installed');
    uncheckAllBtn.classList.add('bulk-uncheck-all');

    checkInstalledBtn.setAttribute('data-tooltip', uiText('check_help'));
    importBtn.setAttribute('data-tooltip', uiText('import_help'));
    exportBtn.setAttribute('data-tooltip', uiText('export_help'));
    const moreActions = document.createElement('details');
    moreActions.className = 'installer-more';
    const moreSummary = document.createElement('summary');
    moreSummary.textContent = uiText('more_actions', 'More');
    const morePanel = document.createElement('div');
    morePanel.className = 'installer-more-panel';
    morePanel.append(checkInstalledBtn, importBtn, exportBtn);
    moreActions.append(moreSummary, morePanel);
    for (const button of [checkInstalledBtn, importBtn, exportBtn]) {
        button.addEventListener('click', () => {
            if (button.disabled) return;
            moreActions.open = false;
            moreSummary.focus();
        });
    }

    const selectionBar = document.createElement('section');
    selectionBar.className = 'installer-selection-bar';
    const selectionCopy = document.createElement('div');
    selectionCopy.className = 'installer-selection-copy';
    const selectionCount = document.createElement('strong');
    selectionCount.setAttribute('role', 'status');
    selectionCount.setAttribute('aria-live', 'polite');
    const activityText = document.createElement('span');
    activityText.className = 'installer-activity-text';
    activityText.setAttribute('role', 'status');
    activityText.setAttribute('aria-live', 'polite');
    const activityDetail = document.createElement('span');
    activityDetail.className = 'installer-activity-detail';
    selectionCopy.append(selectionCount, activityText, activityDetail);
    const updateAllIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="action-icon"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>`;
    const updateAllBtn = makeButton('');
    updateAllBtn.className = 'bulk-action-btn bulk-update-all hidden';
    updateAllBtn.innerHTML = `${updateAllIcon}<span class="btn-label"></span>`;
    updateAllBtn.addEventListener('click', () => {
        if (updateAllBtn.disabled) return;
        upgradeRows(rowsWithUpdates());
    });

    const selectionActions = document.createElement('div');
    selectionActions.className = 'installer-selection-actions';
    selectionActions.append(uncheckAllBtn, updateAllBtn, installBtn);
    selectionBar.append(selectionCopy, selectionActions);

    const controlsBar = document.createElement('div');
    controlsBar.className = 'install-controls-bar';

    const viewToggleGroup = document.createElement('div');
    viewToggleGroup.className = 'view-toggle-group';

    const listViewBtn = document.createElement('button');
    listViewBtn.className = 'view-toggle-btn active';
    listViewBtn.title = (translations.actions && translations.actions.list_view) || 'List view';
    listViewBtn.setAttribute('aria-label', listViewBtn.title);
    listViewBtn.dataset.view = 'list';
    listViewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`;

    const gridViewBtn = document.createElement('button');
    gridViewBtn.className = 'view-toggle-btn';
    gridViewBtn.title = (translations.actions && translations.actions.grid_view) || 'Grid view';
    gridViewBtn.setAttribute('aria-label', gridViewBtn.title);
    gridViewBtn.dataset.view = 'grid';
    gridViewBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;

    viewToggleGroup.appendChild(listViewBtn);
    viewToggleGroup.appendChild(gridViewBtn);

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

    const sortChevron = `<svg class="sort-dropdown-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    const sortCheck = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    const sortDropdown = document.createElement('div');
    sortDropdown.className = 'sort-dropdown';

    const sortTrigger = document.createElement('button');
    sortTrigger.type = 'button';
    sortTrigger.className = 'sort-dropdown-trigger';
    sortTrigger.setAttribute('aria-haspopup', 'listbox');
    sortTrigger.setAttribute('aria-expanded', 'false');

    const sortMenu = document.createElement('div');
    sortMenu.className = 'sort-dropdown-menu';
    sortMenu.setAttribute('role', 'listbox');

    function renderSortTrigger(value) {
        const opt = sortOptions.find(o => o.value === value) || sortOptions[0];
        sortTrigger.innerHTML = `${opt.icon}<span class="sort-dropdown-label">${escapeHtml(opt.label)}</span>${sortChevron}`;
    }

    function setSortSelection(value) {
        renderSortTrigger(value);
        sortMenu.querySelectorAll('.sort-dropdown-option').forEach((b) => {
            const isActive = b.dataset.sort === value;
            b.classList.toggle('active', isActive);
            b.setAttribute('aria-selected', String(isActive));
        });
    }

    function closeSortMenu() {
        sortDropdown.classList.remove('open');
        sortTrigger.setAttribute('aria-expanded', 'false');
    }

    sortOptions.forEach(({ value, label, icon }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sort-dropdown-option';
        btn.dataset.sort = value;
        btn.setAttribute('role', 'option');
        btn.innerHTML = `${icon}<span class="sort-dropdown-option-label">${escapeHtml(label)}</span><span class="sort-dropdown-check">${sortCheck}</span>`;
        btn.addEventListener('click', () => {
            setSortSelection(value);
            closeSortMenu();
            applySort(value);
            try { window.api?.setSetting?.('installer_sort', value); } catch { }
        });
        sortMenu.appendChild(btn);
    });

    sortTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        moreActions.open = false;
        const open = sortDropdown.classList.toggle('open');
        sortTrigger.setAttribute('aria-expanded', String(open));
    });

    const onDocClick = (e) => {
        if (!sortDropdown.contains(e.target)) closeSortMenu();
        if (!moreActions.contains(e.target)) moreActions.open = false;
    };
    const onDocKeydown = (e) => {
        if (e.key === 'Escape') {
            closeSortMenu();
            if (moreActions.open) { moreActions.open = false; moreSummary.focus(); }
        }
    };
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onDocKeydown);
    container._pageCleanup = [() => {
        document.removeEventListener('click', onDocClick);
        document.removeEventListener('keydown', onDocKeydown);
    }];

    setSortSelection('default');

    sortDropdown.appendChild(sortTrigger);
    sortDropdown.appendChild(sortMenu);

    controlsBar.appendChild(viewToggleGroup);
    controlsBar.appendChild(sortDropdown);
    controlsBar.appendChild(moreActions);
    searchWrapper.appendChild(controlsBar);

    let currentSort = 'default';

    function applyView(view) {
        listContainer.dataset.view = view;
        listViewBtn.classList.toggle('active', view === 'list');
        gridViewBtn.classList.toggle('active', view === 'grid');
        listViewBtn.setAttribute('aria-pressed', String(view === 'list'));
        gridViewBtn.setAttribute('aria-pressed', String(view === 'grid'));
    }

    async function selectInstallerView(view) {
        if (view !== 'list' && view !== 'grid') return;
        if (listContainer.dataset.view === view) return;

        applyView(view);
        if (settings && typeof settings === 'object') settings.installer_view = view;

        try {
            const result = await window.api?.setSetting?.('installer_view', view);
            if (result && result.success === false) {
                throw new Error(result.error || 'Failed to save installer view');
            }
        } catch (err) {
            debug('warn', 'Failed to save installer view:', err);
        }
    }

    function applySort(value) {
        currentSort = value;
        const groups = listContainer.querySelectorAll(':scope > div:not(.catalog-results)');
        groups.forEach(group => {
            const ul = group.querySelector('.category-list');
            if (!ul) return;
            const items = Array.from(ul.querySelectorAll('li'));
            const statusOrder = { installed: 0, 'update-available': 1, failed: 2, unknown: 3, 'not-installed': 4 };

            const keyed = items.map((li) => ({
                li,
                name: li.dataset.appName || '',
                rank: statusOrder[li.querySelector('.app-status-badge')?.dataset?.status || 'unknown'] ?? 2
            }));

            keyed.sort((a, b) => {
                if (value === 'za') return b.name.localeCompare(a.name);
                if (value === 'status') {
                    const diff = a.rank - b.rank;
                    if (diff !== 0) return diff;
                }
                return a.name.localeCompare(b.name);
            });

            const fragment = document.createDocumentFragment();
            keyed.forEach(({ li }) => fragment.appendChild(li));
            ul.appendChild(fragment);
        });
    }

    listViewBtn.addEventListener('click', () => { void selectInstallerView('list'); });
    gridViewBtn.addEventListener('click', () => { void selectInstallerView('grid'); });

    function updateActionButtonsState() {
        const state = installerActivity.snapshot();
        const count = container.querySelectorAll('input[type="checkbox"]:checked').length;
        installBtn.disabled = state.busy || count === 0;
        exportBtn.disabled = state.busy || count === 0;
        uncheckAllBtn.disabled = state.busy || count === 0;
        checkInstalledBtn.disabled = state.busy;
        importBtn.disabled = state.busy;
        updateAllBtn.disabled = state.busy;
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.disabled = state.busy; });
        const hasResult = (state.kind === 'install' && state.total > 0 && state.current > 0)
            || (state.kind === 'check' && state.checked !== undefined);
        selectionBar.hidden = count === 0 && !state.busy && !hasResult;
        selectionCount.hidden = count === 0;
        selectionActions.hidden = count === 0 && !(state.busy && state.kind === 'install');
        if ((selectionBar.hidden && selectionBar.contains(document.activeElement))
            || (selectionActions.hidden && selectionActions.contains(document.activeElement))) {
            searchInput.focus();
        }
        selectionCount.textContent = uiText('selected_count', 'Selected: {count}', { count });
        installBtn.querySelector('.btn-label').textContent = state.busy && state.kind === 'install'
            ? uiText('installing', 'Installing…') : uiText('install_count', 'Install ({count})', { count });
        installBtn.setAttribute('aria-busy', String(state.busy && state.kind === 'install'));
    }

    function renderActivity(state) {
        for (const [id, outcome] of Object.entries(state.outcomes)) {
            const row = container.querySelector('li[data-app-id="' + CSS.escape(id) + '"]');
            if (!row) continue;
            const badge = row.querySelector('.app-status-badge');
            if (badge) {
                badge.dataset.status = outcome;
                badge.textContent = getStatusLabel(outcome, translations);
            }
            if (outcome === 'installed' && (state.kind === 'install' || state.kind === 'update') && (state.busy || observedInstall)) {
                row.querySelector('input[type="checkbox"]').checked = false;
            }
        }
        observedInstall = state.busy && state.kind === 'install';
        updateActionButtonsState();
        activityText.removeAttribute('data-tooltip');
        activityText.removeAttribute('tabindex');
        if (state.busy) {
            activityText.textContent = state.kind === 'check' ? uiText('checking')
                : state.current ? uiText('batch_progress', '', state) : uiText('preparing');
            activityDetail.textContent = '';
            if (state.kind === 'install' && state.current) {
                activityText.setAttribute('data-tooltip', uiText('progress_unknown'));
                activityText.tabIndex = 0;
            }
        } else if ((state.kind === 'install' || state.kind === 'update') && state.total && state.current) {
            activityText.textContent = uiText('batch_result', '', state);
            activityDetail.textContent = state.failedNames?.length
                ? uiText('batch_failed', '', { names: state.failedNames.join(', ') }) : '';
        } else if (state.kind === 'check' && state.checked !== undefined) {
            activityText.textContent = uiText('check_result', '', { installed: state.checked, updates: state.updates });
            activityDetail.textContent = '';
        } else {
            activityText.textContent = '';
            activityDetail.textContent = '';
        }
    }

    function collectSelectedIds() {
        const ids = [];
        container.querySelectorAll('input[type="checkbox"]:checked').forEach((cb) => {
            const li = cb.closest('li');
            if (li && li.dataset.appId) ids.push(li.dataset.appId);
        });
        return ids;
    }

    function applySelectedIds(ids) {
        const normalize = (id) => (PYTHON_LINE_RE.test(id) ? PYTHON_ID_PREFIX : id);
        const idSet = new Set((ids || []).map((x) => normalize(String(x))));
        container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
            const li = cb.closest('li');
            if (li && li.dataset.appId) cb.checked = idSet.has(normalize(li.dataset.appId));
        });
        updateActionButtonsState();
    }

    function saveSelectedApps() {
        try { window.api?.setSetting?.('selected_apps', collectSelectedIds()); } catch { }
    }

    updateActionButtonsState();

    container.addEventListener('change', (e) => {
        if (e.target && e.target.type === 'checkbox') {
            updateActionButtonsState();
            saveSelectedApps();
        }
    });

    container.addEventListener('click', (e) => {
        const link = e.target.closest?.('.app-link');
        if (!link || !container.contains(link)) return;
        e.preventDefault();
        const devUrl = link.dataset.devUrl;
        if (!devUrl) return;
        try {
            if (window.api && typeof window.api.openExternal === 'function') {
                window.api.openExternal(devUrl);
            } else {
                window.open(devUrl, '_blank');
            }
        } catch {
        }
    });

    const chipsBar = document.createElement('div');
    chipsBar.className = 'installer-chips';

    const statusFilters = [
        { value: 'all', label: uiText('filter_all', 'All') },
        { value: 'installed', label: uiText('filter_installed', 'Installed') },
        { value: 'update-available', label: uiText('filter_updates', 'Updates') },
        { value: 'not-installed', label: uiText('filter_not_installed', 'Not installed') }
    ];
    let currentStatusFilter = 'all';
    const filterGroup = document.createElement('div');
    filterGroup.className = 'installer-chip-group';
    filterGroup.setAttribute('role', 'group');
    filterGroup.setAttribute('aria-label', uiText('filter_group', 'Filter by status'));
    statusFilters.forEach(({ value, label }) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'installer-chip';
        chip.classList.toggle('active', value === 'all');
        chip.dataset.filter = value;
        chip.textContent = label;
        chip.addEventListener('click', () => {
            currentStatusFilter = value;
            filterGroup.querySelectorAll('.installer-chip').forEach((el) => el.classList.toggle('active', el === chip));
            applySearchFilter();
            if (value !== 'all' && !installedState.at) scheduleAutoCheck();
        });
        filterGroup.appendChild(chip);
    });

    const packGroup = document.createElement('div');
    packGroup.className = 'installer-chip-group installer-packs';
    chipsBar.append(filterGroup, packGroup);
    container.appendChild(chipsBar);

    const listContainer = document.createElement('div');
    listContainer.classList.add('list-container');
    container.appendChild(listContainer);

    let catalogToken = 0;
    const catalogGroup = document.createElement('div');
    catalogGroup.className = 'catalog-results hidden';
    const catalogHeading = document.createElement('h3');
    catalogHeading.className = 'category-heading';
    catalogHeading.textContent = uiText('catalog_heading', 'More from winget');
    const catalogCount = document.createElement('span');
    catalogCount.className = 'catalog-count';
    catalogHeading.appendChild(catalogCount);
    const catalogStatus = document.createElement('p');
    catalogStatus.className = 'catalog-status';
    const catalogList = document.createElement('ul');
    catalogList.className = 'install-grid category-list';
    catalogGroup.append(catalogHeading, catalogStatus, catalogList);
    listContainer.appendChild(catalogGroup);
    const searchEmpty = document.createElement('div');
    searchEmpty.className = 'installer-empty hidden';
    const emptyText = document.createElement('span');
    emptyText.textContent = uiText('no_results');
    const clearSearch = document.createElement('button');
    clearSearch.type = 'button';
    clearSearch.className = 'button-secondary';
    clearSearch.textContent = uiText('clear_search');
    clearSearch.addEventListener('click', () => { searchInput.value = ''; applySearchFilter(); searchInput.focus(); });
    searchEmpty.append(emptyText, clearSearch);
    container.append(searchEmpty, selectionBar);


    const toPackageMap = (entries) => new Map(entries.map((entry) => [entry.id.toLowerCase(), entry]));

    function findPackage(packages, appId) {
        const exact = packages.get(String(appId).toLowerCase());
        if (exact) return exact;
        for (const entry of packages.values()) {
            if (matchWingetId(appId, entry.id)) return entry;
        }
        return null;
    }

    function applyRowStatus(li) {
        const badge = li.querySelector('.app-status-badge');
        if (!badge || !installedState.at || li.dataset.isCustom === 'true') return;

        const upgrade = findPackage(installedState.upgradable, li.dataset.appId);
        const installed = findPackage(installedState.installed, li.dataset.appId);

        if (upgrade && upgrade.available) {
            badge.dataset.status = 'update-available';
            badge.textContent = getStatusLabel('update_available', translations);
            li.dataset.availableVersion = upgrade.available;
        } else if (installed) {
            badge.dataset.status = 'installed';
            badge.textContent = getStatusLabel('installed', translations);
            delete li.dataset.availableVersion;
        } else {
            badge.dataset.status = 'not-installed';
            badge.textContent = getStatusLabel('not_installed', translations);
            delete li.dataset.availableVersion;
        }
        syncUpdateButton(li);
    }

    function applyAllStatuses() {
        container.querySelectorAll('li.app-list-item').forEach(applyRowStatus);
        updateUpdateAllButton();
        if (currentSort === 'status') applySort('status');
        applySearchFilter();
    }

    async function refreshInstalledState({ silent = false } = {}) {
        const wingetCheck = await checkWingetAvailable();
        if (!wingetCheck.available) {
            if (!silent) showWingetMissingUI(container, translations);
            throw new Error(uiText('winget_missing_check', 'Winget is not installed on this PC. Click "Open Microsoft Store" to install App Installer.'));
        }

        const listResult = await window.api.runCommand('winget list --accept-source-agreements');
        if (listResult.error && !listResult.stdout && !listResult.stderr) {
            throw new Error(uiText('winget_command_error', 'Winget command failed to execute. Make sure Winget is installed.'));
        }
        installedState.installed = toPackageMap(parseWingetColumns(`${listResult.stdout || ''}${listResult.stderr || ''}`));
        installedState.at = Date.now();
        if (!container.isConnected) return { installed: 0, updates: 0 };
        applyAllStatuses();

        const upgradeResult = await window.api.runCommand('winget upgrade --include-unknown --accept-source-agreements --source winget');
        installedState.upgradable = toPackageMap(
            parseWingetColumns(`${upgradeResult.stdout || ''}${upgradeResult.stderr || ''}`).filter((entry) => entry.available)
        );
        if (!container.isConnected) return { installed: 0, updates: 0 };
        applyAllStatuses();

        const badges = [...container.querySelectorAll('.app-status-badge')];
        return {
            installed: badges.filter((b) => b.dataset.status === 'installed' || b.dataset.status === 'update-available').length,
            updates: badges.filter((b) => b.dataset.status === 'update-available').length
        };
    }

    function scheduleAutoCheck() {
        if (Date.now() - installedState.at < INSTALLED_TTL_MS) {
            applyAllStatuses();
            return;
        }
        setTimeout(() => {
            if (!container.isConnected || installerActivity.snapshot().busy) return;
            checkInstalledBtn.classList.add('is-checking');
            if (!installedCheckInFlight) {
                installedCheckInFlight = refreshInstalledState({ silent: true })
                    .catch((err) => debug('warn', 'Background check for installed apps failed:', err?.message || err))
                    .finally(() => { installedCheckInFlight = null; });
            }
            installedCheckInFlight.finally(() => {
                if (container.isConnected) applyAllStatuses();
                checkInstalledBtn.classList.remove('is-checking');
            });
        }, 400);
    }


    async function searchCatalog(query) {
        if (catalogCache.has(query)) return catalogCache.get(query);

        const command = `winget search --query "${query}" --count ${CATALOG_RESULT_LIMIT} --disable-interactivity --accept-source-agreements`;
        const result = await Promise.race([
            window.api.runCommand(command),
            new Promise((resolve) => setTimeout(() => resolve({ error: 'timeout' }), 15000))
        ]);
        if (result.error === 'timeout') throw new Error('winget search timed out');

        const rows = parseWingetSearch(`${result.stdout || ''}${result.stderr || ''}`);
        catalogCache.set(query, rows);
        return rows;
    }

    const builtInRows = () => [...listContainer.querySelectorAll(':scope > div:not(.catalog-results) li.app-list-item')];

    function renderCatalogResults(rows) {
        const listed = builtInRows();
        const known = new Set(listed.map((li) => li.dataset.appId.toLowerCase()));
        const knownNames = new Set(listed.map((li) => li.dataset.appName.toLowerCase()));
        const pinned = [...catalogList.querySelectorAll('li.app-list-item')].filter((li) => li.querySelector('input:checked'));
        const pinnedIds = new Set(pinned.map((li) => li.dataset.appId.toLowerCase()));

        catalogList.innerHTML = '';
        pinned.forEach((li) => catalogList.appendChild(li));

        let shown = pinned.length;
        rows.forEach((row, index) => {
            const id = row.id.toLowerCase();
            if (pinnedIds.has(id) || known.has(id) || knownNames.has(row.name.toLowerCase())) return;
            if ([...known].some((appId) => matchWingetId(appId, row.id))) return;
            catalogList.appendChild(createAppRow(row, `catalog-${index}-${id}`));
            shown++;
        });

        catalogGroup.classList.toggle('hidden', shown === 0);
        catalogCount.textContent = shown ? String(shown) : '';
    }

    async function runCatalogSearch() {
        const query = sanitizeSearchQuery(searchInput.value);
        catalogToken += 1;
        const token = catalogToken;

        if (query.length < 2) {
            catalogList.innerHTML = '';
            catalogGroup.classList.add('hidden');
            catalogStatus.textContent = '';
            return;
        }

        catalogGroup.classList.remove('hidden');
        catalogStatus.textContent = uiText('catalog_searching', 'Searching winget…');
        try {
            const rows = await searchCatalog(query);
            if (token !== catalogToken || !container.isConnected) return;
            catalogStatus.textContent = rows.length ? '' : uiText('catalog_no_results', 'Nothing in the winget catalog matches.');
            renderCatalogResults(rows);
            applySearchFilter();
        } catch (err) {
            if (token !== catalogToken) return;
            debug('warn', 'Catalog search failed:', err?.message || err);
            catalogStatus.textContent = uiText('catalog_failed', 'Could not search the winget catalog.');
            catalogList.innerHTML = '';
        }
    }


    async function buildPacks() {
        let packs;
        try {
            const response = await fetch('data/packs.json');
            packs = (await response.json()).packs;
        } catch (err) {
            debug('warn', 'Failed to load packs.json:', err);
            return;
        }
        if (!Array.isArray(packs) || !container.isConnected) return;

        packs.forEach((pack) => {
            const rows = pack.apps
                .map((id) => listContainer.querySelector(`li[data-app-id="${CSS.escape(id)}"]`))
                .filter(Boolean);
            if (!rows.length) return;

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'installer-chip installer-pack-chip';
            chip.textContent = `${uiText(`pack_${pack.id}`, pack.id)} (${rows.length})`;
            chip.addEventListener('click', () => {
                const boxes = rows.map((li) => li.querySelector('input[type="checkbox"]')).filter((cb) => cb && !cb.disabled);
                const selecting = boxes.some((cb) => !cb.checked);
                boxes.forEach((cb) => { cb.checked = selecting; });
                chip.classList.toggle('active', selecting);
                updateActionButtonsState();
                saveSelectedApps();
                toast(
                    selecting
                        ? uiText('pack_selected', '{count} apps selected', { count: boxes.length })
                        : uiText('pack_cleared', 'Selection cleared'),
                    { type: 'success', title: uiText(`pack_${pack.id}`, pack.id) }
                );
            });
            packGroup.appendChild(chip);
        });
    }


    function syncUpdateButton(li) {
        const badge = li.querySelector('.app-status-badge');
        const canUpdate = badge?.dataset.status === 'update-available';
        const existing = li.querySelector('.app-update-btn');

        if (!canUpdate) {
            existing?.remove();
            return;
        }
        if (existing) return;

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'app-update-btn';
        button.textContent = uiText('update_action', 'Update');
        if (li.dataset.availableVersion) {
            button.title = uiText('update_to', 'Update to {version}', { version: li.dataset.availableVersion });
        }
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            upgradeRows([li]);
        });
        li.appendChild(button);
    }

    function updateUpdateAllButton() {
        const count = rowsWithUpdates().length;
        updateAllBtn.classList.toggle('hidden', count === 0);
        updateAllBtn.querySelector('.btn-label').textContent = uiText('update_all', 'Update all ({count})', { count });
    }

    const rowsWithUpdates = () => [...container.querySelectorAll('li.app-list-item')]
        .filter((li) => li.querySelector('.app-status-badge')?.dataset.status === 'update-available');

    async function upgradeRows(rows) {
        if (!rows.length || !installerActivity.begin('update')) return;

        let done = 0;
        let failed = 0;
        try {
            for (const [index, li] of rows.entries()) {
                const name = li.dataset.appName || li.dataset.appId;
                installerActivity.update({ current: index + 1, total: rows.length, name, success: done, failed });

                const progressWrap = li.querySelector('.app-progress-wrap');
                const progressLabel = li.querySelector('.app-progress-label');
                progressWrap?.classList.remove('hidden');
                if (progressLabel) progressLabel.textContent = uiText('updating', 'Updating…');

                const source = li.dataset.source === 'msstore' ? 'msstore' : 'winget';
                const command = `winget upgrade --id ${li.dataset.appId} -e --silent --accept-source-agreements --accept-package-agreements --source ${source}`;
                const result = await window.api.runCommand(command);
                const output = `${result.stdout || ''}${result.stderr || ''}`.toLowerCase();
                const ok = !result.error && !output.includes('failed') && !output.includes('no applicable upgrade');

                if (ok) {
                    done++;
                    installedState.upgradable.delete(li.dataset.appId.toLowerCase());
                    installerActivity.record(li.dataset.appId, 'installed');
                } else {
                    failed++;
                    debug('warn', `Update failed for ${li.dataset.appId}:`, output.slice(0, 200));
                    installerActivity.record(li.dataset.appId, 'failed');
                }
                progressWrap?.classList.add('hidden');
            }
        } finally {
            installerActivity.finish({ success: done, failed });
            applyAllStatuses();
            toast(
                failed
                    ? uiText('update_done_with_errors', '{done} updated, {failed} failed', { done, failed })
                    : uiText('update_done', '{done} updated', { done }),
                { type: failed ? 'warning' : 'success', title: uiText('update_title', 'Update') }
            );
        }
    }

    function createAppRow(app, checkboxId) {
        const li = document.createElement('li');
        li.classList.add('app-list-item');
        li.dataset.appId = app.id;
        li.dataset.appName = app.name;
        li.dataset.source = app.source || 'winget';
        if (app.custom) {
            li.dataset.isCustom = 'true';
            if (app.url) li.dataset.customUrl = app.url;
            if (app.ext) li.dataset.customExt = app.ext;
            if (app.resolver) li.dataset.customResolver = app.resolver;
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.classList.add('app-checkbox');

        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        label.classList.add('app-label');

        const textContainer = document.createElement('div');
        textContainer.classList.add('app-text-container');

        const nameEl = document.createElement('span');
        nameEl.textContent = app.name;
        nameEl.classList.add('app-name');

        const idEl = document.createElement('span');
        idEl.textContent = app.version && app.version !== 'Unknown' ? `${app.id} · ${app.version}` : app.id;
        idEl.classList.add('app-id');

        textContainer.append(nameEl, idEl);
        label.append(createAppFavicon(app), textContainer);

        const statusBadge = document.createElement('span');
        statusBadge.className = 'app-status-badge';
        statusBadge.dataset.status = 'unknown';

        const progressWrap = document.createElement('div');
        progressWrap.className = 'app-progress-wrap hidden';
        const progressFill = document.createElement('div');
        progressFill.className = 'app-progress-fill';
        const progressLabel = document.createElement('span');
        progressLabel.className = 'app-progress-label';
        progressWrap.append(progressFill, progressLabel);

        li.append(checkbox, label, statusBadge, progressWrap);

        if (li.dataset.source === 'msstore') {
            const sourceChip = document.createElement('span');
            sourceChip.className = 'app-source-chip';
            sourceChip.textContent = uiText('source_store', 'Store');
            label.appendChild(sourceChip);
        }

        const devUrl = app.custom ? '' : getDeveloperUrl(app.id);
        if (devUrl) {
            const linkEl = document.createElement('a');
            linkEl.href = '#';
            linkEl.target = '_blank';
            linkEl.rel = 'noopener noreferrer';
            linkEl.classList.add('app-link');
            linkEl.dataset.devUrl = devUrl;
            linkEl.setAttribute('aria-label', (translations.actions && translations.actions.open_developer_site) || 'Open developer site');
            linkEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="13 6 19 12 13 18"></polyline></svg>';
            li.appendChild(linkEl);
        }

        applyRowStatus(li);
        return li;
    }

    async function buildList() {
        let appsData;
        try {
            const response = await fetch('data/installer.json');
            appsData = await response.json();
        } catch (err) {
            debug('error', 'Failed to load installer.json:', err);
            toast(uiText("load_apps_error", "Failed to load app list."), { type: 'error', title: uiText("install_title", "Install") });
            return;
        }

        const ids = Array.isArray(appsData?.apps) ? appsData.apps : [];
        const categories = {};

        const pythonIdx = ids.findIndex((id) => typeof id === 'string' && PYTHON_LINE_RE.test(id));
        const pinnedPythonId = pythonIdx >= 0 ? ids[pythonIdx] : null;

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
                ext: cApp.ext,
                resolver: cApp.resolver
            });
        });

        const total = ids.length + (CUSTOM_APPS ? CUSTOM_APPS.length : 0);
        installerCount.textContent = settings?.lang === 'gr'
            ? `${total} εφαρμογές`
            : `${total} app${total === 1 ? '' : 's'}`;
        const plural = total !== 1 ? 's' : '';
        const suffix = settings?.lang === 'gr'
            ? (total !== 1 ? 'ές' : 'ή')
            : plural;
        const template = (translations.messages && translations.messages.search_for_total) || 'Search for {total} app{plural}...';
        searchInput.placeholder = template
            .replace('{total}', total)
            .replace('{plural}', plural)
            .replace('{suffix}', suffix);
        searchInput.setAttribute('aria-label', searchInput.placeholder);

        [...listContainer.children].forEach((child) => { if (child !== catalogGroup) child.remove(); });
        const orderedCats = ['Browsers', 'Communication', 'Games', 'Media', 'Development', 'Security', 'Hardware', 'Utilities', 'Others'];

        orderedCats.forEach((cat) => {
            const items = categories[cat];
            if (!items || !items.length) return;

            const group = document.createElement('div');
            const heading = document.createElement('h3');
            heading.textContent = getCategoryLabel(cat, translations);
            heading.classList.add('category-heading');
            group.appendChild(heading);

            const ul = document.createElement('ul');
            ul.className = 'install-grid';
            ul.classList.add('category-list');

            items.sort((a, b) => a.name.localeCompare(b.name)).forEach((app, index) => {
                ul.appendChild(createAppRow(app, `pkg-${cat}-${index}`));
            });
            group.appendChild(ul);
            listContainer.insertBefore(group, catalogGroup);
        });

        if (pinnedPythonId) refreshPythonRow(pinnedPythonId);
    }

    function refreshPythonRow(pinnedId) {
        getLatestPythonId(pinnedId).then((latestId) => {
            if (!latestId || latestId === pinnedId) return;
            const row = listContainer.querySelector(`li[data-app-id="${CSS.escape(pinnedId)}"]`);
            if (!row) return;
            row.dataset.appId = latestId;
            const idEl = row.querySelector('.app-id');
            if (idEl) idEl.textContent = latestId;
        }).catch((err) => debug('warn', 'Could not refresh the Python line:', err));
    }

    function passesStatusFilter(li) {
        if (currentStatusFilter === 'all') return true;
        const status = li.querySelector('.app-status-badge')?.dataset.status;
        return status === currentStatusFilter;
    }

    function applySearchFilter() {
        const query = searchInput.value.trim().toLowerCase();
        const groups = [...listContainer.children].filter((group) => group !== catalogGroup);
        let matches = 0;
        groups.forEach((group) => {
            let visible = false;
            const items = group.querySelectorAll('li');
            items.forEach((li) => {
                const name = li.dataset.appName.toLowerCase();
                const id = li.dataset.appId.toLowerCase();
                const match = (!query || name.includes(query) || id.includes(query)) && passesStatusFilter(li);
                li.classList.toggle('hidden', !match);
                if (match) { visible = true; matches++; }
            });
            group.classList.toggle('hidden', !visible);
        });

        let catalogMatches = 0;
        catalogList.querySelectorAll('li').forEach((li) => {
            const match = passesStatusFilter(li);
            li.classList.toggle('hidden', !match);
            if (match) catalogMatches++;
        });
        if (!catalogGroup.classList.contains('hidden')) matches += catalogMatches;

        searchEmpty.classList.toggle('hidden', matches > 0 || !query);
    }

    const debouncedSearch = debounce(applySearchFilter, 250);
    const debouncedCatalogSearch = debounce(runCatalogSearch, 450);
    searchInput.addEventListener('input', () => {
        debouncedSearch();
        debouncedCatalogSearch();
    });
    container._pageCleanup.push(() => {
        debouncedSearch.cancel();
        debouncedCatalogSearch.cancel();
    });

    importBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,application/json';
        fileInput.classList.add('file-input-hidden');
        document.body.appendChild(fileInput);
        fileInput.addEventListener('cancel', () => fileInput.remove(), { once: true });
        container._pageCleanup.push(() => fileInput.remove());

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) {
                fileInput.remove();
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const ids = JSON.parse(reader.result);
                    if (!Array.isArray(ids)) {
                        throw new Error(uiText("invalid_list", "Invalid file format"));
                    }
                    if (installerActivity.snapshot().busy || !container.isConnected) return;
                    applySelectedIds(ids);
                    saveSelectedApps();
                    toast(uiText("import_done", "List imported."), { type: 'success', title: uiText("import_title", "Import") });
                } catch (err) {
                    debug('error', 'Failed to import list:', err);
                    toast(uiText("import_error", "Failed to import list."), { type: 'error', title: uiText("import_title", "Import") });
                } finally {
                    fileInput.remove();
                }
            };
            reader.onerror = () => {
                debug('error', 'File read error');
                toast(uiText("file_error", "Failed to read file."), { type: 'error', title: uiText("import_title", "Import") });
                fileInput.remove();
            };
            reader.readAsText(file);
        });
        fileInput.click();
    });

    checkInstalledBtn.addEventListener('click', async () => {
        if (!installerActivity.begin('check')) return;

        buttonStateManager.setLoading(checkInstalledBtn, uiText('checking'));

        [installBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        try {
            installedState.at = 0;
            const { installed, updates } = await refreshInstalledState({ silent: false });

            installerActivity.update({ checked: installed, updates });
            toast(uiText('check_result', '', { installed, updates }), {
                type: 'success',
                title: uiText("checking_title", "Check Installed"),
                duration: 4000
            });
        } catch (error) {
            debug('error', 'Failed to check installed packages:', error);
            toast(uiText('check_failed', '', { error: error.message }), {
                type: 'error',
                title: uiText("checking_title", "Check Installed")
            });
        } finally {
            buttonStateManager.resetState(checkInstalledBtn);
            [installBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
            installerActivity.finish();
            updateActionButtonsState();
        }
    });

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
        saveSelectedApps();

        if (uncheckedCount > 0) {
            toast(uiText('unchecked_count', '', { count: uncheckedCount }), {
                type: 'success',
                title: uiText("uncheck_title", "Uncheck All")
            });
        }
    });

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
            toast(uiText("export_done", "List exported."), { type: 'success', title: uiText("export_title", "Export") });
        } catch (err) {
            debug('error', 'Failed to export list:', err);
            toast(uiText("export_error", "Failed to export list."), { type: 'error', title: uiText("export_title", "Export") });
        }
    });
    async function runWingetInstallSelected() {
        const actionBtn = installBtn;

        if (!installerActivity.begin('install')) return;
        try {
        const wingetCheck = await checkWingetAvailable();
        if (!wingetCheck.available) {
            showWingetMissingUI(container, translations);
            toast(uiText("winget_missing", "Winget is not installed. Install App Installer from the Microsoft Store."), {
                type: 'error',
                title: uiText("winget_missing_title", "Winget Not Found"),
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
            toast(uiText("no_selection", "No applications selected."), { type: 'info', title: uiText("install_title", "Install") });
            return;
        }

        buttonStateManager.setLoading(actionBtn, uiText('installing'));
        [checkInstalledBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = true));

        let successCount = 0;
        let errorCount = 0;
        const totalItems = selectedItems.length;
        const failedApps = [];

        const updateProgress = (current, name) => {
            installerActivity.update({ current, total: totalItems, name, success: successCount, failed: errorCount });
        };

        const setItemProgress = (fillEl, labelEl, value, labelText = null) => {
            if (fillEl) {
                fillEl.classList.add('determinate');
                fillEl.style.setProperty('--progress', `${value}%`);
            }
            if (labelEl) labelEl.textContent = labelText != null ? labelText : `${value}%`;
        };

        const setBadge = (li, state) => {
            installerActivity.record(li.dataset.appId, state);
            if (state === 'installed') {
                const cb = li.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = false;
                const id = li.dataset.appId.toLowerCase();
                installedState.installed.set(id, { id: li.dataset.appId, version: '', available: null, source: li.dataset.source || 'winget' });
                installedState.upgradable.delete(id);
            }
            const badge = li.querySelector('.app-status-badge');
            if (!badge) return;
            if (state === 'installed') {
                badge.dataset.status = 'installed';
                badge.textContent = getStatusLabel('installed', translations);
            } else {
                badge.dataset.status = 'failed';
                badge.textContent = getStatusLabel('failed', translations);
            }
        };

        const buildInstallCommand = (pkgId, pythonArgs, options = {}) => {
            const { silent = false, userScope = false, ignoreHash = false, source = 'winget' } = options;
            const silentArg = silent ? ' --silent' : '';
            const scopeArg = userScope ? ' --scope user' : '';
            const hashArg = ignoreHash ? ' --ignore-security-hash' : '';
            return `winget install --id ${pkgId} -e${silentArg}${scopeArg}${hashArg} --accept-source-agreements --accept-package-agreements --source ${source}${pythonArgs}`;
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
                exitCode === 2316632081 ||
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
                }
                if (i < attempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            }
            return false;
        };

        const runInstallAttempt = async (commandText, itemProgressFill, itemProgressLabel, phaseLabel) => {
            itemProgressFill?.classList.remove('determinate');
            if (itemProgressLabel) itemProgressLabel.textContent = phaseLabel;
            return window.api.runCommand(commandText);
        };

        let currentIndex = 0;
        try {
            for (const li of selectedItems) {
            currentIndex++;
            updateProgress(currentIndex, li.dataset.appName || li.dataset.appId);

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
                } catch (err) {
                    errorCount++;
                    failedApps.push(appName);
                    setBadge(li, 'failed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, uiText("failed", "Failed"));
                    toast(err?.message || uiText("download_failed", "Download failed"), { type: 'error', title: appName });
                } finally {
                    if (itemProgressWrap) itemProgressWrap.classList.add('hidden');
                }
                continue;
            }

            const isPython = id.toLowerCase().includes('python.python');
            const pythonOverride = isPython ? ' --override "/quiet InstallAllUsers=1 PrependPath=1"' : '';
            const source = li.dataset.source === 'msstore' ? 'msstore' : 'winget';
            const command = buildInstallCommand(id, pythonOverride, { silent: true, source });

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

                let result = await runInstallAttempt(command, itemProgressFill, itemProgressLabel, uiText('installing'));
                let r = parseResult(result);

                if (shouldRetry(r) && isLikelyHashFailure(r.text, r.exitCode)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: true, ignoreHash: true, source });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, uiText('retrying'));
                    r = parseResult(result);
                }
                if (shouldRetry(r)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: false, source });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, uiText('retrying'));
                    r = parseResult(result);
                }
                if (shouldRetry(r) && isPermissionFailure(r.text)) {
                    const cmd = buildInstallCommand(id, pythonOverride, { silent: false, userScope: true, source });
                    result = await runInstallAttempt(cmd, itemProgressFill, itemProgressLabel, uiText('retrying'));
                    r = parseResult(result);
                }

                if (isEpicLauncher && (r.hasError || r.hardFail) && !r.alreadyInstalled && !r.cancelled) {
                    if (itemProgressLabel) itemProgressLabel.textContent = uiText("verify_epic", "Verifying Epic install...");
                    if (await waitForInstalled(id, 18, 10000)) {
                        successCount++;
                        setBadge(li, 'installed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                        continue;
                    }
                }

                if (r.hardFail || r.cancelled) {
                    errorCount++;
                    failedApps.push(appName);
                    setBadge(li, 'failed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, uiText("failed", "Failed"));
                } else if (r.succeeded || r.alreadyInstalled || !r.hasError) {
                    successCount++;
                    setBadge(li, 'installed');
                    setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                } else {
                    if (itemProgressLabel) itemProgressLabel.textContent = uiText("verify_install", "Verifying...");
                    if (await waitForInstalled(id)) {
                        successCount++;
                        setBadge(li, 'installed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, '100%');
                    } else {
                        errorCount++;
                        failedApps.push(appName);
                        setBadge(li, 'failed');
                        setItemProgress(itemProgressFill, itemProgressLabel, 100, uiText("failed", "Failed"));
                    }
                }
            } catch {
                errorCount++;
                failedApps.push(appName);
                setBadge(li, 'failed');
                setItemProgress(itemProgressFill, itemProgressLabel, 100, uiText("failed", "Failed"));
            } finally {
                if (itemProgressWrap) itemProgressWrap.classList.add('hidden');
            }
        }

        installerActivity.update({ success: successCount, failed: errorCount, failedNames: failedApps });
        if (successCount > 0 && errorCount === 0) {
            toast(uiText('batch_result', '', { success: successCount, failed: errorCount }), {
                type: 'success',
                title: uiText("completed", "Completed")
            });
        } else if (successCount > 0 && errorCount > 0) {
            toast(uiText('batch_result', '', { success: successCount, failed: errorCount }) + ' ' + uiText('batch_failed', '', { names: failedApps.join(', ') }), {
                type: 'warning',
                title: uiText("partial", "Partial Completion")
            });
        } else if (errorCount > 0) {
            toast(uiText('batch_failed', '', { names: failedApps.join(', ') }), {
                type: 'error',
                title: uiText("failed", "Failed")
            });
        }
        } finally {
            buttonStateManager.resetState(actionBtn);
            [checkInstalledBtn, uncheckAllBtn, exportBtn, importBtn, searchInput].forEach((el) => (el.disabled = false));
            updateActionButtonsState();
            saveSelectedApps();
        }
        } catch (error) {
            toast(error.message || uiText('task_failed', '', { name: installText }), { type: 'error', title: installText });
        } finally {
            installerActivity.finish();
            updateActionButtonsState();
        }
    }

    async function installCustomPackage(li) {
        const appName = li.dataset.appName || li.dataset.appId;
        const fallbackUrl = li.dataset.customUrl;
        const ext = li.dataset.customExt || 'zip';
        const resolverKey = li.dataset.customResolver;

        if (!fallbackUrl) {
            throw new Error(uiText("download_url_missing", "Download URL missing for custom package"));
        }

        const safeName = String(appName).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        const dest = `${safeName}.${ext}`;
        const downloadId = `custom-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
        const storeKey = `custom-${safeName}`;

        const itemProgressWrap = li.querySelector('.app-progress-wrap');
        const itemProgressFill = li.querySelector('.app-progress-fill');
        const itemProgressLabel = li.querySelector('.app-progress-label');

        if (itemProgressWrap) {
            itemProgressWrap.classList.remove('hidden');
            if (itemProgressFill) itemProgressFill.classList.remove('determinate');
            if (itemProgressLabel) itemProgressLabel.textContent = '';
        }

        let url = fallbackUrl;
        let headers;
        if (resolverKey) {
            if (itemProgressLabel) itemProgressLabel.textContent = uiText("resolve_latest", "Resolving latest...");
            try {
                const resolved = await window.api?.resolveDownloadUrl?.(resolverKey, fallbackUrl);
                if (resolved?.url) url = resolved.url;
                if (resolved?.headers) headers = resolved.headers;
                if (resolved && !resolved.resolved) {
                    debug('warn', `Using fallback URL for ${appName}:`, resolved.error);
                }
            } catch (err) {
                debug('warn', `Version lookup failed for ${appName}:`, err);
            }
            if (itemProgressLabel) itemProgressLabel.textContent = '';
        }

        registerDownload(storeKey, downloadId, { appName, url, ext });

        return new Promise((resolve, reject) => {
            attachDownloadUI(storeKey, (data) => {
                if (data.status !== 'progress' || !li.isConnected) return;
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
            });

            attachDownloadLifecycle(storeKey, async (data) => {
                downloadStore.delete(storeKey);

                if (data.status !== 'complete') {
                    if (li.isConnected && itemProgressWrap) itemProgressWrap.classList.add('hidden');
                    reject(new Error(data.error || (data.status === 'cancelled'
                        ? uiText("download_cancelled", "Download cancelled")
                        : uiText("download_failed", "Download failed"))));
                    return;
                }

                if (li.isConnected) {
                    if (itemProgressFill) {
                        itemProgressFill.classList.add('determinate');
                        itemProgressFill.style.setProperty('--progress', '100%');
                    }
                    if (itemProgressLabel) itemProgressLabel.textContent = '100%';
                }

                try {
                    await new Promise(r => setTimeout(r, 300));

                    const downloadedExt = ext.toLowerCase();

                    if (downloadedExt === 'zip') {
                        const statusEl = document.createElement('span');
                        statusEl.style.display = 'none';
                        li.appendChild(statusEl);

                        await processAdvancedInstaller(data.path, statusEl, appName, li);
                    } else {
                        const runRes = await window.api.runInstaller(data.path);
                        if (!runRes || !runRes.success) {
                            throw new Error((runRes && runRes.error) || uiText("installer_failed", "Failed to run installer"));
                        }
                    }

                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            try {
                window.api.downloadStart(downloadId, url, dest, headers);
            } catch (err) {
                downloadStore.delete(storeKey);
                reject(err);
            }
        });
    }

    installBtn.addEventListener('click', runWingetInstallSelected);

    await buildList();

    let savedView = 'list';
    let savedSort = 'default';
    try {
        const [savedIds, v, s] = await Promise.all([
            window.api?.getSetting?.('selected_apps'),
            window.api?.getSetting?.('installer_view'),
            window.api?.getSetting?.('installer_sort')
        ]);
        if (Array.isArray(savedIds) && savedIds.length) applySelectedIds(savedIds);
        if (v === 'list' || v === 'grid') savedView = v;
        if (['default', 'az', 'za', 'status'].includes(s)) savedSort = s;
    } catch { }

    container._pageCleanup.push(installerActivity.subscribe(renderActivity));
    applyView(savedView);
    setSortSelection(savedSort);
    applySort(savedSort);

    checkWingetAvailable().then(({ available }) => {
        if (!available) showWingetMissingUI(container, translations);
    }).catch((err) => {
        debug('error', 'Winget availability check failed:', err);
    });

    buildPacks();
    scheduleAutoCheck();

    return container;
}


export async function buildCrackInstallerPage(translations, settings, buttonStateManager) {
    const container = document.createElement('div');
    container.className = 'crack-page';

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

    const crackUi = translations.crack_ui || {};

    const hero = document.createElement('section');
    hero.className = 'crack-hero';

    const heroMain = document.createElement('div');
    heroMain.className = 'crack-hero-main';

    const heroIcon = document.createElement('div');
    heroIcon.className = 'crack-hero-icon';
    heroIcon.setAttribute('aria-hidden', 'true');
    heroIcon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/><path d="m7.5 4.3 9 5.2"/></svg>';

    const heroCopy = document.createElement('div');
    heroCopy.className = 'crack-hero-copy';

    const heroTitle = document.createElement('h2');
    heroTitle.textContent = translations.pages?.crack_title || 'Professional Software';

    const heroDescription = document.createElement('p');
    heroDescription.textContent = translations.pages?.crack_desc || 'Download and install available software packages.';

    heroCopy.appendChild(heroTitle);
    heroCopy.appendChild(heroDescription);
    heroMain.appendChild(heroIcon);
    heroMain.appendChild(heroCopy);

    const heroMeta = document.createElement('div');
    heroMeta.className = 'crack-hero-meta';

    const appCount = document.createElement('span');
    appCount.className = 'crack-count-badge';
    appCount.textContent = `${projects.length} ${crackUi.available_apps || 'available apps'}`;

    const onDemand = document.createElement('span');
    onDemand.className = 'crack-on-demand';
    onDemand.textContent = crackUi.on_demand || 'On-demand download and setup';

    heroMeta.appendChild(appCount);
    heroMeta.appendChild(onDemand);
    hero.appendChild(heroMain);
    hero.appendChild(heroMeta);
    container.appendChild(hero);

    const grid = document.createElement('div');
    grid.className = 'crack-app-grid';

    projects.forEach((project) => {
        const { key, fallbackName, desc, url, icon } = project;
        const name = (translations.apps && translations.apps[key] && translations.apps[key].name) || fallbackName;
        const description = (translations.apps && translations.apps[key] && translations.apps[key].description) || desc;

        const card = document.createElement('div');
        card.className = 'crack-app-card';

        const header = document.createElement('div');
        header.className = 'crack-app-header';

        const img = document.createElement('img');
        img.className = 'crack-app-icon';
        img.alt = name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        img.src = icon;
        header.appendChild(img);

        const appCopy = document.createElement('div');
        appCopy.className = 'crack-app-copy';

        const h3 = document.createElement('h3');
        h3.textContent = name;

        const p = document.createElement('p');
        p.textContent = description;

        appCopy.appendChild(h3);
        appCopy.appendChild(p);
        header.appendChild(appCopy);
        card.appendChild(header);

        const btn = document.createElement('button');
        btn.className = 'button crack-app-download';
        const downloadLabel = (translations.actions && translations.actions.download) || 'Download';
        btn.textContent = downloadLabel;
        btn.dataset.originalText = btn.textContent;

        const status = document.createElement('pre');
        status.className = 'status-pre crack-app-status';

        const availability = document.createElement('span');
        availability.className = 'crack-app-availability';

        const availabilityDot = document.createElement('span');
        availabilityDot.className = 'crack-app-availability-dot';
        availabilityDot.setAttribute('aria-hidden', 'true');

        const availabilityText = document.createElement('span');
        availabilityText.textContent = crackUi.ready || 'Ready to download';

        availability.appendChild(availabilityDot);
        availability.appendChild(availabilityText);

        const isClipStudio = key === 'clip_studio_paint';
        let replaceBtn = null;

        if (isClipStudio) {
            replaceBtn = document.createElement('button');
            replaceBtn.className = 'button button-secondary crack-app-download';
            replaceBtn.textContent = 'Replace EXE';
            replaceBtn.classList.add('download-replace-btn');
            replaceBtn.style.display = 'none';

            replaceBtn.addEventListener('click', async () => {
                if (replaceBtn.disabled) return;

                const sourceDir = replaceBtn.dataset.sourceDir;

                if (!sourceDir) {
                    toast(uiText("source_missing", "Missing source directory."), { type: 'error', title: 'Replace EXE' });
                    return;
                }

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
                    toast(uiText("exe_missing", "No EXE found in extracted folder."), { type: 'error', title: 'Replace EXE' });
                    return;
                }

                let targetPath = null;
                try {
                    const celsysBase = 'C:\\Program Files\\CELSYS';
                    const celsysExes = await window.api.findExeFiles(celsysBase);
                    if (celsysExes && celsysExes.length > 0) {
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

        function setCrackCardState(state = 'ready') {
            const busyStates = ['busy', 'extracting', 'opening', 'cleaning'];
            const isBusy = busyStates.includes(state);
            card.classList.toggle('is-busy', isBusy);
            card.classList.toggle('is-complete', state === 'complete');

            const stateText = {
                busy: crackUi.busy || 'Download in progress',
                extracting: crackUi.extracting || 'Extracting files',
                opening: crackUi.opening || 'Opening installer',
                cleaning: crackUi.cleaning || 'Cleaning up',
                complete: crackUi.installer_opened || 'Installer opened',
                ready: crackUi.ready || 'Ready to download'
            };
            availabilityText.textContent = stateText[state] || stateText.ready;
        }

        function makeCrackDownloadUI() {
            return async (data) => {
                if (!btn.isConnected) return;
                const workingLabel = crackUi.working || 'Working…';

                switch (data.status) {
                    case 'started':
                        setCrackCardState('busy');
                        btn.textContent = '0%';
                        break;

                    case 'progress':
                        setCrackCardState('busy');
                        btn.textContent = `${data.percent}%`;
                        break;

                    case 'complete': {
                        setCrackCardState('extracting');
                        btn.textContent = workingLabel;

                        try {
                            await new Promise(r => setTimeout(r, 300));

                            const extractResult = await window.api.extractArchive(data.path, '123');

                            if (extractResult.success) {
                                const extractedDir = getExtractedFolderPath(data.path);
                                setCrackCardState('opening');

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
                                            setCrackCardState('complete');
                                            completeProcess(cardId, 'download', true);
                                            downloadStore.delete(cardId);

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
                                            completeProcess(cardId, 'download', true);
                                            downloadStore.delete(cardId);
                                            toast(`${name} installer started!`, {
                                                type: 'info',
                                                title: name
                                            });

                                            setCrackCardState('cleaning');
                                            try {
                                                await window.api.cleanupInstallArtifacts(data.path, extractedDir);
                                            } catch (cleanupErr) {
                                                debug('warn', 'Cleanup after install failed:', cleanupErr?.message);
                                            }

                                            setCrackCardState('complete');
                                            setTimeout(() => {
                                                if (!btn.isConnected) return;
                                                setCrackCardState('ready');
                                                btn.textContent = crackBtnOriginalText;
                                                btn.disabled = false;
                                            }, 4000);
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
                            setCrackCardState('ready');
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
                        setCrackCardState('ready');
                        btn.textContent = crackBtnOriginalText;
                        btn.style.display = '';
                        btn.disabled = false;
                        downloadStore.delete(cardId);

                        toast(data.error || uiText("download_cancelled", "Download cancelled"), {
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

        const existingDownload = getActiveDownload(cardId);
        if (existingDownload) {
            setCrackCardState('busy');
            btn.disabled = true;
            if (existingDownload.status === 'progress' || existingDownload.status === 'started') {
                btn.textContent = `${existingDownload.percent || 0}%`;
            } else if (existingDownload.status === 'pending') {
                btn.textContent = crackUi.working || 'Working…';
            }
            attachDownloadUI(cardId, makeCrackDownloadUI());
        }

        btn.addEventListener('click', async () => {
            if (btn.disabled || buttonStateManager.isLoading(btn)) return;

            if (getActiveDownload(cardId)) return;

            const originalLabel = btn.textContent;
            trackProcess(cardId, 'download', btn, status);

            setCrackCardState('busy');
            btn.disabled = true;
            btn.textContent = crackUi.working || 'Working…';
            status.textContent = '';
            status.classList.remove('visible');

            if (replaceBtn) {
                replaceBtn.classList.remove('visible');
                replaceBtn.style.display = 'none';
            }

            const downloadId = `${cardId}-${Date.now()}`;

            registerDownload(cardId, downloadId, { key, name, url });
            attachDownloadUI(cardId, makeCrackDownloadUI());

            try {
                window.api.downloadStart(downloadId, url, name);
            } catch (err) {
                setCrackCardState('ready');
                downloadStore.delete(cardId);
                completeProcess(cardId, 'download', false);
                btn.disabled = false;
                btn.textContent = originalLabel;
                toast(uiText("download_failed", "Download failed"), { type: 'error', title: name });
            }
        });

        const footer = document.createElement('div');
        footer.className = 'crack-app-footer';

        const buttonWrapper = document.createElement('div');
        buttonWrapper.className = 'crack-app-actions';
        buttonWrapper.appendChild(btn);
        if (replaceBtn) {
            buttonWrapper.appendChild(replaceBtn);
        }

        footer.appendChild(availability);
        footer.appendChild(buttonWrapper);
        card.appendChild(footer);
        card.appendChild(status);
        grid.appendChild(card);
    });

    container.appendChild(grid);
    return container;
}
