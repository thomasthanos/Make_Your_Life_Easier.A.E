document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.info-section');

  // Navigation functionality
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const targetId = item.getAttribute('data-target');
      sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === targetId);
      });
    });
  });

  // Close button functionality
  const closeBtn = document.querySelector('.info-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const overlay = window.parent.document.getElementById('info-modal-overlay');
      if (overlay) overlay.remove();
    });
  }

  // Language application
  function applyLanguage() {
    let lang = 'en';
    try {
      const settings = JSON.parse(localStorage.getItem('myAppSettings'));
      if (settings?.lang) {
        lang = settings.lang;
      }
    } catch (e) {
      console.warn('Could not load language settings, defaulting to English');
    }

    // Update navigation labels
    document.querySelectorAll('.nav-item').forEach(item => {
      const labelSpan = item.querySelector('.nav-label');
      if (!labelSpan) return;

      const navClass = Array.from(item.classList).find(c => c.startsWith('nav-'));
      const key = navClass?.replace('nav-', '');

      if (key && translations[lang]?.nav[key]) {
        labelSpan.textContent = translations[lang].nav[key];
      }
    });

    // Update menu hint
    const menuHintEl = document.querySelector('.info-menu-hint');
    if (menuHintEl) {
      const hintText = translations[lang]?.menuHint || 'Title bar menu: theme, language, info panel.';
      menuHintEl.textContent = hintText;
    }

    // Update section content
    document.querySelectorAll('.info-section').forEach(section => {
      const id = section.id;
      const data = translations[lang]?.sections[id];
      if (!data) return;

      // Update title
      const titleTextEl = section.querySelector('.section-title-text');
      if (titleTextEl) {
        titleTextEl.textContent = data.title;
      }

      // Update content cards
      const cards = section.querySelectorAll('.column-card');

      // First card - What it does
      if (cards[0]) {
        const whatTitleEl = cards[0].querySelector('.column-title');
        const whatDescEl = cards[0].querySelector('p');
        const featureList = cards[0].querySelector('.feature-list');

        if (whatTitleEl) whatTitleEl.textContent = data.whatTitle;
        if (whatDescEl) whatDescEl.textContent = data.whatDesc;

        // Update feature lists
        if (featureList && data.features) {
          featureList.innerHTML = data.features;
        }
      }

      // Second card - How to use
      if (cards[1]) {
        const howTitleEl = cards[1].querySelector('.column-title');
        const stepsList = cards[1].querySelector('.usage-list');
        const warningNote = cards[1].querySelector('.warning-note');

        if (howTitleEl) howTitleEl.textContent = data.howTitle;
        if (stepsList && data.steps) {
          stepsList.innerHTML = data.steps.map(step =>
            `<li>${step}</li>`
          ).join('');
        }
        if (warningNote && data.warning) {
          warningNote.innerHTML = data.warning;
        }
      }
    });

    // Update close button aria-label
    const closeBtn = document.querySelector('.info-close-btn');
    if (closeBtn) {
      closeBtn.setAttribute('aria-label', lang === 'en' ? 'Close' : 'Κλείσιμο');
    }

    // Update page title
    document.title = lang === 'en' ? 'Help - Make Your Life Easier' : 'Βοήθεια - Make Your Life Easier';
  }

  applyLanguage();

  // Listen for language changes from parent window
  window.addEventListener('storage', (e) => {
    if (e.key === 'myAppSettings') {
      applyLanguage();
    }
  });

  // Also listen for message events in case the parent window communicates via postMessage
  window.addEventListener('message', (event) => {
    if (event.data.type === 'languageChange') {
      applyLanguage();
    }
  });
});