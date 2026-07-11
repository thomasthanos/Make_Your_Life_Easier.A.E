import { getAppVersionWithFallback } from './utils.js';

const MAX_TOASTS = 3;
const MAX_ERROR_HISTORY = 100;
const SVG_NS = 'http://www.w3.org/2000/svg';

const TYPE_CONFIG = {
    success: {
        icon: 'm4.5 12.75 6 6 9-13.5'
    },
    info: {
        icon: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z'
    },
    warning: {
        icon: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z'
    }
};

let currentErrorCard = null;
let errorPaletteIndex = 0;
const errorBulletColours = ['#8a8e99', '#0a84ff', '#aeb4be', '#ffd60a', '#30d158'];

const errorHistory = [];

function recordError(message, { stack = '', source = '' } = {}) {
    message = String(message);
    const last = errorHistory[errorHistory.length - 1];
    if (last && last.message === message && Date.now() - last.at < 1000) return;
    errorHistory.push({
        at: Date.now(),
        time: new Date().toLocaleTimeString('en-GB'),
        message,
        stack: String(stack || ''),
        source
    });
    if (errorHistory.length > MAX_ERROR_HISTORY) errorHistory.shift();
}

function stringifyArg(arg) {
    if (arg instanceof Error) return arg.message;
    if (typeof arg === 'object' && arg !== null) {
        try { return JSON.stringify(arg); } catch { return String(arg); }
    }
    return String(arg);
}

function installGlobalErrorCapture() {
    if (window.__errorCaptureInstalled) return;
    window.__errorCaptureInstalled = true;

    const originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
        originalConsoleError(...args);
        try {
            let parts = args;
            // debug() prepends a "%c<emoji>" format string plus its CSS style — drop both
            if (typeof parts[0] === 'string' && parts[0].startsWith('%c')) parts = parts.slice(2);
            const errArg = parts.find((a) => a instanceof Error);
            const message = parts.map(stringifyArg).join(' ').trim();
            if (message) recordError(message, { stack: errArg?.stack || '', source: 'console' });
        } catch { }
    };

    window.addEventListener('error', (ev) => {
        if (!ev.message && !ev.error) return;
        const stack = ev.error?.stack || (ev.filename ? `    at ${ev.filename}:${ev.lineno}:${ev.colno}` : '');
        recordError(ev.message || String(ev.error), { stack, source: 'uncaught' });
        showErrorCard(ev.message || String(ev.error), { _skipRecord: true });
    });

    window.addEventListener('unhandledrejection', (ev) => {
        const reason = ev.reason;
        const message = reason instanceof Error ? reason.message : String(reason);
        recordError(message, { stack: reason instanceof Error ? reason.stack || '' : '', source: 'unhandled promise' });
        showErrorCard(message, { _skipRecord: true });
    });
}

installGlobalErrorCapture();

async function buildBugReport() {
    let version = 'unknown';
    try { version = await getAppVersionWithFallback(); } catch { }
    const activePage = document.querySelector('#menu-list button.active')?.dataset.key || 'unknown';
    const platform = navigator.userAgentData?.platform || navigator.platform || 'unknown';

    const lines = [
        '════════ MAKE YOUR LIFE EASIER — BUG REPORT ════════',
        `Date:        ${new Date().toISOString()} (local: ${new Date().toLocaleString('en-GB')})`,
        `App version: ${version}`,
        `Platform:    ${platform}`,
        `User agent:  ${navigator.userAgent}`,
        `Language:    ${document.documentElement.lang || navigator.language}`,
        `Active page: ${activePage}`,
        `Window:      ${window.innerWidth}x${window.innerHeight} (screen ${window.screen.width}x${window.screen.height})`,
        `Online:      ${navigator.onLine ? 'yes' : 'no'}`,
        '',
        `──────── Errors this session (${errorHistory.length}) ────────`
    ];

    if (!errorHistory.length) {
        lines.push('(no errors recorded)');
    }
    for (const entry of errorHistory) {
        lines.push('');
        const origin = entry.source ? ` [${entry.source}]` : '';
        lines.push(`[${entry.time}]${origin} ${entry.message}`);
        if (entry.stack) {
            let stack = entry.stack;
            if (stack.startsWith(`Error: ${entry.message}`) || stack.startsWith(entry.message)) {
                stack = stack.split('\n').slice(1).join('\n');
            }
            const indented = stack
                .split('\n')
                .filter((l) => l.trim() !== '')
                .map((l) => `    ${l.trim()}`)
                .join('\n');
            if (indented) lines.push(indented);
        }
    }

    lines.push('');
    lines.push('Paste this report at: https://github.com/thomasthanos/Make_Your_Life_Easier.A.E/issues');
    lines.push('════════ END OF REPORT ════════');
    return lines.join('\n');
}

