/*
 * Renderer script for the Make Your Life Easier application.  This script
 * runs in the browser context of the app window and communicates with
 * the Electron main process through the preload API.  It loads
 * translations, remembers user settings, renders the navigation menu and
 * dynamically builds pages based on the selected section.
 */
const processStates = new Map();

(() => {
  const menuKeys = [
    'settings',
    'install_apps',
    'activate_autologin',
    'system_maintenance',
    'crack_installer',
    'spicetify',
    'password_manager',
    'christitus',
    'dlc_unlocker',
    'bios'
  ];

  // Default settings
  const defaultSettings = {
    lang: 'en',
    theme: 'light'
  };

  // Load settings from localStorage or fall back to defaults
  const settings = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem('myAppSettings'));
      return { ...defaultSettings, ...(saved || {}) };
    } catch (e) {
      return { ...defaultSettings };
    }
  })();

  // Persist settings to localStorage whenever they change
  function saveSettings() {
    localStorage.setItem('myAppSettings', JSON.stringify(settings));
  }

  let translations = {};

  // Load translation JSON file based on current language.  It first tries
  // to fetch from the `lang/` subfolder; if that fails (e.g. because
  // translations are stored at the root level), it falls back to
  // fetching `${lang}.json` directly.
  async function loadTranslations() {
    const candidates = [`lang/${settings.lang}.json`, `${settings.lang}.json`];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          translations = await res.json();
          return;
        }
      } catch (e) {
        // ignore and try next candidate
      }
    }
    // If nothing worked, fallback to English empty translations
    translations = {};
  }

  // Update theme by toggling data attribute on the html element
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  // Build the sidebar menu based on translations
  function renderMenu() {
    const menuList = document.getElementById('menu-list');
    menuList.innerHTML = '';
    menuKeys.forEach((key) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      // Use safe access for menu translations
      btn.textContent = (translations.menu && translations.menu[key]) || key;
      btn.dataset.page = key;
      btn.addEventListener('click', () => {
        document.querySelectorAll('#menu-list button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        loadPage(key);
      });
      li.appendChild(btn);
      menuList.appendChild(li);
    });
    // Activate the first page by default
    const firstBtn = menuList.querySelector('button');
    if (firstBtn) firstBtn.click();
  }

  // Helper to set header text
  function setHeader(text) {
    const header = document.getElementById('header');
    header.textContent = text;
  }
// Βοηθητική συνάρτηση για παρακολούθηση διεργασιών
function trackProcess(cardId, processType, button, statusElement) {
    const processId = `${cardId}-${processType}`;
    processStates.set(processId, {
        button: button,
        status: statusElement,
        type: processType,
        startTime: Date.now(),
        isActive: true
    });
}

// Βοηθητική συνάρτηση για ολοκλήρωση διεργασίας
// Ενημέρωση της completeProcess function
function completeProcess(cardId, processType, success = true) {
    const processId = `${cardId}-${processType}`;
    const process = processStates.get(processId);
    
    if (process && process.isActive) {
        process.isActive = false;
        
        if (processType === 'download') {
            resetDownloadButton(process.button, process.status, success);
        } else if (processType === 'replace') {
            resetReplaceButton(process.button, process.status, success);
        } else if (processType === 'dlc') {
            resetDLCButton(process.button, process.status, success);
        }
        
        processStates.delete(processId);
    }
}

// Νέα συνάρτηση για επαναφορά DLC buttons
function resetDLCButton(button, status, success) {
    const originalText = button.dataset.originalText;
    
    if (success) {
        // Για επιτυχημένη εγκατάσταση, επαναφορά στο αρχικό κείμενο μετά από λίγο
        setTimeout(() => {
            if (originalText) {
                button.innerHTML = originalText;
            } else {
                button.innerHTML = button.innerHTML.includes('SIMS') ? 
                    '🎮 DOWNLOAD SIMS INSTALLER' : '🚀 DOWNLOAD EA UNLOCKER';
            }
            button.disabled = false;
            button.style.background = '';
            
            // Απόκρυψη status μετά από επιτυχία
            setTimeout(() => {
                status.textContent = '';
                status.style.display = 'none';
                status.classList.remove('status-success');
            }, 3000);
            
        }, 2000);
    } else {
        // Για αποτυχία, άμεση επαναφορά
        if (originalText) {
            button.innerHTML = originalText;
        } else {
            button.innerHTML = button.innerHTML.includes('SIMS') ? 
                '🎮 DOWNLOAD SIMS INSTALLER' : '🚀 DOWNLOAD EA UNLOCKER';
        }
        button.disabled = false;
        button.style.background = '';
    }
}

// Επαναφορά download button
function resetDownloadButton(button, status, success) {
    const originalText = button.dataset.originalText;
    if (originalText) {
        button.textContent = originalText;
    }
    button.disabled = false;
    
    if (success) {
        status.textContent = 'Process completed successfully!';
        status.classList.add('status-success');
    } else {
        status.textContent = 'Process completed with issues';
        status.classList.add('status-warning');
    }
    
    autoFadeStatus(status, 3000);
}

// Επαναφορά replace button
function resetReplaceButton(button, status, success) {
    if (success) {
        button.textContent = '✅ Replaced';
        button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';
        button.disabled = true;
        
        // Απόκρυψη με fade out
        setTimeout(() => {
            button.style.transition = 'all 0.5s ease';
            button.style.opacity = '0';
            button.style.maxHeight = '0';
            button.style.padding = '0';
            button.style.margin = '0';
            button.style.overflow = 'hidden';
            
            setTimeout(() => {
                button.style.display = 'none';
            }, 500);
        }, 2000);
    } else {
        button.textContent = 'Replace EXE';
        button.disabled = false;
        button.style.background = '';
    }
}
  // Update the createCard function to use new styling
  function createCard(titleKey, bodyContent) {
      const card = document.createElement('div');
      card.className = 'card';
      
      const h2 = document.createElement('h2');
      h2.textContent = translations.pages[titleKey] || titleKey;
      card.appendChild(h2);
      
      if (typeof bodyContent === 'string') {
          const p = document.createElement('p');
          p.textContent = bodyContent;
          p.style.opacity = '0.8';
          p.style.lineHeight = '1.6';
          card.appendChild(p);
      } else if (bodyContent instanceof Node) {
          card.appendChild(bodyContent);
      } else if (Array.isArray(bodyContent)) {
          bodyContent.forEach((node) => card.appendChild(node));
      }
      
      return card;
  }
  // Enhanced button creation with new styling
  function createModernButton(text, onClick, options = {}) {
      const button = document.createElement('button');
      button.className = options.secondary ? 'button button-secondary' : 'button';
      button.textContent = text;
      
      if (options.icon) {
          button.innerHTML = `${options.icon} ${text}`;
      }
      
      if (onClick) {
          button.addEventListener('click', onClick);
      }
      
      if (options.style) {
          Object.assign(button.style, options.style);
      }
      
      return button;
  }
  // Build specific pages based on the current selection
  async function loadPage(key) {
    const content = document.getElementById('content');
    content.innerHTML = '';
    switch (key) {
      case 'settings':
        setHeader((translations.menu && translations.menu.settings) || 'settings');
        content.appendChild(buildSettingsPage());
        break;
      case 'install_apps':
        setHeader((translations.menu && translations.menu.install_apps) || 'install_apps');
        content.appendChild(await buildInstallPage());
        break;
      // Στο renderer.js, στην switch statement της loadPage()
      case 'activate_autologin':
        setHeader((translations.menu && translations.menu.activate_autologin) || 'activate_autologin');
        content.appendChild(await buildActivateAutologinPage());
        break;
      case 'system_maintenance':
        setHeader((translations.menu && translations.menu.system_maintenance) || 'system_maintenance');
        content.appendChild(await buildMaintenancePage());
        break;
      case 'crack_installer':
        setHeader((translations.menu && translations.menu.crack_installer) || 'crack_installer');
        content.appendChild(await buildCrackInstallerPage());
        break;
      case 'spicetify':
        setHeader((translations.menu && translations.menu.spicetify) || 'spicetify');
        content.appendChild(buildSpicetifyPage());
        break;
      case 'password_manager':
        setHeader((translations.menu && translations.menu.password_manager) || 'password_manager');
        content.appendChild(buildPasswordManagerPage());
        break;
      case 'christitus':
        setHeader((translations.menu && translations.menu.christitus) || 'christitus');
        content.appendChild(buildChrisTitusPage());
        break;
      // Στο renderer.js, στην switch statement της loadPage() πρόσθεσε:
      case 'dlc_unlocker':
        setHeader((translations.menu && translations.menu.dlc_unlocker) || 'dlc_unlocker');
        content.appendChild(await buildDlcUnlockerPage());
        break;
      case 'bios':
        setHeader((translations.menu && translations.menu.bios) || 'bios');
        content.innerHTML = '';
        showRestartDialog();
        break;
      default:
        content.textContent = '';
    }
  }

async function buildActivateAutologinPage() {
  const container = document.createElement('div');
  container.className = 'card';
  
  const title = document.createElement('h2');
  title.textContent = translations.menu.activate_autologin;
  container.appendChild(title);
  
  const desc = document.createElement('p');
  desc.textContent = translations.pages.activate_title || 'Windows activation and automatic login configuration';
  desc.style.opacity = '0.8';
  desc.style.marginBottom = '2rem';
  container.appendChild(desc);
  
  // Activate Windows card
  const activateCard = document.createElement('div');
  activateCard.className = 'app-card fixed-height';
  
  const activateHeader = document.createElement('div');
  activateHeader.className = 'app-header';
  
  const activateIcon = document.createElement('div');
  activateIcon.style.fontSize = '2rem';
  activateIcon.style.marginRight = '1rem';
  activateIcon.textContent = '🔓';
  activateHeader.appendChild(activateIcon);
  
  const activateText = document.createElement('div');
  const activateName = document.createElement('h3');
  activateName.textContent = translations.activation.activate_windows || 'Activate Windows';
  activateName.style.margin = '0 0 0.5rem 0';
  const activateDesc = document.createElement('p');
  activateDesc.textContent = translations.activation.activate_desc || 'Download and run Windows activation script (requires Administrator)';
  activateDesc.style.margin = '0';
  activateDesc.style.opacity = '0.8';
  activateDesc.style.fontSize = '0.9rem';
  activateDesc.style.color = 'var(--warning-color)';
  activateDesc.style.minHeight = '40px';
  activateText.appendChild(activateName);
  activateText.appendChild(activateDesc);
  activateHeader.appendChild(activateText);
  
  activateCard.appendChild(activateHeader);
  
  const activateButton = document.createElement('button');
  activateButton.className = 'button';
  activateButton.textContent = translations.actions.activate_windows || 'Download & Activate Windows';
  activateButton.style.marginTop = 'auto';
  activateButton.style.width = '100%';
  
  const activateStatus = document.createElement('pre');
  activateStatus.className = 'status-pre';
  activateStatus.style.display = 'none';
  
  activateButton.addEventListener('click', async () => {
    await downloadAndRunActivate(activateButton, activateStatus);
  });
  
  activateCard.appendChild(activateButton);
  activateCard.appendChild(activateStatus);
  
  // Autologin card
  const autologinCard = document.createElement('div');
  autologinCard.className = 'app-card fixed-height';
  
  const autologinHeader = document.createElement('div');
  autologinHeader.className = 'app-header';
  
  const autologinIcon = document.createElement('div');
  autologinIcon.style.fontSize = '2rem';
  autologinIcon.style.marginRight = '1rem';
  autologinIcon.textContent = '🚀';
  autologinHeader.appendChild(autologinIcon);
  
  const autologinText = document.createElement('div');
  const autologinName = document.createElement('h3');
  autologinName.textContent = translations.activation.auto_login || 'Auto Login';
  autologinName.style.margin = '0 0 0.5rem 0';
  const autologinDesc = document.createElement('p');
  autologinDesc.textContent = translations.activation.auto_login_desc || 'Download and setup automatic login without password';
  autologinDesc.style.margin = '0';
  autologinDesc.style.opacity = '0.8';
  autologinDesc.style.fontSize = '0.9rem';
  autologinDesc.style.minHeight = '40px';
  autologinText.appendChild(autologinName);
  autologinText.appendChild(autologinDesc);
  autologinHeader.appendChild(autologinText);
  
  autologinCard.appendChild(autologinHeader);
  
  const autologinButton = document.createElement('button');
  autologinButton.className = 'button';
  autologinButton.textContent = translations.actions.setup_autologin || 'Download & Setup Auto Login';
  autologinButton.style.marginTop = 'auto';
  autologinButton.style.width = '100%';
  
  const autologinStatus = document.createElement('pre');
  autologinStatus.className = 'status-pre';
  autologinStatus.style.display = 'none';
  
  autologinButton.addEventListener('click', async () => {
    await downloadAndRunAutologin(autologinButton, autologinStatus);
  });
  
  autologinCard.appendChild(autologinButton);
  autologinCard.appendChild(autologinStatus);
  
  // Grid layout
  const grid = document.createElement('div');
  grid.className = 'install-grid';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = '1.5rem';
  grid.style.alignItems = 'stretch';
  
  grid.appendChild(activateCard);
  grid.appendChild(autologinCard);
  
  container.appendChild(grid);
  
  return container;
}

