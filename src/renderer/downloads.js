import { recordActivity, updateActivity } from './notifications.js';
import { uiText } from './ui-text.js';

export const downloadStore = new Map();

export function registerDownload(key, downloadId, meta = {}) {
    downloadStore.set(key, {
        downloadId,
        activityId: recordActivity({ source: meta.source || (key === 'activate-script' || key === 'autologin-tool' ? 'activate_autologin' : key === 'sparkle-debloat' ? 'debloat' : 'crack_installer'),
            title: meta.name || key, status: 'running', message: uiText('downloading', 'Downloading…'), percent: null }).id,
        status: 'pending',
        percent: 0,
        path: null,
        error: null,
        meta,
        onUpdate: null,
        onLifecycle: null
    });
}

export function attachDownloadUI(key, callback) {
    const dl = downloadStore.get(key);
    if (dl) dl.onUpdate = callback;
}

export function attachDownloadLifecycle(key, callback) {
    const dl = downloadStore.get(key);
    if (dl) dl.onLifecycle = callback;
}

export function updateDownloadPhase(key, phase) {
    const download = downloadStore.get(key);
    if (download) updateActivity(download.activityId, { phase, percent: null });
}

export function finishDownload(key, error = null) {
    const download = downloadStore.get(key);
    if (!download) return;
    updateActivity(download.activityId, {
        status: error ? 'failed' : 'complete', type: error ? 'error' : 'success', completedAt: Date.now(),
        message: error ? uiText('operation_failed', 'The action failed.') : uiText('tool_opened', 'The external tool opened. Continue in its window.'),
        details: error || '', phase: null, percent: null
    });
    downloadStore.delete(key);
}

export function getActiveDownload(key) {
    const dl = downloadStore.get(key);
    if (dl && !['error', 'cancelled'].includes(dl.status)) return dl;
    return null;
}

let downloadListenerInitialized = false;
export function initDownloadListener() {
    if (downloadListenerInitialized || !window.api?.onDownloadEvent) return;
    downloadListenerInitialized = true;

    window.api.onDownloadEvent((data) => {
        for (const [key, dl] of downloadStore) {
            if (dl.downloadId === data.id) {
                const continuing = data.status === 'complete' && dl.meta.followUp;
                dl.status = continuing ? 'processing' : data.status;
                if (data.percent != null) dl.percent = data.percent;
                if (data.path) dl.path = data.path;
                if (data.error) dl.error = data.error;
                if (data.total) dl.total = data.total;
                const finished = !continuing && ['complete', 'error', 'cancelled'].includes(data.status);
                updateActivity(dl.activityId, { status: finished ? data.status : 'running', type: data.status === 'error' ? 'error' : finished && data.status === 'complete' ? 'success' : 'info',
                    message: continuing ? uiText('working', 'Working…') : data.status === 'complete' ? uiText('download_complete', 'Download complete.') : data.error || uiText('downloading', 'Downloading…'),
                    completedAt: finished ? Date.now() : null, percent: !finished && !continuing && Number.isFinite(data.percent) ? data.percent : null });

                if (dl.onUpdate) {
                    try { dl.onUpdate(data); } catch {  }
                }

                const terminal = ['complete', 'error', 'cancelled'].includes(data.status);
                if (terminal && dl.onLifecycle) {
                    const settle = dl.onLifecycle;
                    dl.onLifecycle = null;
                    try { settle(data); } catch {  }
                }

                if (finished) {
                    const finishedId = data.id;
                    setTimeout(() => {
                        const cur = downloadStore.get(key);
                        if (cur && cur.downloadId === finishedId) downloadStore.delete(key);
                    }, 2000);
                }
                break;
            }
        }
    });
}
