import { createNotifier } from '../notifications.js';
const toast = createNotifier('christitus');
import { taskApi } from '../operations.js';
import { uiText } from '../ui-text.js';

import { escapeHtml } from '../utils.js';
import { createStreamTerminal, closeOtherTerminals, openTerminal } from '../terminal.js';


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

    const subtitleText = (translations.christitus_page && translations.christitus_page.subtitle_full) || 'COMPREHENSIVE TOOLBOX FOR WINDOWS OPTIMIZATION';
    const titleWrapper = el('div');
    titleWrapper.innerHTML = `
    <p class="tool-card-sub">${escapeHtml(subtitleText)}</p>
  `;
    header.appendChild(icon);
    header.appendChild(titleWrapper);
    card.appendChild(header);

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

    const actions = el('div', 'tool-card-actions');
    const launchBtn = el('button', 'tool-card-launch', `<span class="tool-card-iconmono">›_</span>${escapeHtml(uiText('launch_tool', 'Launch tool'))}`);
    const ghBtn = el('button', 'tool-card-outline', `<span class="tool-card-iconmono">↗</span>GitHub`);
    actions.appendChild(launchBtn);
    actions.appendChild(ghBtn);
    card.appendChild(actions);

    const setStatus = (msg, type = '') => {
        if (msg) {
            const toastType = (type && type.toLowerCase().includes('error')) ? 'error' : 'success';
            toast(msg, { type: toastType });
        }
    };

    const term = createStreamTerminal(uiText("stop", "Stop"));
    term.title.textContent = 'irm christitus.com/win | iex';
    const { terminal, stopBtn } = term;
    const appendOutput = term.append;
    const printLine = term.print;
    card.appendChild(terminal);

    let running = false;
    let cancelled = false;

    launchBtn.addEventListener('click', async () => {
        if (running) return;
        running = true;
        cancelled = false;
        launchBtn.disabled = true;

        term.reset();
        closeOtherTerminals(terminal);
        openTerminal(terminal);
        printLine('> irm christitus.com/win | iex', 'is-cmd');

        const unsubscribe = taskApi.onChrisTitusOutput(({ stream, text }) => {
            appendOutput(text, stream === 'stderr' ? 'is-stderr' : undefined);
        });

        try {
            const result = await taskApi.runChrisTitus();
            if (result && result.success) {
                printLine(uiText("utility_done_log", "✔ Utility finished."), 'is-ok');
                setStatus(uiText("utility_done", "Windows Utility finished."), 'success');
            } else if (!result || !result.cancelled) {
                printLine(`✖ ${result?.error || `Utility exited with code ${result?.code ?? '?'}.`}`, 'is-err');
                setStatus(uiText('launch_failed', 'Could not launch the tool.') + ' ' + (result?.error || uiText("unknown_error", "Unknown error")), 'error');
            }
        } catch (e) {
            if (!cancelled) {
                printLine(`✖ ${e.message}`, 'is-err');
                setStatus(uiText('launch_failed', 'Could not launch the tool.') + ' ' + e.message, 'error');
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
            await taskApi.cancelChrisTitus();
            printLine(uiText("stopped", "■ Stopped."), 'is-warn');
        } finally {
            stopBtn.disabled = false;
        }
    });

    ghBtn.addEventListener('click', async () => {
        try {
            if (taskApi?.openExternal) await taskApi.openExternal('https://github.com/ChrisTitusTech/winutil');
            else window.open('https://github.com/ChrisTitusTech/winutil', '_blank');
        } catch {  }
    });

    return card;
}
