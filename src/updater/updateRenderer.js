// Renderer script for the update window. It listens for update status
// messages from the main process and keeps the splash UI in sync.

window.addEventListener('DOMContentLoaded', () => {
  const cardEl = document.querySelector('.update-card');
  const progressBar = document.querySelector('.progress-bar');
  const statusEl = document.getElementById('status');
  const progressPercentEl = document.getElementById('progress-percent');
  const progressSizeEl = document.getElementById('progress-size');
  const progressSpeedEl = document.getElementById('progress-speed');
  const progressEtaEl = document.getElementById('progress-eta');
  const cancelBtn = document.getElementById('cancel-btn');

  let lastProgress = 0;
  let currentPhase = 'init';
  let lastDownloadDetails = {};
  let cancelling = false;

  function setMode(mode) {
    if (!cardEl) return;
    const isDownloading = mode === 'downloading';
    cardEl.classList.toggle('is-downloading', isDownloading);
    cardEl.classList.toggle('is-message', !isDownloading);
    if (cancelBtn && !cancelling) {
      cancelBtn.hidden = !isDownloading;
    }
  }

  if (cancelBtn && window.api && typeof window.api.cancelUpdate === 'function') {
    cancelBtn.addEventListener('click', () => {
      if (cancelling) return;
      cancelling = true;
      cancelBtn.hidden = true;
      window.api.cancelUpdate().catch(() => {});
    });
  }

  function formatDecimal(value, fallback = '0.00') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(2) : fallback;
  }

  function updateDownloadMetrics(percent, data = {}) {
    if (progressPercentEl) {
      progressPercentEl.textContent = `${Math.round(percent || 0)}%`;
    }

    if (progressSizeEl) {
      const downloaded = data.downloaded !== undefined
        ? formatDecimal(data.downloaded)
        : formatDecimal((data.transferred || 0) / (1024 * 1024));
      const total = data.total !== undefined
        ? formatDecimal(data.total)
        : formatDecimal((data.totalBytes || 0) / (1024 * 1024));
      progressSizeEl.textContent = `${downloaded}/${total} MB`;
    }

    if (progressSpeedEl) {
      const speed = data.speed !== undefined
        ? formatDecimal(data.speed)
        : formatDecimal((data.bytesPerSecond || 0) / (1024 * 1024));
      progressSpeedEl.textContent = `${speed} MB/s`;
    }

    if (progressEtaEl) {
      const eta = data.eta || 'Calculating';
      progressEtaEl.textContent = percent >= 100 ? 'Done' : `${eta} left`;
    }
  }

  function updateProgress(percent, text, phase = null) {
    if (phase && phase !== currentPhase) {
      currentPhase = phase;
      lastProgress = 0;
    }

    if (typeof percent === 'number') {
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

  if (!window.api || typeof window.api.onUpdateStatus !== 'function') {
    console.warn('UpdateRenderer: window.api.onUpdateStatus not available');
    setMode('message');
    updateProgress(0, 'Loading...');
    return;
  }

  window.api.onUpdateStatus((data) => {
    switch (data.status) {
      case 'checking':
        setMode('message');
        updateProgress(5, 'Checking for updates', 'update-check');
        break;

      case 'available': {
        setMode('message');
        const sizeInfo = data.size ? ` (${data.size})` : '';
        const message = data.releaseName
          ? `${data.releaseName} available${sizeInfo}! Preparing update...`
          : `Update available${sizeInfo}! Preparing update...`;
        updateProgress(10, message, 'update-download');
        break;
      }

      case 'downloading': {
        const percent = Math.round(data.percent || 0);
        const isAppLoading = data.message &&
          (data.message.includes('Loading') ||
            data.message.includes('Initializing') ||
            data.message.includes('Building') ||
            data.message.includes('Finalizing') ||
            data.message.includes('Almost') ||
            data.message.includes('Launching'));

        const phase = isAppLoading ? 'app-loading' : 'update-download';
        setMode(isAppLoading ? 'message' : 'downloading');

        const text = typeof data.message === 'string'
          ? data.message
          : `Downloading update: ${percent}%`;

        updateProgress(percent, text, phase);
        if (!isAppLoading) {
          lastDownloadDetails = { ...lastDownloadDetails, ...data };
          updateDownloadMetrics(percent, data);
        }
        break;
      }

      case 'extracting':
        setMode('message');
        updateProgress(100, data.message || 'Extracting update...', 'update-install');
        break;

      case 'downloaded':
        setMode('downloading');
        updateDownloadMetrics(100, { ...lastDownloadDetails, ...data });
        updateProgress(100, 'Update downloaded! Installing...', 'update-install');
        break;

      case 'not-available':
        setMode('message');
        updateProgress(100, 'Launching application...', 'app-loading');
        break;

      case 'error': {
        setMode('message');
        const errorMsg = data.canRetry
          ? 'Connection error. Retrying...'
          : 'Update failed. Launching app...';
        updateProgress(10, errorMsg, 'app-loading');
        break;
      }

      default:
        break;
    }
  });
});
