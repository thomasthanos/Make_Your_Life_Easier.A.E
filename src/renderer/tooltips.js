import { openPopover, closePopups } from './overlays.js';
import { helpLink } from './overlays.js';
import { uiText } from './ui-text.js';

let tooltip;
let target;
let showTimer;
let hideTimer;
let pinned = false;
let initialized = false;
const tooltipId = 'myle-help-tooltip';

function ensureTooltip() {
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.className = 'custom-tooltip';
        tooltip.setAttribute('role', 'tooltip');
        document.body.appendChild(tooltip);
        tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
        tooltip.addEventListener('mouseleave', scheduleHide);
    }
    return tooltip;
}

function positionTooltip() {
    if (!target?.isConnected || !tooltip) return hideTooltips();
    const anchor = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const gap = 8;
    const maxX = Math.max(gap, window.innerWidth - box.width - gap);
    const maxY = Math.max(gap, window.innerHeight - box.height - gap);
    const y = anchor.bottom + gap + box.height <= window.innerHeight - gap
        ? anchor.bottom + gap : anchor.top - box.height - gap;
    tooltip.style.left = `${Math.max(gap, Math.min(anchor.left, maxX))}px`;
    tooltip.style.top = `${Math.max(gap, Math.min(y, maxY))}px`;
}

export function hideTooltips() {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (target) {
        const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/)
            .filter(id => id && id !== tooltipId);
        if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
        else target.removeAttribute('aria-describedby');
    }
    tooltip?.classList.remove('visible');
    target = null;
    pinned = false;
}

function scheduleHide() {
    if (pinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTooltips, 120);
}

function showTooltip(element, immediate = false) {
    const text = element.getAttribute('data-tooltip');
    if (!text) return;
    hideTooltips();
    target = element;
    showTimer = setTimeout(() => {
        if (target !== element || !element.isConnected) return hideTooltips();
        const popup = ensureTooltip();
        popup.textContent = element.getAttribute('data-tooltip') || '';
        popup.classList.toggle('multiline', popup.textContent.includes('\n'));
        const ids = new Set((element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        ids.add(tooltipId);
        element.setAttribute('aria-describedby', [...ids].join(' '));
        positionTooltip();
        popup.classList.add('visible');
    }, immediate ? 0 : 400);
}

function getTrigger(node) {
    const element = node?.closest?.('[data-tooltip], [title]');
    if (!element) return null;
    attachTooltipHandlers(element);
    return element.getAttribute('data-tooltip') ? element : null;
}

export function initTooltips() {
    if (initialized) return;
    initialized = true;
    document.addEventListener('mouseover', event => {
        const element = getTrigger(event.target);
        if (!element || element.contains(event.relatedTarget) || pinned) return;
        clearTimeout(hideTimer);
        if (element !== target) showTooltip(element);
    });
    document.addEventListener('mouseout', event => {
        if (target?.contains(event.target) && !target.contains(event.relatedTarget)) scheduleHide();
    });
    document.addEventListener('focusin', event => {
        const element = getTrigger(event.target);
        if (element) showTooltip(element);
    });
    document.addEventListener('focusout', event => {
        if (target?.contains(event.target)) hideTooltips();
    });
    document.addEventListener('click', event => {
        const element = getTrigger(event.target);
        if (element?.hasAttribute('data-help-toggle')) {
            const isOpen = element.getAttribute('aria-expanded') === 'true';
            hideTooltips();
            if (isOpen) closePopups();
            else {
                const panel = document.createElement('div');
                panel.className = 'help-popover';
                panel.setAttribute('role', 'note');
                panel.appendChild(document.createTextNode(element.getAttribute('data-tooltip')));
                panel.appendChild(document.createElement('br'));
                panel.appendChild(helpLink());
                element.after(panel);
                openPopover(element, panel, { onClose: () => panel.remove() });
            }
        } else if (!tooltip?.contains(event.target)) hideTooltips();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') hideTooltips();
    });
    document.addEventListener('scroll', event => {
        if (!tooltip?.contains(event.target)) hideTooltips();
    }, true);
    window.addEventListener('resize', hideTooltips);
    window.addEventListener('blur', hideTooltips);
}

export function attachTooltipHandlers(element) {
    if (!element?.getAttribute) return;
    const nativeTitle = element.getAttribute('title');
    if (nativeTitle) {
        element.setAttribute('data-tooltip', nativeTitle);
        element.removeAttribute('title');
    }
    initTooltips();
}

export function createHelpButton(text) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'help-button';
    button.textContent = '?';
    button.setAttribute('aria-label', uiText('help', 'More information'));
    button.setAttribute('data-tooltip', text);
    button.setAttribute('data-help-toggle', '');
    attachTooltipHandlers(button);
    return button;
}
