/**
 * Game Saves Page
 * Finds the saves of every game on this PC, backs them up and restores them.
 * All file work happens in the main process; this page only ever sends game ids.
 */

import { debug } from '../utils.js';
import { toast } from '../components.js';
import { attachTooltipHandlers } from '../managers.js';

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const ICONS = {
    gamepad: svg('<line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><line x1="15" x2="15.01" y1="12" y2="12"/><line x1="18" x2="18.01" y1="10" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>'),
    folder: svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
    archive: svg('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
    scan: svg('<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'),
    upload: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'),
    restore: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
    close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    cloud: svg('<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>'),
    clock: svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
    drive: svg('<line x1="22" x2="2" y1="12" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" x2="6.01" y1="16" y2="16"/><line x1="10" x2="10.01" y1="16" y2="16"/>')
};

const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const STORE_NAMES = { steam: 'Steam', gog: 'GOG', epic: 'Epic', origin: 'EA', uplay: 'Ubisoft' };
const ROW_LIMIT = 300;
const MANIFEST_URL = 'https://github.com/mtkennerly/ludusavi-manifest';
const PCGAMINGWIKI_URL = 'https://www.pcgamingwiki.com';
const CHEVRON_ICON = '<svg class="sort-dropdown-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>';
const CHECK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
// Half-hour steps for the backup time.
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** Time choices, keeping a saved time that falls between the half-hour steps. */
function timeOptions(extra) {
    const times = extra && !TIME_OPTIONS.includes(extra) ? [...TIME_OPTIONS, extra].sort() : TIME_OPTIONS;
    return times.map((time) => [time, time]);
}

// Module scope, so results and a running task survive leaving the page.
const state = {
    data: null,         // last state from the main process
    task: null,         // task this page started
    external: false,    // a task someone else started (the scheduled backup) is running
    progress: null,
    selected: new Set(),
    filter: 'all',
    query: ''
};

let T = {};
let locale;
let activeRender = null;
let progressListening = false;

function tr(key, fallback, values) {
    const text = (typeof T[key] === 'string' && T[key]) || fallback;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (whole, name) => (values[name] === undefined ? whole : String(values[name])));
}

const pageTitle = () => tr('title', 'Game Saves');

// Copy errors with a known cause carry a code, so their advice can be translated.
const ERROR_KEYS = { 'cloud-unavailable': 'error_cloud_unavailable', 'in-use': 'error_in_use' };
const errorText = (item) => (item.code && ERROR_KEYS[item.code] ? tr(ERROR_KEYS[item.code], item.error) : item.error);

