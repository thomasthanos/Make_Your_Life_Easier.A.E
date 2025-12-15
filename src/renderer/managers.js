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
export class ButtonStateManager {
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

    /**
     * Execute async function with button state management
     * @param {HTMLButtonElement} button - The button element
     * @param {Function} asyncFn - Async function to execute
     * @param {string} loadingText - Optional loading text
     * @returns {Promise} - Result of asyncFn
     */
    async withLoading(button, asyncFn, loadingText = null) {
        if (!this.setLoading(button, loadingText)) {
            return; // Button already loading
        }

        try {
            return await asyncFn();
        } finally {
            this.resetState(button);
        }
    }
}

// ============================================
// EVENT LISTENER MANAGER
// ============================================

/**
 * Tracks and manages event listeners for proper cleanup.
 * Prevents memory leaks by ensuring all listeners are removed.
 */
export class EventListenerManager {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Add event listener with automatic tracking
     * @param {EventTarget} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - addEventListener options
     * @returns {Function} - Cleanup function
     */
    add(element, event, handler, options = {}) {
        if (!element) return () => { };

        element.addEventListener(event, handler, options);

        if (!this.listeners.has(element)) {
            this.listeners.set(element, []);
        }

        const listenerInfo = { event, handler, options };
        this.listeners.get(element).push(listenerInfo);

        // Return cleanup function
        return () => this.remove(element, event, handler, options);
    }

    /**
     * Remove specific event listener
     * @param {EventTarget} element - DOM element
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - addEventListener options
     */
    remove(element, event, handler, options = {}) {
        if (!element) return;

        element.removeEventListener(event, handler, options);

        if (this.listeners.has(element)) {
            const elementListeners = this.listeners.get(element);
            const index = elementListeners.findIndex(
                l => l.event === event && l.handler === handler
            );
            if (index > -1) {
                elementListeners.splice(index, 1);
            }
            if (elementListeners.length === 0) {
                this.listeners.delete(element);
            }
        }
    }

    /**
     * Remove all listeners from a specific element
     * @param {EventTarget} element - DOM element
     */
    removeAll(element) {
        if (!element || !this.listeners.has(element)) return;

        const elementListeners = this.listeners.get(element);
        for (const { event, handler, options } of elementListeners) {
            element.removeEventListener(event, handler, options);
        }
        this.listeners.delete(element);
    }

    /**
     * Remove all tracked listeners (cleanup)
     */
    cleanup() {
        for (const [element, listeners] of this.listeners) {
            for (const { event, handler, options } of listeners) {
                element.removeEventListener(event, handler, options);
            }
        }
        this.listeners.clear();
    }

    /**
     * Get count of tracked listeners
     * @returns {number}
     */
    get count() {
        let total = 0;
        for (const listeners of this.listeners.values()) {
            total += listeners.length;
        }
        return total;
    }
}

// ============================================
// TOOLTIP MANAGER
// ============================================

/**
 * Creates and manages a singleton tooltip element
 */
export const tooltipManager = (() => {
    let tooltipEl;

    function ensure() {
        if (!tooltipEl) {
            tooltipEl = document.querySelector('.custom-tooltip');
            if (!tooltipEl) {
                tooltipEl = document.createElement('div');
                tooltipEl.className = 'custom-tooltip';
                const style = tooltipEl.style;
                style.position = 'fixed';
                style.zIndex = '10000';
                style.pointerEvents = 'none';
                style.background = 'rgba(30, 30, 30, 0.94)';
                style.color = '#fff';
                style.padding = '6px 10px';
                style.borderRadius = '8px';
                style.fontSize = '12px';
                style.lineHeight = '1.2';
                style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
                style.opacity = '0';
                style.transform = 'translateZ(0)';
                style.transition = 'opacity 0.15s ease-in-out';
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
export const processStates = new Map();

/**
 * Track a process for a card
 * @param {string} cardId - The card identifier
 * @param {string} processType - Type of process (download, replace, dlc)
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

// Global singleton instances
export const buttonStateManager = new ButtonStateManager();
