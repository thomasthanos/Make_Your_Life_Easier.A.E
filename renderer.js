
const processStates = new Map();

(() => {
  // Define the order of pages shown in the sidebar.  A new entry for
  // "debloat" has been added to provide a one‑click way to disable
  // unnecessary Windows suggestions and Bing web search in the Start
  // menu.  Additional debloat actions can be added to this page in
  // future updates.
  const menuKeys = [
    'settings',
    'install_apps',
    'activate_autologin',
    'system_maintenance',
    // The debloat page contains a button that performs several
    // registry tweaks to disable Windows suggestions and Bing web
    // search results.  See buildDebloatPage() for details.
    'debloat',
    'crack_installer',
    'spicetify',
    'password_manager',
    'christitus',
    'dlc_unlocker',
    'bios'
  ];
  const MENU_ICONS = {
    settings: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings w-5 h-5 text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  `,

    install_apps: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" x2="12" y1="15" y2="3"></line></svg>
  `,

    activate_autologin: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" x2="3" y1="12" y2="12"></line></svg>
  `,

    system_maintenance: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
  `,

    crack_installer: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"></path><path d="M12 22V12"></path><path d="m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7"></path><path d="m7.5 4.27 9 5.15"></path></svg>
  `,

    spicetify: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-music w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
  `,

    password_manager: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lock w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
  `,

    christitus: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-terminal w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" x2="20" y1="19" y2="19"></line></svg>
  `,

    dlc_unlocker: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gamepad2 w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><line x1="6" x2="10" y1="11" y2="11"></line><line x1="8" x2="8" y1="9" y2="13"></line><line x1="15" x2="15.01" y1="12" y2="12"></line><line x1="18" x2="18.01" y1="10" y2="10"></line><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"></path></svg>
  `,

    bios: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-computer w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" data-lov-id="src/components/AppLayout.tsx:66:16" data-lov-name="Icon" data-component-path="src/components/AppLayout.tsx" data-component-line="66" data-component-file="AppLayout.tsx" data-component-name="Icon" data-component-content="%7B%7D"><rect width="14" height="8" x="5" y="2" rx="2"></rect><rect width="20" height="8" x="2" y="14" rx="2"></rect><path d="M6 18h2"></path><path d="M12 18h6"></path></svg>
  `,
    // Use a broom icon to symbolise cleaning and debloating.  This
    // inline SVG is lightweight and matches the existing lucide
    // styling used for the other menu icons.
    debloat: `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-broom w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors"><line x1="3" y1="22" x2="21" y2="22"></line><path d="M10 2l5 5l-5 5"></path><path d="M15 7l5 5"></path><path d="M2 17l5 5"></path></svg>
    `,
  };
  const tooltipManager = (() => {
    let tooltipEl;
    // Create or return the existing tooltip element
    function ensure() {
      if (!tooltipEl) {
        tooltipEl = document.querySelector('.custom-tooltip');
        if (!tooltipEl) {
          tooltipEl = document.createElement('div');
          tooltipEl.className = 'custom-tooltip';
          const style = tooltipEl.style;
          style.position = 'fixed';
          style.zIndex = '10000';
          style.pointerEvents = 'none';
          style.background = 'rgba(30, 30, 30, 0.94)';
          style.color = '#fff';
          style.padding = '6px 10px';
          style.borderRadius = '8px';
          style.fontSize = '12px';
          style.lineHeight = '1.2';
          style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
          style.opacity = '0';
          style.transform = 'translateZ(0)';
          style.transition = 'opacity 0.15s ease-in-out';
          document.body.appendChild(tooltipEl);
        }
      }
      return tooltipEl;
    }
    // Position the tooltip relative to the mouse or target event
    function update(event, tooltip) {
      const offset = 6;
      const rect = tooltip.getBoundingClientRect();
      let x = event.clientX + offset;
      let y = event.clientY + offset;
      if (x + rect.width > window.innerWidth) {
        x = event.clientX - rect.width - offset;
      }
      if (y + rect.height > window.innerHeight) {
        y = event.clientY - rect.height - offset;
      }
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    }
    // Show the tooltip with the specified text
    function show(target, text, event) {
      const tooltip = ensure();
      tooltip.textContent = text;
      clearTimeout(tooltip._showTimer);
      tooltip._showTimer = setTimeout(() => {
        tooltip.style.opacity = '1';
      }, 150);
      update(event, tooltip);
    }
    // Hide the tooltip immediately
    function hide() {
      const tooltip = ensure();
      clearTimeout(tooltip._showTimer);
      tooltip.style.opacity = '0';
    }
    return { ensure, update, show, hide };
  })();

  // Track whether the last user interaction was via keyboard or pointer.
  let lastInteractionWasKeyboard = false;
  // When any key is pressed, assume keyboard navigation
  document.addEventListener('keydown', () => {
    lastInteractionWasKeyboard = true;
  }, true);
  // When the mouse is used, switch to pointer mode
  document.addEventListener('mousedown', () => {
    lastInteractionWasKeyboard = false;
  }, true);
  // Touch interactions also count as pointer interactions
  document.addEventListener('touchstart', () => {
    lastInteractionWasKeyboard = false;
  }, true);

  // Attach custom tooltip handlers to an element with a `data-tooltip` attribute.
  function attachTooltipHandlers(el) {
    if (!el || typeof el.getAttribute !== 'function') return;
    const tip = el.getAttribute('data-tooltip');
    if (!tip) return;
    if (el._tooltipAttached) return;
    el._tooltipAttached = true;
    el.addEventListener('mouseenter', (e) => {
      tooltipManager.show(el, tip, e);
    });
    el.addEventListener('mousemove', (e) => {
      const tooltip = tooltipManager.ensure();
      tooltipManager.update(e, tooltip);
    });
    el.addEventListener('mouseleave', () => {
      tooltipManager.hide();
    });
    el.addEventListener('focus', () => {
      if (!lastInteractionWasKeyboard) return;
      const rect = el.getBoundingClientRect();
      tooltipManager.show(el, tip, { clientX: rect.right, clientY: rect.bottom });
    });
    el.addEventListener('blur', () => {
      tooltipManager.hide();
    });

    // Hide tooltip on mousedown to prevent it reappearing due to focus triggers.
    el.addEventListener('mousedown', () => {
      tooltipManager.hide();
    });
  }
  document.addEventListener('click', (ev) => {
    const active = document.activeElement;
    if (active && typeof active.getAttribute === 'function' && active.getAttribute('data-tooltip')) {
      if (!active.contains(ev.target)) {
        tooltipManager.hide();
        if (typeof active.blur === 'function') {
          active.blur();
        }
      }
    } else {
      tooltipManager.hide();
    }
  });



  function createMenuButton(key, label) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.key = key;
    btn.innerHTML = `
    <span class="mi">${MENU_ICONS[key] || ''}</span>
    <span class="label">${label}</span>
    <span class="dot" aria-hidden="true"></span>
  `;
    li.appendChild(btn);
    return li;
  }
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

  function saveSettings() {
    localStorage.setItem('myAppSettings', JSON.stringify(settings));
  }

  let translations = {};

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
      }
    }
    // If nothing worked, fallback to English empty translations
    translations = {};
  }

  // Update theme by toggling data attribute on the html element
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }

  const SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
  const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"></path></svg>`;

  function updateHeader() {
    const titleEl = document.querySelector('.app-title');
    const subtitleEl = document.querySelector('.app-subtitle');
    if (titleEl) {
      let fullTitle = 'Make Life Easier';
      if (translations.app) {
        if (translations.app.title) {
          fullTitle = translations.app.title;
        } else if (translations.app.title_high || translations.app.title_rest) {
          fullTitle = `${translations.app.title_high || ''}${translations.app.title_rest ? ' ' + translations.app.title_rest : ''}`.trim();
        }
      }
      titleEl.textContent = fullTitle;
    }
    if (subtitleEl) {
      // Fallback to an empty string or a default subtitle when translations are unavailable
      subtitleEl.textContent = (translations.app && translations.app.subtitle) || 'System Management Tools';
    }
    const toggleButton = document.getElementById('theme-toggle');
    if (toggleButton) {
      const refreshIcon = () => {
        toggleButton.innerHTML = settings.theme === 'dark' ? MOON_ICON : SUN_ICON;
      };
      refreshIcon();
      // Clean up any existing listener
      if (toggleButton._toggleListener) {
        toggleButton.removeEventListener('click', toggleButton._toggleListener);
      }
      const listener = () => {
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        settings.theme = newTheme;
        document.documentElement.setAttribute('data-theme', newTheme);
        saveSettings();
        refreshIcon();
      };
      toggleButton._toggleListener = listener;
      toggleButton.addEventListener('click', listener);
    }
  }

  // Build the sidebar menu based on translations
  function renderMenu() {
    const menuList = document.getElementById('menu-list');
    menuList.innerHTML = '';

    menuKeys.forEach((key) => {
      const label = (translations.menu && translations.menu[key]) || key;
      menuList.appendChild(createMenuButton(key, label));
    });

    // Bind μία φορά
    if (!menuList._boundClick) {
      menuList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-key]');
        if (!btn) return;
        document.querySelectorAll('#menu-list button.active')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadPage(btn.dataset.key);
      });
      menuList._boundClick = true;
    }

    // ενεργοποίηση πρώτου
    const first = menuList.querySelector('button[data-key]');
    if (first) {
      first.classList.add('active');
      loadPage(first.dataset.key);
    }
    updateHeader();
  }


  // Helper to set header text
  function setHeader(text) {
    const header = document.getElementById('header');
    header.textContent = text;
  }
  function openInfoModal() {
    if (document.getElementById('info-modal-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'info-modal-overlay';
    overlay.className = 'modal-overlay';
    const container = document.createElement('div');
    container.className = 'modal-container';
    const iframe = document.createElement('iframe');
    iframe.src = 'info/info.html';
    iframe.setAttribute('title', 'Information');
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.addEventListener('error', () => {
      iframe.src = 'info-final.html';
    });
    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);
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
      case 'debloat':
        // Build and display the debloat page.  This page exposes a
        // single button that runs a PowerShell script to disable
        // Windows suggestions and Bing web search.  Results are
        // reported via toast notifications.  Note: additional
        // debloat functionality can be appended here in future.
        setHeader((translations.menu && translations.menu.debloat) || 'Debloat');
        content.appendChild(await buildDebloatPage());
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

  // buildDlcUnlockerPage — CSS-free version (all styling via classes only)
  async function buildDlcUnlockerPage() {
    const container = document.createElement('div');
    container.className = 'card dlc-scope';


    // Grid
    const grid = document.createElement('div');
    grid.className = 'install-grid dlc-grid';
    container.appendChild(grid);

    // ===== Sims Installer Card =====
    const simsCard = document.createElement('div');
    simsCard.className = 'app-card fixed-height dlc-card';
    grid.appendChild(simsCard);

    const simsHeader = document.createElement('div');
    simsHeader.className = 'app-header dlc-card-header';
    simsCard.appendChild(simsHeader);

    const simsIcon = document.createElement('div');
    simsIcon.className = 'dlc-icon sims-icon';
    simsIcon.innerHTML = `
    <svg class="dlc-svg sims-svg" viewBox="0 0 308 734" aria-hidden="true">
      <path d="M204 733L27.3308 366.25L380.669 366.25L204 733Z" fill="url(#paint0_linear_1_6)"/>
      <path d="M204 0L380.669 366.75H27.3308L204 0Z" fill="url(#paint1_linear_1_6)"/>
      <path d="M205.5 734L124.527 366.5L286.473 366.5L205.5 734Z" fill="url(#paint2_linear_1_6)"/>
      <path d="M205.5 0L286.473 366.75H124.527L205.5 0Z" fill="url(#paint3_linear_1_6)"/>
      <defs>
        <linearGradient id="paint0_linear_1_6" x1="34" y1="459" x2="327" y2="537" gradientUnits="userSpaceOnUse">
          <stop stop-color="#AFD23E"/><stop offset="0.518773" stop-color="#11B14B"/>
          <stop offset="0.641251" stop-color="#91C34B"/><stop offset="1" stop-color="#02591E"/>
        </linearGradient>
        <linearGradient id="paint1_linear_1_6" x1="45.5" y1="262.5" x2="387.5" y2="362" gradientUnits="userSpaceOnUse">
          <stop stop-color="#F5F8E0"/><stop offset="0.199057" stop-color="#98C868"/>
          <stop offset="0.609375" stop-color="#1AB04C"/><stop offset="1" stop-color="#99CB47"/>
        </linearGradient>
        <linearGradient id="paint2_linear_1_6" x1="117.5" y1="388" x2="290.5" y2="383.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#A3D24A"/><stop offset="1" stop-color="#51C251"/>
        </linearGradient>
        <linearGradient id="paint3_linear_1_6" x1="144.5" y1="348" x2="299" y2="348.5" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DBEBB3"/><stop offset="0.375221" stop-color="#9ED167"/>
          <stop offset="1" stop-color="#61C558"/>
          <stop offset="1" stop-color="#64C559"/>
        </linearGradient>
      </defs>
    </svg>
  `;
    simsHeader.appendChild(simsIcon);

    const simsText = document.createElement('div');
    simsText.className = 'dlc-card-text';
    const simsName = document.createElement('h3');
    simsName.className = 'dlc-card-title';
    simsName.textContent = (translations?.dlc?.sims_installer) || 'Sims Installer';
    const simsDesc = document.createElement('p');
    simsDesc.className = 'dlc-card-desc';
    simsDesc.textContent = (translations?.dlc?.sims_desc) || 'Complete Sims DLC package with all expansions';
    simsText.appendChild(simsName);
    simsText.appendChild(simsDesc);
    simsHeader.appendChild(simsText);

    const simsButton = document.createElement('button');
    simsButton.className = 'button dlc-btn dlc-btn-sims';
    simsButton.innerHTML = '🎮 ' + ((translations?.dlc?.download_sims) || 'DOWNLOAD SIMS INSTALLER');
    simsCard.appendChild(simsButton);

    const simsStatus = document.createElement('pre');
    simsStatus.className = 'status-pre dlc-status';
    simsCard.appendChild(simsStatus);

    simsButton.addEventListener('click', async () => {
      simsStatus.classList.add('show');
      await downloadAndExtractDLC(
        simsButton,
        simsStatus,
        'sims-installer',
        'https://www.dropbox.com/scl/fi/5841qp2eysq0xvsxodmr1/sims_install.zip?rlkey=h843bkdkw8ymi7rqaq473ktni&st=t72b3hna&dl=1',
        (translations?.dlc?.sims_installer) || 'Sims Installer'
      );
    });

    // ===== EA Unlocker Card =====
    const eaCard = document.createElement('div');
    eaCard.className = 'app-card fixed-height dlc-card';
    grid.appendChild(eaCard);

    const eaHeader = document.createElement('div');
    eaHeader.className = 'app-header dlc-card-header';
    eaCard.appendChild(eaHeader);

    const eaIcon = document.createElement('div');
    eaIcon.className = 'dlc-icon ea-icon';
    eaIcon.innerHTML = `
    <svg class="dlc-svg ea-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <style>.ea-a{fill:gray;}.ea-b{fill:#b2b2b2;}.ea-c{fill:none;stroke:#191919;stroke-linecap:round;stroke-linejoin:round;}</style>
      </defs>
      <polygon class="ea-a" points="16.434 5.5 10.77 14.5 4.563 14.5 5.992 11.5 9.854 11.5 11.256 9.5 2.646 9.5 1.244 11.5 3.304 11.5 0.5 16.5 12.057 16.5 16.434 9.519 18.036 12.5 16.662 12.5 15.261 14.5 19.438 14.5 20.84 16.5 23.5 16.5 16.434 5.5"/>
      <polygon class="ea-b" points="14.574 5.5 5.449 5.5 4.047 7.5 13.173 7.5 14.574 5.5"/>
      <path class="ea-c" d="M16.434,5.5l-5.664,9H4.562l1.43-3H9.854l1.4-2H2.646l-1.4,2H3.3l-2.8,5H12.057l4.377-6.981,1.6,2.981H16.662l-1.4,2h4.177l1.4,2H23.5Zm-1.86,0H5.449l-1.4,2h9.126Z"/>
    </svg>
  `;
    eaHeader.appendChild(eaIcon);

    const eaText = document.createElement('div');
    eaText.className = 'dlc-card-text';
    const eaName = document.createElement('h3');
    eaName.className = 'dlc-card-title';
    eaName.textContent = (translations?.dlc?.ea_unlocker) || 'EA Unlocker';
    const eaDesc = document.createElement('p');
    eaDesc.className = 'dlc-card-desc';
    eaDesc.textContent = (translations?.dlc?.ea_desc) || 'Unlock all EA games DLC content and features';
    eaText.appendChild(eaName);
    eaText.appendChild(eaDesc);
    eaHeader.appendChild(eaText);

    const eaButton = document.createElement('button');
    eaButton.className = 'button dlc-btn dlc-btn-ea';
    eaButton.innerHTML = '🚀 ' + ((translations?.dlc?.download_ea) || 'DOWNLOAD EA UNLOCKER');
    eaCard.appendChild(eaButton);

    const eaStatus = document.createElement('pre');
    eaStatus.className = 'status-pre dlc-status';
    eaCard.appendChild(eaStatus);

    eaButton.addEventListener('click', async () => {
      eaStatus.classList.add('show');
      await downloadAndExtractDLC(
        eaButton,
        eaStatus,
        'ea-unlocker',
        'https://www.dropbox.com/scl/fi/mbnhjivbbyyn4avjerrzw/EA_UNLOCKER.zip?rlkey=vchua3ks8whlvmgbvc2kas0mw&st=1f3zq290&dl=1',
        (translations?.dlc?.ea_unlocker) || 'EA Unlocker'
      );
    });

    // ===== Tutorials Section =====
    const tutorialsSection = document.createElement('div');
    tutorialsSection.className = 'dlc-tutorials';
    container.appendChild(tutorialsSection);

    const tutorialCard = document.createElement('div');
    tutorialCard.className = 'tutorial-card-compact dlc-tutorial-card';
    tutorialsSection.appendChild(tutorialCard);

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.className = 'dlc-thumb-wrap';
    tutorialCard.appendChild(thumbnailContainer);

    const thumbnail = document.createElement('img');
    thumbnail.className = 'dlc-thumb';
    thumbnail.src = 'https://i.ytimg.com/vi/UOfQJv4tkEI/hq720.jpg?sqp=-oaymwEcCNAFEJQDSFXyq4qpAw4IARUAAIhCGAFwAcABBg==&rs=AOn4CLD8q9X7l6Kq1tV-5f5QY2W5sXwJ7g';
    thumbnail.alt = 'Tutorial';
    thumbnailContainer.appendChild(thumbnail);

    const playButton = document.createElement('div');
    playButton.className = 'dlc-play';
    playButton.innerHTML = '<span class="dlc-play-icon">▶</span>';
    thumbnailContainer.appendChild(playButton);

    const content = document.createElement('div');
    content.className = 'dlc-tutorial-content';
    const descEl = document.createElement('p');
    descEl.className = 'dlc-tutorial-desc';
    descEl.innerHTML = (translations?.dlc?.tutorial_desc) ||
      '📁 <strong>EA DLC Unlocker:</strong> General tool for unlocking DLCs in EA games<br>🎮 <strong>Sims 4 Updater:</strong> Specialized for The Sims 4 with updates & repairs';
    content.appendChild(descEl);
    tutorialCard.appendChild(content);

    tutorialCard.addEventListener('click', () => {
      if (window.api?.openExternal) window.api.openExternal('https://www.youtube.com/watch?v=UOfQJv4tkEI');
      else window.open('https://www.youtube.com/watch?v=UOfQJv4tkEI', '_blank');
    });

    return container;
  }



  async function downloadAndExtractDLC(button, statusElement, dlcId, downloadUrl, dlcName) {
    button.disabled = true;
    const originalText = button.innerHTML;
    const originalBackground = button.style.background;

    // ΚΡΥΒΟΥΜΕ το status πριν ξεκινήσει - ΜΟΝΟ για errors θα εμφανιστεί
    statusElement.style.display = 'none';
    statusElement.textContent = '';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    button.innerHTML = '⏳ DOWNLOADING...';

    const downloadId = `${dlcId}-${Date.now()}`;

    return new Promise((resolve) => {
      const unsubscribe = window.api.onDownloadEvent(async (data) => {
        if (data.id !== downloadId) return;

        switch (data.status) {
          case 'started':
            // ΔΕΝ εμφανίζουμε status για κανονική progress
            break;
          case 'progress':
            // ΔΕΝ εμφανίζουμε status για κανονική progress
            button.innerHTML = `⏳ DOWNLOADING... ${data.percent}%`;
            break;
          case 'complete':
            button.innerHTML = '📦 EXTRACTING...';

            try {
              const result = await window.api.extractArchive(data.path, '123');

              if (result.success) {
                button.innerHTML = '🚀 STARTING INSTALLER...';

                const exeResult = await runSpecificExe(data.path, dlcName, button, statusElement);

                if (exeResult.success) {
                  button.innerHTML = '✅ INSTALLER RUNNING';
                  button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';

                  toast(`${dlcName} installer started! Follow the installation wizard.`, {
                    type: 'success',
                    title: 'DLC Unlocker',
                    duration: 5000
                  });

                  // ΕΠΑΝΑΦΟΡΑ ΜΟΝΟ ΤΟΥ ΚΟΥΜΠΙΟΥ ΜΕΤΑ ΑΠΟ 10 ΔΕΥΤΕΡΟΛΕΠΤΑ
                  setTimeout(() => {
                    button.innerHTML = originalText;
                    button.disabled = false;
                    button.style.background = originalBackground;
                  }, 10000);

                } else {
                  // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
                  statusElement.textContent = `Extracted but could not run installer: ${exeResult.error}\nPlease try running the installer manually from the extracted folder.`;
                  statusElement.classList.add('status-error');
                  statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
                  button.innerHTML = '📂 OPEN FOLDER';
                  button.disabled = false;
                  button.style.background = originalBackground;

                  addOpenFolderButton(button, data.path, dlcName);
                }
              } else {
                // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
                statusElement.textContent = 'Trying extraction without password...';
                const retryResult = await window.api.extractArchive(data.path, '');

                if (retryResult.success) {
                  button.innerHTML = '🚀 STARTING INSTALLER...';

                  const exeResult = await runSpecificExe(data.path, dlcName, button, statusElement);

                  if (exeResult.success) {
                    button.innerHTML = '✅ INSTALLER RUNNING';
                    button.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';

                    toast(`${dlcName} installer started! Follow the installation wizard.`, {
                      type: 'success',
                      title: 'DLC Unlocker',
                      duration: 5000
                    });

                    setTimeout(() => {
                      button.innerHTML = originalText;
                      button.disabled = false;
                      button.style.background = originalBackground;
                    }, 10000);

                  } else {
                    // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
                    statusElement.textContent = `Extracted but could not run installer: ${exeResult.error}\nPlease try running the installer manually from the extracted folder.`;
                    statusElement.classList.add('status-error');
                    statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
                    button.innerHTML = '📂 OPEN FOLDER';
                    button.disabled = false;
                    button.style.background = originalBackground;

                    addOpenFolderButton(button, data.path, dlcName);
                  }
                } else {
                  // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
                  const errMsg = (retryResult && retryResult.error) || 'Unknown error';
                  statusElement.textContent = `Extraction failed: ${errMsg}\nThe downloaded file has been opened for manual inspection.`;
                  statusElement.classList.add('status-error');
                  statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
                  button.innerHTML = '🔄 TRY AGAIN';
                  button.disabled = false;
                  button.style.background = originalBackground;

                  toast(`Failed to extract ${dlcName}`, {
                    type: 'error',
                    title: 'DLC Unlocker',
                    duration: 6000
                  });
                  window.api.openFile(data.path).catch(() => { });
                }
              }
            } catch (error) {
              // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
              statusElement.textContent = `Extraction failed: ${error.message}\nPlease check the downloaded file manually.`;
              statusElement.classList.add('status-error');
              statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
              button.innerHTML = '🔄 TRY AGAIN';
              button.disabled = false;
              button.style.background = originalBackground;

              toast(`Failed to extract ${dlcName}`, {
                type: 'error',
                title: 'DLC Unlocker',
                duration: 6000
              });
              window.api.openFile(data.path).catch(() => { });
            }

            unsubscribe();
            resolve();
            break;

          case 'error':
            // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
            statusElement.textContent = `Download error: ${data.error}\nPlease check your internet connection and try again.`;
            statusElement.classList.add('status-error');
            statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
            button.innerHTML = originalText;
            button.disabled = false;
            button.style.background = originalBackground;

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
        // ΕΜΦΑΝΙΖΟΥΜΕ STATUS ΜΟΝΟ ΓΙΑ ERROR
        statusElement.textContent = `Download failed: ${e.message}\nPlease check your internet connection.`;
        statusElement.classList.add('status-error');
        statusElement.style.display = 'block'; // ΜΟΝΟ ΕΔΩ
        button.innerHTML = originalText;
        button.disabled = false;
        button.style.background = originalBackground;

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
    // Preserve original text so we can restore it later
    button.dataset.originalTextActivate = originalText;
    // Hide the status element for progress; it will only be shown for critical errors
    statusElement.style.display = 'none';
    statusElement.textContent = '';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    // Provide immediate feedback that the process is starting
    button.textContent = 'Preparing activation...';

    const downloadId = `activate-${Date.now()}`;
    const activateUrl = 'https://www.dropbox.com/scl/fi/oqgye14tmcg97mxbphorp/activate.bat?rlkey=307wz4bzkzejip3os7iztt54l&st=oz6nh4pf&dl=1';

    return new Promise((resolve) => {
      const unsubscribe = window.api.onDownloadEvent((data) => {
        if (data.id !== downloadId) return;

        switch (data.status) {
          case 'started':
            // update progress on the button
            button.textContent = 'Downloading activation script... 0%';
            break;
          case 'progress':
            button.textContent = `Downloading activation script... ${data.percent}%`;
            break;
          case 'complete': {
            // Update text while running the script
            button.textContent = 'Running activation script...';
            // Execute the bat file
            window.api.openFile(data.path)
              .then((result) => {
                if (result.success) {
                  // On success, simply show a final state on the button
                  button.textContent = 'Activation Started';
                  statusElement.textContent = '';
                  statusElement.style.display = 'none';
                } else {
                  // On failure, revert button and show toast
                  button.textContent = originalText;
                  statusElement.textContent = '';
                  statusElement.style.display = 'none';
                  toast('Failed to run activation script', { type: 'error', title: 'Activation' });
                }
              })
              .catch((err) => {
                button.textContent = originalText;
                statusElement.textContent = '';
                statusElement.style.display = 'none';
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
            // Show error via toast and revert button
            button.textContent = originalText;
            button.disabled = false;
            statusElement.textContent = '';
            statusElement.style.display = 'none';
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
        // On exception during download start, revert button and hide status
        button.textContent = originalText;
        button.disabled = false;
        statusElement.textContent = '';
        statusElement.style.display = 'none';
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
    // Preserve original text so it can be restored later
    button.dataset.originalTextAutologin = originalText;
    // Hide the status element; progress will be shown on the button
    statusElement.style.display = 'none';
    statusElement.textContent = '';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    // Provide immediate feedback that the process is starting
    button.textContent = 'Preparing auto login...';

    const downloadId = `autologin-${Date.now()}`;
    const autologinUrl = 'https://www.dropbox.com/scl/fi/a0bphjru0qfnbsokk751h/auto-login.exe?rlkey=b3ogyjelioq49jyty1odi58x9&st=4o2oq4sc&dl=1';

    return new Promise((resolve) => {
      const unsubscribe = window.api.onDownloadEvent((data) => {
        if (data.id !== downloadId) return;

        switch (data.status) {
          case 'started':
            // update progress on the button
            button.textContent = 'Downloading auto login tool... 0%';
            break;
          case 'progress':
            button.textContent = `Downloading auto login tool... ${data.percent}%`;
            break;
          case 'complete': {
            // update text while running the tool
            button.textContent = 'Running auto login setup...';

            window.api.openFile(data.path)
              .then((result) => {
                if (result.success) {
                  // On success, display finished state
                  button.textContent = 'Auto Login Started';
                  statusElement.textContent = '';
                  statusElement.style.display = 'none';
                } else {
                  // On failure, revert and show toast
                  button.textContent = originalText;
                  statusElement.textContent = '';
                  statusElement.style.display = 'none';
                  toast('Failed to run auto login tool', { type: 'error', title: 'Auto Login' });
                }
              })
              .catch((err) => {
                button.textContent = originalText;
                statusElement.textContent = '';
                statusElement.style.display = 'none';
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
            // show error toast and revert button
            button.textContent = originalText;
            button.disabled = false;
            statusElement.textContent = '';
            statusElement.style.display = 'none';
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
        // On exception during download start, revert button and hide status
        button.textContent = originalText;
        button.disabled = false;
        statusElement.textContent = '';
        statusElement.style.display = 'none';
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

    // Theme selector removed: theme toggling is handled via the header toggle

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'settings-save-btn';
    // Fallback for save button
    saveBtn.textContent = (translations.general && translations.general.save) || 'Save';
    saveBtn.addEventListener('click', async () => {
      // Update only the language setting.  The theme is controlled via
      // the header toggle button and should not be modified here.
      settings.lang = langSelect.value;
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

    // Add info button next to the save button. Clicking it opens the info page in a new window.
    const infoBtn = document.createElement('button');
    infoBtn.className = 'settings-info-btn';
    // Embed a stroke on the SVG path to ensure the outline remains visible even on
    // high‑contrast backgrounds. By specifying a semi‑transparent black stroke
    // directly within the SVG markup we avoid relying on external CSS to
    // override the icon style, giving a more predictable appearance across
    // themes. The stroke-opacity attribute controls how prominent the
    // outline appears, while the stroke-width determines thickness.
    infoBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 50 50" fill="currentColor">
        <path d="M 25 2 C 12.264481 2 2 12.264481 2 25 C 2 37.735519 12.264481 48 25 48 C 37.735519 48 48 37.735519 48 25 C 48 12.264481 37.735519 2 25 2 z M 25 4 C 36.664481 4 46 13.335519 46 25 C 46 36.664481 36.664481 46 25 46 C 13.335519 46 4 36.664481 4 25 C 4 13.335519 13.335519 4 25 4 z M 25 11 A 3 3 0 0 0 25 17 A 3 3 0 0 0 25 11 z M 21 21 L 21 23 L 23 23 L 23 36 L 21 36 L 21 38 L 29 38 L 29 36 L 27 36 L 27 21 L 21 21 z"
              stroke="#ffffffff" stroke-opacity="1" stroke-width="1"></path>
      </svg>`;
    // Use data-tooltip for custom tooltip instead of native title
    infoBtn.setAttribute('data-tooltip', (translations.pages && translations.pages.info) || 'Info');
    attachTooltipHandlers(infoBtn);
    infoBtn.addEventListener('click', () => {
      // Open the info modal as an in‑app pop‑out.  This replaces navigation with a modal overlay.
      openInfoModal();
    });
    container.appendChild(infoBtn);

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
  function ensureToastContainer() {
    let c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
    return c;
  }
  /**
   * Display a transient notification in the bottom right corner of the screen.  This
   * simplified toast implementation only surfaces error messages. Success,
   * warning and info messages are ignored entirely to prevent unnecessary UI
   * clutter. Progress bars have been removed to focus on the message content
   * itself. A close button is always provided so the user can dismiss the
   * notification manually.  Notifications will auto‑dismiss after the
   * specified duration.
   *
   * @param {string} msg The body of the message to display.
   * @param {object} opts Optional settings: title, type and duration.
   */
  /**
   * Display a toast notification. Only error types are shown by default.
   * Success toasts can be triggered, but non‑error types are ignored to
   * avoid cluttering the UI. The markup for each toast is structured
   * similarly to UIverse components: an icon in a coloured circle,
   * followed by a title and message, and a close button on the far right.
   *
   * @param {string} msg - The body text of the toast.
   * @param {Object} opts - Optional parameters: type, title, duration.
   */
  function toast(msg, opts = {}) {
    const { title = '', type = 'info', duration = 4000 } = opts;

    // By default, error and success toasts are displayed. Info and warning
    // toasts can still be triggered if desired, but they will simply
    // return without rendering to keep the interface uncluttered.
    if (type !== 'error' && type !== 'success') {
      return null;
    }

    const container = ensureToastContainer();

    // Create the outer toast element and apply a type‑specific class
    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;

    // Wrapper for the icon. Use a coloured circular backdrop similar
    // to the UIverse examples. The icon itself will be inserted
    // based on the toast type.
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'toast-icon-wrapper';

    // Determine the SVG icon to use
    let svg; // will hold an inline SVG element
    if (type === 'error') {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('class', 'toast-svg-icon');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill-rule', 'evenodd');
      path.setAttribute('clip-rule', 'evenodd');
      path.setAttribute('d', 'M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z');
      svg.appendChild(path);
    } else if (type === 'success') {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.5');
      svg.setAttribute('class', 'toast-svg-icon');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('d', 'm4.5 12.75 6 6 9-13.5');
      svg.appendChild(path);
    }
    if (svg) {
      iconWrapper.appendChild(svg);
    }

    // Container for title and message
    const content = document.createElement('div');
    content.className = 'toast-content';
    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = msg;
    content.appendChild(messageEl);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => dismissToast(toastEl);

    // Assemble toast
    toastEl.appendChild(iconWrapper);
    toastEl.appendChild(content);
    toastEl.appendChild(closeBtn);
    container.appendChild(toastEl);

    let timeout;
    if (duration > 0) {
      timeout = setTimeout(() => dismissToast(toastEl), duration);
    }
    // Pause auto‑dismiss when hovering
    toastEl.addEventListener('mouseenter', () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    });
    toastEl.addEventListener('mouseleave', () => {
      if (!timeout && duration > 0) {
        timeout = setTimeout(() => dismissToast(toastEl), duration);
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
  async function buildInstallPage() {
    const container = document.createElement('div'); container.className = 'card';
    const title = document.createElement('h2'); title.textContent = (translations.pages && translations.pages.install_title) || 'Install Applications'; container.appendChild(title);
    const desc = document.createElement('p'); desc.textContent = (translations.pages && translations.pages.install_desc) || 'Select apps to download. We will open each installer automatically after the download finishes.'; container.appendChild(desc);

    // Λίστα εφαρμογών - όλα σε μία γραμμή το καθένα
    const apps = [
      { name: translations.apps?.betterdiscord?.name || 'BetterDiscord', description: translations.apps?.betterdiscord?.description || 'Enhanced Discord client', url: 'https://www.dropbox.com/scl/fi/qdw73ry6cyqcn4d71aw5n/BetterDiscord-Windows.exe?rlkey=he0pheyexqjk42kwhdxv1cyry&st=kd8njdce&dl=1', ext: 'exe' },
      { name: translations.apps?.discord_ptb?.name || 'Discord PTB', description: translations.apps?.discord_ptb?.description || 'Public Test Build of Discord', url: 'https://www.dropbox.com/scl/fi/aaqzyvha72wjhmlbkaisf/discord_ptb.exe?rlkey=jandm03y74hsx8vmt3bf9enub&st=syrb9gxp&dl=1', ext: 'exe' },
      { name: translations.apps?.discord?.name || 'Discord', description: translations.apps?.discord?.description || 'Official Discord client', url: 'https://www.dropbox.com/scl/fi/bgpi9iy00abrkw995u4by/discord.exe?rlkey=fm22iu7b0gwvackygmhvv29uw&st=mvmkbabw&dl=1', ext: 'exe' },
      { name: translations.apps?.epic_games?.name || 'Epic Games', description: translations.apps?.epic_games?.description || 'Epic Games Launcher', url: 'https://www.dropbox.com/scl/fi/3mnee6vxp3wp1mym5nrhd/epicgames.msi?rlkey=ygiy5oqia6hm0ne61vs7nz6m6&st=qigfjjlm&dl=1', ext: 'msi' },
      { name: translations.apps?.ubisoft_connect?.name || 'Ubisoft Connect', description: translations.apps?.ubisoft_connect?.description || 'Ubisoft game launcher', url: 'https://www.dropbox.com/scl/fi/8wzoxzkf23pklm6thvr3d/ubisoft.exe?rlkey=lasiokbqo5h659kib2s42zjtf&st=pzys86ls&dl=1', ext: 'exe' },
      { name: translations.apps?.spotify?.name || 'Spotify', description: translations.apps?.spotify?.description || 'Spotify music streaming client', url: 'https://www.dropbox.com/scl/fi/tgfdprtihmfmg0vmje5mw/SpotifySetup.exe?rlkey=55vfvccgpndwys4wvl1gg4u1v&st=2leaehi8&dl=1', ext: 'exe' },
      { name: translations.apps?.advanced_installer?.name || 'Advanced Installer', description: translations.apps?.advanced_installer?.description || 'Professional Windows installer authoring tool', url: 'https://www.dropbox.com/scl/fi/nx5ced8mt2t5mye4tus6j/Advanced-Installer-Architect-23.1.0.zip?rlkey=2bre9u83d9lfdvhhz778nvr04&st=cgpe2npr&dl=1', ext: 'zip', isAdvancedInstaller: true }
    ];

    // Αυτόματη ταξινόμηση αλφαβητικά
    const sortedApps = [...apps].sort((a, b) => a.name.localeCompare(b.name));

    const list = document.createElement('ul'); list.style.listStyle = 'none'; list.style.padding = '0'; list.style.margin = '0';

    // Χρήση των sortedApps
    sortedApps.forEach((app, i) => {
      const li = document.createElement('li'); li.style.display = 'flex'; li.style.alignItems = 'center'; li.style.padding = '1rem'; li.style.border = '1px solid var(--border-color)'; li.style.borderRadius = '12px'; li.style.marginBottom = '0.75rem'; li.style.background = 'var(--card-bg)';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = `app-${i}`; cb.style.marginRight = '1rem'; cb.style.width = '18px'; cb.style.height = '18px'; cb.style.accentColor = 'var(--accent-color)';
      const label = document.createElement('label'); label.htmlFor = cb.id; label.style.flex = '1'; label.style.display = 'flex'; label.style.alignItems = 'center';
      const text = document.createElement('div'); const n = document.createElement('span'); n.textContent = app.name; n.style.fontWeight = '600'; n.style.fontSize = '1.1rem'; const p = document.createElement('p'); p.textContent = app.description; p.style.margin = '0'; p.style.opacity = '0.8'; p.style.fontSize = '0.9rem'; text.append(n, p); label.append(text);
      const status = document.createElement('pre'); status.className = 'status-pre'; status.style.marginLeft = 'auto'; status.style.fontSize = '0.85rem'; status.style.opacity = '0.8';
      li.append(cb, label, status); list.appendChild(li);
    });
    container.appendChild(list);

    const btn = document.createElement('button'); btn.className = 'button'; btn.textContent = (translations.actions && translations.actions.download_selected) || 'Download Selected'; btn.style.marginTop = '1rem'; container.appendChild(btn);

    let running = false;
    btn.onclick = async () => {
      if (running) return;
      running = true;
      // Preserve original button text for later restoration
      if (!btn.dataset.originalText) {
        btn.dataset.originalText = btn.textContent;
      }
      btn.disabled = true;
      // Indicate that we are preparing downloads instead of immediately starting
      btn.textContent = 'Preparing downloads...';

      // Χρήση sortedApps για να βρούμε το σωστό app
      const selected = Array.from(list.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => {
        const index = parseInt(cb.id.split('-')[1]);
        return sortedApps[index];
      });

      if (!selected.length) {
        toast(translations.messages.no_apps_selected || 'No applications selected.', { type: 'info' });
        running = false;
        btn.disabled = false;
        btn.textContent = (translations.actions && translations.actions.download_selected) || 'Download Selected';
        return;
      }

      const handleDownload = (app) => {
        const index = sortedApps.findIndex(a => a.name === app.name);
        const li = list.children[index];
        const status = li.querySelector('pre');
        // Hide status element during progress; it will only be used for errors
        status.textContent = '';
        status.style.display = 'none';
        const id = `install-${app.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const TIMEOUT_MS = 120000;
        return new Promise((resolve) => {
          let timeout;
          const unsubscribe = window.api.onDownloadEvent(async (data) => {
            if (data.id !== id) return;
            if (timeout) {
              clearTimeout(timeout);
              timeout = null;
            }

            if (data.status === 'started') {
              // Show progress on the main button
              btn.textContent = `Downloading ${app.name}... 0%`;
            } else if (data.status === 'progress') {
              btn.textContent = `Downloading ${app.name}... ${data.percent}%`;
            } else if (data.status === 'complete') {
              // Indicate completion and opening installer
              btn.textContent = `Opening ${app.name}...`;
              unsubscribe();

              try {
                // Special processing for Advanced Installer
                if (app.isAdvancedInstaller) {
                  await processAdvancedInstaller(data.path, status, app.name);
                } else {
                  // Normal processing for other applications
                  await window.api.openInstaller(data.path);
                  // Set a friendly message on the button
                  btn.textContent = `${app.name} Installer Started`;
                }
              } catch (error) {
                // On error, revert the button and show error toast
                btn.textContent = btn.dataset.originalText || btn.textContent;
                status.textContent = '';
                status.style.display = 'none';
                toast(`${app.name}: error - ${error.message}`, {
                  type: 'error',
                  title: 'Install'
                });
              }

              // Optionally fade any visible status (should be hidden during progress)
              autoFadeStatus(status, 3000);
              resolve();

            } else if (data.status === 'error') {
              // On download error, restore the button to its original text
              btn.textContent = btn.dataset.originalText || btn.textContent;
              status.textContent = '';
              status.style.display = 'none';
              toast(`${app.name}: download error - ${data.error}`, {
                type: 'error',
                title: 'Install'
              });
              autoFadeStatus(status, 4000);
              unsubscribe();
              resolve();
            }
          });

          // Start download
          try {
            window.api.downloadStart(id, app.url, `${app.name}.${app.ext}`);
          } catch (e) {
            // On exception, restore button and hide status
            btn.textContent = btn.dataset.originalText || btn.textContent;
            status.textContent = '';
            status.style.display = 'none';
            toast(`${app.name}: download failed - ${e.message}`, {
              type: 'error',
              title: 'Install'
            });
            autoFadeStatus(status, 4000);
            unsubscribe();
            resolve();
          }

          // Timeout handler
          timeout = setTimeout(() => {
            timeout = null;
            // On timeout, restore button and notify
            btn.textContent = btn.dataset.originalText || btn.textContent;
            status.textContent = '';
            status.style.display = 'none';
            toast(`${app.name}: download timed out`, {
              type: 'error',
              title: 'Install'
            });
            autoFadeStatus(status, 4000);
            unsubscribe();
            resolve();
          }, TIMEOUT_MS);
        });
      };

      // Launch all downloads concurrently
      const promises = selected.map((app) => handleDownload(app));
      await Promise.all(promises);
      // When all downloads complete, restore the original button state without showing a success notification
      running = false;
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || ((translations.actions && translations.actions.download_selected) || 'Download Selected');
    };
    return container;
  }
  // Συνάρτηση για επεξεργασία του Advanced Installer
  async function processAdvancedInstaller(zipPath, statusElement, appName) {
    statusElement.textContent = 'Extracting Advanced Installer...';

    try {
      // Extract το zip αρχείο
      const extractResult = await window.api.extractArchive(zipPath, '');

      if (!extractResult.success) {
        throw new Error(`Extraction failed: ${extractResult.error}`);
      }

      statusElement.textContent = 'Extraction complete!';

      // Βρες το extracted directory
      const extractedDir = getExtractedFolderPath(zipPath);

      // Συγκεκριμένα paths
      const msiPath = `${extractedDir}\\advinst.msi`;
      const activatorPath = `${extractedDir}\\Advanced Installer Activator.exe`;

      console.log('MSI Path:', msiPath);
      console.log('Activator Path:', activatorPath);

      // Έλεγχος ύπαρξης αρχείων με διαφορετικό τρόπο
      const filesExist = await checkFilesExist([msiPath, activatorPath]);

      if (!filesExist.msiExists) {
        throw new Error('advinst.msi not found');
      }

      if (!filesExist.activatorExists) {
        throw new Error('Advanced Installer Activator.exe not found');
      }

      statusElement.textContent = 'Starting Advanced Installer setup...';

      // Εκτέλεση του advinst.msi ΜΟΝΟ ΜΙΑ ΦΟΡΑ
      console.log('Running MSI installer...');
      const installResult = await window.api.runInstaller(msiPath);

      if (!installResult.success) {
        throw new Error(`Failed to run MSI installer: ${installResult.error}`);
      }

      statusElement.textContent = '✅ Advanced Installer setup started! Complete the installation.';
      statusElement.classList.add('status-success');

      // Compact κουμπί δεξιά
      const activatorButton = document.createElement('button');
      activatorButton.className = 'button activator-button';
      activatorButton.innerHTML = '🔓 Activate';
      activatorButton.style.marginLeft = 'auto';
      activatorButton.style.marginTop = '0';
      activatorButton.style.padding = '0.4rem 0.8rem';
      activatorButton.style.fontSize = '0.8rem';
      activatorButton.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
      activatorButton.style.border = 'none';
      activatorButton.style.borderRadius = '4px';
      activatorButton.style.fontWeight = '500';
      activatorButton.style.minWidth = '80px';
      activatorButton.style.height = '32px';

      activatorButton.addEventListener('click', async () => {
        activatorButton.disabled = true;
        activatorButton.innerHTML = '⏳...';

        try {
          console.log('Running activator...');
          const activatorResult = await window.api.runInstaller(activatorPath);

          if (activatorResult.success) {
            activatorButton.innerHTML = '✅ Done';
            activatorButton.style.background = 'linear-gradient(135deg, var(--success-color) 0%, #34d399 100%)';

            statusElement.textContent = '✅ Advanced Installer Activator started successfully! Follow the activation instructions.';
            statusElement.classList.add('status-success');

            toast('Activator started successfully!', {
              type: 'success',
              title: 'Advanced Installer',
              duration: 4000
            });

            autoFadeStatus(statusElement, 6000);

          } else {
            throw new Error(`Could not run activator: ${activatorResult.error}`);
          }
        } catch (error) {
          activatorButton.innerHTML = '❌ Error';
          activatorButton.style.background = 'linear-gradient(135deg, var(--error-color) 0%, #f87171 100%)';

          statusElement.textContent = `Error running activator: ${error.message}`;
          statusElement.classList.add('status-error');

          toast('Failed to run activator', {
            type: 'error',
            title: 'Advanced Installer',
            duration: 4000
          });

          setTimeout(() => {
            activatorButton.disabled = false;
            activatorButton.innerHTML = '🔓 Activate';
            activatorButton.style.background = 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)';
          }, 2000);
        }
      });

      // Προσθήκη compact κουμπιού
      const card = statusElement.closest('li');
      if (card) {
        const oldButton = card.querySelector('.activator-button');
        if (oldButton) oldButton.remove();

        const labelContainer = card.querySelector('label');
        if (labelContainer) {
          labelContainer.style.display = 'flex';
          labelContainer.style.alignItems = 'center';
          labelContainer.style.justifyContent = 'space-between';
          labelContainer.style.width = '100%';

          const textContainer = labelContainer.querySelector('div');
          if (textContainer) {
            textContainer.style.flex = '1';
            textContainer.style.marginRight = '1rem';
          }

          labelContainer.appendChild(activatorButton);
        } else {
          card.appendChild(activatorButton);
        }
      }

      toast('Advanced Installer setup started! Complete the installation and click "Activate".', {
        type: 'info',
        title: 'Advanced Installer',
        duration: 5000
      });

    } catch (error) {
      statusElement.textContent = `Error: ${error.message}`;
      statusElement.classList.add('status-error');
      throw error;
    }
  }

  // Βοηθητική συνάρτηση για έλεγχο ύπαρξης αρχείων (χωρίς εκτέλεση)
  async function checkFilesExist(filePaths) {
    return new Promise((resolve) => {
      const results = {
        msiExists: false,
        activatorExists: false
      };

      let completed = 0;

      filePaths.forEach(filePath => {
        // Χρήση fetch για έλεγχο ύπαρξης χωρίς εκτέλεση
        fetch(`file:///${filePath}`)
          .then(() => {
            if (filePath.includes('advinst.msi')) {
              results.msiExists = true;
            } else if (filePath.includes('Advanced Installer Activator.exe')) {
              results.activatorExists = true;
            }
            completed++;
            if (completed === filePaths.length) resolve(results);
          })
          .catch(() => {
            completed++;
            if (completed === filePaths.length) resolve(results);
          });
      });
    });
  }

  // Βοηθητική συνάρτηση για path του extracted folder
  function getExtractedFolderPath(zipPath) {
    const parentDir = getDirectoryName(zipPath);
    const baseName = getBaseName(zipPath, '.zip');
    return `${parentDir}\\${baseName}`;
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
  // Βοηθητική συνάρτηση για έλεγχο ύπαρξης αρχείων (χωρίς εκτέλεση)
  async function checkFilesExist(filePaths) {
    return new Promise((resolve) => {
      const results = {
        msiExists: false,
        activatorExists: false
      };

      let completed = 0;

      filePaths.forEach(filePath => {
        // Χρήση fetch για έλεγχο ύπαρξης χωρίς εκτέλεση
        fetch(`file:///${filePath}`)
          .then(() => {
            if (filePath.includes('advinst.msi')) {
              results.msiExists = true;
            } else if (filePath.includes('Advanced Installer Activator.exe')) {
              results.activatorExists = true;
            }
            completed++;
            if (completed === filePaths.length) resolve(results);
          })
          .catch(() => {
            completed++;
            if (completed === filePaths.length) resolve(results);
          });
      });
    });
  }

  // Build Spicetify page
  /* === Spicetify SVG icons (exact paths; now width/height = 36) === */
  const ICON_INSTALL_SPICETIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="56" height="56" viewBox="0 0 320.000000 400.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,400.000000) scale(0.050000,-0.050000)" fill="currentColor" stroke="none">
<path d="M4327 7810 c-104 -108 -106 -138 -37 -370 192 -642 -47 -1035 -1034 -1701 -406 -275 -601 -425 -820 -633 -188 -179 -172 -180 -263 14 -254 544 -872 778 -1121 424 -56 -79 -58 -86 -32 -164 25 -76 54 -107 291 -314 l73 -64 -7 -286 -8 -286 -123 -300 c-67 -165 -172 -412 -231 -550 -350 -802 -354 -1595 -13 -2267 840 -1651 3123 -1657 3949 -10 251 499 293 746 285 1665 -8 942 37 1063 450 1204 184 62 300 237 240 363 -165 347 -916 227 -1211 -194 -84 -120 -52 1 60 225 652 1309 668 2334 49 3086 -222 271 -350 311 -497 158z m280 -186 c670 -643 653 -1813 -46 -3084 -246 -445 -277 -658 -105 -707 97 -28 156 14 267 187 167 263 194 298 279 359 176 128 536 194 743 136 89 -25 73 -89 -30 -115 -546 -138 -750 -575 -665 -1423 106 -1062 -230 -1903 -949 -2368 -1169 -756 -2760 -135 -3100 1211 -167 656 -104 1048 319 2018 384 881 377 1282 -29 1494 -194 102 -162 178 75 178 379 -1 734 -393 734 -811 0 -178 34 -167 282 91 276 286 501 469 949 770 1119 751 1413 1265 1129 1974 -85 211 -20 250 147 90z"/>
<path d="M2220 3249 c-534 -66 -689 -152 -612 -337 45 -108 115 -123 336 -75 727 162 1560 78 2166 -218 186 -91 252 -90 321 8 250 358 -1157 754 -2211 622z"/>
<path d="M2250 2551 c-472 -70 -612 -161 -489 -318 49 -62 107 -67 276 -25 573 143 1285 60 1817 -213 184 -94 248 -92 305 9 59 105 18 153 -239 280 -487 242 -1139 346 -1670 267z"/>
<path d="M2421 1900 c-439 -38 -601 -92 -601 -199 0 -116 24 -118 480 -50 478 70 951 2 1335 -195 169 -86 205 -92 253 -38 210 232 -743 544 -1467 482z"/>
</g>
</svg>
`;

  const ICON_UNINSTALL_SPICETIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="56" height="56" viewBox="0 0 300.000000 375.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,375.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
<path d="M2335 3649 c-4 -6 -3 -21 3 -32 70 -152 82 -286 36 -412 -14 -38 -25 -76 -26 -82 -1 -7 -4 -13 -8 -13 -3 0 -14 -18 -24 -40 -22 -50 -146 -183 -241 -258 -98 -77 -250 -182 -264 -182 -6 0 -11 -4 -11 -10 0 -5 -4 -10 -10 -10 -19 0 -242 -172 -320 -246 -42 -41 -81 -74 -85 -74 -4 0 -4 10 0 23 21 70 41 433 25 472 -11 28 -18 -33 -25 -225 -13 -305 -9 -286 -56 -341 -22 -27 -47 -49 -55 -49 -19 0 -34 33 -34 76 0 54 -38 173 -69 213 -85 113 -191 167 -302 154 -61 -7 -70 -27 -24 -54 l35 -21 0 -284 c0 -240 2 -286 15 -290 25 -10 36 5 20 29 -11 17 -15 76 -17 279 -2 169 0 254 7 250 43 -25 67 -52 87 -96 19 -43 23 -67 23 -151 -1 -143 -34 -246 -175 -550 -31 -67 -99 -249 -115 -311 -29 -107 -34 -209 -19 -348 22 -203 89 -379 194 -509 51 -65 181 -197 192 -197 3 0 36 -20 73 -45 38 -25 89 -52 114 -62 25 -9 52 -21 59 -26 6 -5 12 -6 12 -2 0 4 7 2 15 -5 8 -7 15 -10 15 -7 0 3 24 -1 53 -10 87 -24 308 -29 407 -8 47 9 90 18 97 19 7 1 16 5 19 9 4 4 16 7 26 7 26 0 129 53 218 113 215 144 381 413 415 672 2 22 7 58 11 80 7 49 6 246 -1 335 -3 36 -5 112 -5 170 1 58 2 117 1 132 0 15 4 30 9 33 5 3 7 12 4 19 -3 8 0 17 5 21 6 3 9 11 6 16 -10 15 52 132 95 177 44 47 113 86 179 101 53 12 70 26 52 44 -8 8 -47 12 -119 12 -101 0 -111 -2 -174 -33 -74 -36 -139 -100 -178 -177 -29 -56 -83 -113 -115 -121 -28 -7 -85 23 -86 46 -1 22 2 84 5 101 7 36 15 52 136 289 84 165 188 439 174 461 -2 4 1 11 7 14 6 4 8 18 5 30 -3 13 -1 27 4 30 6 4 8 15 5 26 -4 10 -3 24 2 31 10 18 10 298 -1 298 -4 0 -5 11 -2 25 4 16 2 25 -5 25 -7 0 -9 9 -5 25 4 16 2 25 -5 25 -6 0 -9 6 -6 14 3 8 3 17 -1 20 -3 4 -7 16 -9 28 -3 19 -33 80 -85 169 -51 89 -167 195 -183 168z m95 -89 c55 -55 126 -185 161 -295 34 -107 39 -343 10 -486 -38 -192 -115 -387 -250 -637 -112 -206 -109 -326 11 -339 42 -5 49 -2 86 31 22 20 58 67 80 104 52 87 88 124 153 155 67 33 169 47 169 24 0 -8 -10 -17 -23 -20 -34 -9 -132 -102 -161 -153 -14 -25 -36 -78 -48 -118 -24 -77 -27 -175 -17 -546 4 -169 -1 -219 -42 -380 -26 -101 -106 -261 -175 -350 -114 -145 -321 -276 -509 -321 -110 -27 -293 -29 -400 -6 -335 72 -608 325 -703 652 -41 140 -56 355 -33 465 35 169 107 370 132 370 6 0 8 4 5 9 -3 5 9 42 28 82 59 128 123 311 136 388 21 125 -2 236 -58 290 -27 25 -36 41 -36 67 0 18 3 36 6 39 7 8 71 -24 117 -59 19 -14 41 -26 47 -26 7 0 16 -16 20 -35 3 -19 11 -33 16 -32 19 4 46 -96 49 -178 2 -80 2 -80 9 -25 6 47 7 49 8 17 4 -93 55 -123 111 -66 l31 31 1 -34 c1 -32 2 -31 8 8 4 22 17 54 29 71 25 35 154 157 192 182 14 9 33 23 43 32 19 17 292 205 325 224 41 24 192 144 243 195 199 198 262 396 199 628 -11 40 -20 75 -20 78 0 7 24 -11 50 -36z"/>
<path d="M1343 1845 c0 -33 2 -45 4 -27 2 18 2 45 0 60 -2 15 -4 0 -4 -33z"/>
<path d="M1375 1600 c-132 -11 -302 -46 -343 -72 -40 -25 -52 -46 -52 -95 0 -45 20 -77 60 -98 36 -19 63 -19 137 0 91 23 127 27 296 32 261 8 467 -28 680 -121 58 -26 114 -46 124 -46 28 0 85 41 100 70 45 89 -33 164 -253 241 -212 74 -506 109 -749 89z m375 -35 c25 -3 56 -5 70 -6 50 -2 238 -51 325 -86 141 -56 183 -80 201 -114 31 -61 -4 -129 -67 -129 -15 0 -58 14 -96 31 -202 92 -365 129 -608 136 -183 6 -284 -4 -437 -41 -49 -12 -61 -12 -85 0 -38 20 -53 42 -53 79 0 39 36 82 77 90 15 4 51 13 78 20 28 8 59 14 70 14 37 0 104 7 109 12 6 6 359 1 416 -6z"/>
<path d="M1305 1264 c-214 -36 -250 -53 -262 -127 -4 -27 0 -43 16 -66 33 -45 70 -51 171 -27 69 16 120 20 275 20 166 0 201 -2 279 -22 106 -28 189 -58 273 -101 81 -40 125 -41 164 -2 39 39 39 87 2 132 -53 62 -280 153 -458 184 -121 21 -363 25 -460 9z m390 -25 c89 -12 211 -43 295 -75 98 -38 199 -86 215 -104 37 -41 22 -106 -28 -123 -21 -7 -37 -4 -68 12 -121 64 -295 120 -431 142 -114 17 -352 7 -452 -21 -83 -22 -114 -21 -140 6 -19 19 -21 73 -3 97 40 56 405 95 612 66z"/>
<path d="M1335 955 c-49 -7 -116 -18 -147 -24 -96 -20 -135 -84 -88 -144 28 -36 65 -41 156 -20 58 13 125 17 249 18 198 0 270 -15 435 -90 53 -25 104 -45 113 -45 9 0 31 13 48 28 59 53 36 112 -67 169 -65 36 -217 87 -307 102 -96 17 -295 20 -392 6z m365 -29 c47 -8 112 -23 145 -34 222 -74 288 -120 256 -181 -24 -44 -43 -43 -137 3 -102 49 -193 81 -279 95 -84 15 -344 7 -433 -13 -95 -21 -107 -20 -132 6 -26 28 -25 44 3 71 20 21 94 39 247 61 65 9 254 4 330 -8z"/>
<path d="M238 3403 c17 -2 47 -2 65 0 17 2 3 4 -33 4 -36 0 -50 -2 -32 -4z"/>
<path d="M170 3389 c0 -6 -7 -9 -15 -5 -8 3 -15 1 -15 -5 0 -6 -4 -7 -10 -4 -11 7 -74 -24 -66 -32 8 -9 56 -12 83 -6 13 3 20 10 16 18 -3 9 5 17 22 21 20 5 23 9 13 15 -18 12 -28 11 -28 -2z"/>
<path d="M375 3384 c75 -32 148 -88 190 -145 l42 -57 49 29 c27 16 56 26 64 23 11 -4 12 -2 4 6 -8 8 -23 5 -56 -11 l-45 -22 -59 59 c-63 63 -150 119 -199 129 -25 5 -23 3 10 -11z"/>
<path d="M669 3368 c-9 -18 -1 -58 13 -67 17 -10 17 -10 6 9 -27 43 33 48 98 9 17 -11 38 -19 45 -19 8 1 -11 14 -41 29 -30 16 -58 27 -62 24 -5 2 -8 1 -8 6 0 9 -47 17 -51 9z"/>
<path d="M984 3298 c-15 -24 -28 -44 -29 -46 -2 -2 -18 6 -36 17 -19 12 -38 21 -44 21 -5 0 10 -12 34 -27 43 -25 44 -25 58 -7 46 66 56 69 133 49 19 -5 17 -1 -10 14 -55 31 -76 27 -106 -21z"/>
<path d="M322 3227 c38 -40 77 -86 88 -104 l19 -32 -55 -31 c-48 -28 -62 -50 -32 -50 27 0 258 -121 258 -135 0 -12 16 -15 87 -15 47 0 83 3 80 7 -4 3 -21 6 -37 5 -40 -1 -45 15 -27 77 13 44 25 263 14 251 -3 -3 -15 -75 -27 -160 -13 -85 -24 -156 -25 -158 -4 -5 -250 109 -275 128 l-24 18 37 34 37 35 -31 44 c-36 50 -116 136 -140 149 -8 5 16 -24 53 -63z"/>
<path d="M1190 3264 c36 -19 112 -59 171 -89 136 -69 139 -72 109 -135 -13 -28 -22 -52 -19 -54 2 -2 56 -31 119 -66 120 -65 142 -83 133 -106 -7 -20 -37 -17 -83 6 -56 28 -64 24 -10 -5 55 -29 86 -31 100 -6 13 26 -7 48 -95 99 -38 22 -82 52 -97 66 -24 23 -26 30 -21 79 4 38 2 56 -8 64 -19 15 -344 183 -355 183 -5 0 20 -16 56 -36z"/>
<path d="M735 3273 c6 -6 46 -30 90 -53 44 -24 76 -39 70 -33 -5 6 -46 29 -90 53 -44 24 -75 38 -70 33z"/>
<path d="M1035 3109 c87 -51 489 -259 501 -259 15 0 -54 39 -216 122 -85 44 -196 102 -246 129 -110 60 -135 65 -39 8z"/>
<path d="M413 2848 c-7 -9 3 -193 28 -538 20 -289 36 -528 33 -531 -2 -3 8 -17 22 -29 18 -18 44 -27 97 -34 103 -14 204 -13 219 2 10 9 -17 12 -133 12 -79 0 -149 4 -154 8 -31 22 -40 73 -50 287 -3 66 -13 201 -21 300 -25 314 -32 500 -19 513 3 3 22 8 42 12 l38 8 -46 1 c-27 1 -51 -4 -56 -11z"/>
<path d="M932 2853 c70 -2 187 -2 260 0 73 1 16 3 -127 3 -143 0 -203 -2 -133 -3z"/>
<path d="M625 2597 c-3 -7 -4 -152 -3 -322 l3 -310 30 0 30 0 3 300 c1 165 0 310 -3 323 -4 15 -13 22 -31 22 -13 0 -27 -6 -29 -13z m36 -109 c3 -13 4 -126 4 -252 0 -172 -3 -230 -12 -233 -10 -4 -12 53 -12 251 0 141 4 256 9 256 4 0 9 -10 11 -22z"/>
<path d="M1147 2603 c-11 -10 -8 -71 3 -78 6 -3 10 -1 10 4 0 6 4 11 9 11 6 0 13 -21 17 -47 7 -42 9 -45 15 -23 9 32 11 104 3 124 -6 16 -45 22 -57 9z"/>
<path d="M933 2433 c-11 -39 -5 -393 7 -393 6 0 10 80 10 210 0 116 -2 210 -4 210 -2 0 -8 -12 -13 -27z"/>
</g>
</svg>
`;

  const ICON_FULL_UNINSTALL_SPOTIFY = `
<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="48" height="48" viewBox="0 0 600.000000 600.000000" preserveAspectRatio="xMidYMid meet">
<metadata>Created by potrace 1.10, written by Peter Selinger 2001-2011</metadata>
<g transform="translate(0.000000,600.000000) scale(0.100000,-0.100000)" fill="currentColor" stroke="none">
<path d="M250 5830 c-19 -5 -51 -13 -70 -19 -19 -6 -56 -16 -81 -23 -52 -15 -79 -34 -79 -54 0 -11 19 -14 83 -14 113 -1 198 -31 302 -109 94 -71 183 -168 265 -291 8 -13 23 -31 34 -41 26 -25 14 -46 -41 -70 -27 -11 -65 -29 -86 -40 -21 -10 -44 -19 -52 -19 -17 0 -34 -30 -28 -47 3 -7 15 -13 29 -13 25 0 92 -22 136 -46 14 -8 33 -14 41 -14 9 0 28 -6 44 -14 36 -18 87 -40 143 -61 25 -10 57 -23 72 -31 14 -8 31 -14 36 -14 6 0 40 -14 76 -30 37 -17 71 -28 76 -25 6 3 10 32 10 64 0 32 5 71 10 88 6 16 15 67 19 114 11 102 27 205 51 321 23 112 16 120 -65 68 -33 -22 -73 -50 -90 -64 -35 -29 -75 -34 -75 -10 0 26 -58 114 -114 173 -103 107 -222 180 -352 215 -64 17 -231 20 -294 6z m340 -108 c118 -47 225 -131 316 -247 50 -64 106 -98 164 -99 27 -1 54 -6 60 -12 23 -23 -26 -350 -55 -374 -18 -15 -92 1 -143 31 -18 10 -41 19 -50 20 -9 0 -51 17 -92 37 -84 42 -96 62 -61 111 32 45 35 80 11 135 -39 93 -110 185 -227 295 -135 127 -141 147 -46 136 32 -4 87 -18 123 -33z"/>
<path d="M1150 5749 c-21 -30 -22 -34 -7 -58 15 -25 56 -49 282 -166 61 -31 214 -110 340 -176 127 -65 271 -139 320 -164 50 -26 97 -50 105 -55 8 -5 22 -11 30 -15 8 -3 81 -41 162 -83 278 -146 513 -264 553 -278 37 -12 41 -12 62 8 18 17 29 19 60 13 21 -4 44 -12 51 -17 7 -6 15 -8 19 -4 11 11 -19 55 -46 66 -14 6 -66 33 -116 60 -49 27 -97 52 -105 55 -8 4 -22 10 -30 15 -33 20 -155 76 -182 84 -27 8 -22 27 27 102 56 85 59 120 13 163 -18 17 -38 31 -43 31 -6 0 -44 18 -85 39 -116 61 -343 178 -470 244 -63 32 -133 70 -155 83 -22 13 -57 23 -77 24 -33 0 -42 -5 -68 -42 -16 -22 -30 -49 -30 -60 0 -10 -4 -18 -9 -18 -5 0 -12 -16 -15 -35 -6 -28 -12 -35 -30 -35 -13 0 -34 8 -47 18 -31 22 -49 32 -193 107 -199 103 -206 107 -212 116 -3 5 -22 9 -43 9 -30 0 -42 -6 -61 -31z m935 -221 c88 -45 192 -97 230 -116 39 -18 77 -38 85 -43 8 -5 50 -27 93 -50 73 -39 127 -87 127 -112 0 -7 -11 -43 -24 -82 -29 -87 -45 -91 -143 -42 -240 120 -646 329 -668 343 -53 34 -51 48 11 119 78 88 84 88 289 -17z"/>
<path d="M663 4774 c-11 -17 -11 -31 -3 -65 6 -24 15 -132 20 -240 4 -108 13 -247 19 -310 11 -121 27 -369 41 -659 5 -96 13 -220 19 -275 6 -55 13 -177 16 -271 10 -289 32 -314 270 -314 141 0 165 4 165 26 0 25 -54 41 -160 48 -156 10 -181 33 -195 171 -6 64 -29 421 -45 695 -5 91 -14 230 -19 310 -54 775 -54 796 -8 822 17 9 210 11 827 10 443 -2 812 -5 820 -7 9 -3 23 -21 33 -40 9 -19 25 -50 34 -69 20 -41 30 -38 38 12 3 20 10 59 16 85 9 38 8 52 -2 68 -14 20 -23 20 -943 22 l-929 2 -14 -21z"/>
<path d="M3331 4749 c-41 -5 -99 -15 -130 -23 -39 -10 -59 -11 -72 -3 -18 11 -79 -12 -107 -40 -7 -7 -29 -13 -47 -13 -19 0 -46 -5 -62 -11 -15 -6 -41 -15 -58 -20 -64 -17 -150 -50 -182 -69 -19 -11 -39 -20 -44 -20 -5 0 -23 -10 -39 -21 -17 13 -35 19 -45 15 -11 4 -31 -5 -53 -22 -21 -16 -45 -32 -54 -35 -10 -4 -18 -11 -18 -17 0 -5 -8 -10 -19 -10 -10 0 -24 -7 -31 -15 -7 -8 -18 -15 -25 -15 -7 0 -15 -7 -19 -15 -3 -8 -13 -15 -23 -15 -10 0 -31 -14 -47 -30 -16 -17 -36 -30 -45 -30 -9 0 -24 -14 -33 -30 -9 -17 -24 -30 -32 -30 -8 0 -19 -6 -23 -13 -4 -7 -28 -28 -53 -47 -109 -82 -356 -360 -396 -445 -8 -16 -23 -43 -34 -60 -10 -16 -29 -50 -42 -74 -13 -25 -35 -58 -50 -75 -16 -17 -28 -40 -28 -52 0 -12 -7 -27 -15 -34 -8 -7 -15 -23 -15 -35 0 -12 -7 -28 -15 -35 -8 -7 -15 -20 -15 -29 0 -9 -7 -25 -15 -35 -8 -11 -15 -32 -15 -47 0 -14 -7 -32 -15 -39 -8 -7 -15 -24 -15 -39 0 -14 -7 -35 -15 -45 -8 -11 -15 -36 -15 -56 0 -20 -4 -40 -9 -45 -12 -13 -42 -154 -50 -235 -4 -36 -12 -74 -18 -85 -8 -15 -11 -92 -9 -250 3 -239 20 -416 43 -450 7 -11 13 -33 13 -50 0 -16 5 -46 11 -65 6 -19 15 -53 19 -75 9 -46 27 -98 46 -137 8 -14 14 -34 14 -43 0 -9 6 -29 14 -43 8 -15 22 -47 32 -72 10 -25 24 -52 31 -61 7 -8 13 -23 13 -31 0 -9 7 -21 15 -28 8 -7 15 -21 15 -31 0 -10 4 -21 10 -24 5 -3 21 -30 35 -58 98 -198 372 -505 614 -685 81 -60 95 -70 151 -102 19 -11 53 -31 75 -44 82 -51 307 -156 333 -156 10 0 27 -7 38 -15 10 -8 28 -15 40 -15 11 0 24 -4 30 -9 9 -10 49 -21 144 -42 25 -6 72 -17 105 -25 129 -30 219 -40 387 -42 193 -2 397 16 513 46 36 10 92 22 180 39 17 3 35 9 40 14 6 4 44 19 85 32 90 30 109 37 225 92 50 24 97 46 105 49 17 8 36 19 97 59 24 15 45 27 48 27 9 0 80 51 195 141 97 76 360 335 360 355 0 6 34 49 75 96 8 10 15 21 15 24 0 3 13 23 28 43 16 20 32 43 35 51 4 8 16 29 27 45 10 17 30 53 45 80 14 28 29 57 34 65 9 14 46 95 84 183 10 21 17 46 17 55 0 10 5 23 11 29 6 6 14 26 19 44 4 19 13 48 19 64 25 75 41 140 41 172 0 19 6 44 12 56 7 12 15 56 19 97 3 41 12 116 19 165 14 101 7 412 -10 429 -6 6 -10 34 -10 64 0 29 -5 62 -11 73 -6 11 -16 57 -24 102 -16 102 -34 166 -71 255 -8 18 -14 40 -14 48 0 9 -6 28 -14 42 -7 15 -28 59 -46 97 -17 39 -36 77 -41 85 -5 8 -11 21 -14 28 -13 32 -16 39 -35 67 -11 17 -24 39 -30 50 -41 76 -137 214 -210 300 -66 78 -283 287 -355 341 -120 91 -242 167 -375 233 -25 12 -52 26 -60 30 -14 8 -31 16 -123 55 -21 9 -42 16 -48 16 -6 0 -25 6 -42 14 -18 7 -59 21 -92 31 -33 10 -71 22 -85 26 -14 5 -56 13 -94 19 -38 6 -74 14 -79 17 -6 4 -49 10 -96 15 -47 4 -108 12 -136 17 -61 12 -313 12 -414 0z m225 -77 c10 -5 73 -13 139 -16 138 -8 213 -17 305 -39 36 -8 97 -22 135 -31 69 -15 125 -33 235 -76 30 -12 68 -25 83 -30 16 -5 47 -20 70 -33 23 -13 54 -27 69 -31 14 -3 40 -17 56 -31 17 -14 33 -25 38 -25 4 0 24 -11 43 -24 20 -13 70 -45 111 -71 67 -44 236 -179 264 -213 6 -8 29 -33 51 -57 93 -98 202 -230 227 -271 10 -16 23 -38 30 -49 48 -76 65 -105 86 -145 13 -25 30 -56 37 -70 30 -54 84 -179 91 -206 4 -16 12 -40 19 -54 37 -73 72 -212 100 -391 8 -53 19 -108 24 -122 10 -26 8 -398 -2 -415 -3 -4 -8 -46 -11 -93 -6 -89 -16 -141 -47 -254 -11 -38 -25 -88 -30 -110 -6 -22 -22 -64 -35 -93 -13 -29 -24 -59 -24 -67 0 -8 -30 -77 -67 -153 -57 -117 -122 -224 -238 -392 -43 -62 -212 -244 -258 -277 -39 -28 -110 -88 -149 -126 -16 -15 -34 -27 -41 -27 -8 0 -26 -14 -42 -30 -16 -17 -35 -30 -43 -30 -7 0 -28 -11 -45 -24 -18 -13 -50 -33 -72 -45 -22 -12 -51 -28 -65 -36 -51 -30 -250 -115 -268 -115 -10 0 -22 -4 -28 -9 -9 -10 -77 -30 -269 -80 -80 -21 -155 -32 -275 -40 -91 -7 -189 -16 -219 -21 -30 -6 -85 -10 -122 -10 -180 0 -565 142 -782 288 -126 86 -151 103 -157 110 -4 6 -42 36 -108 87 -53 40 -223 219 -295 310 -48 61 -90 115 -95 120 -4 6 -11 17 -15 25 -4 8 -16 29 -27 45 -11 17 -25 42 -31 58 -6 15 -14 27 -19 27 -6 0 -118 219 -151 295 -28 65 -84 244 -105 335 -8 36 -19 83 -24 105 -5 22 -9 58 -10 81 0 22 -4 44 -9 50 -5 5 -12 95 -16 199 -4 105 -9 192 -11 194 -12 13 -21 -63 -22 -184 -1 -106 5 -174 23 -280 25 -149 40 -218 54 -250 9 -20 26 -82 40 -145 5 -19 20 -57 33 -85 14 -27 34 -72 43 -100 10 -27 23 -55 31 -61 7 -6 20 -33 34 -55 9 -27 22 -54 30 -59 7 -6 22 -30 34 -55 51 -104 127 -217 153 -228 5 -2 8 -8 8 -14 0 -6 15 -27 32 -48 52 -58 88 -102 88 -105 0 -1 32 -35 70 -75 40 -42 69 -79 66 -87 -4 -10 1 -12 18 -7 19 4 25 1 30 -19 4 -16 17 -29 36 -35 16 -6 30 -18 30 -26 0 -23 -25 -19 -56 9 -14 13 -35 27 -47 31 -11 3 -41 26 -66 50 -25 24 -50 44 -55 44 -6 0 -24 14 -40 30 -17 17 -67 65 -112 108 -44 42 -83 85 -87 95 -3 9 -12 17 -19 17 -7 0 -23 15 -36 33 -12 17 -37 52 -56 77 -44 58 -162 249 -175 283 -6 14 -21 43 -34 64 -13 21 -32 63 -42 93 -10 30 -31 81 -46 113 -16 33 -27 63 -24 68 3 5 -1 19 -9 31 -8 13 -22 57 -31 98 -9 41 -25 104 -35 140 -19 63 -45 313 -35 330 10 15 -13 207 -26 228 -31 49 2 53 461 52 202 -1 260 -4 282 -17 4 -2 -11 -21 -33 -42 -65 -65 -75 -127 -38 -225 29 -79 97 -150 183 -192 90 -43 111 -44 321 -4 56 11 205 28 310 36 236 19 817 -13 905 -48 8 -4 40 -9 70 -13 96 -11 425 -102 492 -136 10 -5 26 -9 36 -9 9 0 27 -7 38 -15 12 -8 61 -27 110 -43 79 -26 99 -29 173 -24 65 4 93 10 120 28 127 81 180 159 188 279 3 56 1 76 -14 102 -10 17 -30 54 -46 82 -39 72 -80 100 -262 181 -22 10 -56 24 -75 31 -19 7 -44 19 -55 26 -11 7 -28 13 -38 13 -20 0 -127 34 -174 56 -17 7 -45 14 -61 14 -17 0 -33 4 -36 9 -5 8 -52 19 -171 40 -27 5 -102 19 -165 30 -187 36 -209 39 -340 54 -89 10 -222 13 -460 12 -375 -3 -488 -16 -566 -61 -24 -14 -48 -23 -53 -20 -22 14 -20 131 4 154 3 3 21 -2 40 -12 38 -21 46 -20 435 4 354 22 885 -34 1247 -131 39 -10 79 -19 88 -19 8 0 33 -9 53 -19 21 -11 64 -24 97 -30 32 -6 77 -20 99 -30 23 -10 66 -27 96 -36 30 -10 74 -28 97 -41 23 -13 48 -24 56 -24 8 0 27 -7 43 -14 102 -51 304 -49 371 4 14 11 31 20 37 20 17 0 110 127 136 185 35 81 35 140 1 217 -16 35 -37 70 -45 77 -9 8 -16 19 -16 26 0 39 -206 167 -306 191 -16 3 -42 14 -59 24 -16 9 -100 40 -185 69 -85 28 -168 56 -185 62 -67 24 -299 80 -430 105 -44 8 -94 19 -112 25 -17 5 -76 14 -130 19 -54 5 -114 14 -133 19 -19 6 -73 12 -120 15 -47 2 -125 8 -175 13 -49 4 -223 8 -385 8 -316 0 -436 -12 -501 -47 -20 -11 -47 -18 -60 -16 l-24 3 2 125 c1 69 5 206 10 305 5 99 5 193 1 209 -6 22 -2 38 14 64 14 23 21 49 20 76 -3 52 9 70 37 61 23 -7 27 -25 9 -43 -35 -35 26 -18 91 25 44 30 277 143 364 177 116 46 320 86 413 82 44 -2 89 -8 100 -14z m-1156 -402 c-33 -33 -60 -64 -60 -70 0 -10 -52 -40 -70 -40 -14 0 -13 27 1 32 7 2 17 19 23 38 8 26 25 41 71 66 93 52 104 43 35 -26z m70 -31 c0 -11 -4 -29 -10 -39 -5 -10 -12 -73 -15 -141 -3 -68 -9 -173 -14 -234 -5 -60 -6 -113 -4 -118 7 -12 -37 -66 -67 -82 -40 -21 -63 -19 -87 8 -19 20 -21 36 -25 189 -1 91 -7 170 -11 175 -5 4 -17 -3 -28 -16 -17 -21 -19 -41 -20 -195 0 -94 -3 -189 -7 -211 -6 -35 -11 -40 -37 -43 -17 -2 -34 -8 -40 -13 -15 -15 -42 -10 -50 9 -4 9 -9 63 -12 120 -5 88 -8 102 -23 102 -19 0 -29 -32 -34 -105 -5 -74 -38 -177 -67 -209 -15 -18 -31 -44 -34 -59 -4 -15 -11 -30 -16 -33 -5 -3 -9 -23 -9 -45 0 -21 -5 -48 -12 -59 -10 -15 -10 -27 1 -55 7 -19 10 -43 7 -53 -4 -10 1 -27 9 -38 8 -10 15 -26 15 -35 0 -18 112 -132 150 -154 73 -42 99 -49 204 -54 68 -4 111 -10 113 -17 4 -12 -68 -54 -93 -54 -24 0 -125 -38 -143 -54 -13 -11 -61 -15 -231 -18 -170 -2 -220 -6 -238 -18 -22 -14 -25 -13 -39 8 -18 26 -35 28 -68 6 -20 -13 -30 -13 -67 -3 -67 20 -70 24 -65 103 7 108 54 287 78 302 5 3 30 -8 55 -25 25 -17 49 -31 54 -31 5 0 15 -10 21 -22 l12 -22 24 28 c13 15 21 31 18 36 -2 4 -25 5 -50 2 -32 -3 -45 -1 -45 8 0 7 -7 18 -15 24 -14 10 -14 32 -5 173 l10 162 47 86 c26 47 52 85 59 85 31 0 37 -42 32 -227 -4 -140 -2 -183 8 -183 13 0 24 22 24 50 0 10 15 64 34 120 l33 102 -25 -5 -25 -5 6 100 c6 88 11 109 42 172 35 72 148 206 173 206 6 0 12 -10 12 -23 0 -41 -28 -158 -44 -182 -26 -39 -18 -50 11 -16 15 17 32 31 38 31 6 0 24 25 40 56 27 52 29 63 30 175 l0 120 55 48 c35 31 59 46 65 40 5 -5 10 -45 10 -89 0 -44 4 -81 10 -83 5 -1 19 13 30 31 32 54 85 111 150 163 65 53 95 61 95 28z m940 -670 c107 -5 227 -15 265 -20 39 -6 111 -14 161 -18 50 -4 97 -12 105 -17 8 -4 37 -11 64 -15 71 -9 195 -35 228 -48 16 -6 41 -11 56 -11 15 0 47 -6 72 -14 24 -8 91 -28 149 -45 58 -18 119 -37 135 -42 17 -6 44 -14 60 -18 17 -4 39 -13 50 -19 11 -6 49 -21 85 -33 70 -24 108 -38 155 -58 45 -20 85 -37 132 -56 23 -10 44 -24 47 -31 3 -8 10 -14 16 -14 23 0 49 -36 95 -131 19 -41 17 -106 -6 -173 -17 -48 -91 -127 -147 -155 -52 -26 -163 -29 -219 -5 -73 31 -103 44 -135 58 -78 34 -105 44 -135 51 -18 3 -35 11 -38 16 -4 5 -13 9 -22 9 -8 0 -29 6 -46 14 -18 7 -59 21 -92 31 -33 9 -73 21 -90 27 -16 5 -46 14 -65 18 -16 5 -75 20 -130 31 -55 12 -116 25 -136 31 -20 5 -52 9 -70 9 -19 0 -56 7 -83 15 -27 8 -72 15 -100 15 -28 0 -67 4 -86 10 -28 8 -405 33 -505 33 -99 1 -479 -25 -494 -33 -10 -5 -58 -11 -108 -13 -49 -2 -99 -9 -110 -16 -12 -6 -40 -11 -63 -11 -23 0 -51 -5 -63 -12 -34 -18 -126 -20 -151 -3 -11 8 -27 15 -36 15 -27 0 -150 130 -150 159 0 7 -7 22 -15 34 -17 26 -15 111 3 129 7 7 12 21 12 31 0 11 26 46 57 79 32 32 61 65 66 73 4 8 17 15 28 15 11 0 31 7 44 16 20 13 28 14 40 4 17 -14 85 -5 129 17 19 10 51 14 95 12 51 -3 74 1 94 14 21 13 50 17 139 18 62 0 187 7 278 14 91 7 197 11 235 9 39 -2 158 -9 265 -15z m0 -802 c25 -3 90 -8 145 -11 55 -4 132 -13 170 -21 39 -7 111 -21 160 -30 50 -10 112 -23 139 -31 27 -8 66 -14 85 -14 20 0 45 -7 55 -15 11 -8 34 -15 51 -15 17 0 35 -4 40 -9 6 -6 28 -14 50 -20 91 -23 183 -53 242 -78 18 -7 47 -20 65 -27 18 -8 53 -22 78 -31 111 -43 174 -99 195 -174 13 -45 1 -158 -20 -181 -8 -9 -15 -21 -15 -27 0 -17 -100 -79 -151 -92 -38 -11 -54 -10 -96 2 -28 8 -59 20 -69 25 -11 5 -39 18 -64 27 -25 9 -58 23 -73 31 -16 8 -37 14 -47 14 -18 0 -67 18 -113 42 -10 5 -39 13 -65 18 -26 6 -78 19 -117 31 -38 11 -90 24 -115 29 -25 5 -63 13 -85 18 -80 20 -172 35 -260 43 -49 5 -121 13 -160 18 -90 13 -548 13 -645 0 -41 -5 -111 -14 -155 -18 -44 -5 -102 -14 -130 -19 -27 -6 -87 -15 -132 -22 -81 -11 -84 -10 -140 17 -43 21 -67 43 -100 87 -41 55 -43 62 -43 126 0 105 27 146 128 199 52 27 71 32 102 27 29 -4 48 -1 72 13 60 35 163 51 443 67 49 3 92 8 95 11 5 5 404 -3 480 -10z m-916 -2198 c-6 -11 -44 8 -44 21 0 6 10 5 25 -2 13 -6 22 -15 19 -19z"/>
<path d="M2969 2145 c-3 -3 -42 -8 -85 -10 -255 -16 -445 -47 -604 -98 -92 -30 -201 -129 -216 -195 -3 -15 -10 -39 -16 -53 -19 -52 16 -153 76 -217 38 -41 105 -82 151 -92 45 -10 194 5 335 34 360 76 974 45 1300 -64 36 -12 90 -29 120 -37 30 -8 78 -25 107 -38 28 -14 59 -25 68 -25 9 0 30 -8 48 -17 34 -18 92 -31 169 -40 38 -4 56 0 95 22 78 42 117 84 162 174 18 35 21 53 16 95 -10 85 -15 102 -34 123 -10 11 -30 38 -45 61 -14 23 -31 42 -37 42 -6 0 -25 11 -42 24 -43 32 -294 131 -399 157 -20 5 -61 17 -90 28 -29 10 -78 23 -108 29 -30 6 -68 14 -85 17 -16 4 -50 10 -75 14 -25 4 -56 13 -70 19 -14 6 -99 16 -190 22 -91 6 -196 15 -235 20 -82 9 -308 13 -316 5z m496 -113 c129 -13 312 -41 341 -52 14 -6 39 -10 55 -10 17 0 39 -5 50 -10 10 -6 38 -14 61 -19 24 -5 57 -14 73 -19 17 -6 57 -18 90 -28 72 -20 170 -55 250 -89 17 -7 50 -21 75 -31 106 -43 150 -101 150 -197 0 -34 -4 -67 -8 -74 -67 -106 -173 -157 -249 -119 -15 8 -46 22 -68 32 -22 9 -48 21 -59 26 -10 5 -53 21 -95 34 -42 13 -85 28 -96 33 -39 16 -121 39 -195 55 -41 9 -97 22 -125 28 -195 45 -419 61 -725 53 -164 -4 -248 -10 -275 -20 -22 -8 -60 -14 -84 -15 -24 0 -67 -6 -95 -14 -79 -23 -191 -46 -219 -46 -39 0 -72 16 -117 56 -41 38 -80 109 -80 149 0 41 40 114 80 146 45 36 128 69 175 69 16 0 46 5 65 11 56 17 216 40 338 49 62 4 116 11 120 15 9 9 449 -2 567 -13z"/>
<path d="M1880 3649 c0 -11 5 -17 10 -14 6 3 10 13 10 21 0 8 -4 14 -10 14 -5 0 -10 -9 -10 -21z"/>
<path d="M2425 3426 c-23 -39 -26 -58 -32 -174 -5 -111 -3 -138 11 -177 17 -43 36 -60 36 -32 0 6 7 66 15 132 17 138 20 295 5 295 -5 0 -21 -20 -35 -44z"/>
<path d="M2196 3413 c-3 -3 -6 -72 -6 -152 -1 -128 -3 -149 -19 -168 -11 -13 -30 -23 -45 -23 -14 0 -26 -4 -26 -10 0 -29 121 13 135 47 10 24 26 113 25 138 -1 11 -2 45 -3 75 -2 30 -6 61 -10 67 -11 18 -43 34 -51 26z"/>
<path d="M2016 3256 c-4 -15 -4 -37 0 -49 7 -21 8 -20 15 6 4 16 4 38 0 50 -7 20 -8 19 -15 -7z"/>
<path d="M1045 4359 c-67 -59 -65 -40 -65 -649 0 -608 -2 -585 65 -652 41 -42 64 -46 119 -23 26 11 42 28 61 65 14 27 25 58 25 68 0 10 3 21 6 24 3 3 5 245 4 538 0 422 -3 539 -14 564 -22 51 -69 88 -119 93 -39 5 -48 2 -82 -28z m120 -31 l26 -23 0 -598 c1 -673 5 -637 -72 -637 -73 0 -70 -26 -71 637 l0 588 25 28 c30 33 57 34 92 5z"/>
<path d="M1574 4380 c-29 -12 -70 -63 -84 -106 -9 -27 -11 -112 -8 -316 4 -252 6 -280 23 -298 18 -20 19 -20 29 -3 7 11 12 133 13 333 l2 315 26 23 c34 29 56 28 94 -4 l31 -26 0 -183 c0 -106 4 -186 10 -190 30 -19 65 284 41 357 -17 52 -82 108 -124 107 -17 0 -41 -4 -53 -9z"/>
<path d="M2040 4340 c-22 -22 -40 -48 -40 -57 0 -13 2 -14 17 -2 10 8 28 26 41 41 12 15 34 28 48 30 32 4 32 22 0 26 -19 2 -36 -7 -66 -38z"/>
</g>
</svg>
`;

  function buildSpicetifyPage() {
    const container = document.createElement('div');
    container.className = 'card';

    // Grid: δύο στήλες στο πάνω row, full-width το κάτω
    const grid = document.createElement('div');
    grid.className = 'install-grid';

    // Output
    const outputPre = document.createElement('pre');
    outputPre.className = 'status-pre';

    async function runAction(action, successMsg, errorMsg, button) {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = (translations.general?.run || 'Run') + '...';
      try {
        const result = await action();
        outputPre.textContent = result.output || '';
        if (result.success) {
          toast(successMsg, { type: 'success', title: translations.menu?.spicetify || 'Spicetify' });
          button.textContent = '✓ ' + originalText;
          button.classList.add('success');
          setTimeout(() => { button.textContent = originalText; button.classList.remove('success'); }, 2000);
        } else {
          throw new Error(result.error);
        }
      } catch (err) {
        outputPre.textContent = '';
        toast(errorMsg + `: ${err.message}`, { type: 'error', title: translations.menu?.spicetify || 'Spicetify', duration: 6000 });
        button.textContent = '✗ ' + originalText;
        button.classList.add('error');
        setTimeout(() => { button.textContent = originalText; button.classList.remove('error'); }, 2000);
      } finally {
        button.disabled = false;
      }
    }

    function buildHeader(svgHTML, titleTxt, descTxt) {
      const header = document.createElement('div');
      header.className = 'app-header';

      const iconWrap = document.createElement('div');
      iconWrap.className = 'app-icon';
      iconWrap.innerHTML = svgHTML;

      const textBox = document.createElement('div');
      const h3 = document.createElement('h3');
      h3.textContent = titleTxt;
      const p = document.createElement('p');
      p.textContent = descTxt;

      textBox.appendChild(h3);
      textBox.appendChild(p);

      header.appendChild(iconWrap);
      header.appendChild(textBox);
      return header;
    }

    // Card factory
    const makeCard = (svg, title, desc, btnLabel, onClick) => {
      const card = document.createElement('div');
      card.className = 'app-card';
      card.appendChild(buildHeader(svg, title, desc));
      const btn = document.createElement('button');
      btn.className = 'button';
      btn.textContent = btnLabel;
      btn.addEventListener('click', () => onClick(btn));
      card.appendChild(btn);
      return card;
    };

    // Top row: Install | Uninstall
    const installCard = makeCard(
      ICON_INSTALL_SPICETIFY,
      translations.actions?.install_spicetify || 'Install Spicetify',
      translations.pages?.spicetify_desc || 'Download and install Spicetify to customize Spotify',
      translations.actions?.install || 'Install',
      (btn) => runAction(
        () => window.api.installSpicetify(),
        translations.messages?.install_spicetify_success || 'Spicetify installed successfully!',
        translations.messages?.install_spicetify_error || 'Error installing Spicetify',
        btn
      )
    );

    const uninstallCard = makeCard(
      ICON_UNINSTALL_SPICETIFY,
      translations.actions?.uninstall_spicetify || 'Uninstall Spicetify',
      translations.general?.not_implemented || 'Remove Spicetify while keeping Spotify',
      translations.general?.cancel || 'Cancel',
      (btn) => runAction(
        () => window.api.uninstallSpicetify(),
        translations.messages?.uninstall_spicetify_success || 'Spicetify uninstalled successfully!',
        translations.messages?.uninstall_spicetify_error || 'Error uninstalling Spicetify',
        btn
      )
    );

    // Bottom row: Full uninstall spans both columns
    const fullUninstallCard = makeCard(
      ICON_FULL_UNINSTALL_SPOTIFY,
      translations.actions?.full_uninstall_spotify || 'Full Uninstall Spotify',
      translations.general?.not_implemented || 'Complete removal of both Spotify and Spicetify',
      translations.actions?.full_uninstall_spotify || 'Full Uninstall Spotify',
      (btn) => runAction(
        () => window.api.fullUninstallSpotify(),
        translations.messages?.full_uninstall_spotify_success || 'Spotify fully uninstalled!',
        translations.messages?.full_uninstall_spotify_error || 'Error fully uninstalling Spotify',
        btn
      )
    );
    fullUninstallCard.classList.add('full-span');

    // Assemble
    grid.appendChild(installCard);
    grid.appendChild(uninstallCard);
    grid.appendChild(fullUninstallCard);

    container.appendChild(grid);
    container.appendChild(outputPre);
    return container;
  }

  // Build crack installer page - more compact grid with progress and pause
  async function buildCrackInstallerPage() {
    const container = createCard('crack_title', '');
    const projects = [
      { name: 'Clip Studio', url: 'https://www.dropbox.com/scl/fi/kx8gqow9zfian7g8ocqg3/Clip-Studio-Paint.zip?rlkey=wz4b7kfkchzgnsq9tpnp40rcw&st=rmp98tmo&dl=1', icon: 'https://i.postimg.cc/HLrJgc2G/clipstudio.png' },
      { name: 'Encoder', url: 'https://www.dropbox.com/scl/fi/mw4sk0dvdk2r8ux9g1lfc/encoder.zip?rlkey=qwnelw8d920jlum14n1x44zku&st=70gqw7ba&dl=1', icon: 'https://i.postimg.cc/tCGFN5zh/mediaencoder.png' },
      { name: 'Illustrator', url: 'https://www.dropbox.com/scl/fi/aw95btp46onbyhk50gn7b/Illustrator.zip?rlkey=mvklovmenagfasuhr6clorbfj&st=0ds5v39w&dl=1', icon: 'https://i.postimg.cc/W1nm3kg2/illustrator.png' },
      { name: 'Lightroom Classic', url: 'https://www.dropbox.com/scl/fi/0p9rln704lc3qgqtjad9n/Lightroom-Classic.zip?rlkey=gp29smsg6t8oxhox80661k4gu&st=cdv50zpy&dl=1', icon: 'https://i.postimg.cc/K8rfMVSR/lightroom-classic.png' },
      { name: 'Office', url: 'https://www.dropbox.com/scl/fi/pcfv8ft3egcq4x6jzigny/Office2024.zip?rlkey=qbic04ie56dvoxzk1smri0hoo&st=1r1veinx&dl=1', icon: 'https://i.postimg.cc/fb8JmWgm/office.png' },
      { name: 'Photoshop', url: 'https://www.dropbox.com/scl/fi/8vf3d46sq1wj1rb55r4jz/Photoshop.zip?rlkey=6u0dpbfnqopfndwcwq1082f7a&st=5u4v6m3x&dl=1', icon: 'https://i.postimg.cc/HnzW5d2w/photoshop.png' },
      { name: 'Premiere', url: 'https://www.dropbox.com/scl/fi/1yqqufgow2v4rc93l6wu4/premiere.zip?rlkey=49ymly6zgzufwtijnf2se35tc&st=5i77afac&dl=1', icon: 'https://i.postimg.cc/g2JjVX1j/premiere-pro.png' }
    ];
    const grid = document.createElement('div');
    grid.className = 'install-grid crack-grid'; // Added class for specific styling
    // Reduce the gap between cards and adjust minimum card width to minimize unused space
    grid.style.gap = '0.25rem';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
    projects.forEach(({ name, url, icon }) => {
      const card = document.createElement('div');
      card.className = 'app-card';
      const header = document.createElement('div');
      header.className = 'app-header';
      const img = document.createElement('img');
      img.src = icon;
      img.alt = name;
      img.className = 'app-icon';
      // Enforce consistent dimensions for all icons within the crack installer
      img.style.width = '48px';
      img.style.height = '48px';
      img.style.objectFit = 'contain';
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
      pauseBtn.style.padding = '0.5rem 1rem'; // Compact
      pauseBtn.style.display = 'none';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'button button-secondary';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.padding = '0.5rem 1rem';
      cancelBtn.style.display = 'none';

      const controls = document.createElement('div');
      controls.className = 'controls';
      controls.style.display = 'flex';
      controls.style.alignItems = 'center';
      controls.appendChild(pauseBtn);
      controls.appendChild(cancelBtn);

      // Extra button for Clip Studio to replace the executable. It will be inserted
      // alongside the download button rather than inside the controls container.
      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'button button-secondary';
      replaceBtn.textContent = 'Replace EXE';
      // Narrower width – allow it to size to its content
      replaceBtn.style.minWidth = 'auto';
      replaceBtn.style.width = 'auto';
      replaceBtn.style.padding = '0.5rem 0.75rem';
      replaceBtn.style.display = 'none';
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

        // Disable button and prepare for download
        btn.disabled = true;
        // Preserve the original button text so we can restore it later if needed
        if (!btn.dataset.originalTextCrack) {
          btn.dataset.originalTextCrack = btn.textContent;
        }
        // Show initial preparation state on the button
        btn.textContent = 'Preparing download...';
        // Hide the status element during progress; it will only be used for errors
        status.textContent = '';
        status.style.display = 'none';
        // Hide the progress bar, as progress will be indicated on the button itself
        progressContainer.style.display = 'none';
        // Ensure replace button is hidden at start
        replaceBtn.style.display = 'none';

        const downloadId = `${cardId}-${Date.now()}`;

        unsubscribe = window.api.onDownloadEvent(async (data) => {
          if (data.id !== downloadId) return;

          switch (data.status) {
            case 'started':
              // Reset progress bar width for internal use
              progressFill.style.width = '0%';
              // Show progress on the button
              btn.textContent = 'Downloading... 0%';
              break;

            case 'progress':
              // Update progress bar internally but keep it hidden
              progressFill.style.width = `${data.percent}%`;
              // Reflect progress percentage on the button text
              btn.textContent = `Downloading... ${data.percent}%`;
              break;

            case 'complete': {
              // Mark the download as complete on the button
              btn.textContent = 'Download complete! Extracting...';
              // Hide pause/cancel controls
              pauseBtn.style.display = 'none';
              cancelBtn.style.display = 'none';
              try {
                const extractResult = await window.api.extractArchive(data.path, '123');

                if (extractResult.success) {
                  // Indicate extraction completion and installer launching
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
                        // For Clip Studio, prompt user to complete installation and then replace EXE
                        btn.textContent = 'Installation in Progress';
                        completeProcess(cardId, 'download', true);
                        // Show the replace button next to the download button with a reduced width
                        replaceBtn.style.display = 'inline-block';
                        replaceBtn.disabled = false;
                        // Informational toast (ignored for non-error types)
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
                // Restore button text and notify user of error
                btn.textContent = btn.dataset.originalTextCrack || btn.textContent;
                btn.disabled = false;
                // Show error toast
                toast(error.message || 'An error occurred during installation', {
                  type: 'error',
                  title: name
                });
                completeProcess(cardId, 'download', false);
              } finally {
                // Ensure the progress bar remains hidden
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
              }
              break;
            }

            case 'error':
            case 'cancelled': {
              // On error or cancellation, restore the button to its original state
              btn.textContent = btn.dataset.originalTextCrack || btn.textContent;
              btn.disabled = false;
              // Show error notification
              toast(data.error || 'Download cancelled', {
                type: 'error',
                title: name
              });
              completeProcess(cardId, 'download', false);
              // Hide controls and progress bar
              pauseBtn.style.display = 'none';
              cancelBtn.style.display = 'none';
              progressContainer.style.display = 'none';
              progressFill.style.width = '0%';
              // Hide replace button on error/cancellation
              replaceBtn.style.display = 'none';
              if (unsubscribe) unsubscribe();
              break;
            }
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
      // Wrap the download and replace buttons in a flex container so they sit
      // side by side. This wrapper is inserted before the controls.
      const buttonWrapper = document.createElement('div');
      buttonWrapper.style.display = 'flex';
      buttonWrapper.style.alignItems = 'center';
      buttonWrapper.style.gap = '0.5rem';
      buttonWrapper.appendChild(btn);
      buttonWrapper.appendChild(replaceBtn);

      card.appendChild(p);
      card.appendChild(buttonWrapper);
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
    firstRow.style.alignItems = 'stretch'; // Προσθήκη για ίδιο ύψος cards

    // Delete Temp Files card. The last boolean argument (true) indicates
    // that no inline status element should be displayed and that all
    // feedback will be presented via toast notifications.
    const tempCard = createMaintenanceCard(
      translations.maintenance.delete_temp_files || 'Delete Temp Files',
      translations.maintenance.temp_files_desc || 'Clean TEMP, %TEMP%, and Prefetch folders',
      '🧹',
      translations.actions.clean_temp_files || 'Clean Temp Files',
      cleanTempFiles,
      false,
      true
    );

    // Εφαρμογή ίδιου στυλ στο temp button
    const tempButton = tempCard.querySelector('button');
    tempButton.style.height = '40px';
    tempButton.style.minWidth = '100%';

    // SFC/DISM combined card
    const sfcDismCard = document.createElement('div');
    sfcDismCard.className = 'app-card';
    sfcDismCard.style.display = 'flex';
    sfcDismCard.style.flexDirection = 'column';

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
    sfcDismButtons.style.marginTop = 'auto'; // Σπρώχνει τα κουμπιά προς τα κάτω
    sfcDismButtons.style.alignItems = 'center';

    const sfcButton = document.createElement('button');
    sfcButton.className = 'button';
    sfcButton.textContent = translations.actions.run_sfc || 'Run SFC';
    sfcButton.style.flex = '1';
    sfcButton.style.minWidth = '0';
    sfcButton.style.height = '40px';

    const dismButton = document.createElement('button');
    dismButton.className = 'button';
    dismButton.textContent = translations.actions.run_dism || 'Run DISM';
    dismButton.style.flex = '1';
    dismButton.style.minWidth = '0';
    dismButton.style.height = '40px';

    const sfcDismStatus = document.createElement('pre');
    sfcDismStatus.className = 'status-pre';
    sfcDismStatus.style.display = 'none';
    sfcDismStatus.style.marginTop = '1rem';
    // Hide the inline status output for SFC and DISM tasks. All feedback will be provided via toast notifications.
    sfcDismStatus.dataset.hideStatus = 'true';

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

    // Εφαρμογή ίδιου στυλ στο patch button
    const patchButton = patchCard.querySelector('button');
    patchButton.style.height = '40px';
    patchButton.style.minWidth = '100%';

    // Make Patch My PC card full width
    patchCard.style.gridColumn = '1 / -1';

    secondRow.appendChild(patchCard);
    container.appendChild(secondRow);

    return container;
  }

  // Build the debloat page.  This page presents a single card with a
  // descriptive header and a button that executes registry tweaks to
  // disable Windows notifications suggestions and web search in the
  // Start menu.  When clicked, the button calls a backend IPC
  // handler which runs a PowerShell script with elevated
  // privileges.  Results and errors are surfaced to the user via
  // toast notifications, and the button is temporarily disabled to
  // prevent multiple simultaneous runs.
  /**
   * Build the Debloat page.  This UI allows the user to select
   * individual debloat tasks grouped by category, or simply run
   * a recommended set of tasks.  Each task corresponds to a
   * registry tweak or system change executed via a PowerShell
   * script in the main process.  When the "Run Selected Tasks"
   * button is pressed, an IPC message is sent with the chosen
   * identifiers to assemble and execute the script.
   */
  async function buildDebloatPage() {
    const container = document.createElement('div');
    container.className = 'card';

    // Page title and description
    const title = document.createElement('h2');
    title.textContent = (translations.pages?.debloat_title) || 'Debloat & Windows Tweaks';
    container.appendChild(title);
    const desc = document.createElement('p');
    desc.textContent = (translations.pages?.debloat_desc) ||
      'Select which debloat operations you wish to apply. Recommended tasks are pre‑selected. Administrator privileges may be required. A restart is recommended after applying changes.';
    desc.style.opacity = '0.8';
    desc.style.marginBottom = '1.5rem';
    container.appendChild(desc);

    // Define the list of available debloat tasks.  Each task has a
    // unique key, a category for grouping in the UI, a human‑readable
    // label and a default recommended setting.  Some tasks have a
    // `type` property to indicate special handling (e.g. choice
    // selection).  When adding new tasks, ensure the key matches
    // corresponding logic in the main process.
    const debloatTasks = [
      { key: 'removePreinstalledApps', category: 'App Removal', label: 'Remove preinstalled apps', recommended: false },
      // Telemetry, tracking & suggestions
      { key: 'disableTelemetry', category: 'Telemetry & Tracking', label: 'Disable telemetry & diagnostic data', recommended: true },
      { key: 'disableActivityHistory', category: 'Telemetry & Tracking', label: 'Disable activity history', recommended: true },
      { key: 'disableAppLaunchTracking', category: 'Telemetry & Tracking', label: 'Disable app‑launch tracking', recommended: true },
      { key: 'disableTargetedAds', category: 'Telemetry & Tracking', label: 'Disable targeted ads & tailored experiences', recommended: true },
      { key: 'disableTipsSuggestions', category: 'Telemetry & Tracking', label: 'Disable tips, suggestions & ads across Windows', recommended: true },
      { key: 'disableSpotlight', category: 'Telemetry & Tracking', label: 'Disable Windows Spotlight background (W11 only)', recommended: false },
      // Bing, Copilot & AI features
      { key: 'disableBingSearch', category: 'Search, Copilot & AI', label: 'Disable Bing web search & Cortana', recommended: true },
      { key: 'disableCopilot', category: 'Search, Copilot & AI', label: 'Disable Microsoft Copilot', recommended: true },
      { key: 'disableStickyKeys', category: 'Search, Copilot & AI', label: 'Disable Sticky Keys shortcut (W11 only)', recommended: false },
      { key: 'restoreClassicContextMenu', category: 'Search, Copilot & AI', label: 'Restore Windows 10 style context menu (W11 only)', recommended: false },
      // File Explorer & Taskbar customisation
      { key: 'showFileExtensions', category: 'Explorer & Taskbar', label: 'Show file extensions for known file types', recommended: true },
      { key: 'hideTaskviewButton', category: 'Explorer & Taskbar', label: 'Hide the Task View button (W11 only)', recommended: false },
      { key: 'disableWidgets', category: 'Explorer & Taskbar', label: 'Disable widgets on taskbar & lockscreen', recommended: true },
      // Search bar mode selection.  Use a choice instead of a boolean.
      {
        key: 'searchBarMode',
        category: 'Explorer & Taskbar',
        label: 'Search bar style',
        type: 'choice',
        // Use -1 to indicate that no change should be made.  This
        // prevents the search bar from being modified every time
        // tasks are run unless the user explicitly chooses a mode.
        recommended: -1,
        choices: [
          { value: -1, label: 'Leave unchanged' },
          { value: 0, label: 'Hide search' },
          { value: 1, label: 'Show search icon only' },
          { value: 2, label: 'Show search box' }
        ]
      }
      // Additional tasks can be appended here in the future
    ];

    // Prepare a log output element reference.  It will be created
    // later near the footer.  We declare it here so the run
    // handler can close over it.
    let logOutput;

    // Determine if the platform is Windows; hide the page otherwise.
    const isWindows = await window.api.isWindows();
    if (!isWindows) {
      const warn = document.createElement('p');
      warn.textContent = 'Debloat tasks are only available on Windows.';
      warn.style.color = 'var(--error-color)';
      container.appendChild(warn);
      return container;
    }

    // Group tasks by category
    const groups = {};
    debloatTasks.forEach((task) => {
      if (!groups[task.category]) groups[task.category] = [];
      groups[task.category].push(task);
    });

    // Fetch the list of installed preinstalled apps once at the
    // beginning.  This will be used for the app removal section.  If
    // the call fails or returns nothing, we default to an empty list.
    let installedApps = [];
    try {
      installedApps = await window.api.getPreinstalledApps();
    } catch (err) {
      console.warn('Failed to get preinstalled apps:', err);
      installedApps = [];
    }

    // Create a wrapper for task groups
    const groupsWrapper = document.createElement('div');
    groupsWrapper.className = 'debloat-groups';
    groupsWrapper.style.display = 'flex';
    groupsWrapper.style.flexDirection = 'column';
    groupsWrapper.style.gap = '1.2rem';

    // Keep track of checkbox elements by task key for easy access.  In
    // addition, maintain maps for app removal checkboxes and choice
    // selections (e.g. search bar mode).
    const checkboxMap = new Map();
    const appCheckboxMap = new Map();
    const choiceMap = new Map();

    Object.keys(groups).forEach((category) => {
      const tasks = groups[category];
      const groupCard = document.createElement('div');
      groupCard.className = 'debloat-group-card';
      groupCard.style.border = '1px solid var(--border-color, #333)';
      groupCard.style.borderRadius = '8px';
      groupCard.style.padding = '1rem';
      groupCard.style.background = 'var(--card-bg, rgba(255,255,255,0.02))';

      const header = document.createElement('h3');
      header.textContent = category;
      header.style.margin = '0 0 0.75rem 0';
      header.style.fontSize = '1rem';
      header.style.color = 'var(--primary-color)';
      groupCard.appendChild(header);

      tasks.forEach((task) => {
        // For tasks that are simple booleans (type undefined), create
        // a checkbox.  For choice tasks, create radio buttons or a
        // select as appropriate.
        if (!task.type || task.type !== 'choice') {
          // Wrap each checkbox and its label in a flex row.  Using a
          // separate label with a `for` attribute ensures the user
          // can click the text to toggle the checkbox.  This avoids
          // issues where nested labels prevent checking/unchecking.
          const row = document.createElement('div');
          row.className = 'debloat-task-row';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.marginBottom = '0.4rem';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.id = `debloat-${task.key}`;
          cb.checked = !!task.recommended;
          checkboxMap.set(task.key, cb);
          const labelEl = document.createElement('label');
          labelEl.setAttribute('for', cb.id);
          labelEl.textContent = task.label;
          labelEl.style.marginLeft = '0.5rem';
          row.appendChild(cb);
          row.appendChild(labelEl);
          groupCard.appendChild(row);
          // If this is the preinstalled apps task, build a list of
          // installed applications and allow the user to choose which
          // to remove.  The list is hidden until the checkbox is
          // checked.  We use a scrollable container to avoid overly
          // long pages.
          if (task.key === 'removePreinstalledApps') {
            const appsWrapper = document.createElement('div');
            appsWrapper.style.display = cb.checked ? 'block' : 'none';
            appsWrapper.style.marginLeft = '1.5rem';
            appsWrapper.style.marginTop = '0.4rem';
            appsWrapper.style.maxHeight = '200px';
            appsWrapper.style.overflowY = 'auto';
            if (installedApps.length === 0) {
                // If no removable apps were detected, inform the user
                const info = document.createElement('div');
                info.innerHTML = `
                    <div style="color: var(--warning-color); margin-bottom: 0.5rem;">
                        No removable built‑in apps were detected automatically.
                    </div>
                    <div style="font-size: 0.9rem; opacity: 0.8;">
                        You can still proceed - common bloatware will be targeted.
                    </div>
                `;
                appsWrapper.appendChild(info);
            } else {
                // Create a checkbox for each installed app - ONLY FRIENDLY NAME
                installedApps.forEach((app) => {
                    const appRow = document.createElement('div');
                    appRow.style.display = 'flex';
                    appRow.style.alignItems = 'center';
                    appRow.style.marginBottom = '0.5rem';
                    appRow.style.padding = '0.4rem';
                    appRow.style.borderRadius = '4px';
                    appRow.style.background = 'rgba(255,255,255,0.03)';
                    
                    const appCb = document.createElement('input');
                    appCb.type = 'checkbox';
                    appCb.id = `debloat-app-${app.id}`;
                    appCb.dataset.appId = app.id;
                    appCb.checked = false;
                    
                    const appLabel = document.createElement('label');
                    appLabel.setAttribute('for', appCb.id);
                    appLabel.textContent = app.name; // ΜΟΝΟ ΤΟ ΟΝΟΜΑ
                    appLabel.style.marginLeft = '0.75rem';
                    appLabel.style.flex = '1';
                    appLabel.style.fontSize = '0.95rem';
                    appLabel.style.cursor = 'pointer';
                    
                    appRow.appendChild(appCb);
                    appRow.appendChild(appLabel);
                    appsWrapper.appendChild(appRow);
                    appCheckboxMap.set(app.id, appCb);
                });
            }
            // Show/hide based on checkbox
            cb.addEventListener('change', () => {
              appsWrapper.style.display = cb.checked ? 'block' : 'none';
            });
            groupCard.appendChild(appsWrapper);
          }
        } else if (task.type === 'choice') {
          // Render a radio group for tasks that require selecting one of
          // multiple values.  Use the provided choices array.  The
          // recommended value indicates which choice should be
          // preselected.  Apply custom classes to use the fancy
          // circular radio style defined in styles.css.
          const choiceWrapper = document.createElement('div');
          choiceWrapper.classList.add('radio-input');
          choiceWrapper.style.display = 'flex';
          choiceWrapper.style.flexDirection = 'column';
          choiceWrapper.style.marginBottom = '0.6rem';
          const choiceLabel = document.createElement('div');
          choiceLabel.textContent = task.label;
          choiceLabel.style.marginBottom = '0.3rem';
          choiceWrapper.appendChild(choiceLabel);
          const choiceGroupName = `debloat-choice-${task.key}`;
          task.choices.forEach((opt) => {
            const optRow = document.createElement('div');
            optRow.style.display = 'flex';
            optRow.style.alignItems = 'center';
            optRow.style.marginBottom = '0.25rem';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = choiceGroupName;
            radio.id = `${choiceGroupName}-${opt.value}`;
            radio.value = String(opt.value);
            radio.checked = opt.value === task.recommended;
            // Apply the custom class to get the fancy styling
            radio.classList.add('input');
            const rLabel = document.createElement('label');
            rLabel.setAttribute('for', radio.id);
            rLabel.textContent = opt.label;
            rLabel.style.marginLeft = '0.5rem';
            optRow.appendChild(radio);
            optRow.appendChild(rLabel);
            choiceWrapper.appendChild(optRow);
          });
          // Store a function to read the selected value when running
          choiceMap.set(task.key, () => {
            const selectedRadio = choiceWrapper.querySelector(`input[name="${choiceGroupName}"]:checked`);
            return selectedRadio ? parseInt(selectedRadio.value, 10) : task.recommended;
          });
          groupCard.appendChild(choiceWrapper);
        }
      });

      groupsWrapper.appendChild(groupCard);
    });

    container.appendChild(groupsWrapper);

    // Create a footer with control buttons
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.flexWrap = 'wrap';
    footer.style.gap = '1rem';
    footer.style.marginTop = '1.5rem';

    // Button to restore recommended selections
    const defaultBtn = document.createElement('button');
    // Use the secondary style for the restore button
    defaultBtn.className = 'button-secondary';
    defaultBtn.textContent = 'Restore Recommended';
    defaultBtn.addEventListener('click', () => {
      debloatTasks.forEach((task) => {
        const cb = checkboxMap.get(task.key);
        if (cb) cb.checked = !!task.recommended;
        // Reset any app removal selections when unchecking
        if (task.key === 'removePreinstalledApps') {
          appCheckboxMap.forEach((appCb) => {
            appCb.checked = false;
          });
        }
        // Reset choice selections to the recommended value
        if (task.type === 'choice') {
          const getter = choiceMap.get(task.key);
          // Find all radios associated with this choice and select
          // the one matching the recommended value
          const groupName = `debloat-choice-${task.key}`;
          const radios = document.querySelectorAll(`input[name="${groupName}"]`);
          radios.forEach((radio) => {
            radio.checked = parseInt(radio.value, 10) === task.recommended;
          });
        }
      });
    });
    footer.appendChild(defaultBtn);

    // Run selected tasks button
    const runBtn = document.createElement('button');
    runBtn.className = 'button';
    runBtn.textContent = 'Run Selected Tasks';
    runBtn.addEventListener('click', async () => {
      if (runBtn.disabled) return;
      const selectedTasks = [];
      const removeApps = [];
      // Determine which boolean tasks are checked.  Do not include
      // choice tasks here; they are handled separately via choiceMap.
      checkboxMap.forEach((cb, key) => {
        if (cb.checked) {
          selectedTasks.push(key);
        }
      });
      // Gather selected app package names if the removePreinstalledApps
      // task is selected.  Only include names where the checkbox is
      // checked.
      if (selectedTasks.includes('removePreinstalledApps')) {
          appCheckboxMap.forEach((appCb, appId) => {
              if (appCb.checked) {
                  removeApps.push(appId); // Χρησιμοποιούμε το ID για removal
              }
          });
      }
      // Extract the selected search bar mode from the choice map.  If
      // no entry exists, default to null so the backend can ignore it.
      let searchBarMode = null;
      const modeGetter = choiceMap.get('searchBarMode');
      if (modeGetter) {
        const value = modeGetter();
        // Treat -1 as 'no change'
        searchBarMode = (value === -1 ? null : value);
      }
      if (selectedTasks.length === 0 && searchBarMode === null) {
        toast('Please select at least one task or configure the search bar.', {
          type: 'info',
          title: 'No tasks selected',
          duration: 5000
        });
        return;
      }
      const original = runBtn.textContent;
      runBtn.disabled = true;
      runBtn.textContent = 'Running...';
      try {
        const result = await window.api.runDebloatTasks({ selectedTasks, removeApps, searchBarMode });
        // Show the log output if available
        if (result && result.log && logOutput) {
          logOutput.textContent = result.log;
          logOutput.style.display = 'block';
        }
        if (result && result.success) {
          toast(result.message || 'Debloat completed successfully', {
            type: 'success',
            title: 'Debloat',
            duration: 7000
          });
        } else {
          const errMsg = (result && result.error) || 'Debloat failed';
          toast(errMsg, {
            type: 'error',
            title: 'Debloat Error',
            duration: 8000
          });
        }
      } catch (err) {
        toast(err.message || 'An unexpected error occurred', {
          type: 'error',
          title: 'Debloat Error',
          duration: 8000
        });
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = original;
      }
    });
    footer.appendChild(runBtn);

    // Area for displaying the PowerShell log output after running tasks.
    logOutput = document.createElement('pre');
    logOutput.className = 'debloat-log-output';
    logOutput.style.display = 'none';
    logOutput.style.whiteSpace = 'pre-wrap';
    logOutput.style.background = 'rgba(0,0,0,0.4)';
    logOutput.style.padding = '0.75rem';
    logOutput.style.marginTop = '1rem';
    logOutput.style.maxHeight = '15rem';
    logOutput.style.overflowY = 'auto';
    logOutput.style.fontSize = '0.8rem';
    logOutput.style.borderRadius = '6px';
    container.appendChild(logOutput);

    container.appendChild(footer);

    return container;
  }

  // Helper function to create maintenance cards
  // Additional boolean argument `hideStatus` controls whether the status element
  // should be visible. When true, the status <pre> will not display and
  // feedback will only be shown via toast notifications.
  function createMaintenanceCard(name, description, icon, buttonText, taskFunction, requiresAdmin = false, hideStatus = false) {
    const card = document.createElement('div');
    card.className = 'app-card';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

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
    button.style.marginTop = 'auto'; // Σπρώχνει το κουμπί προς τα κάτω

    const status = document.createElement('pre');
    status.className = 'status-pre';
    status.style.display = 'none';
    // Mark this status element to be hidden if requested. The dataset
    // attribute allows runMaintenanceTask to detect tasks that should
    // not display inline output.
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

  // Helper function to run maintenance tasks
  // Helper function to run maintenance tasks
  async function runMaintenanceTask(button, statusElement, taskFunction, taskName, requiresAdmin = false) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Running...';
    // Check whether the status output should be hidden. A dataset
    // attribute set on the status element by createMaintenanceCard
    // indicates that the inline status area should not be displayed.
    const hideStatus = statusElement && statusElement.dataset && statusElement.dataset.hideStatus === 'true';

    if (!hideStatus) {
      statusElement.style.display = 'block';
      if (requiresAdmin) {
        statusElement.textContent = `Running ${taskName}...\n⚠️ This task may require Administrator privileges\n`;
      } else {
        statusElement.textContent = `Running ${taskName}...\n`;
      }
      statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    }

    try {
      // Pass the button to the taskFunction so it can update its own label during downloads
      await taskFunction(statusElement, button);
    } catch (error) {
      if (!hideStatus) {
        statusElement.textContent += `\n❌ Error: ${error.message}`;
        statusElement.classList.add('status-error');
      }
      // Always show a toast error message
      toast(`Error running ${taskName}`, { type: 'error', title: 'Maintenance' });
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      // Only fade the status element if it was displayed
      if (!hideStatus) {
        autoFadeStatus(statusElement, 8000);
      }
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
    // Do not update the inline status element for SFC. The button text indicates progress and
    // a toast will be displayed when the scan finishes or fails.
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

  // Simplified DISM Repair function - opens CMD window
  async function runDismRepair(statusElement) {
    // Do not update the inline status element for DISM. Only display a toast when the repair finishes.
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

  // Temp Files Cleanup function. This function triggers the backend cleanup process
  // and displays toast notifications based on its outcome. No inline status is used
  // for this task because the cleanup may take a while and we only want to notify
  // the user when it has finished or failed.
  async function cleanTempFiles(statusElement) {
    try {
      const result = await window.api.runTempCleanup();
      if (result && result.success) {
        // On success, display the returned message or a default completion message
        toast(result.message || 'Temporary files cleanup completed successfully!', { type: 'success', title: 'Maintenance' });
      } else {
        // On failure, determine if the UAC prompt was denied or another error occurred
        const errorMsg = (result && result.error) || 'Temporary files cleanup failed.';
        toast(errorMsg, { type: 'error', title: 'Maintenance' });
      }
    } catch (error) {
      // Unexpected errors
      const msg = (error && error.message) || 'Error running temp cleanup';
      toast(msg, { type: 'error', title: 'Maintenance' });
    }
  }
  // Helper function to run maintenance tasks
  async function runMaintenanceTask(button, statusElement, taskFunction, taskName) {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Running...';
    // Determine whether to hide the status area. A dataset flag
    // on the status element indicates tasks that should not show inline output.
    const hideStatus = statusElement && statusElement.dataset && statusElement.dataset.hideStatus === 'true';

    if (!hideStatus) {
      statusElement.style.display = 'block';
      statusElement.textContent = `Running ${taskName}...`;
      statusElement.classList.remove('status-success', 'status-error', 'status-warning');
    }
    try {
      // Pass the button to the taskFunction so it can update its own label during downloads
      await taskFunction(statusElement, button);
    } catch (error) {
      if (!hideStatus) {
        statusElement.textContent = `Error: ${error.message}`;
        statusElement.classList.add('status-error');
      }
      // Show an error toast regardless of status visibility
      toast(`Error running ${taskName}`, { type: 'error', title: 'Maintenance' });
    } finally {
      button.disabled = false;
      button.textContent = originalText;
      if (!hideStatus) {
        autoFadeStatus(statusElement, 5000);
      }
    }
  }
  // Function to download and run Patch My PC
  // Function to download and run Patch My PC
async function downloadAndRunPatchMyPC(statusElement, button) {
    // Use a unique ID for this download
    const downloadId = `patchmypc-${Date.now()}`;
    const patchMyPCUrl = 'https://www.dropbox.com/scl/fi/z66qn3wgiyvh8uy3fedu7/patch_my_pc.exe?rlkey=saht980hb3zfezv2ixve697jo&st=3ww4r4vy&dl=1';

    // Hide any existing status text – progress will be shown on the button
    statusElement.textContent = '';
    statusElement.style.display = 'none';
    statusElement.classList.remove('status-success', 'status-error', 'status-warning');

    // Preserve the original button text to restore it later
    const originalText = button.textContent;
    if (!button.dataset.originalTextPatch) {
      button.dataset.originalTextPatch = originalText;
    }
    // Disable the button and show initial message
    button.disabled = true;
    button.textContent = 'Preparing Patch My PC...';

    return new Promise((resolve) => {
      const unsubscribe = window.api.onDownloadEvent((data) => {
        if (data.id !== downloadId) return;

        switch (data.status) {
          case 'started':
            // Show initial progress on the button
            button.textContent = 'Downloading Patch My PC... 0%';
            break;
          case 'progress':
            // Update progress percentage on the button
            button.textContent = `Downloading Patch My PC... ${data.percent}%`;
            break;
          case 'complete': {
            // Indicate that the download is done and we are opening the application
            button.textContent = 'Opening Patch My PC...';
            // Attempt to open the downloaded file
            window.api.openFile(data.path)
              .then((result) => {
                if (result.success) {
                  // Show that the program has been opened successfully on the button
                  button.textContent = 'Patch My PC Started';
                } else {
                  // Revert the button text and inform via toast that opening failed
                  button.textContent = originalText;
                  toast('Failed to open Patch My PC', {
                    type: 'error',
                    title: 'Maintenance'
                  });
                }
              })
              .catch((error) => {
                // On error opening file, restore original button and show toast
                button.textContent = originalText;
                toast('Error opening Patch My PC', {
                  type: 'error',
                  title: 'Maintenance'
                });
              })
              .finally(() => {
                // Clean up and resolve regardless of outcome
                button.disabled = false;
                unsubscribe();
                resolve();
              });
            break;
          }
          case 'error':
            // On download error, revert the button and show a toast
            button.textContent = originalText;
            button.disabled = false;
            toast('Download failed', {
              type: 'error',
              title: 'Maintenance'
            });
            unsubscribe();
            resolve();
            break;
        }
      });

      // Kick off the download
      try {
        window.api.downloadStart(downloadId, patchMyPCUrl, 'PatchMyPC.exe');
      } catch (e) {
        // In case download fails to start, restore button and notify the user
        button.textContent = originalText;
        button.disabled = false;
        toast('Download failed', {
          type: 'error',
          title: 'Maintenance'
        });
        unsubscribe();
        resolve();
      }
    });
  }
  // Update buildPasswordManagerPage function
  function buildPasswordManagerPage() {
    const container = document.createElement('div');
    container.className = 'card password-manager-card';

    // Enhanced warning banner
    const warning = document.createElement('div');
    warning.className = 'password-warning-banner';

    const warningIcon = document.createElement('div');
    warningIcon.className = 'warning-icon';
    warningIcon.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    `;

    const warningContent = document.createElement('div');
    warningContent.className = 'warning-content';

    const warningTitle = document.createElement('div');
    warningTitle.className = 'warning-title';
    warningTitle.textContent = translations.messages.security_notice || 'Security Notice';

    const warningText = document.createElement('div');
    warningText.className = 'warning-text';
    warningText.textContent = translations.messages.password_warning || 'Your passwords are stored securely encrypted on your local device only.';

    warningContent.appendChild(warningTitle);
    warningContent.appendChild(warningText);
    warning.appendChild(warningIcon);
    warning.appendChild(warningContent);
    container.appendChild(warning);

    // Features list
    const features = document.createElement('div');
    features.className = 'password-features';

    const featuresList = [
      { icon: '🔐', text: translations.messages.encrypted_storage || 'Military-grade encryption' },
      { icon: '💾', text: translations.messages.local_storage || 'Local storage only' },
      { icon: '⚡', text: translations.messages.quick_access || 'One-click autofill' },
      { icon: '🔍', text: translations.messages.secure_search || 'Encrypted search' }
    ];

    featuresList.forEach(feature => {
      const featureItem = document.createElement('div');
      featureItem.className = 'feature-item';

      const featureIcon = document.createElement('span');
      featureIcon.className = 'feature-icon';
      featureIcon.textContent = feature.icon;

      const featureText = document.createElement('span');
      featureText.className = 'feature-text';
      featureText.textContent = feature.text;

      featureItem.appendChild(featureIcon);
      featureItem.appendChild(featureText);
      features.appendChild(featureItem);
    });

    container.appendChild(features);

    // Action section
    const actionSection = document.createElement('div');
    actionSection.className = 'password-actions';

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
      {
        icon: '🔓',
        variant: 'primary',
        size: 'large'
      }
    );
    btn.className = 'password-manager-btn';

    actionSection.appendChild(btn);
    container.appendChild(actionSection);

    return container;
  }

  // Προσθήκη των νέων στύλ στο υπάρχον CSS
  const passwordManagerStyles = `
.password-manager-card {
    max-width: 520px;
    margin: 0 auto;
    padding: 2rem;
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    border-radius: 18px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(10px);
    min-height: 360px;
    height: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.password-warning-banner {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.25rem;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.06) 100%);
    border: 1px solid var(--warning-color);
    border-radius: 14px;
    margin-bottom: 2rem;
    backdrop-filter: blur(8px);
    position: relative;
    overflow: hidden;
    min-height: 80px;
}

.password-warning-banner::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--warning-color) 0%, #fbbf24 100%);
}

.warning-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: rgba(245, 158, 11, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 0.1rem;
}

.warning-icon svg {
    width: 20px;
    height: 20px;
    color: var(--warning-color);
}

.warning-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 44px;
}

.warning-title {
    font-weight: 700;
    color: var(--warning-color);
    margin-bottom: 0.5rem;
    font-size: 1.1rem;
}

.warning-text {
    color: var(--text-color);
    opacity: 0.9;
    line-height: 1.5;
    font-size: 0.95rem;
}

.password-features {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
    flex: 1;
}

.feature-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    transition: all 0.2s ease;
    min-height: 60px;
}

.feature-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: var(--accent-color);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-icon {
    font-size: 1.4rem;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
}

.feature-text {
    color: var(--text-color);
    font-size: 0.95rem;
    font-weight: 600;
    opacity: 0.9;
    line-height: 1.4;
}

.password-actions {
    display: flex;
    justify-content: center;
    margin-top: auto;
}

.password-manager-btn {
    width: 100%;
    padding: 1.25rem 2rem;
    font-size: 1.1rem;
    font-weight: 700;
    border-radius: 14px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
    max-width: none;
    min-height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
}

.password-manager-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.6s ease;
}

.password-manager-btn:hover::before {
    left: 100%;
}

.password-manager-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0, 191, 255, 0.4);
}

/* Responsive design */
@media (max-width: 768px) {
    .password-manager-card {
        padding: 1.75rem;
        margin: 0 1rem;
        max-width: none;
        min-height: 340px;
    }
    
    .password-features {
        grid-template-columns: 1fr;
        gap: 0.875rem;
        margin-bottom: 1.75rem;
    }
    
    .feature-item {
        padding: 0.875rem;
        min-height: 56px;
    }
    
    .password-warning-banner {
        padding: 1.125rem;
        margin-bottom: 1.75rem;
        min-height: 76px;
    }
    
    .warning-icon {
        width: 40px;
        height: 40px;
    }
    
    .warning-icon svg {
        width: 18px;
        height: 18px;
    }
    
    .password-manager-btn {
        padding: 1.125rem 1.75rem;
        font-size: 1.05rem;
        min-height: 56px;
    }
}

@media (max-width: 480px) {
    .password-manager-card {
        padding: 1.5rem;
        margin: 0 0.75rem;
        border-radius: 16px;
        min-height: 320px;
    }
    
    .password-features {
        gap: 0.75rem;
    }
    
    .feature-item {
        padding: 0.75rem;
        min-height: 52px;
        gap: 0.625rem;
    }
    
    .feature-icon {
        font-size: 1.3rem;
        width: 24px;
    }
    
    .feature-text {
        font-size: 0.9rem;
    }
    
    .password-warning-banner {
        padding: 1rem;
        gap: 0.75rem;
        min-height: 72px;
    }
    
    .warning-title {
        font-size: 1rem;
    }
    
    .warning-text {
        font-size: 0.9rem;
    }
    
    .password-manager-btn {
        padding: 1rem 1.5rem;
        font-size: 1rem;
        min-height: 52px;
    }
}
`;

  // Προσθήκη των στύλ στο document αν δεν υπάρχουν ήδη
  if (!document.querySelector('#password-manager-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'password-manager-styles';
    styleSheet.textContent = passwordManagerStyles;
    document.head.appendChild(styleSheet);
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
  // === Chris Titus / Windows Utility — full-width, scoped styles, line icon ===
  // === Helper: inline SVG → data URL ===
  const svgDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

  // === Chris Titus / Windows Utility — full-width, scoped styles, terminal icon ===
  function buildChrisTitusPage() {
    const el = (t, cls, html) => {
      const n = document.createElement(t);
      if (cls) n.className = cls;
      if (html !== undefined) n.innerHTML = html;
      return n;
    };

    const card = el('section', 'ctt-card');

    // Scoped CSS (δεν επηρεάζει άλλα μέρη της εφαρμογής)
    const style = document.createElement('style');

    card.appendChild(style);

    // Header (SVG terminal)
    const header = el('div', 'ctt-header');
    const icon = el('img', 'ctt-icon');
    const terminalSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="#1ea8ff" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>`;
    icon.src = svgDataUrl(terminalSVG);

    const titles = el('div', null, `
    <h2 class="ctt-title">Windows Utility</h2>
    <p class="ctt-sub">COMPREHENSIVE TOOLBOX FOR WINDOWS OPTIMIZATION</p>
  `);
    header.appendChild(icon);
    header.appendChild(titles);
    card.appendChild(header);

    // Bullets
    card.appendChild(el('ul', 'ctt-bullets', `
    <li>System optimization and tweaks</li>
    <li>Remove bloatware and unwanted apps</li>
    <li>Privacy and security enhancements</li>
    <li>Essential software installation</li>
  `));

    // Actions
    const actions = el('div', 'ctt-actions');
    const launchBtn = el('button', 'ctt-launch', `<span class="ctt-iconmono">›_</span>Launch Tool`);
    const ghBtn = el('button', 'ctt-outline', `<span class="ctt-iconmono">↗</span>GitHub`);
    actions.appendChild(launchBtn);
    actions.appendChild(ghBtn);
    card.appendChild(actions);

    // Status
    const status = el('div', 'ctt-status');
    card.appendChild(status);
    const setStatus = (msg, type = '') => {
      status.className = 'ctt-status show' + (type ? ' ' + type : '');
      status.textContent = msg || '';
    };

    // Actions wiring
    const psCmd = [
      'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `"irm christitus.com/win | iex"`
    ].join(' ');

    launchBtn.addEventListener('click', async () => {
      try {
        launchBtn.disabled = true;
        setStatus('Downloading & launching Windows Utility...');
        if (window.api?.runCommand) {
          await window.api.runCommand(psCmd);
          setStatus('Utility launched in a new PowerShell window. Follow the on-screen prompts.', 'success');
        } else {
          await navigator.clipboard.writeText(psCmd);
          setStatus('Electron bridge not found. Command copied to clipboard — run in elevated PowerShell.', 'error');
        }
      } catch (e) {
        setStatus('Failed to launch: ' + e.message, 'error');
      } finally {
        launchBtn.disabled = false;
      }
    });

    ghBtn.addEventListener('click', async () => {
      if (window.api?.openExternal) await window.api.openExternal('https://github.com/ChrisTitusTech/winutil');
      else window.open('https://github.com/ChrisTitusTech/winutil', '_blank');
    });

    return card;
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
    let lastUpdateData = null;
    const updateButton = document.createElement('button');
    updateButton.id = 'update-btn';
    updateButton.setAttribute('aria-label', 'Check for updates');
    const bellIconPath = 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
    const errorIconPath = 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 14a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0-4a1 1 0 0 1-1-1V7a1 1 0 0 1 2 0v4a1 1 0 0 1-1 1Z';
    updateButton.innerHTML = `
    <div class="badge">
      <span class="ping"></span>
      <span class="num">0</span>
    </div>
    <div class="outer">
      <div class="inner">
        <div class="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="${bellIconPath}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></path>
          </svg>
          <div class="icon-blur"></div>
        </div>
        <div class="content">
          <span class="title">New Updates</span>
          <span class="subtitle">Check your notifications</span>
        </div>
        <div class="indicators" aria-hidden="true">
          <div></div><div></div><div></div>
        </div>
      </div>
      <div class="extra"></div>
    </div>
  `;
    updateButton.style.display = 'none';
    updateButton.addEventListener('click', () => {
      if (!lastUpdateData) {
        try {
          if (window.api && typeof window.api.checkForUpdates === 'function') {
            window.api.checkForUpdates();
          }
        } catch (_) { }
        return;
      }
      // Otherwise toggle the expanded state
      const expanded = updateButton.classList.toggle('expanded');
      if (expanded) {
        renderExpandedContent(lastUpdateData);
      }
    });
    document.body.appendChild(updateButton);
    const updateCard = document.createElement('div');
    updateCard.id = 'update-card';
    updateCard.style.display = 'none';
    document.body.appendChild(updateCard);
    window.api.getAppVersion().then(version => {
      currentVersion = version;
    });
    window.api.onUpdateStatus((data) => {
      showUpdateNotification(data);
    });


    function renderExpandedContent(data) {
      const extra = updateButton.querySelector('.extra');
      if (!extra) return;
      extra.innerHTML = '';
      let message = '';
      let progressHtml = '';
      let actionsHtml = '';
      switch (data.status) {
        case 'checking':
          message = 'Checking for updates...';
          actionsHtml = `<button class="btn btn-secondary later">Close</button>`;
          break;
        case 'available':
          message = data.message || '';
          actionsHtml = `<button class="btn btn-primary download">Download</button><button class="btn btn-secondary later">Later</button>`;
          break;
        case 'downloading':
          message = data.message || 'Downloading update...';
          const percent = Math.round(data.percent || 0);
          progressHtml = `<div class="progress-bar"><div class="progress" style="width: ${percent}%;"></div></div>`;
          actionsHtml = `<button class="btn btn-secondary later">Later</button>`;
          break;
        case 'downloaded':
          message = data.message || 'Update downloaded. Restart to install.';
          actionsHtml = `<button class="btn btn-primary install">Restart & Install</button><button class="btn btn-secondary later">Later</button>`;
          break;
        case 'error':
          message = `Update error: ${data.message}`;
          actionsHtml = `<button class="btn btn-secondary later">Close</button>`;
          break;
      }
      if (message) {
        extra.innerHTML += `<div class="message">${message}</div>`;
      }
      if (progressHtml) {
        extra.innerHTML += progressHtml;
      }
      if (actionsHtml) {
        extra.innerHTML += `<div class="actions">${actionsHtml}</div>`;
      }
      // Attach event handlers to the action buttons
      const downloadBtn = extra.querySelector('.download');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          downloadBtn.disabled = true;
          downloadBtn.textContent = 'Downloading...';
          try {
            if (window.api && typeof window.api.downloadUpdate === 'function') {
              window.api.downloadUpdate();
            }
          } catch (_) { }
        });
      }
      const installBtn = extra.querySelector('.install');
      if (installBtn) {
        installBtn.addEventListener('click', () => {
          installBtn.disabled = true;
          installBtn.textContent = 'Installing...';
          try {
            if (window.api && typeof window.api.installUpdate === 'function') {
              window.api.installUpdate();
            }
          } catch (_) { }
        });
      }
      const laterBtns = extra.querySelectorAll('.later');
      laterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          updateButton.classList.remove('expanded');
        });
      });
    }

    function showUpdateNotification(data) {
      // Record the most recent update event and update the update button UI.
      lastUpdateData = data;
      // References to elements within the update button
      const titleEl = updateButton.querySelector('.title');
      const subtitleEl = updateButton.querySelector('.subtitle');
      const badgeEl = updateButton.querySelector('.badge');
      const numEl = badgeEl ? badgeEl.querySelector('.num') : null;
      const svgPath = updateButton.querySelector('.icon svg path');
      // Hide the button by default and remove any active/expanded state.
      updateButton.style.display = 'none';
      updateButton.classList.remove('active');
      // Reset collapsed text to default (will be overridden below for actionable statuses)
      if (numEl) numEl.textContent = '0';
      if (titleEl) titleEl.textContent = 'New Updates';
      if (subtitleEl) subtitleEl.textContent = 'Check your notifications';
      if (svgPath) svgPath.setAttribute('d', bellIconPath);

      // Determine collapsed UI based on update status
      switch (data.status) {
        case 'available': {
          if (numEl) numEl.textContent = '1';
          if (titleEl) titleEl.textContent = 'Update Available';
          if (subtitleEl) subtitleEl.textContent = 'Click to view details';
          updateButton.style.display = 'flex';
          updateButton.classList.add('active');
          break;
        }
        case 'downloading': {
          // During download, show progress in the subtitle.  Keep
          // the collapsed title generic.
          if (numEl) numEl.textContent = '1';
          if (titleEl) titleEl.textContent = 'Downloading…';
          if (subtitleEl) {
            const percent = Math.round(data.percent || 0);
            subtitleEl.textContent = `${percent}%`;
          }
          updateButton.style.display = 'flex';
          updateButton.classList.add('active');
          break;
        }
        case 'downloaded': {
          if (numEl) numEl.textContent = '1';
          if (titleEl) titleEl.textContent = 'Update Ready';
          if (subtitleEl) subtitleEl.textContent = 'Click to install';
          updateButton.style.display = 'flex';
          updateButton.classList.add('active');
          break;
        }
        case 'error':
          if (numEl) numEl.textContent = '!';
          if (titleEl) titleEl.textContent = 'Update Error';
          if (subtitleEl) subtitleEl.textContent = 'Click to view details';
          if (svgPath) svgPath.setAttribute('d', errorIconPath);
          updateButton.style.display = 'flex';
          updateButton.classList.add('active');
          break;
        default:
          // For non-actionable statuses (checking, not-available, or unknown), hide the button
          updateButton.classList.remove('expanded');
          updateButton.classList.remove('active');
          return;
      }
      // If expanded, update the extra content
      if (updateButton.classList.contains('expanded')) {
        renderExpandedContent(data);
      }
      return;
    }

  }


  // Initialize the application once
  init();
  async function ensureSidebarVersion() {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;

    // απόφυγε διπλό footer
    if (sidebar.querySelector('.sidebar-footer')) return;

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';

    const wrap = document.createElement('div');
    wrap.className = 'version-wrap';
    wrap.setAttribute('data-tooltip', 'App version');

    wrap.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span id="appVersion">dev</span>
  `;
    attachTooltipHandlers(wrap);

    footer.appendChild(wrap);
    sidebar.appendChild(footer);

    try {
      // Έλεγχος αν το API υπάρχει
      if (window.api && typeof window.api.getAppVersion === 'function') {
        console.log('📦 Fetching app version from API...');
        const version = await window.api.getAppVersion();
        console.log('📦 Version received:', version);

        if (version && version !== '000' && version !== '0.0.0') {
          document.getElementById('appVersion').textContent = `v${version}`;
        } else {
          // Fallback αν η έκδοση είναι 000
          document.getElementById('appVersion').textContent = 'v1.0.0';
          console.warn('⚠️ Version returned 000, using fallback');
        }
      } else {
        console.warn('⚠️ getAppVersion API not available');
        document.getElementById('appVersion').textContent = 'v1.0.0';
      }
    } catch (error) {
      console.error('❌ Error getting version:', error);
      document.getElementById('appVersion').textContent = 'v1.0.0';
    }
  }
  async function ensureSidebarVersion() {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;

    if (sidebar.querySelector('.sidebar-footer')) return;

    const footer = document.createElement('div');
    footer.className = 'sidebar-footer';

    const wrap = document.createElement('div');
    wrap.className = 'version-wrap';
    // Use data-tooltip instead of title for custom tooltip support
    wrap.setAttribute('data-tooltip', 'App version');

    wrap.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <span id="appVersion">dev</span>
  `;

    // Attach our custom tooltip handlers
    attachTooltipHandlers(wrap);

    footer.appendChild(wrap);
    sidebar.appendChild(footer);

    // Πολλαπλές στρατηγικές για να βρει την έκδοση
    const version = await getAppVersionWithFallback();
    document.getElementById('appVersion').textContent = version;
  }

  function normalizeVersion(v) {
    if (!v) return null;
    v = String(v).trim().replace(/^v/i, '');
    // «όλα μηδενικά» 0.0.0, 0.0.0.0, 000 κ.λπ.
    if (/^0+(?:\.0+){0,3}$/.test(v)) return null;
    // αποδεκτό x.y[.z[.w]]
    if (!/^\d+(?:\.\d+){1,3}$/.test(v)) return null;
    return v;
  }

  async function getAppVersionWithFallback() {
    try {
      if (window.api?.getAppVersion) {
        const raw = await window.api.getAppVersion();
        const v = normalizeVersion(raw);
        if (v) return `v${v}`;
      }
    } catch { }
    try {
      const res = await fetch('./package.json');
      if (res.ok) {
        const pkg = await res.json();
        const v = normalizeVersion(pkg?.version);
        if (v) return `v${v}`;
      }
    } catch { }
    const envV = normalizeVersion(typeof process !== 'undefined' ? process?.env?.npm_package_version : null);
    if (envV) return `v${envV}`;
    return 'v1.0.0'; // ασφαλές fallback
  }

  async function ensureSidebarVersion() {
    const sidebar = document.getElementById('sidebar') || document.querySelector('.sidebar');
    if (!sidebar) return;

    if (!sidebar.querySelector('.sidebar-footer')) {
      const footer = document.createElement('div');
      footer.className = 'sidebar-footer';
      footer.innerHTML = `
      <div class="version-wrap" data-tooltip="App version">
        <div class="version-badge" id="versionBadge">
          <span id="appVersion">v…</span>
          <span class="badge-lines"></span>
        </div>
        <div class="user-info" id="userInfo"></div>
      </div>`;
      sidebar.appendChild(footer);
      const versionWrapper = footer.querySelector('.version-wrap');
      if (versionWrapper) attachTooltipHandlers(versionWrapper);
    }

    const versionEl = document.getElementById('appVersion');
    const setSafe = (txt) => { if (versionEl) versionEl.textContent = txt; };

    setSafe(await getAppVersionWithFallback());
    setTimeout(async () => {
      const raw = (versionEl?.textContent || '').trim().replace(/^v/i, '');
      if (!raw || /^0+(?:\.0+){0,3}$/.test(raw)) {
        setSafe(await getAppVersionWithFallback());
      }
    }, 800);

    async function updateUserInfo() {
      const userInfoEl = document.getElementById('userInfo');
      if (!userInfoEl) return;
      try {
        // Remove any previous click handler to avoid multiple bindings
        if (userInfoEl._toggleHandler) {
          userInfoEl.removeEventListener('click', userInfoEl._toggleHandler);
          userInfoEl._toggleHandler = null;
        }
        const profile = await (window.api?.getUserProfile?.());
        userInfoEl.innerHTML = '';
        if (profile && profile.name) {
          // Show the authenticated user's avatar and name
          if (profile.avatar) {
            const img = document.createElement('img');
            img.src = profile.avatar;
            img.alt = 'avatar';
            userInfoEl.appendChild(img);
          }
          const span = document.createElement('span');
          span.textContent = profile.name;
          userInfoEl.appendChild(span);
          // Create a hidden logout menu
          const logoutMenu = document.createElement('div');
          logoutMenu.className = 'logout-menu';
          const logoutBtn = document.createElement('button');
          logoutBtn.className = 'logout-btn';
          logoutBtn.textContent = 'Logout';
          logoutMenu.appendChild(logoutBtn);
          userInfoEl.appendChild(logoutMenu);
          // Toggle the visibility of the logout menu when clicking on the user
          const handler = async (e) => {
            // If the logout button itself was clicked, perform logout
            if (e.target && e.target.classList.contains('logout-btn')) {
              e.stopPropagation();
              try {
                await window.api?.logout?.();
              } catch (err) {
                console.error('Logout failed:', err);
              }
              // After logging out, refresh the UI
              updateUserInfo();
            } else {
              // Toggle the dropdown display
              userInfoEl.classList.toggle('show-logout');
            }
          };
          userInfoEl._toggleHandler = handler;
          userInfoEl.addEventListener('click', handler);
        } else {
          const card = document.createElement('div');
          card.className = 'login-card';

          // Discord icon button
          const discordBtn = document.createElement('button');
          discordBtn.className = 'login-discord';
          // Add a tooltip attribute for a custom tooltip
          discordBtn.setAttribute('data-tooltip', 'Sign in with Discord');
          discordBtn.innerHTML = `
          <svg fill="#000000" preserveAspectRatio="xMidYMid" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 -28.5 256 256"><g stroke-width="0" id="SVGRepo_bgCarrier"></g><g stroke-linejoin="round" stroke-linecap="round" id="SVGRepo_tracerCarrier"></g><g id="SVGRepo_iconCarrier"> <g> <path fill-rule="nonzero" fill="#5865F2" d="M216.856339,16.5966031 C200.285002,8.84328665 182.566144,3.2084988 164.041564,0 C161.766523,4.11318106 159.108624,9.64549908 157.276099,14.0464379 C137.583995,11.0849896 118.072967,11.0849896 98.7430163,14.0464379 C96.9108417,9.64549908 94.1925838,4.11318106 91.8971895,0 C73.3526068,3.2084988 55.6133949,8.86399117 39.0420583,16.6376612 C5.61752293,67.146514 -3.4433191,116.400813 1.08711069,164.955721 C23.2560196,181.510915 44.7403634,191.567697 65.8621325,198.148576 C71.0772151,190.971126 75.7283628,183.341335 79.7352139,175.300261 C72.104019,172.400575 64.7949724,168.822202 57.8887866,164.667963 C59.7209612,163.310589 61.5131304,161.891452 63.2445898,160.431257 C105.36741,180.133187 151.134928,180.133187 192.754523,160.431257 C194.506336,161.891452 196.298154,163.310589 198.110326,164.667963 C191.183787,168.842556 183.854737,172.420929 176.223542,175.320965 C180.230393,183.341335 184.861538,190.991831 190.096624,198.16893 C211.238746,191.588051 232.743023,181.531619 254.911949,164.955721 C260.227747,108.668201 245.831087,59.8662432 216.856339,16.5966031 Z M85.4738752,135.09489 C72.8290281,135.09489 62.4592217,123.290155 62.4592217,108.914901 C62.4592217,94.5396472 72.607595,82.7145587 85.4738752,82.7145587 C98.3405064,82.7145587 108.709962,94.5189427 108.488529,108.914901 C108.508531,123.290155 98.3405064,135.09489 85.4738752,135.09489 Z M170.525237,135.09489 C157.88039,135.09489 147.510584,123.290155 147.510584,108.914901 C147.510584,94.5396472 157.658606,82.7145587 170.525237,82.7145587 C183.391518,82.7145587 193.761324,94.5189427 193.539891,108.914901 C193.539891,123.290155 183.391518,135.09489 170.525237,135.09489 Z"></path> </g> </g></svg>
        `;
          card.appendChild(discordBtn);

          // Google icon button using the full multi‑colour Google logo
          const googleBtn = document.createElement('button');
          googleBtn.className = 'login-google';
          // Add a tooltip attribute for a custom tooltip
          googleBtn.setAttribute('data-tooltip', 'Sign in with Google');
          googleBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 0 262 262" preserveAspectRatio="xMidYMid">
            <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/>
            <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/>
            <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/>
            <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/>
          </svg>
        `;
          card.appendChild(googleBtn);

          userInfoEl.appendChild(card);
          [discordBtn, googleBtn].forEach((btn) => {
            attachTooltipHandlers(btn);
          });

          googleBtn.addEventListener('click', async () => {
            try {
              await window.api?.loginGoogle?.();
            } catch (err) {
              console.error('Google login failed:', err);
              const msg = String(err?.message || err);
              if (msg && /not configured/i.test(msg)) {
                window.alert('Google login is not available because OAuth credentials are not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI environment variables or provide a configuration file.');
              }
            }
            updateUserInfo();
          });
          discordBtn.addEventListener('click', async () => {
            try {
              await window.api?.loginDiscord?.();
            } catch (err) {
              console.error('Discord login failed:', err);
              const msg = String(err?.message || err);
              if (msg && /not configured/i.test(msg)) {
                window.alert('Discord login is not available because OAuth credentials are not configured. Please set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI environment variables or provide a configuration file.');
              }
            }
            updateUserInfo();
          });
        }
      } catch (err) {
        console.warn('Failed to update user info:', err);
      }
    }
    // Immediately update on initialisation
    updateUserInfo();
  }
  getAppVersionWithFallback().then(v => console.log('App version resolved =', v));

  // κάλεσέ το στο init:
  async function init() {
    await loadTranslations();
    applyTheme();
    renderMenu();
    await ensureSidebarVersion();   // <-- να υπάρχει αυτό
    initializeAutoUpdater();
  }


})();