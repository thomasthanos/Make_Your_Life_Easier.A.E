document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.info-section');

  function requestFrameResize() {
    const card = document.querySelector('.info-card');
    if (!card || window.parent === window) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const content = card.querySelector('.info-content');
        const previousCardMaxHeight = card.style.maxHeight;
        const previousCardOverflow = card.style.overflow;
        const previousContentOverflow = content?.style.overflowY || '';
        const previousContentMaxHeight = content?.style.maxHeight || '';

        let height = 0;
        try {
          card.style.maxHeight = 'none';
          card.style.overflow = 'visible';
          if (content) {
            content.style.overflowY = 'visible';
            content.style.maxHeight = 'none';
          }

          height = Math.ceil(Math.max(
            card.getBoundingClientRect().height,
            card.scrollHeight
          )) + 2;
        } finally {
          card.style.maxHeight = previousCardMaxHeight;
          card.style.overflow = previousCardOverflow;
          if (content) {
            content.style.overflowY = previousContentOverflow;
            content.style.maxHeight = previousContentMaxHeight;
          }
        }

        if (height > 0) {
          window.parent.postMessage({ type: 'infoFrameResize', height }, '*');
        }
      });
    });
  }

  // Navigation functionality
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const targetId = item.getAttribute('data-target');
      sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === targetId);
      });
      requestFrameResize();
    });
  });

  // Close button functionality
  const closeBtn = document.querySelector('.info-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'infoCloseRequest' }, '*');
      }
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
    requestFrameResize();
  }

  applyLanguage();
  requestFrameResize();
  window.addEventListener('resize', requestFrameResize);
  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(requestFrameResize);
    document.querySelectorAll('.info-card, .info-section, .info-content').forEach(el => {
      resizeObserver.observe(el);
    });
  }

  // Listen for language changes from parent window
  window.addEventListener('storage', (e) => {
    if (e.key === 'myAppSettings') {
      applyLanguage();
      requestFrameResize();
    }
  });

  // Also listen for message events in case the parent window communicates via postMessage
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'infoParentResized') {
      requestFrameResize();
      return;
    }
    if (event.data?.type === 'languageChange') {
      applyLanguage();
      requestFrameResize();
    }
  });
});
