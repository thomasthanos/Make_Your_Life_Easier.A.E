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
        
        if (whatTitleEl) whatTitleEl.textContent = data.whatTitle;
        if (whatDescEl) whatDescEl.textContent = data.whatDesc;
      }

      // Second card - How to use
      if (cards[1]) {
        const howTitleEl = cards[1].querySelector('.column-title');
        const stepsList = cards[1].querySelector('.usage-list');
        
        if (howTitleEl) howTitleEl.textContent = data.howTitle;
        if (stepsList) {
          stepsList.innerHTML = data.steps.map(step => 
            `<li>${step}</li>`
          ).join('');
        }
      }
    });
  }

  applyLanguage();
});