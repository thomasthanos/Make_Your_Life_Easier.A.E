/**
 * Utilities Page
 * Contains the ChrisTitus page
 * CSS classes match original renderer.js structure
 */

import { escapeHtml } from '../utils.js';
import { toast, closeOtherTerminals } from '../components.js';

// ============================================
// CHRIS TITUS PAGE (Original Structure)
// ============================================

const svgDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export function buildChrisTitusPage(translations, _settings) {
    const el = (t, cls, html) => {
        const n = document.createElement(t);
        if (cls) n.className = cls;
        if (html !== undefined) n.innerHTML = html;
        return n;
    };

    const card = el('section', 'tool-card');

    const style = document.createElement('style');
    card.appendChild(style);

    // Header
    const header = el('div', 'tool-card-header');
    const icon = el('img', 'tool-card-icon');
    const terminalSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="none" stroke="#1ea8ff" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>`;
    icon.src = svgDataUrl(terminalSVG);

    const titleText = (translations.menu && translations.menu.christitus) || 'Windows Utility';
    const subtitleText = (translations.christitus_page && translations.christitus_page.subtitle_full) || 'COMPREHENSIVE TOOLBOX FOR WINDOWS OPTIMIZATION';
    const titleWrapper = el('div');
    titleWrapper.innerHTML = `
    <h2 class="tool-card-title">${escapeHtml(titleText)}</h2>
    <p class="tool-card-sub">${escapeHtml(subtitleText)}</p>
  `;
    header.appendChild(icon);
    header.appendChild(titleWrapper);
    card.appendChild(header);

    // Features List
    const features = (translations.christitus_page && Array.isArray(translations.christitus_page.features))
        ? translations.christitus_page.features
        : [
            'System optimization and tweaks',
            'Remove bloatware and unwanted apps',
            'Privacy and security enhancements',
            'Essential software installation'
        ];

    const bulletHtml = features
        .filter(item => item != null && item !== '')
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('');
    card.appendChild(el('ul', 'tool-card-bullets', bulletHtml));

    // Action Buttons
    const actions = el('div', 'tool-card-actions');
    const launchBtn = el('button', 'tool-card-launch', `<span class="tool-card-iconmono">›_</span>Launch Tool`);
    const ghBtn = el('button', 'tool-card-outline', `<span class="tool-card-iconmono">↗</span>GitHub`);
    actions.appendChild(launchBtn);
    actions.appendChild(ghBtn);
    card.appendChild(actions);

    // Status
    const status = el('div', 'tool-card-status');
    card.appendChild(status);

    const setStatus = (msg, type = '') => {
        status.className = 'tool-card-status';
        status.textContent = '';
        if (msg) {
            const toastType = (type && type.toLowerCase().includes('error')) ? 'error' : 'success';
            toast(msg, { type: toastType });
        }
    };

    const terminal = el('div', 'winget-terminal');
    const termHeader = el('div', 'winget-terminal-header');
    const dots = el('div', 'winget-terminal-dots');
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));
    const termTitle = el('span', 'winget-terminal-title', 'irm christitus.com/win | iex');
    const stopBtn = el('button', 'winget-terminal-stop', 'Stop');
    stopBtn.type = 'button';
    termHeader.appendChild(dots);
    termHeader.appendChild(termTitle);
    termHeader.appendChild(stopBtn);
    const termBody = el('div', 'winget-terminal-body');
    terminal.appendChild(termHeader);
    terminal.appendChild(termBody);
    card.appendChild(terminal);

    let running = false;
    let cancelled = false;
    let currentLine = null;
    let replaceCurrent = false;
    const MAX_LINES = 400;

    const stripAnsiSequences = (text) => String(text)
        .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\x08/g, '');

    function newLine(className) {
        currentLine = document.createElement('div');
        currentLine.className = 'winget-terminal-line';
        if (className) currentLine.classList.add(className);
        termBody.appendChild(currentLine);
        while (termBody.childElementCount > MAX_LINES) {
            termBody.removeChild(termBody.firstElementChild);
        }
    }

    function appendOutput(text, className) {
        const clean = stripAnsiSequences(text).replace(/\r\n/g, '\n');
        for (const chunk of clean.split(/(\n|\r)/)) {
            if (chunk === '\n') {
                currentLine = null;
                replaceCurrent = false;
            } else if (chunk === '\r') {
                replaceCurrent = true;
            } else if (chunk) {
                if (!currentLine) newLine(className);
                if (replaceCurrent) {
                    currentLine.textContent = chunk;
                    replaceCurrent = false;
                } else {
                    currentLine.textContent += chunk;
                }
            }
        }
        termBody.scrollTop = termBody.scrollHeight;
    }

    function printLine(text, className) {
        currentLine = null;
        newLine(className);
        currentLine.textContent = text;
        currentLine = null;
        termBody.scrollTop = termBody.scrollHeight;
    }

    launchBtn.addEventListener('click', async () => {
        if (running) return;
        running = true;
        cancelled = false;
        launchBtn.disabled = true;

        termBody.innerHTML = '';
        currentLine = null;
        replaceCurrent = false;
        closeOtherTerminals(terminal);
        terminal.classList.add('open', 'running');
        printLine('> irm christitus.com/win | iex', 'is-cmd');

        const unsubscribe = window.api.onChrisTitusOutput(({ stream, text }) => {
            appendOutput(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await window.api.runChrisTitus();
            if (result && result.success) {
                printLine('✔ Utility finished.', 'is-ok');
                setStatus('Windows Utility finished.', 'success');
            } else if (!result || !result.cancelled) {
                printLine(`✖ ${result?.error || `Utility exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                setStatus('Failed to launch: ' + (result?.error || 'Unknown error'), 'error');
            }
        } catch (e) {
            if (!cancelled) {
                printLine(`✖ ${e.message}`, 'is-err');
                setStatus('Failed to launch: ' + e.message, 'error');
            }
        } finally {
            unsubscribe();
            running = false;
            terminal.classList.remove('running');
            launchBtn.disabled = false;
        }
    });

    stopBtn.addEventListener('click', async () => {
        if (!running) return;
        cancelled = true;
        stopBtn.disabled = true;
        try {
            await window.api.cancelChrisTitus();
            printLine('■ Stopped.', 'is-warn');
        } finally {
            stopBtn.disabled = false;
        }
    });

    ghBtn.addEventListener('click', async () => {
        try {
            if (window.api?.openExternal) await window.api.openExternal('https://github.com/ChrisTitusTech/winutil');
            else window.open('https://github.com/ChrisTitusTech/winutil', '_blank');
        } catch { /* ignore – best-effort external link */ }
    });

    return card;
}