function ensureNotificationCenter() {
    let center = document.getElementById('notification-center');
    if (!center) {
        center = document.createElement('div');
        center.id = 'notification-center';

        const stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.setAttribute('aria-live', 'polite');

        const errors = document.createElement('div');
        errors.id = 'error-container';
        errors.setAttribute('aria-live', 'assertive');

        center.appendChild(stack);
        center.appendChild(errors);
        document.body.appendChild(center);
    }
    return {
        toasts: center.querySelector('#toast-stack'),
        errors: center.querySelector('#error-container')
    };
}

function createIcon(pathD, opts = {}) {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', opts.strokeWidth || '1.5');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (opts.className) svg.setAttribute('class', opts.className);
    for (const d of Array.isArray(pathD) ? pathD : [pathD]) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        path.setAttribute('d', d);
        svg.appendChild(path);
    }
    return svg;
}

function dismissToast(toastEl) {
    if (!toastEl || toastEl.classList.contains('toast-exit')) return;
    if (toastEl._dismissTimer) {
        clearTimeout(toastEl._dismissTimer);
        toastEl._dismissTimer = null;
    }
    toastEl.classList.add('toast-exit');
    const remove = () => toastEl.remove();
    toastEl.addEventListener('animationend', remove, { once: true });
    setTimeout(remove, 400);
}

