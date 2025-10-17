//
// Placeholder JavaScript for the Make Your Life Easier help page.
//
// This file is intentionally minimal.  In previous iterations of the
// information page, complex navigation and animation logic was used to
// display multiple sections.  The new design for the help modal is much
// simpler: it presents a single piece of content describing how to use
// the installer.  If in the future additional interactivity is required
// (e.g. toggling between multiple help topics, handling language
// selection), the necessary code can be added here.
//

document.addEventListener('DOMContentLoaded', () => {
  // Grab all navigation items and all sections.  When a nav item is clicked,
  // we highlight it and show the corresponding section (hiding all others).
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.info-section');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Update active class on nav items
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      // Determine target section ID
      const targetId = item.getAttribute('data-target');
      // Toggle section visibility
      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });

  // Close the modal when the in‑card close button is clicked.  This
  // function reaches up to the parent document to remove the overlay.
  const closeBtn = document.querySelector('.info-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const overlay = window.parent.document.getElementById('info-modal-overlay');
      if (overlay) overlay.remove();
    });
  }
});