async function buildDlcUnlockerPage() {
  const container = document.createElement('div');
  container.className = 'card';
  
  const title = document.createElement('h2');
  title.textContent = translations.menu.dlc_unlocker || 'DLC Unlocker';
  container.appendChild(title);
  
  // Grid container for the two cards
  const grid = document.createElement('div');
  grid.className = 'install-grid';
  grid.style.gridTemplateColumns = '1fr 1fr';
  grid.style.gap = '1.5rem';
  grid.style.alignItems = 'stretch';
  
  // Sims Installer Card
  const simsCard = document.createElement('div');
  simsCard.className = 'app-card fixed-height';
  
  const simsHeader = document.createElement('div');
  simsHeader.className = 'app-header';
  
  const simsIcon = document.createElement('div');
  simsIcon.style.fontSize = '3rem';
  simsIcon.style.marginRight = '1rem';
  simsIcon.innerHTML = `
    <svg width="58" height="58" viewBox="0 0 308 734" fill="none">
      <path d="M204 733L27.3308 366.25L380.669 366.25L204 733Z" fill="url(#paint0_linear_1_6)"/>
      <path d="M204 0L380.669 366.75H27.3308L204 0Z" fill="url(#paint1_linear_1_6)"/>
      <path d="M205.5 734L124.527 366.5L286.473 366.5L205.5 734Z" fill="url(#paint2_linear_1_6)"/>
      <path d="M205.5 0L286.473 366.75H124.527L205.5 0Z" fill="url(#paint3_linear_1_6)"/>
      <defs>
        <linearGradient id="paint0_linear_1_6" x1="34" y1="459" x2="327" y2="537" gradientUnits="userSpaceOnUse">
          <stop stop-color="#AFD23E"/>
          <stop offset="0.518773" stop-color="#11B14B"/>
          <stop offset="0.641251" stop-color="#91C34B"/>
          <stop offset="1" stop-color="#02591E"/>
        </linearGradient>
        <linearGradient id="paint1_linear_1_6" x1="45.5" y1="262.5" x2="387.5" y2="362" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F5F8E0"/>
          <stop offset="0.199057" stop-color="#98C868"/>
          <stop offset="0.609375" stop-color="#1AB04C"/>
          <stop offset="1" stop-color="#99CB47"/>
        </linearGradient>
        <linearGradient id="paint2_linear_1_6" x1="117.5" y1="388" x2="290.5" y2="383.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#A3D24A"/>
          <stop offset="1" stop-color="#51C251"/>
        </linearGradient>
        <linearGradient id="paint3_linear_1_6" x1="144.5" y1="348" x2="299" y2="348.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DBEBB3"/>
          <stop offset="0.375221" stop-color="#9ED167"/>
          <stop offset="1" stop-color="#61C558"/>
          <stop offset="1" stop-color="#64C559"/>
        </linearGradient>
      </defs>
    </svg>
  `;
  simsHeader.appendChild(simsIcon);
  
  const simsText = document.createElement('div');
  const simsName = document.createElement('h3');
  simsName.textContent = translations.dlc.sims_installer || 'Sims Installer';
  simsName.style.margin = '0 0 0.5rem 0';
  simsName.style.fontSize = '1.4rem';
  const simsDesc = document.createElement('p');
  simsDesc.textContent = translations.dlc.sims_desc || 'Complete Sims DLC package with all expansions';
  simsDesc.style.margin = '0';
  simsDesc.style.opacity = '0.8';
  simsDesc.style.fontSize = '0.9rem';
  simsDesc.style.minHeight = '40px';
  simsText.appendChild(simsName);
  simsText.appendChild(simsDesc);
  simsHeader.appendChild(simsText);
  
  simsCard.appendChild(simsHeader);
  
  const simsButton = document.createElement('button');
  simsButton.className = 'button';
  simsButton.innerHTML = '🎮 ' + (translations.dlc.download_sims || 'DOWNLOAD SIMS INSTALLER');
  simsButton.style.marginTop = 'auto';
  simsButton.style.width = '100%';
  simsButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  simsButton.style.border = 'none';
  simsButton.style.fontWeight = '700';
  simsButton.style.letterSpacing = '0.5px';
  
  const simsStatus = document.createElement('pre');
  simsStatus.className = 'status-pre';
  simsStatus.style.display = 'none';
  
  simsButton.addEventListener('click', async () => {
    await downloadAndExtractDLC(
      simsButton, 
      simsStatus, 
      'sims-installer',
      'https://www.dropbox.com/scl/fi/5841qp2eysq0xvsxodmr1/sims_install.zip?rlkey=h843bkdkw8ymi7rqaq473ktni&st=t72b3hna&dl=1',
      translations.dlc.sims_installer || 'Sims Installer'
    );
  });
  
  simsCard.appendChild(simsButton);
  simsCard.appendChild(simsStatus);
  
  // EA Unlocker Card
  const eaCard = document.createElement('div');
  eaCard.className = 'app-card fixed-height';
  
  const eaHeader = document.createElement('div');
  eaHeader.className = 'app-header';
  
  const eaIcon = document.createElement('div');
  eaIcon.style.fontSize = '3rem';
  eaIcon.style.marginRight = '1rem';
  eaIcon.innerHTML = `
    <svg width="58" height="58" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .ea-a{fill:gray;}
          .ea-b{fill:#b2b2b2;}
          .ea-c{fill:none;stroke:#191919;stroke-linecap:round;stroke-linejoin:round;}
        </style>
      </defs>
      <polygon class="ea-a" points="16.434 5.5 10.77 14.5 4.563 14.5 5.992 11.5 9.854 11.5 11.256 9.5 2.646 9.5 1.244 11.5 3.304 11.5 0.5 16.5 12.057 16.5 16.434 9.519 18.036 12.5 16.662 12.5 15.261 14.5 19.438 14.5 20.84 16.5 23.5 16.5 16.434 5.5"/>
      <polygon class="ea-b" points="14.574 5.5 5.449 5.5 4.047 7.5 13.173 7.5 14.574 5.5"/>
      <path class="ea-c" d="M16.434,5.5l-5.664,9H4.562l1.43-3H9.854l1.4-2H2.646l-1.4,2H3.3l-2.8,5H12.057l4.377-6.981,1.6,2.981H16.662l-1.4,2h4.177l1.4,2H23.5Zm-1.86,0H5.449l-1.4,2h9.126Z"/>
    </svg>
  `;
  eaHeader.appendChild(eaIcon);
  
  const eaText = document.createElement('div');
  const eaName = document.createElement('h3');
  eaName.textContent = translations.dlc.ea_unlocker || 'EA Unlocker';
  eaName.style.margin = '0 0 0.5rem 0';
  eaName.style.fontSize = '1.4rem';
  const eaDesc = document.createElement('p');
  eaDesc.textContent = translations.dlc.ea_desc || 'Unlock all EA games DLC content and features';
  eaDesc.style.margin = '0';
  eaDesc.style.opacity = '0.8';
  eaDesc.style.fontSize = '0.9rem';
  eaDesc.style.minHeight = '40px';
  eaText.appendChild(eaName);
  eaText.appendChild(eaDesc);
  eaHeader.appendChild(eaText);
  
  eaCard.appendChild(eaHeader);
  
  const eaButton = document.createElement('button');
  eaButton.className = 'button';
  eaButton.innerHTML = '🚀 ' + (translations.dlc.download_ea || 'DOWNLOAD EA UNLOCKER');
  eaButton.style.marginTop = 'auto';
  eaButton.style.width = '100%';
  eaButton.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  eaButton.style.border = 'none';
  eaButton.style.fontWeight = '700';
  eaButton.style.letterSpacing = '0.5px';
  
  const eaStatus = document.createElement('pre');
  eaStatus.className = 'status-pre';
  eaStatus.style.display = 'none';
  
  eaButton.addEventListener('click', async () => {
    await downloadAndExtractDLC(
      eaButton, 
      eaStatus, 
      'ea-unlocker',
      'https://www.dropbox.com/scl/fi/mbnhjivbbyyn4avjerrzw/EA_UNLOCKER.zip?rlkey=vchua3ks8whlvmgbvc2kas0mw&st=1f3zq290&dl=1',
      translations.dlc.ea_unlocker || 'EA Unlocker'
    );
  });
  
  eaCard.appendChild(eaButton);
  eaCard.appendChild(eaStatus);
  
  // Add cards to grid
  grid.appendChild(simsCard);
  grid.appendChild(eaCard);
  container.appendChild(grid);
  
  // Ultra Compact YouTube Tutorial Section
  const tutorialsSection = document.createElement('div');
  tutorialsSection.style.marginTop = '2rem';
  tutorialsSection.style.paddingTop = '1.5rem';
  tutorialsSection.style.borderTop = '1px solid var(--border-color)';

  // Single compact tutorial card
  const tutorialCard = document.createElement('div');
  tutorialCard.className = 'tutorial-card-compact';
  tutorialCard.style.background = 'var(--card-bg)';
  tutorialCard.style.border = '1px solid var(--border-color)';
  tutorialCard.style.borderRadius = '12px';
  tutorialCard.style.padding = '0.75rem';
  tutorialCard.style.transition = 'all 0.3s ease';
  tutorialCard.style.cursor = 'pointer';
  tutorialCard.style.display = 'flex';
  tutorialCard.style.alignItems = 'center';
  tutorialCard.style.gap = '1rem';
  tutorialCard.style.maxWidth = '500px';
  tutorialCard.style.margin = '0 auto';

  // Thumbnail
  const thumbnailContainer = document.createElement('div');
  thumbnailContainer.style.position = 'relative';
  thumbnailContainer.style.flexShrink = '0';

  const thumbnail = document.createElement('img');
  thumbnail.src = 'https://i.ytimg.com/vi/UOfQJv4tkEI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD8q9X7l6Kq1tV-5f5QY2W5sXwJ7g';
  thumbnail.alt = 'Tutorial';
  thumbnail.style.width = '120px';
  thumbnail.style.height = '68px';
  thumbnail.style.objectFit = 'cover';
  thumbnail.style.borderRadius = '8px';
  thumbnail.style.transition = 'transform 0.3s ease';

  // Play button overlay
  const playButton = document.createElement('div');
  playButton.style.position = 'absolute';
  playButton.style.top = '50%';
  playButton.style.left = '50%';
  playButton.style.transform = 'translate(-50%, -50%)';
  playButton.style.background = 'rgba(255, 0, 0, 0.9)';
  playButton.style.borderRadius = '6px';
  playButton.style.width = '32px';
  playButton.style.height = '32px';
  playButton.style.display = 'flex';
  playButton.style.alignItems = 'center';
  playButton.style.justifyContent = 'center';
  playButton.style.transition = 'all 0.3s ease';

  const playIcon = document.createElement('div');
  playIcon.innerHTML = '▶';
  playIcon.style.color = 'white';
  playIcon.style.fontSize = '0.8rem';
  playIcon.style.marginLeft = '2px';

  playButton.appendChild(playIcon);
  thumbnailContainer.appendChild(thumbnail);
  thumbnailContainer.appendChild(playButton);

  // Content area
  const content = document.createElement('div');
  content.style.flex = '1';

  const descEl = document.createElement('p');
  descEl.innerHTML = translations.dlc.tutorial_desc || '📁 <strong>EA DLC Unlocker:</strong> General tool for unlocking DLCs in EA games<br>🎮 <strong>Sims 4 Updater:</strong> Specialized for The Sims 4 with updates & repairs';
  descEl.style.margin = '0';
  descEl.style.fontSize = '0.85rem';
  descEl.style.color = 'var(--text-color)';
  descEl.style.opacity = '0.9';
  descEl.style.lineHeight = '1.4';

  content.appendChild(descEl);
  tutorialCard.appendChild(thumbnailContainer);
  tutorialCard.appendChild(content);

  // Hover effects (remain the same)
  tutorialCard.addEventListener('mouseenter', () => {
    tutorialCard.style.transform = 'translateY(-2px)';
    tutorialCard.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
    thumbnail.style.transform = 'scale(1.05)';
    playButton.style.background = 'rgba(255, 0, 0, 1)';
    playButton.style.transform = 'translate(-50%, -50%) scale(1.1)';
  });

  tutorialCard.addEventListener('mouseleave', () => {
    tutorialCard.style.transform = 'translateY(0)';
    tutorialCard.style.boxShadow = 'none';
    thumbnail.style.transform = 'scale(1)';
    playButton.style.background = 'rgba(255, 0, 0, 0.9)';
    playButton.style.transform = 'translate(-50%, -50%) scale(1)';
  });

  // Click to open video
  tutorialCard.addEventListener('click', () => {
    window.api.openExternal('https://www.youtube.com/watch?v=UOfQJv4tkEI');
  });

  tutorialsSection.appendChild(tutorialCard);
  container.appendChild(tutorialsSection);
  
  return container;
}