function formatBytes(bytes) {
    const value = Number(bytes || 0);
    if (value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    return `${(value / Math.pow(1024, index)).toFixed(index >= 2 ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try {
        return date.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return date.toLocaleString();
    }
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
}

function textButton(className, label, icon) {
    const node = el('button', className);
    node.type = 'button';
    if (icon) {
        const iconSpan = el('span', 'gs-button-icon');
        iconSpan.innerHTML = ICONS[icon];
        node.appendChild(iconSpan);
    }
    node.appendChild(el('span', 'gs-button-label', label));
    return node;
}

function setLabel(node, label) {
    const span = node.querySelector('.gs-button-label');
    if (span) span.textContent = label;
}

/**
 * Use the app's own tooltip, as the sidebar does, instead of the native title
 * popup. An empty text removes it.
 */
function setTooltip(node, text) {
    if (text) {
        node.setAttribute('data-tooltip', text);
        attachTooltipHandlers(node);
    } else {
        node.removeAttribute('data-tooltip');
    }
}

function iconButton(icon, label) {
    const node = el('button', 'gs-icon-btn');
    node.type = 'button';
    node.innerHTML = ICONS[icon];
    node.setAttribute('aria-label', label);
    setTooltip(node, label);
    return node;
}

function closeDropdown(node) {
    node.classList.remove('open');
    const trigger = node.querySelector('.sort-dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

/**
 * A dropdown built like the Install Apps sort menu. A native <select> opens a
 * system popup that ignores the app's dark theme.
 * @param {Array<[string, string]>} options - [value, label] pairs
 * @param {{label?: string, onChange?: Function, className?: string}} [config]
 * @returns {{root: HTMLElement, value: string, setValue: Function, setOptions: Function, setDisabled: Function}}
 */
function dropdown(options, { label, onChange, className = '' } = {}) {
    const root = el('div', `sort-dropdown gs-dropdown ${className}`.trim());
    const trigger = el('button', 'sort-dropdown-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    if (label) trigger.setAttribute('aria-label', label);
    const current = el('span', 'sort-dropdown-label');
    trigger.appendChild(current);
    trigger.insertAdjacentHTML('beforeend', CHEVRON_ICON);
    const menu = el('div', 'sort-dropdown-menu');
    menu.setAttribute('role', 'listbox');
    root.append(trigger, menu);

    let value = null;
    const api = {
        root,
        get value() {
            return value;
        },
        setValue(next) {
            value = next;
            current.textContent = '';
            for (const option of menu.children) {
                const active = option.dataset.value === next;
                option.classList.toggle('active', active);
                option.setAttribute('aria-selected', String(active));
                if (active) current.textContent = option.textContent;
            }
        },
        setOptions(list) {
            menu.replaceChildren();
            for (const [optionValue, optionLabel] of list) {
                const option = el('button', 'sort-dropdown-option');
                option.type = 'button';
                option.dataset.value = optionValue;
                option.setAttribute('role', 'option');
                const check = el('span', 'sort-dropdown-check');
                check.innerHTML = CHECK_ICON;
                option.append(el('span', 'sort-dropdown-option-label', optionLabel), check);
                option.addEventListener('click', () => {
                    closeDropdown(root);
                    if (optionValue === value) return;
                    api.setValue(optionValue);
                    if (onChange) onChange(optionValue);
                });
                menu.appendChild(option);
            }
            api.setValue(value);
        },
        setDisabled(disabled) {
            trigger.disabled = disabled;
            if (disabled) closeDropdown(root);
        }
    };

    trigger.addEventListener('click', () => {
        const opening = !root.classList.contains('open');
        document.querySelectorAll('.gs-dropdown.open').forEach((node) => closeDropdown(node));
        if (!opening) return;
        root.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        const active = menu.querySelector('.active');
        if (active) menu.scrollTop = active.offsetTop - menu.clientHeight / 2;
    });

    api.setOptions(options);
    return api;
}

function field(label, control) {
    const wrap = el('div', 'gs-field');
    wrap.append(el('span', null, label), control);
    return wrap;
}

function cardHeader(icon, heading, description) {
    const head = el('div', 'gs-card-head');
    const iconBox = el('div', 'gs-card-icon');
    iconBox.innerHTML = ICONS[icon];
    const copy = el('div');
    copy.append(el('h3', null, heading), el('p', null, description));
    head.append(iconBox, copy);
    return head;
}

function emptyState(text) {
    return el('div', 'gs-empty', text);
}

const isLocked = () => Boolean(state.task || state.external || (state.data && state.data.busy));
const dayName = (day) => (T.days && T.days[day]) || day;

function statusText(status) {
    switch (status) {
        case 'up-to-date': return tr('status_ok', 'Backed up');
        case 'changed': return tr('status_changed', 'Changed since backup');
        case 'backup-only': return tr('status_backup_only', 'Only in backup');
        default: return tr('status_new', 'Not backed up');
    }
}

function progressText(progress) {
    const values = {
        current: progress.phase === 'scan' ? progress.current || 0 : (progress.current || 0) + 1,
        total: progress.total || 0,
        label: progress.label || ''
    };
    switch (progress.phase) {
        case 'manifest-download': return tr('progress_download', 'Downloading the game save database…');
        case 'manifest-parse': return tr('progress_parse', 'Reading the game save database…');
        case 'detect': return tr('progress_detect', 'Looking for Steam, Epic, GOG and Ubisoft…');
        case 'scan': return tr('progress_scan', 'Checking games… {current} of {total}', values);
        case 'suggestions': return tr('progress_suggestions', 'Looking for other save folders…');
        case 'backup': return tr('progress_backup', 'Backing up {label} ({current} of {total})', values);
        case 'restore': return tr('progress_restore', 'Restoring {label} ({current} of {total})', values);
        default: return tr('progress_starting', 'Starting…');
    }
}

function lastRunText(run) {
    if (!run) return tr('last_run_never', 'No automatic backup has run yet.');
    const when = formatDate(run.finishedAt);
    if (run.error) return tr('last_run_failed', 'Last backup ({when}) failed: {error}', { when, error: run.error });
    return tr('last_run_ok', 'Last backup: {when} · {games} game(s), {files} file(s) copied', {
        when,
        games: run.backedUp || 0,
        files: run.copied || 0
    });
}

function render(scope) {
    if (!activeRender) return;
    try {
        activeRender(scope);
    } catch (err) {
        debug('warn', 'Game saves render failed:', err);
    }
}

function applyState(next) {
    if (!next) return;
    state.data = next;
    const ids = new Set(next.scan ? next.scan.games.map((game) => game.id) : []);
    for (const id of [...state.selected]) {
        if (!ids.has(id)) state.selected.delete(id);
    }
}

async function refreshState() {
    try {
        const result = await window.api.gameSavesState();
        if (result && result.success) applyState(result.state);
    } catch (err) {
        debug('warn', 'Game saves state failed:', err);
    }
    render();
}

function ensureProgressListener() {
    if (progressListening || !window.api || typeof window.api.onGameSavesProgress !== 'function') return;
    progressListening = true;
    window.api.onGameSavesProgress((progress) => {
        if (!progress) return;
        if (progress.phase === 'done') {
            state.progress = null;
            if (!state.task) {
                // A task this page did not start, like the scheduled backup, finished.
                state.external = false;
                refreshState();
                return;
            }
            render('progress');
            return;
        }
        const wasLocked = isLocked();
        if (!state.task) state.external = true;
        state.progress = progress;
        render(wasLocked ? 'progress' : undefined);
    });
}

async function runTask(name, action, { progress = true } = {}) {
    if (isLocked()) return null;
    state.task = name;
    if (progress) state.progress = { phase: 'start' };
    render();
    let result = null;
    try {
        result = await action();
        if (result && result.state) applyState(result.state);
        if (result && !result.success && !result.cancelled && result.error) {
            toast(result.error, { type: 'error', title: pageTitle(), duration: 7000 });
        }
    } catch (err) {
        toast((err && err.message) || String(err), { type: 'error', title: pageTitle(), duration: 7000 });
    } finally {
        state.task = null;
        state.progress = null;
        render();
    }
    return result;
}

function scan(refreshManifest = false) {
    return runTask('scan', () => window.api.gameSavesScan({ refreshManifest }));
}

async function rescanIfNeeded(result) {
    if (result && result.success && (result.rescan || (state.data && !state.data.scan))) await scan();
}

function reportBackup(result) {
    if (!result || !result.success) return;
    const results = result.results || [];
    const copied = results.reduce((sum, item) => sum + item.copied, 0);
    const failed = results.filter((item) => item.errors.length);
    if (failed.length) {
        toast(tr('backup_partial', '{count} game(s) had problems. {name}: {error}', {
            count: failed.length,
            name: failed[0].name,
            error: errorText(failed[0].errors[0])
        }), { type: 'error', title: pageTitle(), duration: 9000 });
    } else {
        toast(tr('backup_done', 'Backed up {games} game(s), {files} file(s) copied.', { games: results.length, files: copied }), {
            type: 'success',
            title: pageTitle()
        });
    }
}

function reportRestore(result) {
    if (!result || !result.success) return;
    const results = result.results || [];
    const restored = results.reduce((sum, item) => sum + item.restored, 0);
    const failed = results.filter((item) => item.errors.length);
    if (failed.length) {
        toast(tr('restore_partial', 'Restored {files} item(s). {count} game(s) had problems. {name}: {error}', {
            files: restored,
            count: failed.length,
            name: failed[0].name,
            error: errorText(failed[0].errors[0])
        }), { type: 'error', title: pageTitle(), duration: 9000 });
    } else if (results.some((item) => item.safetyDir)) {
        toast(tr('restore_done_safety', 'Restored {files} item(s). The saves that were replaced are kept in _before-restore.', { files: restored }), {
            type: 'success',
            title: pageTitle(),
            duration: 7000
        });
    } else {
        toast(tr('restore_done', 'Restored {files} item(s).', { files: restored }), { type: 'success', title: pageTitle() });
    }
}

function reportRun(result) {
    const run = result && result.success && result.lastRun;
    if (!run) return;
    const text = run.backedUp
        ? tr('run_done', 'Backed up {games} game(s), {files} file(s) copied.', { games: run.backedUp, files: run.copied })
        : tr('run_nothing', 'Every save was already backed up.');
    toast(text, { type: 'success', title: pageTitle() });
}

async function openFolder(target, id) {
    try {
        const result = await window.api.gameSavesOpen(target, id);
        if (result && !result.success && result.error) toast(result.error, { type: 'error', title: pageTitle() });
    } catch (err) {
        toast((err && err.message) || String(err), { type: 'error', title: pageTitle() });
    }
}

export async function buildGameSavesPage(translations = {}, settings = {}) {
    T = translations.game_saves_ui || {};
    locale = settings && settings.lang === 'gr' ? 'el-GR' : undefined;
    ensureProgressListener();

    const container = el('div', 'gs-page');

    // ── Hero ──
    const hero = el('section', 'gs-hero');
    const heroMain = el('div', 'gs-hero-main');
    const heroIcon = el('div', 'gs-hero-icon');
    heroIcon.innerHTML = ICONS.gamepad;
    const heroCopy = el('div', 'gs-hero-copy');
    heroCopy.append(
        el('h2', null, pageTitle()),
        el('p', null, tr('subtitle', 'Find the saves of every game on this PC, back them up and bring them back.'))
    );
    heroMain.append(heroIcon, heroCopy);
    const heroMeta = el('div', 'gs-hero-meta');
    const gamesChip = el('span', 'gs-chip is-accent');
    const sizeChip = el('span', 'gs-chip');
    const databaseChip = el('span', 'gs-chip');
    heroMeta.append(gamesChip, sizeChip, databaseChip);
    hero.append(heroMain, heroMeta);

    // ── Backup folder ──
    const settingsGrid = el('div', 'gs-settings');
    const folderCard = el('section', 'gs-card');
    const folderPath = el('div', 'gs-path-box');
    const folderWarning = el('p', 'gs-warning');
    const folderActions = el('div', 'gs-actions');
    const chooseBtn = textButton('button-secondary gs-btn', tr('choose_folder', 'Choose folder'), 'folder');
    const openRootBtn = textButton('button-secondary gs-btn', tr('open_folder', 'Open'));
    folderActions.append(chooseBtn, openRootBtn);
    const cloudRow = el('div', 'gs-cloud-row');
    folderCard.append(
        cardHeader('folder', tr('backup_folder_title', 'Backup folder'), tr('backup_folder_desc', 'One folder per game. Put it in a cloud folder to keep a copy off this PC.')),
        folderPath,
        folderWarning,
        folderActions,
        cloudRow
    );

    // ── Automatic backup ──
    const scheduleCard = el('section', 'gs-card');
    const markScheduleDirty = () => {
        scheduleDirty = true;
        renderSchedule();
    };
    const modeDropdown = dropdown([
        ['off', tr('mode_off', 'Off')],
        ['daily', tr('mode_daily', 'Every day')],
        ['weekly', tr('mode_weekly', 'Every week')]
    ], { label: tr('frequency_label', 'Frequency'), onChange: markScheduleDirty });
    const dayDropdown = dropdown(WEEK_DAYS.map((day) => [day, dayName(day)]), {
        label: tr('day_label', 'Day'),
        onChange: markScheduleDirty
    });
    const timeDropdown = dropdown(timeOptions(), {
        label: tr('time_label', 'Time'),
        onChange: markScheduleDirty,
        className: 'gs-dropdown--time gs-dropdown--scroll'
    });
    const dayField = field(tr('day_label', 'Day'), dayDropdown.root);
    const timeField = field(tr('time_label', 'Time'), timeDropdown.root);
    const saveScheduleBtn = textButton('button gs-btn', tr('save_schedule', 'Save'));
    const scheduleForm = el('div', 'gs-schedule-form');
    scheduleForm.append(field(tr('frequency_label', 'Frequency'), modeDropdown.root), dayField, timeField, saveScheduleBtn);
    const scheduleStatus = el('p', 'gs-note');
    const scheduleWarning = el('p', 'gs-warning');
    const lastRunLine = el('p', 'gs-note');
    const runNowBtn = textButton('button-secondary gs-btn', tr('run_now', 'Back up new and changed saves now'), 'upload');
    scheduleCard.append(
        cardHeader('clock', tr('auto_title', 'Automatic backup'), tr('auto_desc', 'Windows starts the app in the background, backs up new and changed saves, and closes it again.')),
        scheduleForm,
        scheduleStatus,
        scheduleWarning,
        lastRunLine,
        el('div', 'gs-actions')
    );
    scheduleCard.lastElementChild.appendChild(runNowBtn);

    // ── Extra game folders ──
    const rootsCard = el('section', 'gs-card gs-card--wide');
    const rootsList = el('div', 'gs-roots');
    const launchersLine = el('p', 'gs-note');
    const addRootBtn = textButton('button-secondary gs-btn gs-btn--small', tr('add_game_folder_btn', 'Add folder'), 'drive');
    rootsCard.append(
        cardHeader('drive', tr('roots_title', 'Game install folders'), tr('roots_desc', 'Steam, Epic, GOG and Ubisoft games are found automatically. For games installed anywhere else, add the folder they are installed in.')),
        rootsList,
        launchersLine,
        el('div', 'gs-actions')
    );
    rootsCard.lastElementChild.appendChild(addRootBtn);
    settingsGrid.append(folderCard, scheduleCard, rootsCard);

    // ── Toolbar ──
    const toolbar = el('section', 'gs-toolbar');
    const scanBtn = textButton('button gs-btn', tr('scan', 'Scan'), 'scan');
    const searchInput = el('input', 'gs-input gs-search');
    searchInput.type = 'search';
    searchInput.placeholder = tr('search_placeholder', 'Search games…');
    const filterDropdown = dropdown([
        ['all', tr('filter_all', 'All games')],
        ['pending', tr('filter_pending', 'Needs backup')],
        ['ok', tr('filter_ok', 'Backed up')],
        ['backup-only', tr('filter_backup_only', 'Only in backup')]
    ], {
        onChange: (value) => {
            state.filter = value;
            renderList();
            renderToolbar();
        }
    });
    const selectAllBtn = textButton('button-secondary gs-btn', tr('select_all', 'Select all'));
    const backupBtn = textButton('button gs-btn', tr('backup_selected', 'Back up'), 'upload');
    const restoreBtn = textButton('button-secondary gs-btn', tr('restore_selected', 'Restore'), 'restore');
    const updateDbBtn = textButton('button-secondary gs-btn gs-btn--ghost', tr('update_database', 'Update database'));
    toolbar.append(scanBtn, searchInput, filterDropdown.root, selectAllBtn, backupBtn, restoreBtn, updateDbBtn);

    // ── Progress ──
    const progressBox = el('section', 'gs-progress is-hidden');
    const progressHead = el('div', 'gs-progress-head');
    const progressLabel = el('span', 'gs-progress-label');
    const cancelBtn = textButton('button-secondary gs-btn gs-btn--small', tr('cancel', 'Cancel'));
    progressHead.append(progressLabel, cancelBtn);
    const progressTrack = el('div', 'gs-progress-track');
    const progressFill = el('div', 'gs-progress-fill');
    progressTrack.appendChild(progressFill);
    progressBox.append(progressHead, progressTrack);

    // ── Lists ──
    const listHeader = el('div', 'gs-list-header');
    const listCount = el('span', 'gs-note');
    listHeader.append(el('h3', null, tr('games_title', 'Games with saves')), listCount);
    const list = el('div', 'gs-list');
    const suggestionsSection = el('section', 'gs-suggestions is-hidden');

    const attribution = el('p', 'gs-attribution');
    const manifestLink = el('button', 'gs-link', 'Ludusavi manifest');
    manifestLink.type = 'button';
    const wikiLink = el('button', 'gs-link', 'PCGamingWiki');
    wikiLink.type = 'button';
    attribution.append(
        document.createTextNode(`${tr('attribution', 'Save locations come from the')} `),
        manifestLink,
        document.createTextNode(` · ${tr('attribution_source', 'data from')} `),
        wikiLink,
        document.createTextNode(' (CC BY-NC-SA)')
    );

    container.append(hero, settingsGrid, toolbar, progressBox, listHeader, list, suggestionsSection, attribution);

    let scheduleDirty = false;

    function visibleGames() {
        const games = (state.data && state.data.scan && state.data.scan.games) || [];
        const query = state.query.trim().toLowerCase();
        return games.filter((game) => {
            if (state.filter === 'pending' && game.status !== 'new' && game.status !== 'changed') return false;
            if (state.filter === 'ok' && game.status !== 'up-to-date') return false;
            if (state.filter === 'backup-only' && game.status !== 'backup-only') return false;
            if (!query) return true;
            return game.name.toLowerCase().includes(query)
                || (game.locations || []).some((location) => location.toLowerCase().includes(query));
        });
    }

    function selectedGames() {
        const games = (state.data && state.data.scan && state.data.scan.games) || [];
        return games.filter((game) => state.selected.has(game.id));
    }

    function renderProgress() {
        const busy = Boolean(state.progress) || state.external || Boolean(state.data && state.data.busy && !state.task);
        progressBox.classList.toggle('is-hidden', !busy);
        if (!busy) return;
        const progress = state.progress || { phase: 'start' };
        progressLabel.textContent = progressText(progress);
        const percent = progress.total ? Math.max(3, Math.min(100, Math.round((progress.current / progress.total) * 100))) : null;
        progressTrack.classList.toggle('is-indeterminate', percent === null);
        progressFill.style.width = percent === null ? '' : `${percent}%`;
        cancelBtn.disabled = !(state.data && (state.task === 'scan' || state.task === 'backup' || state.task === 'restore' || state.task === 'scheduled'));
    }

    function renderHero() {
        const data = state.data;
        const scanData = data && data.scan;
        const local = scanData ? scanData.games.filter((game) => game.status !== 'backup-only') : [];
        gamesChip.textContent = scanData
            ? tr('games_found', '{count} games', { count: local.length })
            : tr('not_scanned', 'Not scanned yet');
        sizeChip.textContent = scanData ? formatBytes(local.reduce((sum, game) => sum + game.totalSize, 0)) : '';
        sizeChip.classList.toggle('is-hidden', !scanData);
        const manifest = (scanData && scanData.manifest) || (data && data.manifest);
        databaseChip.textContent = manifest && manifest.gameCount
            ? tr('database_count', '{count} games in the database', { count: Number(manifest.gameCount).toLocaleString(locale) })
            : '';
        databaseChip.classList.toggle('is-hidden', !databaseChip.textContent);
        const offline = Boolean(scanData && scanData.manifest && scanData.manifest.offline);
        databaseChip.classList.toggle('is-warning', offline);
        setTooltip(databaseChip, offline ? tr('database_offline', 'Could not check for a newer database; using the saved copy.') : '');
    }

    function renderFolder() {
        const locked = isLocked();
        const config = state.data ? state.data.config : { backupRoot: '' };
        folderPath.textContent = config.backupRoot || tr('not_set', 'No backup folder yet');
        setTooltip(folderPath, config.backupRoot || '');
        folderPath.classList.toggle('is-empty', !config.backupRoot);
        const unavailable = Boolean(config.backupRoot) && !state.data.backupRootAvailable;
        folderWarning.textContent = unavailable ? tr('folder_unavailable', 'This folder cannot be reached right now. Is its drive connected?') : '';
        folderWarning.classList.toggle('is-hidden', !unavailable);
        chooseBtn.disabled = locked;
        openRootBtn.disabled = locked || !config.backupRoot || unavailable;

        cloudRow.replaceChildren();
        const clouds = (state.data && state.data.cloudFolders) || [];
        cloudRow.classList.toggle('is-hidden', clouds.length === 0);
        if (clouds.length === 0) return;
        cloudRow.appendChild(el('span', 'gs-note', tr('cloud_label', 'Use a cloud folder:')));
        for (const folder of clouds) {
            const active = Boolean(config.backupRoot) && config.backupRoot.toLowerCase().startsWith(folder.path.toLowerCase());
            const chip = textButton(`gs-cloud-chip${active ? ' is-active' : ''}`, folder.label, 'cloud');
            setTooltip(chip, folder.path);
            chip.disabled = locked;
            chip.addEventListener('click', async () => {
                const result = await runTask('folder', () => window.api.gameSavesUseCloud(folder.id), { progress: false });
                await rescanIfNeeded(result);
            });
            cloudRow.appendChild(chip);
        }
    }

    function renderSchedule() {
        const locked = isLocked();
        const schedule = state.data ? state.data.config.schedule : { mode: 'off', time: '20:00', day: 'SUN' };
        if (!scheduleDirty) {
            modeDropdown.setValue(schedule.mode);
            if (!TIME_OPTIONS.includes(schedule.time)) timeDropdown.setOptions(timeOptions(schedule.time));
            timeDropdown.setValue(schedule.time);
            dayDropdown.setValue(schedule.day);
        }
        dayField.classList.toggle('is-hidden', modeDropdown.value !== 'weekly');
        timeField.classList.toggle('is-hidden', modeDropdown.value === 'off');

        const info = (state.data && state.data.schedule) || {};
        let status;
        if (schedule.mode === 'off') {
            status = tr('schedule_off_status', 'Automatic backup is off.');
        } else if (!info.registered) {
            status = tr('schedule_missing', 'The scheduled task is missing. Press Save to create it again.');
        } else if (schedule.mode === 'weekly') {
            status = tr('schedule_weekly_status', 'Runs every {day} at {time}.', { day: dayName(schedule.day), time: schedule.time });
        } else {
            status = tr('schedule_daily_status', 'Runs every day at {time}.', { time: schedule.time });
        }
        scheduleStatus.textContent = status;
        scheduleStatus.classList.toggle('is-warning', schedule.mode !== 'off' && !info.registered);

        const warnings = [];
        if (state.data && !info.canSchedule) warnings.push(tr('schedule_dev', 'Automatic backups can only be scheduled from the installed or portable app.'));
        if (info.risky) warnings.push(tr('schedule_portable_warning', 'This portable copy is in Downloads or Temp. If it is moved or deleted, automatic backups stop.'));
        scheduleWarning.textContent = warnings.join(' ');
        scheduleWarning.classList.toggle('is-hidden', warnings.length === 0);

        lastRunLine.textContent = lastRunText(state.data && state.data.lastRun);
        modeDropdown.setDisabled(locked);
        timeDropdown.setDisabled(locked);
        dayDropdown.setDisabled(locked);
        saveScheduleBtn.disabled = locked || !scheduleDirty;
        runNowBtn.disabled = locked || !(state.data && state.data.config.backupRoot);
    }

    function renderRoots() {
        const locked = isLocked();
        rootsList.replaceChildren();
        const roots = state.data ? state.data.config.customRoots : [];
        if (roots.length === 0) rootsList.appendChild(el('span', 'gs-note', tr('no_game_folders', 'No extra folders added.')));
        for (const root of roots) {
            const item = el('span', 'gs-root');
            const label = el('span', 'gs-root-path', root);
            setTooltip(label, root);
            const remove = iconButton('close', tr('remove', 'Remove'));
            remove.disabled = locked;
            remove.addEventListener('click', async () => {
                const result = await runTask('roots', () => window.api.gameSavesRemoveRoot(root), { progress: false });
                await rescanIfNeeded(result);
            });
            item.append(label, remove);
            rootsList.appendChild(item);
        }
        addRootBtn.disabled = locked;

        const launchers = state.data && state.data.scan && state.data.scan.launchers;
        if (!launchers) {
            launchersLine.textContent = '';
        } else {
            const names = [
                launchers.steam && 'Steam',
                launchers.epic && `Epic (${launchers.epic})`,
                launchers.gog && `GOG (${launchers.gog})`,
                launchers.ubisoft && 'Ubisoft Connect'
            ].filter(Boolean);
            launchersLine.textContent = names.length
                ? tr('launchers_found', 'Detected: {list}', { list: names.join(', ') })
                : tr('launchers_none', 'No Steam, Epic, GOG or Ubisoft installation was detected.');
        }
        launchersLine.classList.toggle('is-hidden', !launchersLine.textContent);
    }

    function renderToolbar() {
        const locked = isLocked();
        const data = state.data;
        const scanData = data && data.scan;
        const supported = !data || data.supported;
        scanBtn.disabled = locked || !supported;
        setLabel(scanBtn, state.task === 'scan'
            ? tr('scanning', 'Scanning…')
            : scanData ? tr('rescan', 'Scan again') : tr('scan', 'Scan'));
        updateDbBtn.disabled = locked || !supported;
        searchInput.disabled = !scanData;
        filterDropdown.setDisabled(!scanData);

        const selected = selectedGames();
        const backupCount = selected.filter((game) => game.status !== 'backup-only').length;
        const restoreCount = selected.filter((game) => game.backedUpAt).length;
        setLabel(backupBtn, backupCount ? tr('backup_selected_count', 'Back up ({count})', { count: backupCount }) : tr('backup_selected', 'Back up'));
        setLabel(restoreBtn, restoreCount ? tr('restore_selected_count', 'Restore ({count})', { count: restoreCount }) : tr('restore_selected', 'Restore'));
        backupBtn.disabled = locked || backupCount === 0;
        restoreBtn.disabled = locked || restoreCount === 0;

        const visible = visibleGames();
        const allSelected = visible.length > 0 && visible.every((game) => state.selected.has(game.id));
        setLabel(selectAllBtn, allSelected ? tr('unselect_all', 'Unselect all') : tr('select_all', 'Select all'));
        selectAllBtn.disabled = locked || visible.length === 0;
    }

    function gameRow(game) {
        const locked = isLocked();
        const row = el('article', 'gs-row');
        const check = el('input', 'gs-check');
        check.type = 'checkbox';
        check.checked = state.selected.has(game.id);
        check.disabled = locked;
        check.setAttribute('aria-label', game.name);
        row.classList.toggle('is-selected', check.checked);
        check.addEventListener('change', () => {
            if (check.checked) state.selected.add(game.id);
            else state.selected.delete(game.id);
            row.classList.toggle('is-selected', check.checked);
            renderToolbar();
        });

        const main = el('div', 'gs-row-main');
        const titleLine = el('div', 'gs-row-title');
        titleLine.append(el('h4', null, game.name), el('span', `gs-status is-${game.status}`, statusText(game.status)));
        for (const store of game.cloud || []) titleLine.appendChild(el('span', 'gs-badge', `${STORE_NAMES[store] || store} Cloud`));
        if (game.registryCount) titleLine.appendChild(el('span', 'gs-badge', tr('badge_registry', 'Registry')));
        if (game.kind === 'custom') titleLine.appendChild(el('span', 'gs-badge', tr('badge_custom', 'Added by you')));

        const parts = [];
        if (game.fileCount || !game.registryCount) {
            parts.push(tr('files_count', '{count} files', { count: game.fileCount }), formatBytes(game.totalSize));
        }
        if (game.registryCount) parts.push(tr('registry_count', '{count} registry key(s)', { count: game.registryCount }));
        if (game.lastModified) parts.push(tr('last_saved', 'saved {when}', { when: formatDate(game.lastModified) }));
        if (game.backedUpAt) parts.push(tr('last_backup', 'backup {when}', { when: formatDate(game.backedUpAt) }));
        main.append(titleLine, el('div', 'gs-row-meta', parts.join(' · ')));
        if (game.locations && game.locations[0]) {
            const location = el('div', 'gs-path', game.locations[0]);
            setTooltip(location, game.locations.join('\n'));
            main.appendChild(location);
        }
        // The row itself toggles selection, like the checkbox.
        main.addEventListener('click', () => {
            if (check.disabled) return;
            check.checked = !check.checked;
            check.dispatchEvent(new Event('change'));
        });

        const actions = el('div', 'gs-row-actions');
        const auto = el('label', 'gs-auto');
        setTooltip(auto, tr('auto_toggle_hint', 'Include in automatic backups'));
        const autoInput = el('input');
        autoInput.type = 'checkbox';
        autoInput.checked = !game.excluded;
        autoInput.disabled = locked || game.status === 'backup-only';
        autoInput.addEventListener('change', () => {
            runTask('exclude', () => window.api.gameSavesSetExcluded(game.id, !autoInput.checked), { progress: false });
        });
        auto.append(autoInput, el('span', null, tr('auto_toggle', 'Auto')));
        const openLocation = iconButton('folder', tr('open_location', 'Open save folder'));
        openLocation.disabled = !(game.locations && game.locations.length);
        openLocation.addEventListener('click', () => openFolder('game-location', game.id));
        const openBackup = iconButton('archive', tr('open_backup', 'Open backup'));
        openBackup.disabled = !game.backedUpAt;
        openBackup.addEventListener('click', () => openFolder('game-backup', game.id));
        actions.append(auto, openLocation, openBackup);

        row.append(check, main, actions);
        return row;
    }

    function renderList() {
        const data = state.data;
        const scanData = data && data.scan;
        list.replaceChildren();
        if (data && !data.supported) {
            listCount.textContent = '';
            list.appendChild(emptyState(tr('unsupported', 'Game Saves works on Windows only.')));
            return;
        }
        if (!scanData) {
            listCount.textContent = '';
            list.appendChild(emptyState(state.task === 'scan' || state.progress
                ? tr('scanning_first', 'Looking for saves… The first scan also downloads the game save database (about 17 MB).')
                : tr('empty_not_scanned', 'Press Scan to look for game saves on this PC.')));
            return;
        }
        const games = visibleGames();
        listCount.textContent = tr('list_count', '{shown} of {total}', { shown: games.length, total: scanData.games.length });
        if (games.length === 0) {
            list.appendChild(emptyState(scanData.games.length
                ? tr('empty_filtered', 'No games match.')
                : tr('empty_none', 'No game saves were found on this PC.')));
            return;
        }
        const fragment = document.createDocumentFragment();
        games.slice(0, ROW_LIMIT).forEach((game) => fragment.appendChild(gameRow(game)));
        list.appendChild(fragment);
        if (games.length > ROW_LIMIT) {
            list.appendChild(el('p', 'gs-note gs-list-more', tr('list_more', 'Showing the first {count}. Search to narrow the list.', { count: ROW_LIMIT })));
        }
    }

    function renderSuggestions() {
        const locked = isLocked();
        const items = (state.data && state.data.scan && state.data.scan.suggestions) || [];
        suggestionsSection.replaceChildren();
        suggestionsSection.classList.toggle('is-hidden', items.length === 0);
        if (items.length === 0) return;

        const head = el('div', 'gs-section-head');
        head.append(
            el('h3', null, tr('suggestions_title', 'Possible saves')),
            el('p', 'gs-note', tr('suggestions_desc', 'These folders look like game saves but are not in the database. Add the ones you want backed up.'))
        );
        suggestionsSection.appendChild(head);

        for (const item of items) {
            const row = el('article', 'gs-row gs-row--suggestion');
            const main = el('div', 'gs-row-main');
            const parts = [tr('files_count', '{count} files', { count: item.fileCount }), formatBytes(item.totalSize)];
            if (item.lastModified) parts.push(tr('last_saved', 'saved {when}', { when: formatDate(item.lastModified) }));
            const location = el('div', 'gs-path', item.path);
            setTooltip(location, item.path);
            main.append(el('h4', null, item.name), el('div', 'gs-row-meta', parts.join(' · ')), location);

            const actions = el('div', 'gs-row-actions');
            const open = iconButton('folder', tr('open_location', 'Open save folder'));
            open.addEventListener('click', () => openFolder('suggestion', item.id));
            const add = textButton('button gs-btn gs-btn--small', tr('add', 'Add'));
            const ignore = textButton('button-secondary gs-btn gs-btn--small', tr('ignore', 'Ignore'));
            add.disabled = locked;
            ignore.disabled = locked;
            const resolve = async (action) => {
                const result = await runTask('suggestion', () => window.api.gameSavesSuggestion(item.id, action), { progress: false });
                if (result && result.success && action === 'confirm') {
                    toast(tr('suggestion_added', 'Added. Scanning again to include it…'), { type: 'success', title: pageTitle() });
                }
                await rescanIfNeeded(result);
            };
            add.addEventListener('click', () => resolve('confirm'));
            ignore.addEventListener('click', () => resolve('ignore'));
            actions.append(open, add, ignore);
            row.append(main, actions);
            suggestionsSection.appendChild(row);
        }
    }

    function renderPage(scope) {
        renderProgress();
        if (scope === 'progress') return;
        renderHero();
        renderFolder();
        renderSchedule();
        renderRoots();
        renderToolbar();
        renderList();
        renderSuggestions();
    }

    // ── Events ──
    chooseBtn.addEventListener('click', async () => {
        const result = await runTask('folder', () => window.api.gameSavesPickFolder(), { progress: false });
        await rescanIfNeeded(result);
    });
    openRootBtn.addEventListener('click', () => openFolder('backup-root'));

    // Menus close on an outside click or Escape. These listeners live on
    // document, so the page cleanup below removes them.
    const onDocumentClick = (event) => {
        container.querySelectorAll('.gs-dropdown.open').forEach((node) => {
            if (!node.contains(event.target)) closeDropdown(node);
        });
    };
    const onDocumentKeydown = (event) => {
        if (event.key === 'Escape') container.querySelectorAll('.gs-dropdown.open').forEach((node) => closeDropdown(node));
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onDocumentKeydown);
    saveScheduleBtn.addEventListener('click', async () => {
        const mode = modeDropdown.value;
        const result = await runTask('schedule', () => window.api.gameSavesSetSchedule({
            mode,
            time: timeDropdown.value,
            day: dayDropdown.value
        }), { progress: false });
        if (result && result.success) {
            scheduleDirty = false;
            toast(mode === 'off' ? tr('schedule_disabled', 'Automatic backup turned off.') : tr('schedule_saved', 'Automatic backup saved.'), {
                type: 'success',
                title: pageTitle()
            });
            render();
        }
    });
    runNowBtn.addEventListener('click', async () => {
        reportRun(await runTask('scheduled', () => window.api.gameSavesRunNow()));
    });

    addRootBtn.addEventListener('click', async () => {
        const result = await runTask('roots', () => window.api.gameSavesAddRoot(), { progress: false });
        await rescanIfNeeded(result);
    });

    scanBtn.addEventListener('click', () => scan(false));
    updateDbBtn.addEventListener('click', () => scan(true));
    searchInput.value = state.query;
    searchInput.addEventListener('input', () => {
        state.query = searchInput.value;
        renderList();
        renderToolbar();
    });
    filterDropdown.setValue(state.filter);
    selectAllBtn.addEventListener('click', () => {
        const visible = visibleGames();
        const allSelected = visible.length > 0 && visible.every((game) => state.selected.has(game.id));
        for (const game of visible) {
            if (allSelected) state.selected.delete(game.id);
            else state.selected.add(game.id);
        }
        renderList();
        renderToolbar();
    });
    backupBtn.addEventListener('click', async () => {
        const ids = selectedGames().filter((game) => game.status !== 'backup-only').map((game) => game.id);
        reportBackup(await runTask('backup', () => window.api.gameSavesBackup(ids)));
    });
    restoreBtn.addEventListener('click', async () => {
        const ids = selectedGames().filter((game) => game.backedUpAt).map((game) => game.id);
        // No progress bar up front: the main process asks for confirmation first.
        const result = await runTask('restore', () => window.api.gameSavesRestore(ids), { progress: false });
        reportRestore(result);
        if (result && result.success && result.rescan) await scan();
    });
    cancelBtn.addEventListener('click', () => {
        cancelBtn.disabled = true;
        window.api.gameSavesCancel().catch(() => {});
    });
    manifestLink.addEventListener('click', () => window.api.openExternal(MANIFEST_URL));
    wikiLink.addEventListener('click', () => window.api.openExternal(PCGAMINGWIKI_URL));

    activeRender = renderPage;
    container._pageCleanup = [() => {
        if (activeRender === renderPage) activeRender = null;
        document.removeEventListener('click', onDocumentClick);
        document.removeEventListener('keydown', onDocumentKeydown);
    }];
    renderPage();

    refreshState().then(() => {
        const data = state.data;
        if (activeRender === renderPage && data && data.supported && !data.scan && !isLocked()) scan();
    });

    return container;
}