export function toast(msg, opts = {}) {
    const { title = '', type = 'info', duration = 4000 } = opts;

    if (type === 'error') {
        showErrorCard(msg, { title: title || 'Error', error: opts.error });
        return null;
    }

    const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
    const { toasts } = ensureNotificationCenter();

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${TYPE_CONFIG[type] ? type : 'info'}`;
    toastEl.setAttribute('role', 'status');

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'toast-icon-wrapper';
    iconWrapper.appendChild(createIcon(config.icon, { className: 'toast-svg-icon' }));

    const content = document.createElement('div');
    content.className = 'toast-content';
    if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'toast-title';
        titleEl.textContent = title;
        content.appendChild(titleEl);
    }
    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.textContent = msg;
    content.appendChild(messageEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '×';
    closeBtn.onclick = () => dismissToast(toastEl);

    toastEl.appendChild(iconWrapper);
    toastEl.appendChild(content);
    toastEl.appendChild(closeBtn);

    if (duration > 0) {
        const progress = document.createElement('div');
        progress.className = 'toast-progress';
        progress.style.animationDuration = `${duration}ms`;
        progress.addEventListener('animationend', () => dismissToast(toastEl), { once: true });
        toastEl.appendChild(progress);
        // Fallback: the progress bar's animationend is throttled/paused while the
        // window is minimized, so a timer guarantees the toast still auto-dismisses.
        toastEl._dismissTimer = setTimeout(() => dismissToast(toastEl), duration + 150);
    }

    toasts.appendChild(toastEl);

    const active = toasts.querySelectorAll('.toast:not(.toast-exit)');
    for (let i = 0; i < active.length - MAX_TOASTS; i++) {
        dismissToast(active[i]);
    }

    return toastEl;
}

function appendErrorLine(bodyEl, msg) {
    const colour = errorBulletColours[errorPaletteIndex % errorBulletColours.length];
    errorPaletteIndex++;

    const line = document.createElement('div');
    line.className = 'error-line';

    const dash = document.createElement('span');
    dash.textContent = '- ';
    dash.style.color = colour;

    const msgSpan = document.createElement('span');
    msgSpan.className = 'error-msg';
    msgSpan.textContent = msg;

    line.appendChild(dash);
    line.appendChild(msgSpan);
    bodyEl.appendChild(line);
}

export function showErrorCard(msg, opts = {}) {
    msg = String(msg);
    if (!opts._skipRecord) {
        recordError(msg, {
            stack: opts.error instanceof Error ? opts.error.stack || '' : '',
            source: opts.title && opts.title !== 'Error' ? opts.title : ''
        });
    }
    if (msg.includes('\n')) {
        for (const part of msg.split(/\n+/).filter((p) => p.trim() !== '')) {
            showErrorCard(part, { ...opts, _skipRecord: true });
        }
        return;
    }

    const { errors } = ensureNotificationCenter();

    if (currentErrorCard && currentErrorCard.isConnected) {
        appendErrorLine(currentErrorCard.bodyEl, msg);
        return;
    }

    const card = document.createElement('div');
    card.className = 'error-card';

    const wrap = document.createElement('div');
    wrap.className = 'error-wrap';

    const terminal = document.createElement('div');
    terminal.className = 'error-terminal';

    const head = document.createElement('div');
    head.className = 'error-head';

    const titleEl = document.createElement('p');
    titleEl.className = 'error-title';
    titleEl.appendChild(createIcon(
        'M7 15L10 12L7 9M13 15H17M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z',
        { strokeWidth: '2' }
    ));
    titleEl.appendChild(document.createTextNode(' Terminal'));

    const reportBtn = document.createElement('button');
    reportBtn.className = 'error-report';
    reportBtn.setAttribute('aria-label', 'Report a bug — copy full error report');
    reportBtn.setAttribute('title', 'Report a bug');
    reportBtn.appendChild(createIcon([
        'm8 2 1.88 1.88',
        'M14.12 3.88 16 2',
        'M9 7.13v-1a3.003 3.003 0 1 1 6 0v1',
        'M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6',
        'M12 20v-9',
        'M6.53 9C4.6 8.8 3 7.1 3 5',
        'M6 13H2',
        'M3 21c0-2.1 1.7-3.8 3.8-4',
        'M20.97 5c0 2.1-1.6 3.8-3.5 4',
        'M22 13h-4',
        'M17.2 17c2.1.2 3.8 1.9 3.8 4'
    ], { strokeWidth: '2' }));

    const copyBtn = document.createElement('button');
    copyBtn.className = 'error-copy';
    copyBtn.setAttribute('aria-label', 'Copy error messages');
    copyBtn.setAttribute('title', 'Copy messages');
    copyBtn.appendChild(createIcon([
        'M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2',
        'M9 3m0 2a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v0a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2z'
    ], { strokeWidth: '2' }));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'error-close';
    closeBtn.setAttribute('aria-label', 'Close error card');
    closeBtn.appendChild(createIcon(['M6 6L18 18', 'M6 18L18 6'], { strokeWidth: '2' }));

    head.appendChild(titleEl);
    head.appendChild(reportBtn);
    head.appendChild(copyBtn);
    head.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'error-body';
    body.setAttribute('role', 'alert');

    terminal.appendChild(head);
    terminal.appendChild(body);
    wrap.appendChild(terminal);
    card.appendChild(wrap);
    errors.appendChild(card);

    card.bodyEl = body;
    appendErrorLine(body, msg);

    copyBtn.onclick = () => {
        try {
            const text = body.innerText.replace(/\n+$/g, '');
            navigator.clipboard.writeText(text)
                .then(() => toast('Error messages copied to clipboard!', { type: 'success', title: 'Clipboard' }))
                .catch(() => toast('Failed to copy', { type: 'error', title: 'Clipboard' }));
        } catch {
            toast('Failed to copy', { type: 'error', title: 'Clipboard' });
        }
    };

    reportBtn.onclick = async () => {
        try {
            const report = await buildBugReport();
            await navigator.clipboard.writeText(report);
            toast('Full bug report copied — paste it into a GitHub issue.', { type: 'success', title: 'Bug report' });
        } catch {
            toast('Failed to copy bug report', { type: 'error', title: 'Bug report' });
        }
    };

    closeBtn.onclick = () => {
        card.remove();
        currentErrorCard = null;
    };

    currentErrorCard = card;
}