async function downloadAndExtractDLC(button, statusElement, dlcId, downloadUrl, dlcName) {
    button.disabled = true;
    const originalText = button.innerHTML;
    const originalBackground = button.style.background;
    
    button.innerHTML = '⏳ DOWNLOADING...';
    statusElement.style.display = 'block';
    statusElement.textContent = `Starting download for ${dlcName}...`;
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    const downloadId = `${dlcId}-${Date.now()}`;

    return new Promise((resolve) => {
        const unsubscribe = window.api.onDownloadEvent(async (data) => {
            if (data.id !== downloadId) return;

            switch (data.status) {
                case 'started':
                    statusElement.textContent = `Downloading ${dlcName}... 0%`;
                    break;
                case 'progress':
                    statusElement.textContent = `Downloading ${dlcName}... ${data.percent}%`;
                    button.innerHTML = `⏳ DOWNLOADING... ${data.percent}%`;
                    break;
                case 'complete':
                    statusElement.textContent = 'Download complete! Extracting files...';
                    button.innerHTML = '📦 EXTRACTING...';
                    
                    try {
                        // Extract το zip file με κωδικό 123
                        const result = await window.api.extractArchive(data.path, '123');
                        
                        if (result.success) {
                            statusElement.textContent = 'Extraction complete! Running installer...';
                            button.innerHTML = '🚀 STARTING INSTALLER...';
                            
                            const exeResult = await runSpecificExe(data.path, dlcName, button, statusElement);
                            
                            if (exeResult.success) {
                                statusElement.textContent = `${dlcName} installer started successfully! 🎉\nYou can now follow the installation wizard.`;
                                statusElement.classList.add('status-success');
                                button.innerHTML = '✅ INSTALLER RUNNING';
                                button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';
                                
                                toast(`${dlcName} installer started! Follow the installation wizard.`, { 
                                    type: 'success', 
                                    title: 'DLC Unlocker',
                                    duration: 5000 
                                });

                                // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out του status μετά από 8 δευτερόλεπτα
                                autoFadeStatus(statusElement, 8000);

                                // ΕΠΑΝΑΦΟΡΑ ΜΟΝΟ ΤΟΥ ΚΟΥΜΠΙΟΥ ΜΕΤΑ ΑΠΟ 10 ΔΕΥΤΕΡΟΛΕΠΤΑ, ΚΡΑΤΑΜΕ ΤΟ STATUS
                                setTimeout(() => {
                                    button.innerHTML = originalText;
                                    button.disabled = false;
                                    button.style.background = originalBackground;
                                    // ΔΕΝ αφαιρούμε το status text - αφήνουμε το output ορατό
                                }, 10000);
                                
                            } else {
                                statusElement.textContent = `Extracted but could not run installer: ${exeResult.error}\nPlease try running the installer manually from the extracted folder.`;
                                statusElement.classList.add('status-warning');
                                button.innerHTML = '📂 OPEN FOLDER';
                                button.disabled = false;
                                button.style.background = originalBackground;
                                
                                // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για error case
                                autoFadeStatus(statusElement, 10000);
                                
                                addOpenFolderButton(button, data.path, dlcName);
                                // Κρατάμε το status ορατό για manual instructions
                            }
                        } else {
                            // Δοκιμή χωρίς κωδικό
                            statusElement.textContent = 'Trying extraction without password...';
                            const retryResult = await window.api.extractArchive(data.path, '');
                            
                            if (retryResult.success) {
                                statusElement.textContent = 'Extraction complete! Running installer...';
                                button.innerHTML = '🚀 STARTING INSTALLER...';
                                
                                const exeResult = await runSpecificExe(data.path, dlcName, button, statusElement);
                                
                                if (exeResult.success) {
                                    statusElement.textContent = `${dlcName} installer started successfully! 🎉\nYou can now follow the installation wizard.`;
                                    statusElement.classList.add('status-success');
                                    button.innerHTML = '✅ INSTALLER RUNNING';
                                    button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';
                                    
                                    toast(`${dlcName} installer started! Follow the installation wizard.`, { 
                                        type: 'success', 
                                        title: 'DLC Unlocker',
                                        duration: 5000 
                                    });

                                    // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out του status
                                    autoFadeStatus(statusElement, 8000);

                                    // ΕΠΑΝΑΦΟΡΑ ΜΟΝΟ ΤΟΥ ΚΟΥΜΠΙΟΥ
                                    setTimeout(() => {
                                        button.innerHTML = originalText;
                                        button.disabled = false;
                                        button.style.background = originalBackground;
                                    }, 10000);
                                    
                                } else {
                                    statusElement.textContent = `Extracted but could not run installer: ${exeResult.error}\nPlease try running the installer manually from the extracted folder.`;
                                    statusElement.classList.add('status-warning');
                                    button.innerHTML = '📂 OPEN FOLDER';
                                    button.disabled = false;
                                    button.style.background = originalBackground;
                                    
                                    // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για error case
                                    autoFadeStatus(statusElement, 10000);
                                    
                                    addOpenFolderButton(button, data.path, dlcName);
                                }
                            } else {
                                const errMsg = (retryResult && retryResult.error) || 'Unknown error';
                                statusElement.textContent = `Extraction failed: ${errMsg}\nThe downloaded file has been opened for manual inspection.`;
                                statusElement.classList.add('status-error');
                                button.innerHTML = '🔄 TRY AGAIN';
                                button.disabled = false;
                                button.style.background = originalBackground;
                                
                                // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για exception case
                                autoFadeStatus(statusElement, 10000);
                                
                                toast(`Failed to extract ${dlcName}`, { 
                                    type: 'error', 
                                    title: 'DLC Unlocker',
                                    duration: 6000 
                                });
                                window.api.openFile(data.path).catch(() => {});
                            }
                        }
                    } catch (error) {
                        statusElement.textContent = `Extraction failed: ${error.message}\nPlease check the downloaded file manually.`;
                        statusElement.classList.add('status-error');
                        button.innerHTML = '🔄 TRY AGAIN';
                        button.disabled = false;
                        button.style.background = originalBackground;
                        
                        // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για exception case
                        autoFadeStatus(statusElement, 10000);
                        
                        toast(`Failed to extract ${dlcName}`, { 
                            type: 'error', 
                            title: 'DLC Unlocker',
                            duration: 6000 
                        });
                        window.api.openFile(data.path).catch(() => {});
                    }
                    
                    unsubscribe();
                    resolve();
                    break;
                    
                case 'error':
                    statusElement.textContent = `Download error: ${data.error}\nPlease check your internet connection and try again.`;
                    statusElement.classList.add('status-error');
                    button.innerHTML = originalText;
                    button.disabled = false;
                    button.style.background = originalBackground;
                    
                    // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για download error
                    autoFadeStatus(statusElement, 10000);
                    
                    toast(`Download failed for ${dlcName}`, { 
                        type: 'error', 
                        title: 'DLC Unlocker',
                        duration: 6000 
                    });
                    unsubscribe();
                    resolve();
                    break;
            }
        });

        // Start download
        try {
            window.api.downloadStart(downloadId, downloadUrl, `${dlcName.replace(/\s+/g, '_')}.zip`);
        } catch (e) {
            statusElement.textContent = `Download failed: ${e.message}\nPlease check your internet connection.`;
            statusElement.classList.add('status-error');
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.background = originalBackground;
            
            // ΠΡΟΣΘΗΚΗ: Αυτόματο fade-out και για exception case
            autoFadeStatus(statusElement, 10000);
            
            toast(`Download failed for ${dlcName}`, { 
                type: 'error', 
                title: 'DLC Unlocker',
                duration: 6000 
            });
            unsubscribe();
            resolve();
        }
    });
}
// Function για να τρέξει συγκεκριμένο exe file με pattern matching
async function runSpecificExe(zipPath, dlcName, button, statusElement) {
    return new Promise((resolve) => {
        setTimeout(async () => {
            const extractedDir = getExtractedFolderPath(zipPath);
            
            // Pattern matching για κάθε DLC
            let exePatterns = [];
            
            if (dlcName === 'Sims Installer') {
                exePatterns = [
                    /sims-4-updater-v.*\.exe$/i
                ];
            } else if (dlcName === 'EA Unlocker') {
                exePatterns = [
                    /setup\.bat$/i,
                ];
            }
            
            if (exePatterns.length > 0) {
                try {
                    const result = await findExeByPattern(extractedDir, exePatterns, dlcName);
                    
                    if (result.success) {
                        statusElement.textContent = `Found ${result.exeName}! Running installer...`;
                        button.innerHTML = '🎮 LAUNCHING INSTALLER...';
                        
                        const openResult = await window.api.openFile(result.exePath);
                        
                        if (openResult.success) {
                            resolve({ success: true, exePath: result.exePath });
                        } else {
                            resolve({ success: false, error: `Could not run ${result.exeName}` });
                        }
                    } else {
                        resolve({ success: false, error: result.error });
                    }
                } catch (error) {
                    resolve({ success: false, error: error.message });
                }
            } else {
                resolve({ success: false, error: 'No patterns specified for this DLC' });
            }
        }, 2000);
    });
}
// Function για εύρεση exe με βάση patterns
async function findExeByPattern(extractedDir, patterns, dlcName) {
  return new Promise((resolve) => {
    window.api.findExeFiles(extractedDir)
      .then(files => {
        if (files && files.length > 0) {
          // Προτεραιότητα 1: Αρχεία που ταιριάζουν με τα patterns
          for (const pattern of patterns) {
            const matchingFiles = files.filter(file => {
              const fileName = getBaseName(file, '');
              return pattern.test(fileName);
            });
            
            if (matchingFiles.length > 0) {
              // Βρες το πιο πιθανό αρχείο (π.χ. μεγαλύτερο, ή με συγκεκριμένα keywords)
              const bestFile = selectBestExe(matchingFiles, dlcName);
              return resolve({ 
                success: true, 
                exePath: bestFile, 
                exeName: getBaseName(bestFile, '') 
              });
            }
          }
          
          // Προτεραιότητα 2: Αρχεία με συγκεκριμένα keywords
          const keywordFiles = files.filter(file => {
            const lowerFile = file.toLowerCase();
            return lowerFile.includes('install') || 
                   lowerFile.includes('setup') || 
                   lowerFile.includes('crack') ||
                   lowerFile.includes('unlock');
          });
          
          if (keywordFiles.length > 0) {
            const bestFile = selectBestExe(keywordFiles, dlcName);
            return resolve({ 
              success: true, 
              exePath: bestFile, 
              exeName: getBaseName(bestFile, ''),
              alternative: true 
            });
          }
          
          // Προτεραιότητα 3: Πάρε το πρώτο exe
          return resolve({ 
            success: true, 
            exePath: files[0], 
            exeName: getBaseName(files[0], ''),
            alternative: true 
          });
        } else {
          resolve({ success: false, error: 'No executable files found' });
        }
      })
      .catch(() => resolve({ success: false, error: 'Error searching for executables' }));
  });
}
// Βοηθητική function για εύρεση του Clip Studio installer
async function findClipStudioInstaller(extractedDir) {
  return new Promise((resolve) => {
    window.api.findExeFiles(extractedDir)
      .then(files => {
        if (!files || files.length === 0) {
          resolve(null);
          return;
        }
        
        // Προτεραιότητα: files με "clipstudio_crack" ή "install" ή "setup"
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
          // Αλλιώς πάρε το πρώτο exe
          resolve(files[0]);
        }
      })
      .catch(() => resolve(null));
  });
}

// Helper function to locate the correct installer executable for non‑Clip Studio projects.
// For most Adobe applications the installer is named `Set‑up.exe` (with a hyphen).
// For Microsoft Office we look for `OInstall_x64.exe` (or any file starting with 'oinstall').
// If none of these are found we return null so the UI can prompt the user to run
// the installer manually. We deliberately avoid choosing other executables such as
// cracks or patches.
async function findProjectInstaller(extractedDir, projectName) {
  try {
    const exeFiles = await window.api.findExeFiles(extractedDir);
    if (!exeFiles || exeFiles.length === 0) {
      return null;
    }
    const lowerName = (projectName || '').toLowerCase();
    // Special case: Office uses OInstall executables
    if (lowerName.includes('office')) {
      // Normalize base names for comparison
      const exact = exeFiles.find(f => getBaseName(f, '').toLowerCase() === 'oinstall_x64');
      if (exact) return exact;
      const prefix = exeFiles.find(f => getBaseName(f, '').toLowerCase().startsWith('oinstall'));
      if (prefix) return prefix;
      return null;
    }
    // General case: search for files whose base name contains 'set-up' (hyphenated)
    const hyphenated = exeFiles.find(f => getBaseName(f, '').toLowerCase().includes('set-up'));
    if (hyphenated) return hyphenated;
    // Also handle 'setup' (no hyphen) but ensure we avoid crack/patch/unlock/pop keywords
    const setup = exeFiles.find(f => {
      const base = getBaseName(f, '').toLowerCase();
      return base.includes('setup') &&
             !base.includes('crack') &&
             !base.includes('patch') &&
             !base.includes('unlock') &&
             !base.includes('pop');
    });
    if (setup) return setup;
    // As a safety, look for any file containing 'install' but not crack/patch/unlock/pop
    const install = exeFiles.find(f => {
      const base = getBaseName(f, '').toLowerCase();
      return base.includes('install') &&
             !base.includes('crack') &&
             !base.includes('patch') &&
             !base.includes('unlock') &&
             !base.includes('pop');
    });
    if (install) return install;
    // If none match, return null instead of running an arbitrary executable
    return null;
  } catch (err) {
    return null;
  }
}
// Function για επιλογή του καλύτερου exe από μια λίστα
function selectBestExe(files, dlcName) {
  // Score-based selection
  const scoredFiles = files.map(file => {
    const fileName = getBaseName(file, '').toLowerCase();
    let score = 0;
    
    // Bonus points για συγκεκριμένα keywords
    if (fileName.includes('install')) score += 10;
    if (fileName.includes('setup')) score += 8;
    if (fileName.includes('crack')) score += 6;
    if (fileName.includes('unlock')) score += 6;
    if (fileName.includes('patch')) score += 4;
    
    // Bonus points για DLC-specific keywords
    if (dlcName === 'Sims Installer') {
      if (fileName.includes('sims')) score += 5;
      if (fileName.includes('updater')) score += 5;
    } else if (dlcName === 'EA Unlocker') {
      if (fileName.includes('ea')) score += 5;
      if (fileName.includes('clipstudio')) score += 5;
    }
    
    // Penalty για αρχεία με "uninstall", "remove", κλπ
    if (fileName.includes('uninstall')) score -= 20;
    if (fileName.includes('remove')) score -= 15;
    if (fileName.includes('delete')) score -= 15;
    
    return { file, score, fileName };
  });
  
  // Ταξινόμηση με βάση το score (σε φθίνουσα σειρά)
  scoredFiles.sort((a, b) => b.score - a.score);
  
  // Επέστρεψε το αρχείο με το υψηλότερο score
  return scoredFiles[0].file;
}
// Βοηθητική function για path του extracted folder
function getExtractedFolderPath(zipPath) {
  const parentDir = getDirectoryName(zipPath);
  const baseName = getBaseName(zipPath, '.zip');
  return `${parentDir}/${baseName}`;
}

