import { button, element, icon } from './ui.js';
import { uiText } from './ui-text.js';
let currentPopup = null;
const focusable = 'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';
const visibleControls = root => [...root.querySelectorAll(focusable)].filter(node => node.getClientRects().length);
export function closePopups() { currentPopup?.(); }
export function openPopover(anchor, panel, { onClose, focus = true, keyboard = 'menu' } = {}) {
    closePopups();
    const placeholder = document.createComment('popover');
    panel.before(placeholder);
    panel.classList.add('ui-popover');
    panel.hidden = false;
    document.body.append(panel);
    anchor.setAttribute('aria-expanded', 'true');
    const position = () => {
        if (!anchor.isConnected) return close(false);
        const rect = anchor.getBoundingClientRect();
        panel.style.maxHeight = `${Math.max(80, window.innerHeight - 64)}px`;
        const box = panel.getBoundingClientRect();
        const top = rect.bottom + box.height + 8 < window.innerHeight ? rect.bottom + 6 : rect.top - box.height - 6;
        panel.style.top = `${Math.max(44, Math.min(top, window.innerHeight - box.height - 8))}px`;
        panel.style.left = `${Math.max(8, Math.min(rect.right - box.width, window.innerWidth - box.width - 8))}px`;
    };
    const close = (restoreFocus = true) => {
        if (currentPopup !== close) return;
        currentPopup = null;
        document.removeEventListener('pointerdown', outside, true);
        document.removeEventListener('keydown', key, true);
        document.removeEventListener('scroll', scrolled, true);
        window.removeEventListener('resize', position);
        observer.disconnect();
        panel.classList.remove('ui-popover');
        if (placeholder.parentNode) placeholder.replaceWith(panel);
        else panel.remove();
        panel.hidden = true;
        anchor.setAttribute('aria-expanded', 'false');
        onClose?.();
        if (restoreFocus && anchor.isConnected) anchor.focus();
    };
    const outside = event => { if (!panel.contains(event.target) && !anchor.contains(event.target)) close(false); };
    const scrolled = event => { if (!panel.contains(event.target)) close(false); };
    const key = event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
        if (keyboard === 'menu' && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            const controls = visibleControls(panel);
            if (!controls.length) return;
            event.preventDefault();
            const index = controls.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + controls.length) % controls.length;
            controls[next].focus();
        }
        if (event.key === 'Tab' && keyboard === 'menu') {
            // The popup lives at the end of body; resume the trigger's tab order.
            anchor.focus();
            close(false);
        }
    };
    currentPopup = close;
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    position();
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
    document.addEventListener('scroll', scrolled, true);
    window.addEventListener('resize', position);
    if (focus) visibleControls(panel)[0]?.focus();
    return close;
}
export function bindMenu(anchor, panel) {
    anchor.setAttribute('aria-haspopup', 'true');
    anchor.setAttribute('aria-expanded', 'false');
    panel.hidden = true;
    anchor.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (anchor.getAttribute('aria-expanded') === 'true') closePopups();
        else openPopover(anchor, panel);
    });
    panel.addEventListener('click', event => {
        if (event.target.closest('button:not(:disabled)')) closePopups();
    });
}
export function manageDialog(overlay, dialog, close) {
    const previous = document.activeElement;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const siblings = [...document.body.children].filter(node => node !== overlay && !node.contains(overlay) && !['SCRIPT','STYLE'].includes(node.tagName));
    const inertBefore = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    const key = event => {
        if (currentPopup) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
        if (event.key === 'Tab') {
            const controls = visibleControls(dialog);
            if (!controls.length) { event.preventDefault(); dialog.focus(); return; }
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
        }
    };
    document.addEventListener('keydown', key, true);
    dialog.tabIndex = -1;
    (visibleControls(dialog)[0] || dialog).focus();
    return () => {
        document.removeEventListener('keydown', key, true);
        siblings.forEach((node, i) => { node.inert = inertBefore[i]; });
        if (previous?.isConnected) previous.focus();
    };
}
export function openDrawer(title) {
    document.querySelectorAll('.ui-drawer-overlay').forEach(node => node._close?.());
    closePopups();
    const overlay = element('div', 'ui-drawer-overlay');
    const panel = element('section', 'ui-drawer');
    const heading = element('h2', '', title);
    heading.id = 'drawer-title';
    panel.setAttribute('aria-labelledby', heading.id);
    const body = element('div', 'ui-drawer-body');
    let release = () => {};
    let onClose = () => {};
    const close = () => { closePopups(); release(); onClose(); overlay.remove(); };
    overlay._close = close;
    const header = element('header', 'ui-drawer-header');
    const dismiss = button('×', close, 'ui-icon-button');
    dismiss.setAttribute('aria-label', uiText('close', 'Close'));
    header.append(heading, dismiss);
    panel.append(header, body);
    overlay.append(panel);
    document.body.append(overlay);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    release = manageDialog(overlay, panel, close);
    return { body, close, onClose(callback) { onClose = callback; } };
}

