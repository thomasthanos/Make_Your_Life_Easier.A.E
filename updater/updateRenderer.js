// Renderer script for the update window.  This script listens for
// update status messages from the main process and updates the UI
// accordingly.  It does not itself trigger update checks — the main
// process starts the check when the update window is created.

window.addEventListener('DOMContentLoaded', () => {
  // Select the progress bar element and the status element.
  const progressBar = document.querySelector('.progress-bar');
  const statusEl = document.getElementById('status');
  
  // Track last progress for smooth animation
  let lastProgress = 0;

  /**
   * Update the progress bar width and optional status message.
   * @param {number} percent Progress percentage (0–100)
   * @param {string} [text] Optional status text to display
   */
  function updateProgress(percent, text) {
    if (typeof percent === 'number') {
      // Only animate forward, don't go backwards
      const clamped = Math.max(lastProgress, Math.min(100, percent));
      lastProgress = clamped;
      if (progressBar) {
        progressBar.style.width = `${clamped}%`;
      }
    }
    if (text && statusEl) {
      statusEl.textContent = text;
    }
  }

  // Check if API is available
  if (!window.api || typeof window.api.onUpdateStatus !== 'function') {
    console.warn('UpdateRenderer: window.api.onUpdateStatus not available');
    updateProgress(0, 'Loading...');
    return;
  }

  // Listen for update status messages from the main process.
  window.api.onUpdateStatus((data) => {
    switch (data.status) {
      case 'checking':
        updateProgress(5, 'Checking for updates…');
        break;
      case 'available':
        updateProgress(10, 'Update available! Downloading…');
        break;
      case 'downloading': {
        const percent = Math.round(data.percent || 0);
        // If a custom message is provided by the main process (e.g. for
        // application loading), use it.
        const text = typeof data.message === 'string'
          ? data.message
          : `Downloading update: ${percent}%`;
        updateProgress(percent, text);
        break;
      }
      case 'downloaded':
        updateProgress(100, 'Installing update…');
        break;
      case 'not-available':
        updateProgress(100, 'Launching application…');
        break;
      case 'error':
        // Don't show error to user, just proceed
        updateProgress(0, 'Initializing application…');
        break;
      default:
        break;
    }
  });
});