// Βοηθητικές functions για path manipulation
function getDirectoryName(filePath) {
  if (filePath.includes('\\')) {
    return filePath.substring(0, filePath.lastIndexOf('\\'));
  }
  return filePath.substring(0, filePath.lastIndexOf('/'));
}

function getBaseName(filePath, ext = '') {
  let fileName;
  if (filePath.includes('\\')) {
    fileName = filePath.substring(filePath.lastIndexOf('\\') + 1);
  } else {
    fileName = filePath.substring(filePath.lastIndexOf('/') + 1);
  }
  
  if (ext && fileName.endsWith(ext)) {
    fileName = fileName.substring(0, fileName.length - ext.length);
  }
  return fileName;
}

// Βοηθητική function για προσθήκη κουμπιού ανοίγματος φακέλου
function addOpenFolderButton(button, zipPath, dlcName) {
  const extractedDir = getExtractedFolderPath(zipPath);
  
  const openFolderButton = document.createElement('button');
  openFolderButton.className = 'button button-secondary open-folder-button';
  openFolderButton.innerHTML = '📂 OPEN EXTRACTED FOLDER';
  openFolderButton.style.marginTop = '0.5rem';
  openFolderButton.style.width = '100%';
  openFolderButton.onclick = () => {
    window.api.openFile(extractedDir)
      .then(result => {
        if (!result.success) {
          toast('Could not open folder automatically. Please navigate to it manually.', { 
            type: 'warning', 
            title: 'DLC Unlocker' 
          });
        }
      });
  };
  
  const card = button.closest('.app-card');
  const existingButton = card.querySelector('.open-folder-button');
  if (!existingButton) {
    card.appendChild(openFolderButton);
  }
}

// Νέα function για activate download και execution
async function downloadAndRunActivate(button, statusElement) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Downloading...';
  statusElement.style.display = 'block';
  statusElement.textContent = 'Downloading activation script...\n⚠️ This requires Administrator privileges\n';
  statusElement.classList.remove('status-success', 'status-error', 'status-warning');

  const downloadId = `activate-${Date.now()}`;
  const activateUrl = 'https://www.dropbox.com/scl/fi/oqgye14tmcg97mxbphorp/activate.bat?rlkey=307wz4bzkzejip3os7iztt54l&st=oz6nh4pf&dl=1';

  return new Promise((resolve) => {
    const unsubscribe = window.api.onDownloadEvent((data) => {
      if (data.id !== downloadId) return;

      switch (data.status) {
        case 'started':
          statusElement.textContent = 'Downloading activation script... 0%';
          break;
        case 'progress':
          statusElement.textContent = `Downloading activation script... ${data.percent}%`;
          break;
        case 'complete':
          statusElement.textContent = 'Download complete! Running activation script...';
          button.textContent = 'Running...';
          
          // Εκτέλεση του bat file
          window.api.openFile(data.path)
            .then((result) => {
              if (result.success) {
                statusElement.textContent = 'Activation script started successfully! Please check the command window.';
                statusElement.classList.add('status-success');
                button.textContent = 'Activation Started';
                toast('Activation script started!', { type: 'success', title: 'Activation' });
              } else {
                statusElement.textContent = `Error running script: ${result.error}`;
                statusElement.classList.add('status-error');
                button.textContent = 'Download & Activate Windows';
                toast('Failed to run activation script', { type: 'error', title: 'Activation' });
              }
            })
            .catch((err) => {
              statusElement.textContent = `Error: ${err.message}`;
              statusElement.classList.add('status-error');
              button.textContent = 'Download & Activate Windows';
              toast('Error running activation script', { type: 'error', title: 'Activation' });
            })
            .finally(() => {
              button.disabled = false;
              autoFadeStatus(statusElement, 5000);
              unsubscribe();
              resolve();
            });
          break;
        case 'error':
          statusElement.textContent = `Download error: ${data.error}`;
          statusElement.classList.add('status-error');
          button.textContent = 'Download & Activate Windows';
          button.disabled = false;
          toast('Download failed', { type: 'error', title: 'Activation' });
          unsubscribe();
          resolve();
          break;
      }
    });

    // Start download
    try {
      window.api.downloadStart(downloadId, activateUrl, 'activate.bat');
    } catch (e) {
      statusElement.textContent = `Download failed: ${e.message}`;
      statusElement.classList.add('status-error');
      button.textContent = 'Download & Activate Windows';
      button.disabled = false;
      toast('Download failed', { type: 'error', title: 'Activation' });
      unsubscribe();
      resolve();
    }
  });
}

// Νέα function για autologin download και execution
async function downloadAndRunAutologin(button, statusElement) {
  button.disabled = true;
  const originalText = button.textContent;
  button.textContent = 'Downloading...';
  statusElement.style.display = 'block';
  statusElement.textContent = 'Downloading auto login tool...\n⚠️ This requires Administrator privileges\n';
  statusElement.classList.remove('status-success', 'status-error', 'status-warning');

  const downloadId = `autologin-${Date.now()}`;
  const autologinUrl = 'https://www.dropbox.com/scl/fi/a0bphjru0qfnbsokk751h/auto-login.exe?rlkey=b3ogyjelioq49jyty1odi58x9&st=4o2oq4sc&dl=1';

  return new Promise((resolve) => {
    const unsubscribe = window.api.onDownloadEvent((data) => {
      if (data.id !== downloadId) return;

      switch (data.status) {
        case 'started':
          statusElement.textContent = 'Downloading auto login tool... 0%';
          break;
        case 'progress':
          statusElement.textContent = `Downloading auto login tool... ${data.percent}%`;
          break;
        case 'complete':
          statusElement.textContent = 'Download complete! Running auto login setup...';
          button.textContent = 'Running...';
          
          // Εκτέλεση του exe file
          window.api.openFile(data.path)
            .then((result) => {
              if (result.success) {
                statusElement.textContent = 'Auto login tool started successfully! Please follow the instructions.';
                statusElement.classList.add('status-success');
                button.textContent = 'Auto Login Started';
                toast('Auto login tool started!', { type: 'success', title: 'Auto Login' });
              } else {
                statusElement.textContent = `Error running tool: ${result.error}`;
                statusElement.classList.add('status-error');
                button.textContent = 'Download & Setup Auto Login';
                toast('Failed to run auto login tool', { type: 'error', title: 'Auto Login' });
              }
            })
            .catch((err) => {
              statusElement.textContent = `Error: ${err.message}`;
              statusElement.classList.add('status-error');
              button.textContent = 'Download & Setup Auto Login';
              toast('Error running auto login tool', { type: 'error', title: 'Auto Login' });
            })
            .finally(() => {
              button.disabled = false;
              autoFadeStatus(statusElement, 5000);
              unsubscribe();
              resolve();
            });
          break;
        case 'error':
          statusElement.textContent = `Download error: ${data.error}`;
          statusElement.classList.add('status-error');
          button.textContent = 'Download & Setup Auto Login';
          button.disabled = false;
          toast('Download failed', { type: 'error', title: 'Auto Login' });
          unsubscribe();
          resolve();
          break;
      }
    });

    // Start download
    try {
      window.api.downloadStart(downloadId, autologinUrl, 'auto_login.exe');
    } catch (e) {
      statusElement.textContent = `Download failed: ${e.message}`;
      statusElement.classList.add('status-error');
      button.textContent = 'Download & Setup Auto Login';
      button.disabled = false;
      toast('Download failed', { type: 'error', title: 'Auto Login' });
      unsubscribe();
      resolve();
    }
  });
}
  // Build settings page with language and theme selectors
  function buildSettingsPage() {
      const container = document.createElement('div');
      container.className = 'settings-container';
      
      const title = document.createElement('h2');
      title.className = 'settings-title';
      // Use fallbacks if translations are missing
      title.textContent = (translations.pages && translations.pages.settings_title) || (translations.menu && translations.menu.settings) || 'Settings';
      container.appendChild(title);

      // Language selector row
      const langRow = document.createElement('div');
      langRow.className = 'settings-row';
      
      const langLabel = document.createElement('label');
      langLabel.className = 'settings-label';
      // Fallback for language label if translation is unavailable
      langLabel.textContent = ((translations.general && translations.general.language) || 'Language') + ':';
      
      const langControl = document.createElement('div');
      langControl.className = 'settings-control';
      
      const langSelect = document.createElement('select');
      langSelect.className = 'settings-select';
      
      [['en', 'English'], ['gr', 'Ελληνικά']].forEach(([value, label]) => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = label;
          if (settings.lang === value) option.selected = true;
          langSelect.appendChild(option);
      });
      
      langControl.appendChild(langSelect);
      langRow.appendChild(langLabel);
      langRow.appendChild(langControl);
      container.appendChild(langRow);

      // Theme selector row
      const themeRow = document.createElement('div');
      themeRow.className = 'settings-row';
      
      const themeLabel = document.createElement('label');
      themeLabel.className = 'settings-label';
      // Fallback for theme label
      themeLabel.textContent = ((translations.general && translations.general.theme) || 'Theme') + ':';
      
      const themeControl = document.createElement('div');
      themeControl.className = 'settings-control';
      
      const themeSwitchContainer = document.createElement('div');
      themeSwitchContainer.className = 'settings-switch';
      
      const themeSwitch = document.createElement('label');
      themeSwitch.className = 'switch';
      
      const themeInput = document.createElement('input');
      themeInput.type = 'checkbox';
      themeInput.checked = settings.theme === 'dark';
      
      const themeSlider = document.createElement('span');
      themeSlider.className = 'slider';
      
      const themeSwitchLabel = document.createElement('span');
      themeSwitchLabel.className = 'switch-label';
      // Fallback for dark/light labels
      themeSwitchLabel.textContent = themeInput.checked ? ((translations.general && translations.general.dark) || 'Dark') : ((translations.general && translations.general.light) || 'Light');
      
      themeSwitch.appendChild(themeInput);
      themeSwitch.appendChild(themeSlider);
      themeSwitchContainer.appendChild(themeSwitch);
      themeSwitchContainer.appendChild(themeSwitchLabel);
      themeControl.appendChild(themeSwitchContainer);
      
      // Update label when theme changes, using fallbacks
      themeInput.addEventListener('change', () => {
          themeSwitchLabel.textContent = themeInput.checked ? ((translations.general && translations.general.dark) || 'Dark') : ((translations.general && translations.general.light) || 'Light');
      });
      
      themeRow.appendChild(themeLabel);
      themeRow.appendChild(themeControl);
      container.appendChild(themeRow);

      // Save button
      const saveBtn = document.createElement('button');
      saveBtn.className = 'settings-save-btn';
      // Fallback for save button
      saveBtn.textContent = (translations.general && translations.general.save) || 'Save';
      saveBtn.addEventListener('click', async () => {
          settings.lang = langSelect.value;
          settings.theme = themeInput.checked ? 'dark' : 'light';
          saveSettings();
          await loadTranslations();
          applyTheme();
          renderMenu();
          setHeader(translations.menu.settings);
          
          // Show success feedback
          const originalText = saveBtn.textContent;
          saveBtn.textContent = '✓ ' + ((translations.general && translations.general.saved) || 'Saved');
          saveBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';
          
          setTimeout(() => {
              saveBtn.textContent = originalText;
              saveBtn.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-color-light) 100%)';
          }, 2000);
      });
      
      container.appendChild(saveBtn);

      // Append update section for checking app updates. This should work even in non-Electron environments.
      {
        const updateSection = document.createElement('div');
        updateSection.className = 'settings-row';
        updateSection.style.cssText = 'border-top: 1px solid var(--border-color); padding-top: 1.5rem; margin-top: 1rem;';

        const updateLabel = document.createElement('div');
        updateLabel.className = 'settings-label';
        // Use translation if available, otherwise fallback to English
        updateLabel.textContent =
          (translations && translations.pages && translations.pages.updates) ||
          'Updates:';

        const updateControl = document.createElement('div');
        updateControl.className = 'settings-control';

        const updateButton = document.createElement('button');
        updateButton.className = 'button';
        const versionInfo = document.createElement('div');
        versionInfo.style.cssText =
          'margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.7;';

        // Determine if the Electron API is available. If not, disable the update button.
        const hasAPI =
          typeof window !== 'undefined' &&
          window.api &&
          typeof window.api.checkForUpdates === 'function' &&
          typeof window.api.getAppVersion === 'function';

        if (hasAPI) {
          // When API is available, allow checking for updates
          updateButton.textContent =
            (translations && translations.actions &&
              translations.actions.check_updates) ||
            'Check for Updates';
          updateButton.disabled = false;
          updateButton.onclick = () => {
            updateButton.disabled = true;
            updateButton.textContent =
              (translations?.actions &&
                translations.actions.checking_updates) ||
              'Checking...';
            window.api
              .checkForUpdates()
              .finally(() => {
                setTimeout(() => {
                  updateButton.disabled = false;
                  updateButton.textContent =
                    (translations?.actions &&
                      translations.actions.check_updates) ||
                    'Check for Updates';
                }, 3000);
              });
          };
          versionInfo.textContent =
            (translations && translations.pages &&
              translations.pages.current_version_loading) ||
            'Current version: loading...';
          window.api
            .getAppVersion()
            .then((version) => {
              const tmpl =
                translations &&
                translations.pages &&
                translations.pages.current_version;
              if (tmpl && typeof tmpl === 'string') {
                versionInfo.textContent = tmpl.replace('{version}', version);
              } else {
                versionInfo.textContent = `Current version: ${version}`;
              }
            })
            .catch(() => {
              // ignore errors
            });
        } else {
          // If API is not available, disable the button and show that updates are unavailable
          updateButton.textContent =
            (translations && translations.actions &&
              translations.actions.updates_unavailable) ||
            'Updates unavailable';
          updateButton.disabled = true;
          versionInfo.textContent =
            (translations && translations.pages &&
              translations.pages.current_version_unavailable) ||
            'Current version: unavailable';
        }

        updateControl.appendChild(updateButton);
        updateControl.appendChild(versionInfo);
        updateSection.appendChild(updateLabel);
        updateSection.appendChild(updateControl);
        container.appendChild(updateSection);
      }

      return container;
  }

  // Fixed function to open installer
  const openInstaller = async (app, filePath, status, index) => {
    try {
      status.textContent = 'Opening installer...';
      
      // Use the new openFile method
      const result = await window.api.openFile(filePath);
      
      if (result.success) {
        status.textContent = 'Installer opened successfully!';
        status.classList.add('status-success');
      } else {
        throw new Error(result.error);
      }
      
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
      status.classList.add('status-error');
      console.error('Error opening installer:', err);
    } finally {
      // Always mark as complete and clean up
      const download = activeDownloads.get(index);
      if (download) {
        download.status = 'complete';
        activeDownloads.delete(index);
      }
      checkAllComplete();
    }
  };
  // ---- Toasts (bottom-right) ----
  function ensureToastContainer(){
    let c = document.getElementById('toast-container');
    if(!c){ c = document.createElement('div'); c.id='toast-container'; document.body.appendChild(c); }
    return c;
  }
