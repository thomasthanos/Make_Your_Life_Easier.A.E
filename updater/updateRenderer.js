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
  let currentPhase = 'init'; // Track phase to allow progress reset

  /**
   * Update the progress bar width and optional status message.
   * @param {number} percent Progress percentage (0–100)
   * @param {string} [text] Optional status text to display
   * @param {string} [phase] Optional phase identifier to allow progress reset
   */
  function updateProgress(percent, text, phase = null) {
    // If phase changed, allow progress to reset
    if (phase && phase !== currentPhase) {
      currentPhase = phase;
      lastProgress = 0;
    }

    if (typeof percent === 'number') {
      // Only animate forward within same phase
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
        updateProgress(5, 'Checking for updates…', 'update-check');
        break;
      case 'available': {
        const sizeInfo = data.size ? ` (${data.size})` : '';
        const message = data.releaseName 
          ? `${data.releaseName} available${sizeInfo}! Downloading…`
          : `Update available${sizeInfo}! Downloading…`;
        updateProgress(10, message, 'update-download');
        break;
      }
      case 'downloading': {
        const percent = Math.round(data.percent || 0);
        // If message contains "Loading" or "Initializing", it's app loading phase
        const isAppLoading = data.message &&
          (data.message.includes('Loading') ||
            data.message.includes('Initializing') ||
            data.message.includes('Building') ||
            data.message.includes('Finalizing') ||
            data.message.includes('Almost') ||
            data.message.includes('Launching'));

        const phase = isAppLoading ? 'app-loading' : 'update-download';
        
        // Enhanced message with speed and ETA if available
        let text = typeof data.message === 'string'
          ? data.message
          : `Downloading update: ${percent}%`;
        
        // Add retry indicator if retrying
        if (data.message && data.message.includes('Retrying')) {
          text = `⟳ ${text}`;
        }
        
        updateProgress(percent, text, phase);
        break;
      }
      case 'downloaded':
        updateProgress(100, 'Update downloaded! Installing…', 'update-install');
        break;
      case 'not-available':
        updateProgress(100, 'Launching application…', 'app-loading');
        break;
      case 'error': {
        const errorMsg = data.canRetry 
          ? 'Connection error. Retrying…' 
          : 'Update failed. Launching app…';
        updateProgress(10, errorMsg, 'app-loading');
        break;
      }
      default:
        break;
    }
  });
});