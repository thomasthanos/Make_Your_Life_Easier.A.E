document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.info-section');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const targetId = item.getAttribute('data-target');
      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });
  const closeBtn = document.querySelector('.info-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const overlay = window.parent.document.getElementById('info-modal-overlay');
      if (overlay) overlay.remove();
    });
  }
});