function toast(msg, opts = {}) {
  const { title = '', type = 'info', duration = 4000 } = opts;
  const container = ensureToastContainer();
  
  const toastEl = document.createElement('div');
  toastEl.className = `toast ${type}`;
  
  // Icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  icon.textContent = icons[type] || 'ℹ';
  
  const body = document.createElement('div');
  body.className = 'toast-body';
  
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    body.appendChild(titleEl);
  }
  
  const message = document.createElement('div');
  message.className = 'toast-message';
  message.textContent = msg;
  body.appendChild(message);
  
  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '×';
  close.onclick = () => dismissToast(toastEl);
  
  // Progress bar for auto-dismiss
  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  if (duration > 0) {
    progress.style.animationDuration = `${duration}ms`;
  }
  
  toastEl.append(icon, body, close, progress);
  container.appendChild(toastEl);
  
  // Auto dismiss
  let timeout;
  if (duration > 0) {
    timeout = setTimeout(() => dismissToast(toastEl), duration);
  }
  
  // Pause on hover
  toastEl.addEventListener('mouseenter', () => {
    if (timeout) {
      clearTimeout(timeout);
      progress.style.animationPlayState = 'paused';
    }
  });
  
  toastEl.addEventListener('mouseleave', () => {
    if (duration > 0) {
      const remaining = duration - (duration * (parseFloat(progress.style.width) / 100 || 0));
      timeout = setTimeout(() => dismissToast(toastEl), remaining);
      progress.style.animationPlayState = 'running';
    }
  });
  
  return toastEl;
}

