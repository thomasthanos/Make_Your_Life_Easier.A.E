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
        const parts = String(pkgId).split('.');
        const publisher = (parts[0] || '').toLowerCase();
        const domainMap = {
            google: 'google.com',
            bitdefender: 'bitdefender.com',
            brave: 'brave.com',
            discord: 'discord.com',
            dropbox: 'dropbox.com',
            electronicarts: 'ea.com',
            elgato: 'elgato.com',
            epicgames: 'epicgames.com',
            git: 'git-scm.com',
            github: 'github.com',
            nordsecurity: 'nordvpn.com',
            mojang: 'minecraft.net',
            vivaldi: 'vivaldi.com',
            valve: 'steampowered.com',
            playstation: 'playstation.com',
            python: 'python.org',
            microsoft: 'microsoft.com',
            rarlab: 'win-rar.com',
            razerinc: 'razer.com',
            softdeluxe: 'freedownloadmanager.org',
            spotify: 'spotify.com',
            surfshark: 'surfshark.com',
            zwylair: 'github.com',
            proton: 'protonvpn.com',
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
            iobit: 'iobit.com',
            blizzard: 'battle.net',
            ubisoft: 'https://store.ubisoft.com/ie/home?lang=en-ZW',
            guru3d: 'guru3d.com'
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
        { key: 'Development', keywords: ['visualstudio', 'python', 'node', 'git', 'java', 'eclipse', 'intellij', 'jetbrains', 'studio', 'code', 'github', 'gitlab', 'docker', 'virtualbox', 'vmware'] },
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
        activateBtn.style.display = 'inline-block';
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
        li.appendChild(buttonContainer);
    }
    
    activateBtn = document.createElement('button');
    activateBtn.className = 'activate-btn';
    activateBtn.textContent = 'Activate';
    activateBtn.dataset.activatorPath = activatorPath;
    
    // Μικρότερο κουμπί που ταιριάζει με το design
    activateBtn.style.cssText = `
        font-size: 12px;
        padding: 2px 8px;
        margin-left: 8px;
        background-color: #059669;
        border: 1px solid #059669;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        display: inline-block;
    `;
    
    activateBtn.addEventListener('mouseenter', () => {
        if (!activateBtn.disabled) {
            activateBtn.style.backgroundColor = '#047857';
            activateBtn.style.borderColor = '#047857';
        }
    });
    
    activateBtn.addEventListener('mouseleave', () => {
        if (!activateBtn.disabled) {
            activateBtn.style.backgroundColor = '#059669';
            activateBtn.style.borderColor = '#059669';
        }
    });
    
    activateBtn.addEventListener('click', async () => {
        try {
            activateBtn.disabled = true;
            activateBtn.textContent = 'Activating...';
            activateBtn.style.opacity = '0.7';
            
            const runResult = await window.api.runInstaller(activatorPath);
            if (runResult.success) {
                activateBtn.textContent = '✅ Activated';
                activateBtn.style.backgroundColor = '#059669';
                activateBtn.disabled = true;
                activateBtn.style.opacity = '1';
                
                toast('Advanced Installer activated successfully!', {
                    type: 'success',
                    title: 'Advanced Installer',
                    duration: 3000
                });
            } else {
                throw new Error(runResult.error || 'Activation failed');
            }
        } catch (error) {
            activateBtn.textContent = '❌ Retry';
            activateBtn.style.backgroundColor = '#dc2626';
            activateBtn.style.borderColor = '#dc2626';
            activateBtn.disabled = false;
            activateBtn.style.opacity = '1';
            
            toast(`Activation failed: ${error.message}`, {
                type: 'error',
                title: 'Advanced Installer'
            });
        }
    });
    
    buttonContainer.appendChild(activateBtn);
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

    const searchIcon = document.createElement('span');
    searchIcon.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <path d="m21 21-4.3-4.3"></path>
    </svg>
  `;
    searchIcon.classList.add('search-icon');

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = (translations.messages && translations.messages.search_apps) || 'Search apps...';
    searchInput.className = 'search-input-styled';

    searchContainer.appendChild(searchIcon);
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

    const installText = (translations.actions && translations.actions.install_selected) || 'Install Selected';
    const uninstallText = (translations.actions && translations.actions.uninstall_selected) || 'Uninstall Selected';
    const exportText = (translations.actions && translations.actions.export_list) || 'Export List';
    const importText = (translations.actions && translations.actions.import_list) || 'Import List';

    const installBtn = makeButton(installText, '');
    const uninstallBtn = makeButton(uninstallText, '#dc2626');
    const exportBtn = makeButton(exportText, '');
    const importBtn = makeButton(importText, '');

    installBtn.innerHTML = `${installIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(installText)}</span>`;
    uninstallBtn.innerHTML = `${uninstallIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(uninstallText)}</span>`;
    exportBtn.innerHTML = `${exportIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(exportText)}</span>`;
    importBtn.innerHTML = `${importIcon}<span class="btn-label" style="margin-left: 0.5rem;">${escapeHtml(importText)}</span>`;

    installBtn.classList.add('btn-install', 'bulk-action-btn', 'bulk-install');
    uninstallBtn.classList.add('btn-uninstall', 'bulk-action-btn', 'bulk-uninstall');
    exportBtn.classList.add('btn-export', 'bulk-action-btn', 'bulk-export');
    importBtn.classList.add('btn-import', 'bulk-action-btn', 'bulk-import');

    actionsWrapper.appendChild(installBtn);
    actionsWrapper.appendChild(uninstallBtn);
    actionsWrapper.appendChild(exportBtn);
    actionsWrapper.appendChild(importBtn);
    container.appendChild(actionsWrapper);

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
                ? `winget install --id ${id} -e --accept-source-agreements --accept-package-agreements`
                : `winget uninstall --id ${id} -e`;

            try {
                const result = await window.api.runCommand(command);
                const output = ((result.stdout || '') + (result.stderr || '')).toLowerCase();

                if (result && result.error) {
                    const hasSuccessIndicator = isInstall
                        ? (output.includes('successfully installed') || output.includes('already installed'))
                        : output.includes('successfully uninstalled');

                    if (!hasSuccessIndicator) {
                        results.push({ name: appName, success: false, error: result.error });
                        errorCount++;
                        continue;
                    }
                }

                if (isInstall) {
                    const alreadyInstalled = output.includes('no applicable upgrade found') ||
                        output.includes('already installed') ||
                        output.includes('no newer package versions');

                    const installSuccess = output.includes('successfully installed') ||
                        output.includes('installation successful');

                    const installFailed = output.includes('installation failed') ||
                        output.includes('no package found') ||
                        output.includes('did not find');

                    if (alreadyInstalled) {
                        results.push({ name: appName, success: true, status: 'already_installed' });
                        successCount++;
                    } else if (installFailed && !installSuccess) {
                        results.push({ name: appName, success: false, status: 'failed' });
                        errorCount++;
                    } else {
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

        if (successCount > 0 && errorCount === 0) {
            toast(`All ${selectedItems.length} applications ${isInstall ? 'installed' : 'uninstalled'} successfully!`, {
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