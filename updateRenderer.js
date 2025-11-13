// Renderer script for the update window.  This script listens for
// update status messages from the main process and updates the UI
// accordingly.  It does not itself trigger update checks — the main
// process starts the check when the update window is created.

window.addEventListener('DOMContentLoaded', () => {
  const progressCircle = document.querySelector('svg .progress');
  const statusEl = document.getElementById('status');
  const circumference = 2 * Math.PI * 45;
  // Ensure the dash array matches the circumference.  Some browsers may
  // modify the stroke-dasharray attribute in the HTML, so explicitly
  // assign it here.
  progressCircle.style.strokeDasharray = `${circumference}`;
  progressCircle.style.strokeDashoffset = `${circumference}`;

  /**
   * Update the progress ring and optional status message.
   * @param {number} percent Progress percentage (0–100)
   * @param {string} [text] Optional status text to display
   */
  function updateProgress(percent, text) {
    if (typeof percent === 'number') {
      const offset = circumference - (percent / 100) * circumference;
      progressCircle.style.strokeDashoffset = offset;
    }
    if (text) {
      statusEl.textContent = text;
    }
  }

  // Listen for update status messages from the main process.  The
  // preload script exposes onUpdateStatus which registers a callback.
  window.api.onUpdateStatus((data) => {
    switch (data.status) {
      case 'checking':
        statusEl.textContent = 'Checking for updates…';
        break;
      case 'available':
        statusEl.textContent = 'Downloading update…';
        break;
      case 'downloading': {
        const percent = Math.round(data.percent || 0);
        updateProgress(percent, `Downloading update: ${percent}%`);
        break;
      }
      case 'downloaded':
        // Set progress to complete and indicate installation.  The main
        // process will handle the installation and restart.
        updateProgress(100, 'Installing update…');
        break;
      case 'not-available':
        // No update found — the main process will close this window and
        // open the main application shortly.
        updateProgress(100, 'Launching application…');
        break;
      case 'error':
        // Show a friendly error message instead of the raw error text.
        // The main process will handle launching the main window.
        updateProgress(100, 'Unable to check for updates. Launching application…');
        break;
      default:
        break;
    }
  });
});