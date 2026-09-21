import { uiText } from './ui-text.js';
import { button, element, emptyState, icon, progress } from './ui.js';
import { openPopover } from './overlays.js';

let sequence = 0;
const entries = [];
const listeners = new Set();
const publish = () => listeners.forEach(listener => {
    try { listener(); } catch (error) { console.error('Activity view:', error); }
});
export function activities() { return entries.map(entry => ({ ...entry })); }
export function subscribeActivity(listener) {
    listeners.add(listener);
    listener();
    return () => listeners.delete(listener);
}
export function recordActivity(data) {
    const entry = { id: `activity-${++sequence}`, time: Date.now(), count: 1, status: 'complete', type: 'info', ...data };
    if (entry.status === 'running') entry.operationId ||= entry.id;
    const duplicate = entry.status !== 'running' && entries.find(item =>
        item.status !== 'running' && item.source === entry.source && item.operationId === entry.operationId &&
        item.message === entry.message && item.type === entry.type && item.title === entry.title && Date.now() - item.time < 10000);
    if (duplicate) {
        duplicate.count++;
        duplicate.time = Date.now();
        publish();
        return duplicate;
    }
    entries.unshift(entry);
    trim();
    publish();
    return entry;
}
function trim() {
    let completed = 0;
    for (let i = 0; i < entries.length; i++) {
        if (entries[i].status !== 'running' && ++completed > 100) entries.splice(i--, 1);
    }
}
export function updateActivity(id, patch) {
    const entry = entries.find(item => item.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    trim();
    publish();
}
export function clearActivity() {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].status !== 'running') entries.splice(i, 1);
    publish();
}

