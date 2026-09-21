import { uiText } from './ui-text.js';
export function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
}
export function button(text, onClick, className = 'button-secondary') {
    const node = element('button', className, text);
    node.type = 'button';
    if (onClick) node.addEventListener('click', onClick);
    return node;
}
export function pageHeader(title, description, actions = []) {
    const header = element('header', 'page-header');
    const copy = element('div', 'page-header-copy');
    if (title) copy.append(element('h1', '', title));
    if (description) copy.append(element('p', '', description));
    header.append(copy);
    if (actions.length) header.append(toolbar(actions));
    return header;
}
function toolbar(children = []) {
    const node = element('div', 'ui-toolbar');
    node.append(...children);
    return node;
}
export function emptyState(message, action) {
    const node = element('div', 'ui-empty', message);
    if (action) node.append(action);
    return node;
}
export function progress(label, percent = null) {
    const node = element('div', 'ui-progress');
    node.append(element('span', '', label));
    const bar = element('progress');
    bar.max = 100;
    if (Number.isFinite(percent)) bar.value = Math.max(0, Math.min(100, percent));
    bar.setAttribute('aria-label', label || uiText('working', 'Working…'));
    node.append(bar);
    return node;
}
const paths = {
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    terminal: '<path d="m6 8 4 4-4 4m7 0h5"/><rect x="2" y="3" width="20" height="18" rx="4"/>',
    layers: '<path d="m12 3 10 5-10 5L2 8l10-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    key: '<circle cx="8" cy="15" r="5"/><path d="m11.5 11.5 8-8 2 2-2 2-2-2m0 4-2-2"/>',
    chip: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><path d="M10 10h4v4h-4z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    book: '<path d="M12 5v16m0-16C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1Z"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>'
};
export function icon(name, className = '') {
    const node = document.createElement('span');
    node.className = `ui-symbol ${className}`.trim();
    node.setAttribute('aria-hidden', 'true');
    node.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.activity}</svg>`;
    return node;
}

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

export const buttonStateManager = new ButtonStateManager();

const maintenanceIcon = (body) => `
    <svg class="maintenance-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        ${body}
    </svg>
`;

const maintenanceCustomIcon = (viewBox, body) => `
    <svg class="maintenance-svg-icon" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" aria-hidden="true">
        ${body}
    </svg>
