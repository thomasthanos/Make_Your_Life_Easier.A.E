

class ButtonStateManager {
    constructor() {
        this.buttonStates = new Map();
    }

    setLoading(button, loadingText = null) {
        if (!button || this.buttonStates.has(button)) {
            return false;
        }

        const originalState = {
            disabled: button.disabled
        };

        this.buttonStates.set(button, originalState);
        button.disabled = true;
        button.classList.add('btn-loading');

        if (loadingText) {
            const labelEl = button.querySelector('.btn-label');
            if (labelEl) {
                originalState.labelText = labelEl.textContent;
                labelEl.textContent = loadingText;
            } else {
                button.dataset.originalText = button.textContent;
                button.textContent = loadingText;
            }
        }

        return true;
    }

    resetState(button) {
        if (!button || !this.buttonStates.has(button)) {
            return;
        }

        const originalState = this.buttonStates.get(button);
        button.disabled = originalState.disabled;
        button.classList.remove('btn-loading');

        if (originalState.labelText) {
            const labelEl = button.querySelector('.btn-label');
            if (labelEl) {
                labelEl.textContent = originalState.labelText;
            }
        } else if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }

        this.buttonStates.delete(button);
    }

    isLoading(button) {
        return this.buttonStates.has(button);
    }

    resetAll() {
        for (const button of this.buttonStates.keys()) {
            this.resetState(button);
        }
    }
}

export { attachTooltipHandlers } from './tooltips.js';


const processStates = new Map();

export function trackProcess(cardId, processType, button, statusElement) {
    const processId = `${cardId}-${processType}`;
    processStates.set(processId, {
        button: button,
        status: statusElement,
        type: processType,
        startTime: Date.now(),
        isActive: true
    });
}

export function completeProcess(cardId, processType, success = true, resetFunctions = {}) {
    const processId = `${cardId}-${processType}`;
    const process = processStates.get(processId);

    if (process && process.isActive) {
        process.isActive = false;

        const resetFn = resetFunctions[processType];
        if (resetFn) {
            resetFn(process.button, process.status, success);
        }

        processStates.delete(processId);
    }
}


export const downloadStore = new Map();

export function registerDownload(key, downloadId, meta = {}) {
    downloadStore.set(key, {
        downloadId,
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

export function detachAllDownloadUI() {
    for (const dl of downloadStore.values()) {
        dl.onUpdate = null;
    }
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
                dl.status = data.status;
                if (data.percent != null) dl.percent = data.percent;
                if (data.path) dl.path = data.path;
                if (data.error) dl.error = data.error;
                if (data.total) dl.total = data.total;

                if (dl.onUpdate) {
                    try { dl.onUpdate(data); } catch {  }
                }

                const terminal = ['complete', 'error', 'cancelled'].includes(data.status);
                if (terminal && dl.onLifecycle) {
                    const settle = dl.onLifecycle;
                    dl.onLifecycle = null;
                    try { settle(data); } catch {  }
                }

                if (['complete', 'error', 'cancelled'].includes(data.status)) {
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

export const buttonStateManager = new ButtonStateManager();