const pending = [];
const visible = new Map();
let currentSource = 'app';
export function setNotificationSource(source) { currentSource = source; }
export function createNotifier(source) {
    return (message, options = {}) => toast(message, { ...options, source });
}
function dismissToast(node) {
    if (!node) return;
    node._stopTimer?.();
    visible.delete(node.dataset.activityId);
    node.remove();
    flush();
}
function copyDetails(entry, feedback) {
    navigator.clipboard.writeText([entry.title, entry.message, entry.details].filter(Boolean).join('\n'))
        .then(() => { feedback.textContent = uiText('copied', 'Copied'); })
        .catch(() => { feedback.textContent = uiText('copy_failed', 'Failed to copy'); });
}
function details(entry) {
    const node = element('details', 'activity-details');
    node.append(element('summary', '', uiText('details', 'Technical details')));
    node.append(element('pre', '', entry.details || entry.message));
    const copy = button(uiText('copy_details', 'Copy details'), () => copyDetails(entry, copy));
    node.append(copy);
    return node;
}
export function openActivityPanel() {
    const anchor = document.getElementById('activity-toggle');
    if (!anchor) return;
    pending.length = 0;
    [...visible.values()].forEach(dismissToast);
    const panel = element('section', 'activity-panel');
    panel.setAttribute('aria-label', uiText('activity', 'Activity'));
    const header = element('header', 'activity-panel-header');
    const heading = element('div', 'activity-heading');
    const headingCopy = element('div');
    headingCopy.append(element('h2', '', uiText('activity', 'Activity')), element('p', '', uiText('activity_session', 'Your current session')));
    heading.append(icon('activity'), headingCopy);
    let close = () => {};
    const dismiss = button('', () => close(), 'ui-icon-button');
    dismiss.append(icon('close'));
    dismiss.setAttribute('aria-label', uiText('close', 'Close'));
    header.append(heading, dismiss);
    const filters = element('div', 'activity-filters');
    const list = element('div', 'activity-list');
    const cards = new Map();
    let filter = 'all';
    const allButton = button(uiText('activity_all', 'Recent'), () => { filter = 'all'; render(); }, 'activity-filter');
    const runningButton = button('', () => { filter = 'running'; render(); }, 'activity-filter');
    filters.append(allButton, runningButton);
    const footer = element('footer', 'activity-panel-footer');
    const count = element('span');
    const clear = button(uiText('clear_history', 'Clear history'), clearActivity, 'ui-text-button');
    footer.append(count, clear);
    panel.append(header, filters, list, footer);
    function render() {
        const all = activities();
        const active = all.filter(entry => entry.status === 'running').length;
        runningButton.textContent = uiText('activity_running', 'Running') + (active ? ' · ' + active : '');
        allButton.setAttribute('aria-pressed', String(filter === 'all'));
        runningButton.setAttribute('aria-pressed', String(filter === 'running'));
        clear.disabled = !all.some(entry => entry.status !== 'running');
        count.textContent = uiText('activity_completed', '{count} completed', { count: all.length - active });
        const shown = all.filter(entry => filter === 'all' || entry.status === 'running').sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running'));
        const ids = new Set(shown.map(entry => entry.id));
        for (const [id, card] of cards) if (!ids.has(id)) { card.remove(); cards.delete(id); }
        list.querySelector('.ui-empty')?.remove();
        if (!shown.length) {
            const empty = emptyState('');
            empty.append(icon('check'), element('h3', '', uiText(filter === 'running' ? 'activity_idle' : 'activity_empty_title', 'Nothing running')),
                element('p', '', uiText('activity_empty', 'Installations and task results appear here.')));
            list.replaceChildren(empty);
        }
        for (const entry of shown) {
            const previous = cards.get(entry.id);
            const signature = JSON.stringify([entry.title, entry.time, entry.count, entry.type, entry.message, entry.status, entry.phase, entry.percent, entry.details, entry.actionLabel, !!entry.action]);
            if (previous?.dataset.signature === signature) continue;
            const wasOpen = previous?.querySelector('details')?.open;
            const focused = previous?.contains(document.activeElement) ? document.activeElement.tagName : null;
            const card = element('article', 'activity-entry is-' + entry.type + (entry.status === 'running' ? ' is-running' : ''));
            card.dataset.signature = signature;
            cards.set(entry.id, card);
            const mark = icon(entry.status === 'running' ? 'activity' : entry.type === 'error' || entry.type === 'warning' ? 'error' : entry.status === 'cancelled' ? 'clock' : 'check', 'activity-mark');
            const copy = element('div', 'activity-entry-copy');
            const top = element('div', 'activity-entry-top');
            top.append(element('h3', '', (entry.title || uiText('activity', 'Activity')) + (entry.count > 1 ? ' ×' + entry.count : '')),
                element('time', '', new Date(entry.time).toLocaleTimeString(document.documentElement.lang, { hour: '2-digit', minute: '2-digit' })));
            copy.append(top);
            if (entry.status === 'running') copy.append(progress(entry.phase || entry.message || uiText('working', 'Working…'), entry.percent));
            else copy.append(element('p', '', entry.type === 'error' ? uiText('error_summary', 'The action could not be completed. Review the details before trying again.') : entry.message));
            if (entry.type === 'error' || entry.details) {
                const extra = details(entry); extra.open = !!wasOpen; copy.append(extra);
            }
            if (typeof entry.action === 'function') copy.append(button(entry.actionLabel || uiText('retry', 'Retry'), entry.action, 'ui-text-button'));
            card.append(mark, copy);
            if (previous) previous.replaceWith(card);
            else list.insertBefore(card, list.children[shown.indexOf(entry)] || null);
            if (focused) card.querySelector(focused.toLowerCase())?.focus({ preventScroll: true });
        }
    }
    const stop = subscribeActivity(render);
    document.body.append(panel);
    close = openPopover(anchor, panel, { keyboard: 'panel', onClose: () => { stop(); panel.remove(); } });
}
function flush() {
    while (visible.size < 2 && pending.length) show(pending.shift());
}
function show(entry) {
    let center = document.getElementById('notification-center');
    if (!center) {
        center = element('div');
        center.id = 'notification-center';
        center.setAttribute('aria-label', uiText('notifications', 'Notifications'));
        document.body.append(center);
    }
    const node = element('div', `ui-toast is-${entry.type}`);
    node.dataset.activityId = entry.id;
    node.setAttribute('role', entry.type === 'error' ? 'alert' : 'status');
    const copy = element('div', 'ui-toast-copy');
    copy.append(element('strong', '', entry.title || uiText(entry.type, 'Information')));
    copy.append(element('p', '', entry.type === 'error' ? uiText('error_summary', 'The action could not be completed. Review the details before trying again.') : entry.message));
    if (entry.type === 'error' || entry.details) copy.append(button(uiText('view_activity', 'View details'), openActivityPanel, 'ui-text-button'));
    copy.append(element('span', 'ui-toast-count', entry.count > 1 ? `×${entry.count}` : ''));
    const close = button('×', () => dismissToast(node), 'ui-icon-button');
    close.setAttribute('aria-label', uiText('dismiss', 'Dismiss notification'));
    node.append(icon(entry.type === 'error' || entry.type === 'warning' ? 'error' : 'check', 'toast-mark'), copy, close);
    visible.set(entry.id, node);
    center.append(node);
    let timer, start, remaining = entry.type === 'error' ? 0 : entry.type === 'warning' ? 8000 : 5000;
    const resume = () => {
        if (!remaining || node.matches(':hover') || node.contains(document.activeElement)) return;
        clearTimeout(timer);
        start = performance.now();
        timer = setTimeout(() => dismissToast(node), remaining);
    };
    const pause = () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(1, remaining - (performance.now() - start));
    };
    node._stopTimer = () => clearTimeout(timer);
    node.addEventListener('mouseenter', pause);
    node.addEventListener('mouseleave', resume);
    node.addEventListener('focusin', pause);
    node.addEventListener('focusout', () => queueMicrotask(resume));
    resume();
    return node;
}
export function toast(message, options = {}) {
    const source = options.source || currentSource;
    // An operation's immediate result toast belongs to the same history entry.
    const completed = activities().find(item => options.operationId ? item.id === options.operationId : item.source === source && item.operationId && item.status !== 'running' && !item.notified && Date.now() - (item.completedAt || 0) < 2000);
    let entry;
    if (completed && ['success', 'error', 'warning'].includes(options.type)) {
        updateActivity(completed.id, { message: String(message), type: options.type, notified: true, details: completed.details || (options.type === 'error' ? String(message) : '') });
        entry = activities().find(item => item.id === completed.id);
    } else entry = recordActivity({ source, ...options, message: String(message) });
    if (document.querySelector('.activity-panel.ui-popover')) return null;
    const existing = visible.get(entry.id);
    if (existing) {
        existing.querySelector('.ui-toast-count').textContent = `×${entry.count}`;
        return existing;
    }
    if (!pending.some(item => item.id === entry.id)) pending.push(entry);
    if (pending.length > 20) pending.splice(0, pending.length - 20);
    flush();
    return visible.get(entry.id) || null;
}
export function showErrorCard(message, options = {}) { return toast(message, { ...options, type: 'error' }); }