let sequence = 0;
export function selectControl(options, initialValue, onChange, label) {
    const root = element('div', 'ui-select-control');
    const trigger = button('', null, 'ui-select-trigger');
    const text = element('span');
    trigger.append(text, icon('arrow', 'ui-select-chevron'));
    const menu = element('div', 'ui-select-menu');
    menu.id = `ui-select-${++sequence}`;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', label);
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', label);
    let value = initialValue;
    const choices = new Map();
    const setValue = next => {
        value = next;
        text.textContent = options.find(option => option.value === next)?.label || '';
        for (const [key, choice] of choices) choice.setAttribute('aria-selected', String(key === value));
    };
    for (const option of options) {
        const choice = button('', () => { setValue(option.value); closePopups(); onChange(value); }, 'ui-select-option');
        choice.setAttribute('role', 'option');
        choice.append(element('span', '', option.label), icon('check'));
        choices.set(option.value, choice);
        menu.append(choice);
    }
    menu.hidden = true;
    root.append(trigger, menu);
    setValue(value);
    function open() {
        if (trigger.getAttribute('aria-expanded') === 'true') return closePopups();
        menu.style.minWidth = `${Math.min(trigger.getBoundingClientRect().width, window.innerWidth - 16)}px`;
        openPopover(trigger, menu, { focus: false });
        choices.get(value)?.focus({ preventScroll: true });
        choices.get(value)?.scrollIntoView({ block: 'nearest' });
    }
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
    });
    let query = '', resetQuery;
    menu.addEventListener('keydown', event => {
        if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) return;
        if (event.key === ' ') return;
        query += event.key.toLocaleLowerCase();
        clearTimeout(resetQuery);
        resetQuery = setTimeout(() => { query = ''; }, 700);
        const match = options.find(option => option.label.toLocaleLowerCase().startsWith(query));
        if (match) { event.preventDefault(); choices.get(match.value).focus(); }
    });
    return { root, trigger, setValue, get value() { return value; } };
}

let translations = {};
let currentPage = 'install_apps';
export function configureHelp(catalog, page = currentPage) { translations = catalog; currentPage = page; }
export function helpContent(key, { compact = false } = {}) {
    const data = translations.help?.[key] || {};
    const content = element('div', 'help-content');
    content.append(element('p', '', data.description || translations.menu_info?.[key] || uiText('hub_description', 'Choose a tool to see its instructions.')));
    if (data.when) content.append(element('h3', '', uiText('when_to_use', 'When to use it')), element('p', '', data.when));
    if (data.requirements) content.append(element('h3', '', uiText('requirements', 'Before you start')), element('p', '', data.requirements));
    if (!compact && data.steps?.length) {
        content.append(element('h3', '', uiText('how_to_use', 'How to use it')));
        const list = element('ol');
        for (const step of data.steps) list.append(element('li', '', step));
        content.append(list);
    }
    if (data.warning) content.append(element('p', 'ui-warning', data.warning));
    return content;
}
export function openHelp(key = currentPage) {
    const drawer = openDrawer(uiText('help', 'Help'));
    const keys = ['install_apps','crack_installer','system_cleaner','system_maintenance','game_saves','spicetify','tools_hub','christitus','debloat','activate_autologin','bios'];
    const body = element('div');
    const select = selectControl(keys.map(page => ({ value: page, label: translations.menu?.[page] || page })),
        keys.includes(key) ? key : 'tools_hub', () => render(), uiText('help_topic', 'Help topic'));
    const render = () => {
        body.replaceChildren(element('h2', '', translations.menu?.[select.value] || select.value), helpContent(select.value));
    };
    drawer.body.append(select.root, body);
    render();
}
export function helpLink(key) { return button(uiText('more_help', 'Full instructions'), () => openHelp(key), 'ui-text-button'); }
