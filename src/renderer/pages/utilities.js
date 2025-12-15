/**
 * Utilities Page
 * Contains Password Manager and ChrisTitus pages
 * CSS classes match original renderer.js structure
 */

import { debug, escapeHtml } from '../utils.js';
import { buttonStateManager } from '../managers.js';
import { toast } from '../components.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates a modern styled button (original structure)
 */
function createModernButton(text, onClick, options = {}) {
    const button = document.createElement('button');
    button.className = options.secondary ? 'button button-secondary' : 'button';
    button.textContent = text;

    if (options.icon) {
        button.innerHTML = `${options.icon} ${escapeHtml(text)}`;
    }

    if (onClick) {
        button.addEventListener('click', onClick);
    }

    if (options.style) {
        Object.assign(button.style, options.style);
    }

    return button;
}

/**
 * Shows notification message
 */
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `toast status-${type}`;
    notification.textContent = message;
    notification.classList.add('notification');

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('slide-out');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// PASSWORD MANAGER PAGE (Original Structure)
// ============================================

export function buildPasswordManagerPage(translations, settings) {
    const container = document.createElement('div');
    container.className = 'card password-manager-card';

    // Warning Banner
    const warning = document.createElement('div');
    warning.className = 'password-warning-banner';

    const warningIcon = document.createElement('div');
    warningIcon.className = 'warning-icon';
    warningIcon.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `;

    const warningContent = document.createElement('div');
    warningContent.className = 'warning-content';

    const warningTitle = document.createElement('div');
    warningTitle.className = 'warning-title';
    warningTitle.textContent = translations.messages?.security_notice || 'Security Notice';

    const warningText = document.createElement('div');
    warningText.className = 'warning-text';
    warningText.textContent = translations.messages?.password_warning || 'Your passwords are stored securely encrypted on your local device only.';

    warningContent.appendChild(warningTitle);
    warningContent.appendChild(warningText);
    warning.appendChild(warningIcon);
    warning.appendChild(warningContent);
    container.appendChild(warning);

    // Features List
    const features = document.createElement('div');
    features.className = 'password-features';

    const featuresList = [
        { icon: '🔐', text: translations.messages?.encrypted_storage || 'Military-grade encryption' },
        { icon: '💾', text: translations.messages?.local_storage || 'Local storage only' },
        { icon: '⚡', text: translations.messages?.quick_access || 'One-click autofill' },
        { icon: '🔍', text: translations.messages?.secure_search || 'Encrypted search' }
    ];

    featuresList.forEach(feature => {
        const featureItem = document.createElement('div');
        featureItem.className = 'feature-item';

        const featureIcon = document.createElement('span');
        featureIcon.className = 'feature-icon';
        featureIcon.textContent = feature.icon;

        const featureText = document.createElement('span');
        featureText.className = 'feature-text';
        featureText.textContent = feature.text;

        featureItem.appendChild(featureIcon);
        featureItem.appendChild(featureText);
        features.appendChild(featureItem);
    });

    container.appendChild(features);

    // Action Section
    const actionSection = document.createElement('div');
    actionSection.className = 'password-actions';

    const btn = createModernButton(
        translations.actions?.open_password_manager || 'Open Password Manager',
        async () => {
            try {
                const result = await window.api.openPasswordManager(settings.lang);
                if (!result.success) {
                    showNotification('Failed to open password manager', 'error');
                }
            } catch (error) {
                showNotification('Error opening password manager: ' + error.message, 'error');
            }
        },
        {
            icon: '🔓',
            variant: 'primary',
            size: 'large'
        }
    );
    btn.className = 'password-manager-btn';

    actionSection.appendChild(btn);
    container.appendChild(actionSection);

    return container;
}

// ============================================
// CHRIS TITUS PAGE (Original Structure)
// ============================================

const svgDataUrl = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export function buildChrisTitusPage(translations, settings) {
    const el = (t, cls, html) => {
        const n = document.createElement(t);
        if (cls) n.className = cls;
        if (html !== undefined) n.innerHTML = html;
        return n;
    };

    const card = el('section', 'ctt-card');

    const style = document.createElement('style');
    card.appendChild(style);

    // Header
    const header = el('div', 'ctt-header');
    const icon = el('img', 'ctt-icon');
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
    <h2 class="ctt-title">${escapeHtml(titleText)}</h2>
    <p class="ctt-sub">${escapeHtml(subtitleText)}</p>
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
    card.appendChild(el('ul', 'ctt-bullets', bulletHtml));

    // Action Buttons
    const actions = el('div', 'ctt-actions');
    const launchBtn = el('button', 'ctt-launch', `<span class="ctt-iconmono">›_</span>Launch Tool`);
    const ghBtn = el('button', 'ctt-outline', `<span class="ctt-iconmono">↗</span>GitHub`);
    actions.appendChild(launchBtn);
    actions.appendChild(ghBtn);
    card.appendChild(actions);

    // Status
    const status = el('div', 'ctt-status');
    card.appendChild(status);

    const setStatus = (msg, type = '') => {
        status.className = 'ctt-status';
        status.textContent = '';
        if (msg) {
            const toastType = (type && type.toLowerCase().includes('error')) ? 'error' : 'success';
            toast(msg, { type: toastType });
        }
    };

    // PowerShell Command
    const psCmd = [
        'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        `"irm christitus.com/win | iex"`
    ].join(' ');

    launchBtn.addEventListener('click', async () => {
        try {
            launchBtn.disabled = true;
            setStatus('Downloading & launching Windows Utility...');

            if (window.api?.runChrisTitus) {
                const result = await window.api.runChrisTitus();
                if (result && !result.error) {
                    setStatus('Utility launched in a new PowerShell window. Follow the on-screen prompts.', 'success');
                } else {
                    const errMsg = result && result.error ? result.error : 'Unknown error';
                    setStatus('Failed to launch: ' + errMsg, 'error');
                }
            } else if (window.api?.runCommand) {
                const runResult = await window.api.runCommand(psCmd);
                if (runResult && !runResult.error) {
                    setStatus('Utility launched in a new PowerShell window. Follow the on-screen prompts.', 'success');
                } else {
                    const errMsg = runResult && runResult.error ? runResult.error : 'Unknown error';
                    setStatus('Failed to launch: ' + errMsg, 'error');
                }
            } else {
                await navigator.clipboard.writeText(psCmd);
                setStatus('Electron bridge not found. Command copied to clipboard — run in elevated PowerShell.', 'error');
            }
        } catch (e) {
            setStatus('Failed to launch: ' + e.message, 'error');
        } finally {
            launchBtn.disabled = false;
        }
    });

    ghBtn.addEventListener('click', async () => {
        if (window.api?.openExternal) await window.api.openExternal('https://github.com/ChrisTitusTech/winutil');
        else window.open('https://github.com/ChrisTitusTech/winutil', '_blank');
    });

    return card;
}
