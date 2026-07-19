/**
 * Renderer Managers
 * Contains UI management classes for buttons, events, and tooltips
 */

// ============================================
// BUTTON STATE MANAGER
// ============================================

/**
 * Manages button states during async operations.
 * Prevents double-clicks and provides visual feedback.
 */
class ButtonStateManager {
    constructor() {
        this.buttonStates = new Map();
    }

    /**
     * Set button to loading state
     * @param {HTMLButtonElement} button - The button element
     * @param {string} loadingText - Optional text to show while loading
     * @returns {boolean} - Returns false if button is already loading
     */
    setLoading(button, loadingText = null) {
        if (!button || this.buttonStates.has(button)) {
            return false;
        }

        const originalState = {
            disabled: button.disabled,
            innerHTML: button.innerHTML,
            className: button.className
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

    /**
     * Reset button to original state
     * @param {HTMLButtonElement} button - The button element
     */
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

    /**
     * Check if button is currently loading
     * @param {HTMLButtonElement} button - The button element
     * @returns {boolean}
     */
    isLoading(button) {
        return this.buttonStates.has(button);
    }

    /**
     * Reset all buttons to original state
     */
    resetAll() {
        for (const button of this.buttonStates.keys()) {
            this.resetState(button);
        }
    }
}

// ============================================
// TOOLTIP MANAGER
// ============================================

/**
 * Creates and manages a singleton tooltip element
 */
const tooltipManager = (() => {
    let tooltipEl;

    function ensure() {
        if (!tooltipEl) {
            tooltipEl = document.querySelector('.custom-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'custom-tooltip';
                document.body.appendChild(tooltipEl);
            }
        }
        return tooltipEl;
    }

    function update(event, tooltip) {
        const offset = 6;
        const rect = tooltip.getBoundingClientRect();
        let x = event.clientX + offset;
        let y = event.clientY + offset;
        if (x + rect.width > window.innerWidth) {
            x = event.clientX - rect.width - offset;
        }
        if (y + rect.height > window.innerHeight) {
            y = event.clientY - rect.height - offset;
        }
        tooltip.style.left = `${x}px`;
        tooltip.style.top = `${y}px`;
    }

    function show(target, text, event) {
        const tooltip = ensure();
        tooltip.textContent = text;
        tooltip.classList.toggle('multiline', String(text).includes('\n'));
        clearTimeout(tooltip._showTimer);
        tooltip._showTimer = setTimeout(() => {
            tooltip.classList.add('visible');
        }, 150);
        update(event, tooltip);
    }

    function hide() {
        const tooltip = ensure();
        clearTimeout(tooltip._showTimer);
        tooltip.classList.remove('visible');
    }

    return { ensure, update, show, hide };
})();

// ============================================
// TOOLTIP ATTACHMENT HELPER
// ============================================

// Track keyboard vs mouse interaction for tooltip accessibility
let lastInteractionWasKeyboard = false;

// Set up global interaction tracking
if (typeof document !== 'undefined') {
    document.addEventListener('keydown', () => {
        lastInteractionWasKeyboard = true;
    }, true);

    document.addEventListener('mousedown', () => {
        lastInteractionWasKeyboard = false;
    }, true);

    document.addEventListener('touchstart', () => {
        lastInteractionWasKeyboard = false;
    }, true);

    // Global click handler to hide tooltip when clicking outside
    document.addEventListener('click', (ev) => {
        const active = document.activeElement;
        if (active && typeof active.getAttribute === 'function' && active.getAttribute('data-tooltip')) {
            if (!active.contains(ev.target)) {
                tooltipManager.hide();
                if (typeof active.blur === 'function') {
                    active.blur();
                }
            }
        } else {
            tooltipManager.hide();
        }
    });
}

/**
 * Attach tooltip handlers to an element with data-tooltip attribute
 * @param {HTMLElement} el - The element to attach tooltip to
 */
export function attachTooltipHandlers(el) {
    if (!el || typeof el.getAttribute !== 'function') return;
    const tip = el.getAttribute('data-tooltip');
    if (!tip) return;
    if (el._tooltipAttached) return;
    el._tooltipAttached = true;

    el.addEventListener('mouseenter', (e) => {
        tooltipManager.show(el, tip, e);
    });

    el.addEventListener('mousemove', (e) => {
        const tooltip = tooltipManager.ensure();
        tooltipManager.update(e, tooltip);
    });

    el.addEventListener('mouseleave', () => {
        tooltipManager.hide();
    });

    el.addEventListener('focus', () => {
        if (!lastInteractionWasKeyboard) return;
        const rect = el.getBoundingClientRect();
        tooltipManager.show(el, tip, { clientX: rect.right, clientY: rect.bottom });
    });

    el.addEventListener('blur', () => {
        tooltipManager.hide();
    });

    el.addEventListener('mousedown', () => {
        tooltipManager.hide();
    });
}

// ============================================
// PROCESS STATE MANAGER
// ============================================

/**
 * Tracks process states for cards (downloads, replacements, etc.)
 */
const processStates = new Map();

/**
 * Track a process for a card
 * @param {string} cardId - The card identifier
 * @param {string} processType - Type of process (download, replace)
 * @param {HTMLButtonElement} button - The button element
 * @param {HTMLElement} statusElement - The status element
 */
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

/**
 * Complete a tracked process
 * @param {string} cardId - The card identifier
 * @param {string} processType - Type of process
 * @param {boolean} success - Whether the process was successful
 * @param {Object} resetFunctions - Object containing reset functions for different types
 */
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

// ============================================
// GLOBAL DOWNLOAD STATE STORE
// ============================================

/**
 * Persists download state across page switches so progress survives tab changes.
 * Key: logical identifier (e.g., 'crack-clip_studio_paint', 'custom-appName')
 * Value: { downloadId, status, percent, path, error, meta, onUpdate }
 */
export const downloadStore = new Map();

/**
 * Register a download in the global store
 * @param {string} key - Logical key for the download
 * @param {string} downloadId - The IPC download ID
 * @param {Object} meta - Extra metadata (appName, url, etc.)
 */
export function registerDownload(key, downloadId, meta = {}) {
    downloadStore.set(key, {
        downloadId,
        status: 'pending',
        percent: 0,
        path: null,
        error: null,
        meta,
        onUpdate: null // UI callback, attached by page builder
    });
}

/**
 * Attach a UI update callback to an active download (called from page builder)
 * @param {string} key - Logical key
 * @param {Function} callback - Called with download event data
 */
export function attachDownloadUI(key, callback) {
    const dl = downloadStore.get(key);
    if (dl) dl.onUpdate = callback;
}

/**
 * Detach all UI callbacks (called before page switch destroys DOM)
 */
export function detachAllDownloadUI() {
    for (const dl of downloadStore.values()) {
        dl.onUpdate = null;
    }
}

/**
 * Get active download state for a key
 * @param {string} key - Logical key
 * @returns {Object|null}
 */
export function getActiveDownload(key) {
    const dl = downloadStore.get(key);
    if (dl && !['error', 'cancelled'].includes(dl.status)) return dl;
    return null;
}

/**
 * Initialize the persistent download event listener (call once during app init)
 */
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

                // Forward to UI callback if attached
                if (dl.onUpdate) {
                    try { dl.onUpdate(data); } catch { /* DOM may be stale, ignore */ }
                }

                // Clean up finished downloads from store after a delay.
                // Includes 'complete' so entries do not leak when a download
                // finishes while its page (and onUpdate callback) is not active.
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

// Global singleton instances
export const buttonStateManager = new ButtonStateManager();