function dismissToast(toastEl) {
  toastEl.classList.add('toast-exit');
  setTimeout(() => {
    if (toastEl.parentNode) {
      toastEl.parentNode.removeChild(toastEl);
    }
  }, 300);
}
  // ---- INSTALL APPS (fixed) ----
  async function buildInstallPage(){
    const container = document.createElement('div'); container.className='card';
    const title = document.createElement('h2'); title.textContent = (translations.pages&&translations.pages.install_title)||'Install Applications'; container.appendChild(title);
    const desc  = document.createElement('p'); desc.textContent = (translations.pages&&translations.pages.install_desc)||'Select apps to download. We will open each installer automatically after the download finishes.'; container.appendChild(desc);

    // Keep your app list; you can edit URLs/names safely
    const apps = [
      { name: 'BetterDiscord', description: 'Enhanced Discord client', url: 'https://www.dropbox.com/scl/fi/qdw73ry6cyqcn4d71aw5n/BetterDiscord-Windows.exe?rlkey=he0pheyexqjk42kwhdxv1cyry&st=kd8njdce&dl=1', ext: 'exe' },
      { name: 'Discord PTB', description: 'Public Test Build of Discord', url: 'https://www.dropbox.com/scl/fi/aaqzyvha72wjhmlbkaisf/discord_ptb.exe?rlkey=jandm03y74hsx8vmt3bf9enub&st=syrb9gxp&dl=1', ext: 'exe' },
      { name: 'Discord', description: 'Official Discord client', url: 'https://www.dropbox.com/scl/fi/bgpi9iy00abrkw995u4by/discord.exe?rlkey=fm22iu7b0gwvackygmhvv29uw&st=mvmkbabw&dl=1', ext: 'exe' },
      { name: 'Epic Games', description: 'Epic Games Launcher', url: 'https://www.dropbox.com/scl/fi/3mnee6vxp3wp1mym5nrhd/epicgames.msi?rlkey=ygiy5oqia6hm0ne61vs7nz6m6&st=qigfjjlm&dl=1', ext: 'msi' },
      { name: 'Ubisoft Connect', description: 'Ubisoft game launcher', url: 'https://www.dropbox.com/scl/fi/8wzoxzkf23pklm6thvr3d/ubisoft.exe?rlkey=lasiokbqo5h659kib2s42zjtf&st=pzys86ls&dl=1', ext: 'exe' }
    ];

    const list = document.createElement('ul'); list.style.listStyle='none'; list.style.padding='0'; list.style.margin='0';
    apps.forEach((app, i)=>{
      const li=document.createElement('li'); li.style.display='flex'; li.style.alignItems='center'; li.style.padding='1rem'; li.style.border='1px solid var(--border-color)'; li.style.borderRadius='12px'; li.style.marginBottom='0.75rem'; li.style.background='var(--card-bg)';
      const cb=document.createElement('input'); cb.type='checkbox'; cb.id=`app-${i}`; cb.style.marginRight='1rem'; cb.style.width='18px'; cb.style.height='18px'; cb.style.accentColor='var(--accent-color)';
      const label=document.createElement('label'); label.htmlFor=cb.id; label.style.flex='1'; label.style.display='flex'; label.style.alignItems='center';
      const text=document.createElement('div'); const n=document.createElement('span'); n.textContent=app.name; n.style.fontWeight='600'; n.style.fontSize='1.1rem'; const p=document.createElement('p'); p.textContent=app.description; p.style.margin='0'; p.style.opacity='0.8'; p.style.fontSize='0.9rem'; text.append(n,p); label.append(text);
      const status=document.createElement('pre'); status.className='status-pre'; status.style.marginLeft='auto'; status.style.fontSize='0.85rem'; status.style.opacity='0.8';
      li.append(cb,label,status); list.appendChild(li);
    });
    container.appendChild(list);

    const btn=document.createElement('button'); btn.className='button'; btn.textContent=(translations.actions&&translations.actions.download_selected)||'Download Selected'; btn.style.marginTop='1rem'; container.appendChild(btn);

    let running = false;
    btn.onclick = async () => {
      if (running) return;
      running = true;
      btn.disabled = true;
      btn.textContent = 'Downloading...';

      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => parseInt(cb.id.split('-')[1]));
      if (!selected.length) {
        toast(translations.messages.no_apps_selected || 'No applications selected.', { type: 'info' });
        running = false;
        btn.disabled = false;
        btn.textContent = (translations.actions && translations.actions.download_selected) || 'Download Selected';
        return;
      }



const handleDownload = (idx) => {
    const app = apps[idx];
    const li = list.children[idx];
    const status = li.querySelector('pre');
    status.textContent = 'Starting download...';
    status.style.display = 'block'; // Ensure it's visible
    const id = `install-${app.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    const TIMEOUT_MS = 120000;
    return new Promise((resolve) => {
        let timeout;
        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== id) return;
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            if (data.status === 'started') {
                status.textContent = 'Downloading: 0%';
                status.style.display = 'block';
            } else if (data.status === 'progress') {
                status.textContent = `Downloading: ${data.percent}%`;
                status.style.display = 'block';
            } else if (data.status === 'complete') {
                status.textContent = 'Download complete! Launching installer...';
                status.style.display = 'block';
                unsubscribe();
                window.api.openInstaller(data.path)
                    .then(() => {
                        status.textContent = 'Installer opened successfully!';
                        status.classList.add('status-success');
                        status.style.display = 'block';
                        toast(`${app.name}: άνοιξε ο installer.`, { type: 'success', title: 'Install' });
                        autoFadeStatus(status, 2000); // Fade out after 2 seconds
                        resolve();
                    })
                    .catch((e) => {
                        status.textContent = 'Downloaded. Could not open automatically.';
                        status.classList.add('status-warning');
                        status.style.display = 'block';
                        toast(`${app.name}: δεν μπόρεσε να ανοίξει αυτόματα (${e.message}).`, { type: 'error', title: 'Install', duration: 6000 });
                        autoFadeStatus(status, 3000); // Fade out after 3 seconds
                        resolve();
                    });
            } else if (data.status === 'error') {
                status.textContent = `Download error: ${data.error}`;
                status.classList.add('status-error');
                status.style.display = 'block';
                toast(`${app.name}: σφάλμα λήψης – ${data.error}`, { type: 'error', title: 'Install', duration: 6000 });
                autoFadeStatus(status, 4000); // Fade out after 4 seconds for errors
                unsubscribe();
                resolve();
            }
        });
        // Start download
        try {
            window.api.downloadStart(id, app.url, `${app.name}.${app.ext}`);
        } catch (e) {
            status.textContent = `Download failed: ${e.message}`;
            status.classList.add('status-error');
            status.style.display = 'block';
            toast(`${app.name}: αποτυχία λήψης – ${e.message}`, { type: 'error', title: 'Install', duration: 6000 });
            autoFadeStatus(status, 4000); // Fade out after 4 seconds
            unsubscribe();
            resolve();
            return;
        }
        // Timeout handler
        timeout = setTimeout(() => {
            timeout = null;
            status.textContent = 'Download timed out';
            status.classList.add('status-error');
            status.style.display = 'block';
            toast(`${app.name}: έληξε ο χρόνος λήψης`, { type: 'error', title: 'Install', duration: 6000 });
            autoFadeStatus(status, 4000); // Fade out after 4 seconds
            unsubscribe();
            resolve();
        }, TIMEOUT_MS);
    });
};

      // Launch all downloads concurrently
      const promises = selected.map((idx) => handleDownload(idx));
      await Promise.all(promises);
      toast(translations.messages.all_downloads_complete || 'All downloads completed.', { title: 'make-your-life-easier', type: 'success' });
      running = false;
      btn.disabled = false;
      btn.textContent = (translations.actions && translations.actions.download_selected) || 'Download Selected';
    };
    return container;
  }

// Build Spicetify page
  function buildSpicetifyPage() {
    // Build the Spicetify page with install/uninstall buttons.  We use the
    // modern card and button styles defined in styles.css.  The page
    // description comes from the translations file (fallback to a
    // reasonable English string if missing).
    const container = document.createElement('div');
    container.className = 'card';

    const title = document.createElement('h2');
    title.textContent = translations.pages?.spicetify_title || translations.menu.spicetify;
    container.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = (translations.pages && translations.pages.spicetify_desc) ||
      'Spicetify is a Spotify client modification tool. Please respect Spotify\'s terms of service when using it.';
    desc.style.opacity = '0.8';
    desc.style.lineHeight = '1.6';
    container.appendChild(desc);

    // Output area for command logs.  We use a <pre> element so that
    // whitespace and line breaks are preserved.  It will scroll if
    // necessary.
    const outputPre = document.createElement('pre');
    outputPre.className = 'status-pre';
    outputPre.style.whiteSpace = 'pre-wrap';
    outputPre.style.wordBreak = 'break-word';
    outputPre.style.maxHeight = '200px';
    outputPre.style.overflowY = 'auto';
    outputPre.style.marginTop = '1rem';

    // Helper to run an action and update the UI.  It disables all
    // buttons during execution, shows a toast on success/failure and
    // writes the command output to the <pre>.
    async function runAction(action, successMsg, errorMsg) {
      // Disable buttons
      [installBtn, uninstallBtn, fullRemoveBtn].forEach((b) => b.disabled = true);
      try {
        const result = await action();
        outputPre.textContent = result.output || '';
        if (result.success) {
          toast(successMsg, { type: 'success', title: translations.menu.spicetify });
        } else {
          toast(errorMsg + (result.error ? `: ${result.error}` : ''), { type: 'error', title: translations.menu.spicetify, duration: 6000 });
        }
      } catch (err) {
        outputPre.textContent = '';
        toast(errorMsg + `: ${err.message}`, { type: 'error', title: translations.menu.spicetify, duration: 6000 });
      } finally {
        [installBtn, uninstallBtn, fullRemoveBtn].forEach((b) => b.disabled = false);
      }
    }

    // Create Install Spicetify button
    const installBtn = createModernButton(
      (translations.actions && translations.actions.install_spicetify) || 'Install Spicetify',
      () => runAction(
        () => window.api.installSpicetify(),
        (translations.messages && translations.messages.install_spicetify_success) || 'Spicetify installed successfully!',
        (translations.messages && translations.messages.install_spicetify_error) || 'Error installing Spicetify'
      )
    );

    // Create Uninstall Spicetify button
    const uninstallBtn = createModernButton(
      (translations.actions && translations.actions.uninstall_spicetify) || 'Uninstall Spicetify',
      () => runAction(
        () => window.api.uninstallSpicetify(),
        (translations.messages && translations.messages.uninstall_spicetify_success) || 'Spicetify uninstalled successfully!',
        (translations.messages && translations.messages.uninstall_spicetify_error) || 'Error uninstalling Spicetify'
      ),
      { secondary: true }
    );

    // Create Full Uninstall Spotify button
    const fullRemoveBtn = createModernButton(
      (translations.actions && translations.actions.full_uninstall_spotify) || 'Full Uninstall Spotify',
      () => runAction(
        () => window.api.fullUninstallSpotify(),
        (translations.messages && translations.messages.full_uninstall_spotify_success) || 'Spotify fully uninstalled!',
        (translations.messages && translations.messages.full_uninstall_spotify_error) || 'Error fully uninstalling Spotify'
      ),
      { secondary: true }
    );

    // Buttons container to align them horizontally and wrap on small screens
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.display = 'flex';
    buttonsContainer.style.flexWrap = 'wrap';
    buttonsContainer.style.marginTop = '1rem';
    buttonsContainer.style.gap = '0.5rem';
    buttonsContainer.appendChild(installBtn);
    buttonsContainer.appendChild(uninstallBtn);
    buttonsContainer.appendChild(fullRemoveBtn);

    container.appendChild(buttonsContainer);
    container.appendChild(outputPre);

    return container;
  }

// Build crack installer page - more compact grid with progress and pause
async function buildCrackInstallerPage() {
  const container = createCard('crack_title', '');
  const projects = [
    { name: 'Clip Studio', url: 'https://www.dropbox.com/scl/fi/kx8gqow9zfian7g8ocqg3/Clip-Studio-Paint.zip?rlkey=wz4b7kfkchzgnsq9tpnp40rcw&st=rmp98tmo&dl=1', icon: 'https://i.postimg.cc/gj8gxQnQ/clipstudio.png' },
    { name: 'Encoder', url: 'https://www.dropbox.com/scl/fi/mw4sk0dvdk2r8ux9g1lfc/encoder.zip?rlkey=qwnelw8d920jlum14n1x44zku&st=70gqw7ba&dl=1', icon: 'https://i.postimg.cc/cHVD404f/mediaencoder.png' },
    { name: 'Illustrator', url: 'https://www.dropbox.com/scl/fi/aw95btp46onbyhk50gn7b/Illustrator.zip?rlkey=mvklovmenagfasuhr6clorbfj&st=0ds5v39w&dl=1', icon: 'https://i.postimg.cc/jd68tVVJ/illustrator.png' },
    { name: 'Lightroom Classic', url: 'https://www.dropbox.com/scl/fi/0p9rln704lc3qgqtjad9n/Lightroom-Classic.zip?rlkey=gp29smsg6t8oxhox80661k4gu&st=cdv50zpy&dl=1', icon: 'https://i.postimg.cc/N0CJSR3J/lightroom-classic.png' },
    { name: 'Office', url: 'https://www.dropbox.com/scl/fi/pcfv8ft3egcq4x6jzigny/Office2024.zip?rlkey=qbic04ie56dvoxzk1smri0hoo&st=1r1veinx&dl=1', icon: 'https://i.postimg.cc/QxZ628z3/office.png' },
    { name: 'Photoshop', url: 'https://www.dropbox.com/scl/fi/8vf3d46sq1wj1rb55r4jz/Photoshop.zip?rlkey=6u0dpbfnqopfndwcwq1082f7a&st=5u4v6m3x&dl=1', icon: 'https://i.postimg.cc/BvSkdSX6/photoshop.png' },
    { name: 'Premiere', url: 'https://www.dropbox.com/scl/fi/1yqqufgow2v4rc93l6wu4/premiere.zip?rlkey=49ymly6zgzufwtijnf2se35tc&st=5i77afac&dl=1', icon: 'https://i.postimg.cc/9QjvYt2y/premiere-pro.png' }
  ];
  const grid = document.createElement('div');
  grid.className = 'install-grid crack-grid'; // Added class for specific styling
  projects.forEach(({ name, url, icon }) => {
    const card = document.createElement('div');
    card.className = 'app-card';
    const header = document.createElement('div');
    header.className = 'app-header';
    const img = document.createElement('img');
    img.src = icon;
    img.alt = name;
    img.className = 'app-icon';
    header.appendChild(img);
    const h3 = document.createElement('h3');
    h3.textContent = name;
    header.appendChild(h3);
    card.appendChild(header);
    const p = document.createElement('p');
    p.textContent = ''; // Description if needed
    const btn = document.createElement('button');
    btn.className = 'button';
    btn.textContent = 'Download ' + name;
    // Store the original button text so we can restore it after installation
    btn.dataset.originalText = btn.textContent;
    const status = document.createElement('pre');
    status.className = 'status-pre';
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-container';
    progressContainer.style.display = 'none';
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressBar.style.width = '100%';
    progressBar.style.height = '6px'; // Compact height
    progressBar.style.background = 'var(--border-color)';
    progressBar.style.borderRadius = '3px';
    progressBar.style.overflow = 'hidden';
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressFill.style.height = '100%';
    progressFill.style.background = 'linear-gradient(90deg, var(--accent-color), var(--accent-color-light))';
    progressFill.style.width = '0%';
    progressFill.style.transition = 'width 0.3s ease';
    progressBar.appendChild(progressFill);
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'button button-secondary';
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.marginLeft = '0.5rem';
    pauseBtn.style.padding = '0.5rem 1rem'; // Compact
    pauseBtn.style.display = 'none';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'button button-secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.marginLeft = '0.5rem';
    cancelBtn.style.padding = '0.5rem 1rem';
    cancelBtn.style.display = 'none';
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.style.display = 'flex';
    controls.style.alignItems = 'center';
    controls.appendChild(pauseBtn);
    controls.appendChild(cancelBtn);
    // Extra button for Clip Studio to replace the executable in Program Files
    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'button button-secondary';
    replaceBtn.textContent = 'Replace EXE';
    replaceBtn.style.marginLeft = '0.5rem';
    replaceBtn.style.padding = '0.5rem 1rem';
    replaceBtn.style.display = 'none';
    controls.appendChild(replaceBtn);
    const isClipStudio = name.toLowerCase().includes('clip studio');
    // Mark this card as part of the crack installer so we can apply custom fade logic
    card.dataset.crackCard = 'true';
    const downloadId = `crack-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    let isPaused = false;
    let unsubscribe;
    
// SIMPLE REPLACE BUTTON - WITH Clip_Studio FOLDER
// Αντικατάσταση του replace button event listener
replaceBtn.addEventListener('click', async () => {
    const cardId = `crack-${name.toLowerCase().replace(/\s+/g, '-')}`;
    trackProcess(cardId, 'replace', replaceBtn, status);
    
    replaceBtn.disabled = true;
    replaceBtn.textContent = 'Replacing...';
    status.textContent = 'Starting replacement process...';

    try {
        const sourcePath = 'C:\\Users\\%USERNAME%\\Downloads\\Clip_Studio\\CLIPStudioPaint.exe';
        const targetPath = 'C:\\Program Files\\CELSYS\\CLIP STUDIO 1.5\\CLIP STUDIO PAINT\\CLIPStudioPaint.exe';

        status.textContent = 'Requesting Administrator privileges...\n⚠️ Please accept the UAC prompt';

        const result = await window.api.replaceExe(sourcePath, targetPath);

        if (result.success) {
            status.textContent = '✅ Replacement successful! Clip Studio is now activated.';
            status.classList.add('status-success');
            
            // ΟΛΟΚΛΗΡΩΣΗ REPLACE PROCESS ΜΕ ΕΠΙΤΥΧΙΑ
            completeProcess(cardId, 'replace', true);
            
            toast('Clip Studio crack applied successfully!', {
                type: 'success',
                title: 'Crack Installer'
            });
        } else {
            if (result.code === 'UAC_DENIED') {
                status.textContent = '❌ Administrator privileges required.\nPlease try again and accept UAC prompt.';
                showManualReplacementInstructions(sourcePath, targetPath);
            } else {
                status.textContent = `❌ Replacement failed: ${result.error}`;
            }
            status.classList.add('status-error');
            
            // ΟΛΟΚΛΗΡΩΣΗ REPLACE PROCESS ΜΕ ΑΠΟΤΥΧΙΑ
            completeProcess(cardId, 'replace', false);
        }
    } catch (error) {
        status.textContent = `Replacement failed: ${error.message}`;
        status.classList.add('status-error');
        completeProcess(cardId, 'replace', false);
    }
});
// Βοηθητική function για replacement
async function performReplacement(targetPath, sourceDir, statusElement, button) {
    statusElement.textContent = 'Finding patch executable...';
    
    // Αναζήτηση για το clipstudio_crack.exe
    const crackFiles = await window.api.findExeFiles(sourceDir);
    const crackExe = crackFiles.find(file => 
        file.toLowerCase().includes('clipstudio_crack') || 
        file.toLowerCase().includes('crack') ||
        file.toLowerCase().includes('patch')
    );
    
    if (!crackExe) {
        throw new Error('Crack executable not found in extracted files');
    }
    
    // Derive the filename from the target path for display
    const fileName = targetPath.split('\\').pop();
    statusElement.textContent = `Replacing ${fileName}...`;

    // Perform the replacement using the exposed API
    const result = await window.api.replaceExe(crackExe, targetPath);

    if (result.success) {
        statusElement.textContent = '✅ Replacement successful!';
        statusElement.classList.add('status-success');
        button.textContent = '✅ Replaced';
        button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';

        toast('Clip Studio crack applied successfully!', {
            type: 'success',
            title: 'Crack Installer',
            duration: 5000
        });

        // Fade the status after 3 seconds
        autoFadeStatus(statusElement, 3000);
    } else {
        throw new Error(result.error || 'Unknown error during replacement');
    }
}
// Αντικατάσταση του event listener για Clip Studio
btn.addEventListener('click', () => {
    if (unsubscribe) unsubscribe();
    
    const cardId = `crack-${name.toLowerCase().replace(/\s+/g, '-')}`;
    trackProcess(cardId, 'download', btn, status);
    
    btn.disabled = true;
    btn.textContent = 'Downloading...';
    status.textContent = '';
    progressContainer.style.display = 'block';
    
    const downloadId = `${cardId}-${Date.now()}`;
    
    unsubscribe = window.api.onDownloadEvent(async (data) => {
        if (data.id !== downloadId) return;
        
        switch (data.status) {
            case 'started':
                progressFill.style.width = '0%';
                status.textContent = '';
                break;
                
            case 'progress':
                progressFill.style.width = `${data.percent}%`;
                status.textContent = `Progress: ${data.percent}%`;
                break;
                
            case 'complete': {
                progressFill.style.width = '100%';
                status.textContent = 'Download complete! Extracting...';
                
                pauseBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                
                try {
                    const extractResult = await window.api.extractArchive(data.path, '123');
                    
                    if (extractResult.success) {
                        status.textContent = 'Extraction complete! Running installer...';
                        
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
                                    status.textContent = 'Installer started! Complete installation then click "Replace EXE"';
                                    status.classList.add('status-success');
                                    btn.textContent = 'Installation in Progress';
                                    
                                    // ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΑΣΗΣ - ΟΧΙ ΑΠΕΝΕΡΓΟΠΟΙΗΣΗ
                                    completeProcess(cardId, 'download', true);
                                    
                                    replaceBtn.style.display = 'inline-block';
                                    replaceBtn.disabled = false;
                                    
                                    toast('Clip Studio installer started! Complete installation first.', {
                                        type: 'info',
                                        title: 'Clip Studio'
                                    });
                                } else {
                                    status.textContent = 'Installer started! Follow on-screen instructions.';
                                    status.classList.add('status-success');
                                    btn.textContent = 'Installation Running';
                                    
                                    // ΟΛΟΚΛΗΡΩΣΗ DOWNLOAD PROCESS
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
                    status.textContent = `Error: ${error.message}`;
                    status.classList.add('status-error');
                    completeProcess(cardId, 'download', false);
                } finally {
                    progressContainer.style.display = 'none';
                    progressFill.style.width = '0%';
                }
                break;
            }
            
            case 'error':
            case 'cancelled':
                status.textContent = `Error: ${data.error || 'Cancelled'}`;
                status.classList.add('status-error');
                completeProcess(cardId, 'download', false);
                pauseBtn.style.display = 'none';
                cancelBtn.style.display = 'none';
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
                if (unsubscribe) unsubscribe();
                break;
        }
    });
    
    // Start download
    window.api.downloadStart(downloadId, url, name);
});
    pauseBtn.addEventListener('click', () => {
      if (isPaused) {
        window.api.downloadResume(downloadId);
      } else {
        window.api.downloadPause(downloadId);
      }
    });
    cancelBtn.addEventListener('click', () => {
      window.api.downloadCancel(downloadId);
    });
    card.appendChild(p);
    card.appendChild(btn);
    card.appendChild(controls);
    card.appendChild(progressContainer);
    card.appendChild(progressBar);
    card.appendChild(status);
    grid.appendChild(card);
  });
  container.appendChild(grid);
  return container;
}