`;

const MAINTENANCE_ICONS = {
    alert: maintenanceIcon('<path d="M12 9.5v4m0 3.5h.01M10.3 4 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z"/>'),
    bios: maintenanceIcon('<rect x="5" y="3" width="14" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M8 6.5h.01M7 17.5h3M14 17.5h3"/>'),
    cleaner: maintenanceIcon('<path d="M4 17h9"/><path d="M7 17l1-6.4A2.1 2.1 0 0 1 10.1 9h2.8a2.1 2.1 0 0 1 2.1 1.6l1 6.4"/><path d="M8.7 17v3"/><path d="M14.3 17v3"/><path d="M10 6h4"/><path d="M18 5l.5-1.3L20 3l-1.5-.7L18 1l-.5 1.3L16 3l1.5.7L18 5z"/><path d="M20 11l.4-1 1-.4-1-.4-.4-1-.4 1-1 .4 1 .4.4 1z"/>'),
    tempFile: maintenanceIcon('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9.5 13.5l5 5"/><path d="M14.5 13.5l-5 5"/>'),
    prefetch: maintenanceIcon('<path d="M5 17a7 7 0 1 1 14 0"/><path d="M12 17l4-5"/><path d="M8 17h8"/><path d="M8.5 9.5l1 1"/><path d="M15.5 9.5l-1 1"/>'),
    updateCache: maintenanceIcon('<path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M5 16.5A3.5 3.5 0 0 0 8.5 20h7a3.5 3.5 0 0 0 1-6.86A5 5 0 0 0 7 11.2"/>'),
    imageCache: maintenanceIcon('<rect x="4" y="5" width="16" height="14" rx="3"/><path d="m8 15 2.2-2.2a1.1 1.1 0 0 1 1.6 0L15 16"/><path d="m14 14 1-1a1.1 1.1 0 0 1 1.6 0L20 16"/><circle cx="9" cy="9.5" r="1.3"/>'),
    crashReport: maintenanceIcon('<path d="M8 4h8l3 3v13H8z"/><path d="M16 4v4h4"/><path d="M12 12v3"/><path d="M12 18h.01"/><path d="M9.5 9.5h5"/>'),
    scan: maintenanceIcon('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v6h-6"/>'),
    sparkle: maintenanceIcon('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z"/><path d="M5.5 16.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4z"/>'),
    shield: maintenanceIcon('<path d="M12 3l7 3v5c0 4.4-2.9 8.1-7 9.5C7.9 19.1 5 15.4 5 11V6l7-3z"/><path d="M9.5 12l1.8 1.8 3.4-3.6"/>'),
    selectAll: maintenanceIcon('<path d="M4 12l4 4 8-9"/><rect x="3" y="3" width="18" height="18" rx="4"/>'),
    cleanup: maintenanceIcon('<path d="M4 17h16"/><path d="M7 17l1.2-7.2A2.2 2.2 0 0 1 10.4 8h3.2a2.2 2.2 0 0 1 2.2 1.8L17 17"/><path d="M9 17v3"/><path d="M15 17v3"/><path d="M10 5h4"/>'),
    temp: maintenanceIcon('<path d="M8 3h8"/><path d="M10 3v5l-4.6 8A3.4 3.4 0 0 0 8.3 21h7.4a3.4 3.4 0 0 0 2.9-5L14 8V3"/><path d="M8.5 16h7"/><path d="M10 18h4"/>'),
    recycle: maintenanceIcon('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M7 7l1 14h8l1-14"/><path d="M10 11v6"/><path d="M14 11v6"/>'),
    cache: maintenanceIcon('<path d="M5 7c0-2.2 3.1-4 7-4s7 1.8 7 4-3.1 4-7 4-7-1.8-7-4z"/><path d="M5 7v5c0 2.2 3.1 4 7 4s7-1.8 7-4V7"/><path d="M5 12v5c0 2.2 3.1 4 7 4s7-1.8 7-4v-5"/>'),
    thumbnail: maintenanceIcon('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h3v3H8z"/><path d="M14 9h2"/><path d="M14 13h2"/><path d="M8 16h8"/>'),
    report: maintenanceIcon('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M10 12h6"/><path d="M10 16h4"/>'),
    disk: maintenanceCustomIcon('0 0 1024 1024', '<path fill="currentColor" d="M864.453 386.372H604.968V135.834c0-39.533-32.049-71.582-71.582-71.582h-35.791c-39.533 0-71.582 32.049-71.582 71.582v250.538H166.527c-34.592 0-62.634 28.042-62.634 62.634 0 30.327 21.556 55.617 50.181 61.392L85.997 833.761c0 49.417 35.791 90.596 89.478 89.478 53.687-1.118 85.893-53.687 156.91-53.687 172.801 0 397.852 53.687 397.852 53.687 49.417 0 89.478-40.061 89.478-89.478l68.827-326.927c22.634-9.439 38.547-31.772 38.547-57.828-0.001-34.591-28.043-62.634-62.636-62.634zM461.803 153.73c0-29.651 24.036-53.687 53.687-53.687 29.651 0 53.687 24.036 53.687 53.687v232.642H461.803V153.73z m319.456 662.753c-11.092 41.902-31.537 70.965-70.44 70.965 0 0-197.096-49.497-355.544-53.438l41.811-142.707c2.779-9.485-2.658-19.427-12.142-22.207-9.485-2.777-19.426 2.658-22.205 12.142l-45.103 153.939c-55.562 8.478-102.763 52.27-142.161 52.27-43.62 0-67.243-33.993-53.687-70.965 13.556-36.974 74.247-305.459 74.247-305.459l641.576 0.617c-0.001 0.001-45.261 262.941-56.352 304.843z m83.194-340.633H166.527c-14.825 0-26.843-12.019-26.843-26.843 0-14.825 12.019-26.843 26.843-26.843h697.927c14.825 0 26.843 12.019 26.843 26.843s-12.019 26.843-26.844 26.843z"/>'),
    network: maintenanceIcon('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>'),
    dns: maintenanceIcon('<path d="M4 7h10"/><path d="M4 12h16"/><path d="M10 17h10"/><path d="M16 5l2 2-2 2"/><path d="M8 15l-2 2 2 2"/>'),
    ip: maintenanceCustomIcon('0 0 20.234 20.234', '<path fill="currentColor" d="M6.776 4.72h1.549v6.827H6.776V4.72zM11.751 4.669c-0.942 0-1.61 0.061-2.087 0.143v6.735h1.53V9.106c0.143 0.02 0.324 0.031 0.527 0.031 0.911 0 1.691-0.224 2.218-0.721 0.405-0.386 0.628-0.952 0.628-1.621 0-0.668-0.295-1.234-0.729-1.579-0.456-0.365-1.136-0.547-2.087-0.547zM11.709 7.95c-0.222 0-0.385-0.01-0.516-0.041V5.895c0.111-0.03 0.324-0.061 0.639-0.061 0.769 0 1.205 0.375 1.205 1.002 0 0.699-0.507 1.114-1.328 1.114zM10.117 0C5.523 0 1.8 3.723 1.8 8.316s8.317 11.918 8.317 11.918 8.317-7.324 8.317-11.917S14.711 0 10.117 0zM10.138 13.373c-3.05 0-5.522-2.473-5.522-5.524 0-3.05 2.473-5.522 5.522-5.522 3.051 0 5.522 2.473 5.522 5.522 0 3.05-2.472 5.524-5.522 5.524z"/>'),
    bluetooth: maintenanceIcon('<path d="M7 7l10 10-5 4V3l5 4L7 17"/>'),
    reset: maintenanceCustomIcon('0 0 1024 1024', '<path fill="currentColor" d="M372.288 745.792a394.048 394.048 0 0 0 113.728 102.848v-127.744a390.08 390.08 0 0 0-113.728 24.896z m-51.584 24.192a392.96 392.96 0 0 0-60.16 41.6h-1.28a390.336 390.336 0 0 0 205.696 89.6 450.24 450.24 0 0 1-144.256-131.2z m-24.704-230.016c3.968 56.768 20.096 110.208 45.696 157.696a445.696 445.696 0 0 1 144.32-32.896v-124.8h-190.08z m-56.128 0H120.96a390.4 390.4 0 0 0 98.56 233.024c22.208-19.2 46.272-36.224 71.808-50.752a445.312 445.312 0 0 1-51.456-182.272z m445.824 158.784c25.984-47.808 42.24-101.568 46.336-158.72H540.992v124.864c51.072 3.2 99.776 14.976 144.704 33.92z m50.24 24.96c24.448 14.08 47.552 30.464 68.928 48.896a390.4 390.4 0 0 0 98.176-232.576h-114.88a445.312 445.312 0 0 1-52.224 183.68z m-194.944 125.44a394.048 394.048 0 0 0 113.92-102.4 389.888 389.888 0 0 0-113.92-25.728v128.192z m23.104 51.392a390.4 390.4 0 0 0 200.704-88.96h-0.512a392.96 392.96 0 0 0-57.92-40.32 450.24 450.24 0 0 1-142.272 129.28zM341.76 326.144a389.632 389.632 0 0 0-45.76 157.824h190.016V358.976a445.696 445.696 0 0 1-144.256-32.768z m-50.368-24.576a449.216 449.216 0 0 1-71.808-50.56 390.4 390.4 0 0 0-98.56 232.96h118.848a445.312 445.312 0 0 1 51.52-182.4z m194.56-126.208A394.048 394.048 0 0 0 372.48 278.016a390.08 390.08 0 0 0 113.536 24.768V175.36z m-20.992-52.544a390.272 390.272 0 0 0-205.312 89.152h0.512c18.88 15.872 39.168 29.888 60.608 41.92a450.24 450.24 0 0 1 144.192-131.072z m189.76 154.048a394.048 394.048 0 0 0-113.728-102.08v127.808a389.952 389.952 0 0 0 113.728-25.728z m51.392-24.576a392.96 392.96 0 0 0 57.856-40.32h0.384A390.336 390.336 0 0 0 564.16 123.52a450.24 450.24 0 0 1 141.952 128.832z m25.92 231.68a389.632 389.632 0 0 0-46.528-159.168 445.568 445.568 0 0 1-144.512 33.92v125.248h191.04z m56.128 0h114.88a390.4 390.4 0 0 0-98.56-232.96 449.28 449.28 0 0 1-68.736 48.896c29.824 55.424 48.32 117.76 52.416 184.128zM512 960A448 448 0 1 1 512 64a448 448 0 0 1 0 896z"/>'),
    repair: maintenanceIcon('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l2.8-2.8a5.5 5.5 0 0 1-7.1 7.1L7.1 20a2.1 2.1 0 0 1-3-3l6.3-6.3a5.5 5.5 0 0 1 7.1-7.1z"/>'),
    audio: maintenanceIcon('<path d="M4 10v4h4l5 4V6l-5 4H4z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    tools: maintenanceCustomIcon('0 0 24 24', '<path d="M4 12A8 8 0 0 1 18.93 8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><path d="M20 12A8 8 0 0 1 5.07 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" opacity="0.72"/><polyline points="14 8 19 8 19 3" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/><polyline points="10 16 5 16 5 21" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>'),
    overview: maintenanceIcon('<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>'),
    list: maintenanceIcon('<path d="M9 6h12"/><path d="M9 12h12"/><path d="M9 18h12"/><circle cx="4.5" cy="6" r="1.5"/><circle cx="4.5" cy="12" r="1.5"/><circle cx="4.5" cy="18" r="1.5"/>')
};

export function getMaintenanceIcon(iconKey) {
    return MAINTENANCE_ICONS[iconKey] || MAINTENANCE_ICONS.tools;
}
