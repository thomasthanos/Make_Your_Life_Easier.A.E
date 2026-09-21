import { uiText } from './ui-text.js';
import { stripAnsi } from './utils.js';

export function createStreamTerminal(stopLabel) {
    const terminal = document.createElement('div');
    terminal.className = 'winget-terminal';

    const header = document.createElement('div');
    header.className = 'winget-terminal-header';

    const dots = document.createElement('div');
    dots.className = 'winget-terminal-dots';
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('span'));

    const title = document.createElement('span');
    title.className = 'winget-terminal-title';

    const stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'winget-terminal-stop';
    stopBtn.textContent = stopLabel;

    header.appendChild(dots);
    header.appendChild(title);
    header.appendChild(stopBtn);

    const body = document.createElement('div');
    body.className = 'winget-terminal-body';

    terminal.appendChild(header);
    terminal.appendChild(body);

    let currentLine = null;
    let replaceCurrent = false;
    const MAX_LINES = 400;

    function newLine(className) {
        currentLine = document.createElement('div');
        currentLine.className = 'winget-terminal-line';
        if (className) currentLine.classList.add(className);
        body.appendChild(currentLine);
        while (body.childElementCount > MAX_LINES) {
            body.removeChild(body.firstElementChild);
        }
    }

    function append(text, className) {
        const clean = stripAnsi(text).replace(/\r\n/g, '\n');
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
        body.scrollTop = body.scrollHeight;
    }

    function print(text, className) {
        currentLine = null;
        newLine(className);
        currentLine.textContent = text;
        currentLine = null;
        body.scrollTop = body.scrollHeight;
    }

    function reset() {
        body.innerHTML = '';
        currentLine = null;
        replaceCurrent = false;
    }

    return { terminal, title, stopBtn, append, print, reset };
}

export function closeOtherTerminals(current) {
    document.querySelectorAll('.winget-terminal.open').forEach((terminal) => {
        if (terminal !== current && !terminal.classList.contains('running')) {
            terminal.classList.remove('open');
        }
    });
}

export function openTerminal(terminal) {
    if (!terminal) return;
    const body = terminal.querySelector('.winget-terminal-body');
    if (body && !body.closest('.terminal-details')) {
        const details = document.createElement('details');
        details.className = 'terminal-details';
        const summary = document.createElement('summary');
        summary.textContent = uiText('details', 'Technical details');
        body.before(details);
        details.append(summary, body);
    }
    terminal.classList.add('open', 'running');
    requestAnimationFrame(() => {
        if (terminal.isConnected) terminal.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest' });
    });
}