// Build maintenance page
async function buildMaintenancePage() {
    const container = document.createElement('div');
    container.className = 'card';
    
    const title = document.createElement('h2');
    title.textContent = translations.pages?.maintenance_title || 'System Maintenance';
    container.appendChild(title);
    
    const desc = document.createElement('p');
    desc.textContent = translations.pages?.maintenance_desc || 'Perform various system maintenance tasks to keep your computer running smoothly.';
    desc.style.opacity = '0.8';
    desc.style.marginBottom = '2rem';
    container.appendChild(desc);
    
    // First row: Delete Temp Files and SFC/DISM
    const firstRow = document.createElement('div');
    firstRow.className = 'maintenance-row';
    firstRow.style.display = 'grid';
    firstRow.style.gridTemplateColumns = '1fr 1fr';
    firstRow.style.gap = '1.5rem';
    firstRow.style.marginBottom = '1.5rem';
    
    // Delete Temp Files card
    const tempCard = createMaintenanceCard(
        translations.maintenance.delete_temp_files || 'Delete Temp Files',
        translations.maintenance.temp_files_desc || 'Clean TEMP, %TEMP%, and Prefetch folders',
        '🧹',
        translations.actions.clean_temp_files || 'Clean Temp Files',
        cleanTempFiles,
        false
    );
    
    // SFC/DISM combined card
    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'app-card';
    
    const sfcDismHeader = document.createElement('div');
    sfcDismHeader.className = 'app-header';
    
    const sfcDismIcon = document.createElement('div');
    sfcDismIcon.style.fontSize = '2rem';
    sfcDismIcon.style.marginRight = '1rem';
    sfcDismIcon.textContent = '🛠️';
    sfcDismHeader.appendChild(sfcDismIcon);
    
    const sfcDismText = document.createElement('div');
    const sfcDismName = document.createElement('h3');
    sfcDismName.textContent = translations.maintenance.system_file_repair || 'System File Repair';
    sfcDismName.style.margin = '0 0 0.5rem 0';
    const sfcDismDesc = document.createElement('p');
    sfcDismDesc.textContent = translations.maintenance.system_file_desc || 'SFC Scan & DISM Repair system tools (Admin required)';
    sfcDismDesc.style.margin = '0';
    sfcDismDesc.style.opacity = '0.8';
    sfcDismDesc.style.fontSize = '0.9rem';
    sfcDismDesc.style.color = 'var(--warning-color)';
    sfcDismText.appendChild(sfcDismName);
    sfcDismText.appendChild(sfcDismDesc);
    sfcDismHeader.appendChild(sfcDismText);
    
    sfcDismCard.appendChild(sfcDismHeader);
    
    // Button container for SFC/DISM
    const sfcDismButtons = document.createElement('div');
    sfcDismButtons.style.display = 'flex';
    sfcDismButtons.style.gap = '0.75rem';
    sfcDismButtons.style.marginTop = '1rem';
    sfcDismButtons.style.flexWrap = 'wrap';
    
    const sfcButton = document.createElement('button');
    sfcButton.className = 'button';
    sfcButton.textContent = translations.actions.run_sfc || 'Run SFC';
    sfcButton.style.flex = '1';
    sfcButton.style.minWidth = '100px';
    
    const dismButton = document.createElement('button');
    dismButton.className = 'button';
    dismButton.textContent = translations.actions.run_dism || 'Run DISM';
    dismButton.style.flex = '1';
    dismButton.style.minWidth = '100px';
    
    const sfcDismStatus = document.createElement('pre');
    sfcDismStatus.className = 'status-pre';
    sfcDismStatus.style.display = 'none';
    sfcDismStatus.style.marginTop = '1rem';
    
    sfcButton.addEventListener('click', async () => {
        await runMaintenanceTask(sfcButton, sfcDismStatus, runSfcScan, translations.actions.run_sfc || 'SFC', true);
    });
    
    dismButton.addEventListener('click', async () => {
        await runMaintenanceTask(dismButton, sfcDismStatus, runDismRepair, translations.actions.run_dism || 'DISM', true);
    });
    
    sfcDismButtons.appendChild(sfcButton);
    sfcDismButtons.appendChild(dismButton);
    sfcDismCard.appendChild(sfcDismButtons);
    sfcDismCard.appendChild(sfcDismStatus);
    
    firstRow.appendChild(tempCard);
    firstRow.appendChild(sfcDismCard);
    container.appendChild(firstRow);
    
    // Second row: Patch My PC (full width)
    const secondRow = document.createElement('div');
    
    const patchCard = createMaintenanceCard(
        translations.maintenance.patch_my_pc || 'Patch My PC',
        translations.maintenance.patch_my_pc_desc || 'Update third-party applications automatically',
        '📦',
        translations.actions.download_run || 'Download & Run',
        downloadAndRunPatchMyPC,
        false
    );
    
    // Make Patch My PC card full width
    patchCard.style.gridColumn = '1 / -1';
    
    secondRow.appendChild(patchCard);
    container.appendChild(secondRow);
    
    return container;
}

// Helper function to create maintenance cards
function createMaintenanceCard(name, description, icon, buttonText, taskFunction, requiresAdmin = false) {
    const card = document.createElement('div');
    card.className = 'app-card';
    
    const header = document.createElement('div');
    header.className = 'app-header';
    
    const iconEl = document.createElement('div');
    iconEl.style.fontSize = '2rem';
    iconEl.style.marginRight = '1rem';
    iconEl.textContent = icon;
    header.appendChild(iconEl);
    
    const text = document.createElement('div');
    const nameEl = document.createElement('h3');
    nameEl.textContent = name;
    nameEl.style.margin = '0 0 0.5rem 0';
    const descEl = document.createElement('p');
    descEl.textContent = description;
    descEl.style.margin = '0';
    descEl.style.opacity = '0.8';
    descEl.style.fontSize = '0.9rem';
    
    // Add admin warning if needed
    if (requiresAdmin) {
        const adminWarning = document.createElement('small');
        adminWarning.textContent = ' (Admin required)';
        adminWarning.style.color = 'var(--warning-color)';
        descEl.appendChild(adminWarning);
    }
    
    text.appendChild(nameEl);
    text.appendChild(descEl);
    header.appendChild(text);
    
    const button = document.createElement('button');
    button.className = 'button';
    button.textContent = buttonText;
    button.style.marginTop = '1rem';
    
    const status = document.createElement('pre');
    status.className = 'status-pre';
    status.style.display = 'none';
    
    button.addEventListener('click', async () => {
        await runMaintenanceTask(button, status, taskFunction, name, requiresAdmin);
    });
    
    card.appendChild(header);
    card.appendChild(button);
    card.appendChild(status);
    
    return card;
}

// Helper function to run maintenance tasks
// Helper function to run maintenance tasks
async function runMaintenanceTask(button, statusElement, taskFunction, taskName, requiresAdmin = false) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Running...';
    statusElement.style.display = 'block';
    
    if (requiresAdmin) {
        statusElement.textContent = `Running ${taskName}...\n⚠️ This task may require Administrator privileges\n`;
    } else {
        statusElement.textContent = `Running ${taskName}...\n`;
    }
    
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    
    try {
        await taskFunction(statusElement);
    } catch (error) {
        statusElement.textContent += `\n❌ Error: ${error.message}`;
        statusElement.classList.add('status-error');
        toast(`Error running ${taskName}`, { type: 'error', title: 'Maintenance' });
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        autoFadeStatus(statusElement, 8000);
    }
}

function autoFadeStatus(statusElement, delay = 5000) {
    if (!statusElement || !statusElement.textContent || statusElement.textContent.trim() === '') return;
    
    if (statusElement._autoFadeTimeout) {
        clearTimeout(statusElement._autoFadeTimeout);
    }
    
    statusElement._autoFadeTimeout = setTimeout(() => {
        statusElement.style.transition = 'all 0.5s ease';
        statusElement.style.opacity = '0';
        statusElement.style.maxHeight = '0';
        statusElement.style.paddingTop = '0';
        statusElement.style.paddingBottom = '0';
        statusElement.style.marginTop = '0';
        statusElement.style.marginBottom = '0';
        statusElement.style.border = 'none';
        statusElement.style.overflow = 'hidden';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
            statusElement.style.opacity = '1';
            statusElement.style.maxHeight = 'none';
            statusElement.style.padding = '';
            statusElement.style.margin = '1rem 0 0 0';
            statusElement.style.border = '';
            statusElement.style.overflow = 'auto';
            statusElement.textContent = '';
            statusElement.classList.remove('status-success', 'status-error', 'status-warning');
        }, 500);
    }, delay);
}

// Simplified SFC Scan function - opens CMD window
async function runSfcScan(statusElement) {
    statusElement.textContent = 'Starting SFC Scan...\nOpening command window...';
    
    try {
        const result = await window.api.runSfcScan();
        
        if (result.success) {
            statusElement.textContent = result.message;
            statusElement.classList.add('status-success');
            toast('SFC scan started successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            statusElement.textContent = `Error: ${result.error}`;
            statusElement.classList.add('status-error');
            toast('Failed to start SFC scan', { type: 'error', title: 'Maintenance' });
        }
        
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
        toast('Error starting SFC scan', { type: 'error', title: 'Maintenance' });
    }
}

// Simplified DISM Repair function - opens CMD window
async function runDismRepair(statusElement) {
    statusElement.textContent = 'Starting DISM Repair...\nOpening command window...';
    
    try {
        const result = await window.api.runDismRepair();
        
        if (result.success) {
            statusElement.textContent = result.message;
            statusElement.classList.add('status-success');
            toast('DISM repair started successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            statusElement.textContent = `Error: ${result.error}`;
            statusElement.classList.add('status-error');
            toast('Failed to start DISM repair', { type: 'error', title: 'Maintenance' });
        }
        
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
        toast('Error starting DISM repair', { type: 'error', title: 'Maintenance' });
    }
}

// Simplified Temp Files Cleanup function - opens CMD window
async function cleanTempFiles(statusElement) {
    statusElement.textContent = 'Starting Temp Files Cleanup...\nOpening command window...';
    
    try {
        const result = await window.api.runTempCleanup();
        
        if (result.success) {
            statusElement.textContent = result.message;
            statusElement.classList.add('status-success');
            toast('Temp cleanup started successfully!', { type: 'success', title: 'Maintenance' });
        } else {
            statusElement.textContent = `Error: ${result.error}`;
            statusElement.classList.add('status-error');
            toast('Failed to start temp cleanup', { type: 'error', title: 'Maintenance' });
        }
        
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
        toast('Error starting temp cleanup', { type: 'error', title: 'Maintenance' });
    }
}
// Helper function to run maintenance tasks
async function runMaintenanceTask(button, statusElement, taskFunction, taskName) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Running...';
    statusElement.style.display = 'block';
    statusElement.textContent = `Running ${taskName}...`;
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    
    try {
        await taskFunction(statusElement);
    } catch (error) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
    } finally {
        button.disabled = false;
        button.textContent = originalText;
        autoFadeStatus(statusElement, 5000);
    }
}
// Function to download and run Patch My PC
// Function to download and run Patch My PC
async function downloadAndRunPatchMyPC(statusElement) {
    const downloadId = `patchmypc-${Date.now()}`;
    const patchMyPCUrl = 'https://www.dropbox.com/scl/fi/z66qn3wgiyvh8uy3fedu7/patch_my_pc.exe?rlkey=saht980hb3zfezv2ixve697jo&st=3ww4r4vy&dl=1';
    
    statusElement.textContent = 'Downloading Patch My PC...\n';
    statusElement.style.display = 'block';
    
    return new Promise((resolve) => {
        const unsubscribe = window.api.onDownloadEvent((data) => {
            if (data.id !== downloadId) return;
            
            switch (data.status) {
                case 'started':
                    statusElement.textContent = 'Downloading Patch My PC... 0%';
                    break;
                case 'progress':
                    statusElement.textContent = `Downloading Patch My PC... ${data.percent}%`;
                    break;
                case 'complete':
                    statusElement.textContent = 'Download complete! Opening Patch My PC...';
                    
                    // Open the downloaded file
                    window.api.openFile(data.path)
                        .then((result) => {
                            if (result.success) {
                                statusElement.textContent = 'Patch My PC opened successfully!';
                                statusElement.classList.add('status-success');
                                toast('Patch My PC started successfully!', { 
                                    type: 'success', 
                                    title: 'Maintenance' 
                                });
                            } else {
                                statusElement.textContent = `Error opening file: ${result.error}`;
                                statusElement.classList.add('status-error');
                                toast('Failed to open Patch My PC', { 
                                    type: 'error', 
                                    title: 'Maintenance' 
                                });
                            }
                        })
                        .catch((error) => {
                            statusElement.textContent = `Error: ${error.message}`;
                            statusElement.classList.add('status-error');
                            toast('Error opening Patch My PC', { 
                                type: 'error', 
                                title: 'Maintenance' 
                            });
                        })
                        .finally(() => {
                            // Fade out the status after finishing the operation
                            autoFadeStatus(statusElement, 7000);
                            unsubscribe();
                            resolve();
                        });
                    break;
                case 'error':
                    statusElement.textContent = `Download error: ${data.error}`;
                    statusElement.classList.add('status-error');
                    toast('Download failed', { 
                        type: 'error', 
                        title: 'Maintenance' 
                    });
                    unsubscribe();
                    resolve();
                    // Fade out error status
                    autoFadeStatus(statusElement, 7000);
                    break;
            }
        });
        
        // Start download
        try {
            window.api.downloadStart(downloadId, patchMyPCUrl, 'PatchMyPC.exe');
        } catch (e) {
            statusElement.textContent = `Download failed: ${e.message}`;
            statusElement.classList.add('status-error');
            toast('Download failed', { 
                type: 'error', 
                title: 'Maintenance' 
            });
            unsubscribe();
            resolve();
            // Fade out error status
            autoFadeStatus(statusElement, 7000);
        }
    });
}
  // Update buildPasswordManagerPage function
function buildPasswordManagerPage() {
    const container = document.createElement('div');
    container.className = 'card';
    
    const title = document.createElement('h2');
    title.innerHTML = '🔒 ' + (translations.pages.password_title || 'Password Manager');
    container.appendChild(title);
    
    const warning = document.createElement('p');
    warning.innerHTML = '⚠️ ' + (translations.messages.password_warning || 'Your passwords are stored securely on your local device.');
    warning.className = 'status-warning';
    warning.style.padding = '1rem';
    warning.style.background = 'rgba(245, 158, 11, 0.1)';
    warning.style.borderRadius = '8px';
    warning.style.borderLeft = '4px solid var(--warning-color)';
    container.appendChild(warning);
    
    const btn = createModernButton(
        translations.actions.open_password_manager || 'Open Password Manager', 
        async () => {
            try {
                const result = await window.api.openPasswordManager();
                if (!result.success) {
                    showNotification('Failed to open password manager', 'error');
                }
            } catch (error) {
                showNotification('Error opening password manager: ' + error.message, 'error');
            }
        },
        { icon: '🔓' }
    );
    
    container.appendChild(btn);
    return container;
}
  // Add notification system
  function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `toast status-${type}`;
      notification.textContent = message;
      notification.style.position = 'fixed';
      notification.style.bottom = '20px';
      notification.style.right = '20px';
      notification.style.padding = '1rem 1.5rem';
      notification.style.background = 'var(--card-bg)';
      notification.style.border = '1px solid var(--border-color)';
      notification.style.borderRadius = '12px';
      notification.style.boxShadow = '0 8px 32px rgba(0,0,0,0.2)';
      notification.style.zIndex = '1000';
      notification.style.animation = 'slideIn 0.3s ease';
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
          notification.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => notification.remove(), 300);
      }, 3000);
  }
  // Add CSS for notifications
  const notificationStyles = document.createElement('style');
  notificationStyles.textContent = `
      @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
      }
  `;
  document.head.appendChild(notificationStyles);
  // Build Chris Titus page
function buildChrisTitusPage() {
    const container = document.createElement('div');
    container.className = 'card';
    
    // Header with gradient
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '2rem';
    
    const icon = document.createElement('div');
    icon.style.fontSize = '4rem';
    icon.style.marginBottom = '1rem';
    icon.textContent = '🛠️';
    
    const title = document.createElement('h2');
    title.innerHTML = 'Chris Titus<br><span style="font-size: 1.2rem; opacity: 0.8;">Toolbox</span>';
    title.style.background = 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-color-light) 100%)';
    title.style.webkitBackgroundClip = 'text';
    title.style.webkitTextFillColor = 'transparent';
    title.style.backgroundClip = 'text';
    
    header.appendChild(icon);
    header.appendChild(title);
    container.appendChild(header);

    // Main action button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.textAlign = 'center';
    
    const runButton = document.createElement('button');
    runButton.className = 'button';
    runButton.innerHTML = '🚀 Run Chris Titus Toolbox';
    runButton.style.fontSize = '1.1rem';
    runButton.style.padding = '1.2rem 2.5rem';
    runButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    runButton.style.border = 'none';
    runButton.style.borderRadius = '50px';
    runButton.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
    runButton.style.transition = 'all 0.3s ease';
    
    runButton.addEventListener('mouseenter', () => {
        runButton.style.transform = 'translateY(-3px)';
        runButton.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.4)';
    });
    
    runButton.addEventListener('mouseleave', () => {
        runButton.style.transform = 'translateY(0)';
        runButton.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
    });

    runButton.addEventListener('click', async () => {
        runButton.disabled = true;
        runButton.innerHTML = '⏳ Running...';
        runButton.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
        
        try {
            const result = await window.api.runCommand('powershell -Command "iwr -useb https://christitus.com/win | iex"');
            
            if (result.error) {
                toast('Error running toolbox', { 
                    type: 'error', 
                    title: 'Chris Titus',
                    duration: 5000 
                });
            } else {
                toast('Toolbox started successfully!', { 
                    type: 'success', 
                    title: 'Chris Titus' 
                });
            }
        } catch (error) {
            toast('Failed to run toolbox', { 
                type: 'error', 
                title: 'Chris Titus',
                duration: 5000 
            });
        } finally {
            setTimeout(() => {
                runButton.disabled = false;
                runButton.innerHTML = '🚀 Run Chris Titus Toolbox';
                runButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            }, 2000);
        }
    });
    
    buttonContainer.appendChild(runButton);
    container.appendChild(buttonContainer);

    // Footer note
    const footerNote = document.createElement('p');
    footerNote.innerHTML = '💡 <strong>Tip:</strong> Run as Administrator for full functionality';
    footerNote.style.textAlign = 'center';
    footerNote.style.marginTop = '2rem';
    footerNote.style.opacity = '0.7';
    footerNote.style.fontSize = '0.9rem';
    container.appendChild(footerNote);

    return container;
}

  // Modifications to renderer.js
// Add the following function after buildChrisTitusPage() or similar:

function showRestartDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'bios-overlay';
  
  const dialog = document.createElement('div');
  dialog.className = 'bios-dialog';
  
  const title = document.createElement('h2');
  title.className = 'bios-title';
  title.innerHTML = '⚙️ ' + (translations.menu.bios || 'BIOS Settings');
  dialog.appendChild(title);
  
  const desc = document.createElement('p');
  desc.className = 'bios-description';
  desc.textContent = translations.messages.bios_instructions || 'This action will restart your computer and boot into BIOS/UEFI settings. Make sure to save all your work before proceeding.';
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
    ${translations.messages.admin_warning || 'This operation requires administrator privileges and will restart your computer immediately.'}
  `;
  dialog.appendChild(warning);
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'bios-buttons';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'bios-cancel-btn';
  cancelBtn.textContent = translations.general.cancel || 'Cancel';
  
  const restartBtn = document.createElement('button');
  restartBtn.className = 'bios-restart-btn';
  restartBtn.innerHTML = '🔄 ' + (translations.messages.restart_to_bios || 'Restart to BIOS');
  
  // Smooth cancel animation
  cancelBtn.addEventListener('click', () => {
    dialog.classList.add('slide-down');
    overlay.classList.add('fade-out');
    
    setTimeout(() => {
      if (overlay.parentNode) {
        document.body.removeChild(overlay);
      }
      loadPage('settings');
    }, 300);
  });
  
  // Restart function with smooth feedback
  restartBtn.addEventListener('click', async () => {
    restartBtn.disabled = true;
    restartBtn.innerHTML = '⏳ Processing...';
    restartBtn.style.opacity = '0.7';
    
    try {
      const result = await window.api.restartToBios();
      
      // Success animation
      if (result.success) {
        restartBtn.innerHTML = '✅ Success!';
        restartBtn.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';
        
        toast('BIOS restart initiated! Computer will restart shortly.', { 
          type: 'success',
          duration: 5000 
        });
        
        // Auto-close after success
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
      // Error animation
      restartBtn.innerHTML = '❌ Failed';
      restartBtn.style.background = 'linear-gradient(135deg, var(--error-color) 0%, #f87171 100%)';
      
      setTimeout(() => {
        restartBtn.disabled = false;
        restartBtn.innerHTML = '🔄 ' + (translations.messages.restart_to_bios || 'Restart to BIOS');
        restartBtn.style.opacity = '1';
        restartBtn.style.background = 'linear-gradient(135deg, var(--warning-color) 0%, #dc2626 100%)';
      }, 2000);
      
      if (error.message.includes('Administrator')) {
        showNotification(
          '🔒 Administrator Privileges Required\n\nPlease run the application as Administrator to access BIOS settings.',
          'error'
        );
      } else {
        showNotification('❌ ' + error.message, 'error');
      }
    }
  });
  
  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(restartBtn);
  dialog.appendChild(buttonContainer);
  
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Add escape key listener
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      cancelBtn.click();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Auto-focus on cancel button for accessibility
  cancelBtn.focus();
}

  // Build BIOS page
  function buildBiosPage() {
    return createCard('bios_title', translations.messages.bios_instructions);
  }

  // Initialize the app: load translations, apply theme and render menu
  async function init() {
    await loadTranslations();
    applyTheme();
    renderMenu();
    initializeAutoUpdater();
  }
// Auto Updater functionality
function initializeAutoUpdater() {
  const updateStatus = document.createElement('div');
  updateStatus.id = 'update-status';
  updateStatus.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 300px;
    backdrop-filter: blur(10px);
    display: none;
  `;

  const updateContent = document.createElement('div');
  updateStatus.appendChild(updateContent);
  document.body.appendChild(updateStatus);

  let currentVersion = '';

  // Get current version
  window.api.getAppVersion().then(version => {
    currentVersion = version;
  });

  // Listen for update events
  window.api.onUpdateStatus((data) => {
    showUpdateNotification(data);
  });

  function showUpdateNotification(data) {
    // Skip showing anything for checking or if no update is available
    if (data.status === 'checking' || data.status === 'not-available') {
      return;  // Don't display the UI at all
    }

    updateContent.innerHTML = '';
    
    const title = document.createElement('div');
    title.style.cssText = 'font-weight: 600; margin-bottom: 0.5rem; color: var(--accent-color);';
    title.textContent = '🔔 App Update';

    const message = document.createElement('div');
    message.style.cssText = 'margin-bottom: 1rem; font-size: 0.9rem; line-height: 1.4;';
    message.textContent = data.message;

    updateContent.appendChild(title);
    updateContent.appendChild(message);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = 'display: flex; gap: 0.5rem; justify-content: flex-end;';

    switch (data.status) {
      case 'available':
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'button';
        downloadBtn.textContent = 'Download';
        downloadBtn.onclick = () => {
          window.api.downloadUpdate();
          downloadBtn.disabled = true;
          downloadBtn.textContent = 'Downloading...';
        };
        buttonContainer.appendChild(downloadBtn);
        break;

      case 'downloading':
        const progress = document.createElement('div');
        progress.style.cssText = 'width: 100%; height: 4px; background: var(--border-color); border-radius: 2px; overflow: hidden; margin-bottom: 0.5rem;';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = `height: 100%; background: linear-gradient(90deg, var(--accent-color), var(--accent-color-light)); width: ${data.percent || 0}%; transition: width 0.3s ease;`;
        progress.appendChild(progressBar);
        updateContent.appendChild(progress);
        break;

      case 'downloaded':
        const installBtn = document.createElement('button');
        installBtn.className = 'button';
        installBtn.textContent = 'Restart & Install';
        installBtn.onclick = () => {
          window.api.installUpdate();
        };
        buttonContainer.appendChild(installBtn);
        break;

      case 'error':
        const closeBtn = document.createElement('button');
        closeBtn.className = 'button button-secondary';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => {
          updateStatus.style.display = 'none';
        };
        buttonContainer.appendChild(closeBtn);
        break;
    }

    if (data.status !== 'downloading') {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'button button-secondary';
      closeBtn.textContent = 'Later';
      closeBtn.onclick = () => {
        updateStatus.style.display = 'none';
      };
      buttonContainer.appendChild(closeBtn);
    }

    updateContent.appendChild(buttonContainer);
    updateStatus.style.display = 'block';
  }

}


// Initialize the application once
init();
})();