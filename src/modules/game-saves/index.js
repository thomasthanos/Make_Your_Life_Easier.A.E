
const { app, dialog, Notification, shell, utilityProcess } = require('electron');
const fs = require('fs');
const path = require('path');
const { debug } = require('../debug');
const { isWithin, validatePath } = require('../security');
const {
  DEFAULT_ROOT_NAME,
  backupStatus,
  compareWithBackup,
  describeBackupRoot,
  gameBackupDir,
  mappingSummary,
  readMapping,
  resolveBackupRootChoice,
  restoreLocations
} = require('./backup');
const { detectCloudFolders } = require('./cloud-folders');
const { createConfigStore, normalizeSchedule } = require('./config');
const { readJson, writeJsonAtomic } = require('./io');
const { readManifestMeta } = require('./manifest');
const { expandCollapsed } = require('./paths');
const scheduler = require('./schedule');

const PROGRESS_CHANNEL = 'game-saves-progress';
const RESTORE_LIST_LIMIT = 12;
const FILE_LIST_LIMIT = 2000;
const DEFAULT_LANG = 'en';
const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'icons', 'hacker.ico');

function isBackupSavesLaunch(argv) {
  return Array.isArray(argv) && argv.includes(scheduler.BACKUP_FLAG);
}

function format(text, values = {}) {
  return String(text || '').replace(/\{(\w+)\}/g, (whole, key) => (values[key] === undefined ? whole : String(values[key])));
}

function isDirectory(dir) {
  try {
    return Boolean(dir) && fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

const byPath = (a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });

function groupByLocation(files, locations) {
  const roots = [...new Map(locations.filter(Boolean).map((dir) => [dir.toLowerCase(), dir])).values()];
  const groups = new Map(roots.map((dir) => [dir.toLowerCase(), { location: dir, files: [] }]));
  const other = { location: '', files: [] };
  for (const file of files) {
    const root = path.isAbsolute(file.path)
      ? roots.filter((dir) => isWithin(file.path, dir)).sort((a, b) => a.length - b.length)[0]
      : null;
    if (root) groups.get(root.toLowerCase()).files.push({ ...file, path: path.relative(root, file.path) });
    else other.files.push(file);
  }
  return [...groups.values(), other].filter((group) => group.files.length > 0);
}

function summarizeScan(scan, config) {
  if (!scan) return null;
  const excluded = new Set(config.excludedGames);
  return {
    scannedAt: scan.scannedAt,
    manifest: scan.manifest,
    launchers: scan.launchers,
    games: scan.games.map((game) => ({
      id: game.id,
      name: game.name,
      kind: game.kind,
      status: game.status,
      backedUpAt: game.backedUpAt,
      fileCount: game.fileCount,
      totalSize: game.totalSize,
      lastModified: game.lastModified,
      registryCount: game.registry.length,
      installed: game.installed,
      cloud: game.cloud,
      steamCloud: Boolean(game.steamCloud),
      locations: game.locations,
      backup: game.backup || null,
      excluded: excluded.has(game.id)
    })),
    suggestions: scan.suggestions.map(({ id, name, path: dir, fileCount, totalSize, lastModified }) => (
      { id, name, path: dir, fileCount, totalSize, lastModified }
    ))
  };
}

function createGameSavesService({ getMainWindow, settingsStore }) {
  const dataDir = path.join(app.getPath('userData'), 'game-saves');
  const configStore = createConfigStore(path.join(dataDir, 'config.json'));
  const lastRunFile = path.join(dataDir, 'last-run.json');
  let job = null;
  let lastScan = null;
  let scheduledRuns = 0;

  function strings() {
    const lang = (settingsStore && settingsStore.get('lang')) || DEFAULT_LANG;
    const all = readJson(path.join(__dirname, '..', '..', 'i18n', `${lang === 'gr' ? 'gr' : 'en'}.json`), {});
    return (all && all.game_saves_ui) || {};
  }

  function mainWindow() {
    const win = getMainWindow();
    return win && !win.isDestroyed() ? win : null;
  }

  function sendProgress(progress) {
    const win = mainWindow();
    if (win) win.webContents.send(PROGRESS_CHANNEL, progress);
  }

  function runWorker(type, payload) {
    if (job) return Promise.reject(new Error(strings().busy || 'Another game saves task is already running.'));
    const current = { type, cancelled: false, child: null };
    job = current;
    sendProgress({ type, phase: 'start' });

    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        if (job === current) job = null;
        try {
          if (current.child) current.child.kill();
        } catch {  }
        sendProgress({ type, phase: 'done' });
        callback(value);
      };

      try {
        current.child = utilityProcess.fork(path.join(__dirname, 'worker.js'), [], { serviceName: 'MYLE Game Saves' });
      } catch (err) {
        settle(reject, err);
        return;
      }
      current.child.once('spawn', () => current.child.postMessage({ type, payload }));
      current.child.on('message', (message) => {
        if (!message) return;
        if (message.kind === 'progress') sendProgress({ type, ...message.progress });
        else if (message.kind === 'result') settle(resolve, message.result);
        else if (message.kind === 'error') settle(reject, new Error(message.error));
      });
      current.child.once('exit', (code) => {
        const error = new Error(current.cancelled ? 'Cancelled.' : `The game saves task stopped unexpectedly (exit code ${code}).`);
        error.cancelled = current.cancelled;
        settle(reject, error);
      });
    });
  }

  async function guarded(task) {
    try {
      return await task();
    } catch (err) {
      if (!err.cancelled) debug('warn', 'Game saves:', err.message);
      return { success: false, error: err.message, cancelled: Boolean(err.cancelled) };
    }
  }

  function findExistingBackups() {
    const candidates = [
      ...detectCloudFolders().map((folder) => ({ label: folder.label, path: path.join(folder.path, DEFAULT_ROOT_NAME) })),
      { label: 'Documents', path: path.join(app.getPath('documents'), DEFAULT_ROOT_NAME) },
      ...'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => ({ label: `${letter}:`, path: path.join(`${letter}:/`, DEFAULT_ROOT_NAME) }))
    ];
    const seen = new Set();
    const found = [];
    for (const candidate of candidates) {
      const key = candidate.path.toLowerCase();
      if (seen.has(key) || !isDirectory(candidate.path)) continue;
      seen.add(key);
      const summary = describeBackupRoot(candidate.path);
      if (summary.games > 0) found.push({ ...candidate, ...summary });
    }
    return found;
  }

  async function buildState() {
    const config = configStore.get();
    const executable = scheduler.resolveTaskExecutable({ isPackaged: app.isPackaged });
    return {
      supported: process.platform === 'win32',
      busy: job ? job.type : null,
      config: {
        backupRoot: config.backupRoot,
        customRoots: config.customRoots,
        schedule: config.schedule
      },
      backupRootAvailable: isDirectory(config.backupRoot),
      cloudFolders: detectCloudFolders(),
      foundBackups: config.backupRoot ? [] : findExistingBackups(),
      schedule: {
        canSchedule: !executable.error,
        portable: executable.portable,
        risky: executable.risky,
        registered: config.schedule.mode === 'off' ? false : await scheduler.scheduledTaskExists()
      },
      lastRun: readJson(lastRunFile),
      manifest: readManifestMeta(dataDir),
      scan: summarizeScan(lastScan, config)
    };
  }

  function pickGames(ids) {
    if (!lastScan || !Array.isArray(ids)) return [];
    const wanted = new Set(ids.filter((id) => typeof id === 'string'));
    return lastScan.games.filter((game) => wanted.has(game.id));
  }

  function refreshBackups(results) {
    if (!lastScan) return;
    const { backupRoot } = configStore.get();
    for (const summary of results) {
      const game = lastScan.games.find((item) => item.name === summary.name && item.status !== 'backup-only');
      if (!game) continue;
      const mapping = readMapping(backupRoot, game.name, game.kind);
      game.backup = mappingSummary(mapping);
      game.backedUpAt = game.backup ? game.backup.backedUpAt : null;
      game.status = backupStatus(game, mapping, lastScan.vars);
    }
  }

  async function showDialog(kind, options) {
    const win = mainWindow();
    const method = kind === 'open' ? dialog.showOpenDialog : dialog.showMessageBox;
    return win ? method(win, options) : method(options);
  }

  const scan = (options) => guarded(async () => {
    lastScan = await runWorker('scan', {
      userDataPath: app.getPath('userData'),
      config: configStore.get(),
      refreshManifest: Boolean(options && options.refreshManifest)
    });
    return { success: true, state: await buildState() };
  });

  const backup = (ids) => guarded(async () => {
    const t = strings();
    const config = configStore.get();
    if (!config.backupRoot) return { success: false, error: t.need_backup_root || 'Choose a backup folder first.' };
    const games = pickGames(ids).filter((game) => game.status !== 'backup-only');
    if (games.length === 0) return { success: false, error: t.nothing_selected || 'Select at least one game.' };
    const result = await runWorker('backup', { config, games, vars: lastScan.vars });
    refreshBackups(result.results);
    return { success: true, results: result.results, state: await buildState() };
  });

  async function confirmRestore(items, games, t) {
    const lines = items.slice(0, RESTORE_LIST_LIMIT).map((item) => {
      const destination = item.kind === 'custom' ? item.customPath : item.location;
      return destination ? `• ${item.name}  →  ${destination}` : `• ${item.name}`;
    });
    if (items.length > RESTORE_LIST_LIMIT) {
      lines.push(format(t.restore_confirm_more || '…and {count} more', { count: items.length - RESTORE_LIST_LIMIT }));
    }
    const detail = [lines.join('\n')];
    const newer = games.filter((game) => game.status === 'changed' && game.backup && game.lastModified > game.backup.newestMtime);
    if (newer.length) {
      detail.push('', format(t.restore_confirm_newer || 'This PC has newer saves than the backup for: {games}.', {
        games: newer.slice(0, 5).map((game) => game.name).join(', ')
      }));
    }
    detail.push('', t.restore_confirm_detail || 'Close these games first. The saves currently on this PC are copied to _before-restore in the backup folder before anything is overwritten.');
    const cloudGames = games.filter((game) => game.cloud && game.cloud.length).map((game) => game.name);
    if (cloudGames.length) {
      detail.push('', format(t.restore_confirm_cloud || 'Cloud saves are on for: {games}. The launcher may replace the restored files with its own cloud copy.', {
        games: cloudGames.slice(0, 5).join(', ')
      }));
    }
    const { response } = await showDialog('message', {
      type: 'warning',
      title: t.title || 'Game Saves',
      message: format(t.restore_confirm_title || 'Restore the saves of {count} game(s)?', { count: items.length }),
      detail: detail.join('\n'),
      buttons: [t.restore_confirm_button || 'Restore', t.cancel || 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });
    return response === 0;
  }

  const restore = (ids) => guarded(async () => {
    const t = strings();
    const config = configStore.get();
    if (!config.backupRoot) return { success: false, error: t.need_backup_root || 'Choose a backup folder first.' };
    const games = pickGames(ids).filter((game) => game.backup);
    if (games.length === 0) return { success: false, error: t.nothing_to_restore || 'None of the selected games has a backup.' };

    const items = games.map((game) => {
      if (game.kind !== 'custom') return { name: game.name, kind: 'manifest', location: game.locations[0] };
      const known = config.customGames.find((custom) => custom.name === game.name);
      const customPath = known
        ? known.path
        : expandCollapsed(game.customPathCollapsed, lastScan.vars) || game.customPath || '';
      return { name: game.name, kind: 'custom', customPath };
    });
    if (!(await confirmRestore(items, games, t))) return { success: false, cancelled: true };

    const result = await runWorker('restore', { userDataPath: app.getPath('userData'), config, items });
    return { success: true, results: result.results, state: await buildState(), rescan: true };
  });

  const listFiles = (id, source) => guarded(async () => {
    const game = pickGames([id])[0];
    if (!game) return { success: false, error: strings().game_gone || 'This game is no longer in the list. Scan again.' };
    const inBackup = source === 'backup';
    const mapping = readMapping(configStore.get().backupRoot, game.name, game.kind);
    const compared = compareWithBackup(game, mapping, lastScan.vars);
    const files = (inBackup ? compared.backup : compared.pc).sort(byPath);
    const counts = {};
    for (const file of files) counts[file.state] = (counts[file.state] || 0) + 1;
    const locations = inBackup && mapping ? [...game.locations, ...restoreLocations(mapping, lastScan.vars)] : game.locations;
    const registry = inBackup ? (mapping && Array.isArray(mapping.registry) ? mapping.registry : []) : game.registry;
    return {
      success: true,
      total: files.length,
      totalSize: files.reduce((sum, file) => sum + file.size, 0),
      counts,
      pcOnly: inBackup ? compared.pc.filter((file) => file.state === 'new').length : 0,
      groups: groupByLocation(files.slice(0, FILE_LIST_LIMIT), locations),
      registry: registry.map((item) => String(item.key))
    };
  });

  const cancel = () => guarded(async () => {
    if (job) {
      job.cancelled = true;
      try {
        if (job.child) job.child.kill();
      } catch {  }
    }
    return { success: true };
  });

  async function setBackupRoot(dir) {
    const check = validatePath(dir);
    if (!check.valid) return { success: false, error: check.error };
    const root = resolveBackupRootChoice(check.normalized);
    fs.mkdirSync(root, { recursive: true });
    const previous = configStore.get().backupRoot;
    configStore.update({ backupRoot: root });
    if (previous.toLowerCase() !== root.toLowerCase()) lastScan = null;
    return { success: true, state: await buildState() };
  }

  const pickBackupFolder = () => guarded(async () => {
    const t = strings();
    const result = await showDialog('open', {
      title: t.choose_folder || 'Choose a backup folder',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true };
    return setBackupRoot(result.filePaths[0]);
  });

  const useCloudFolder = (id) => guarded(async () => {
    const folder = detectCloudFolders().find((item) => item.id === id);
    if (!folder) return { success: false, error: strings().cloud_missing || 'That cloud folder was not found.' };
    return setBackupRoot(path.join(folder.path, DEFAULT_ROOT_NAME));
  });

  const useFoundBackup = (dir) => guarded(async () => {
    const wanted = String(dir || '').toLowerCase();
    const match = findExistingBackups().find((item) => item.path.toLowerCase() === wanted);
    if (!match) return { success: false, error: strings().folder_missing || 'The folder does not exist.' };
    return setBackupRoot(match.path);
  });

  const addCustomRoot = () => guarded(async () => {
    const t = strings();
    const result = await showDialog('open', {
      title: t.add_game_folder || 'Add a folder where games are installed',
      properties: ['openDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { success: false, cancelled: true };
    const config = configStore.get();
    configStore.update({ customRoots: [...config.customRoots, result.filePaths[0]] });
    return { success: true, state: await buildState(), rescan: true };
  });

  const removeCustomRoot = (dir) => guarded(async () => {
    const config = configStore.get();
    const target = typeof dir === 'string' ? dir.toLowerCase() : '';
    configStore.update({ customRoots: config.customRoots.filter((root) => root.toLowerCase() !== target) });
    return { success: true, state: await buildState(), rescan: true };
  });

  const setSchedule = (input) => guarded(async () => {
    const t = strings();
    const next = normalizeSchedule(input);
    if (next.mode === 'off') {
      await scheduler.applySchedule(next);
    } else {
      if (!configStore.get().backupRoot) return { success: false, error: t.need_backup_root || 'Choose a backup folder first.' };
      const executable = scheduler.resolveTaskExecutable({ isPackaged: app.isPackaged });
      if (executable.error) {
        return { success: false, error: t.schedule_dev || 'Automatic backups can only be scheduled from the installed or portable app.' };
      }
      const applied = await scheduler.applySchedule(next, { exePath: executable.path });
      if (!applied.success) {
        return { success: false, error: format(t.schedule_failed || 'Could not create the scheduled task: {error}', { error: applied.error }) };
      }
    }
    configStore.update({ schedule: next });
    return { success: true, state: await buildState() };
  });

  const setExcluded = (ids, excluded) => guarded(async () => {
    const list = (Array.isArray(ids) ? ids : [ids]).filter((id) => typeof id === 'string' && id);
    if (list.length === 0) return { success: false, error: 'Invalid game.' };
    const changing = new Set(list);
    const rest = configStore.get().excludedGames.filter((item) => !changing.has(item));
    configStore.update({ excludedGames: excluded ? [...rest, ...list] : rest });
    return { success: true, state: await buildState() };
  });

  function uniqueCustomName(name, config) {
    const taken = new Set([
      ...config.customGames.map((game) => game.name.toLowerCase()),
      ...(lastScan ? lastScan.games.map((game) => game.name.toLowerCase()) : [])
    ]);
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${name} (${n})`;
    return candidate;
  }

  const resolveSuggestion = (id, action) => guarded(async () => {
    const suggestion = lastScan && lastScan.suggestions.find((item) => item.id === id);
    if (!suggestion) return { success: false, error: strings().suggestion_gone || 'This suggestion is no longer available. Scan again.' };
    const config = configStore.get();
    if (action === 'ignore') {
      configStore.update({ ignoredSuggestions: [...config.ignoredSuggestions, suggestion.path] });
    } else if (action === 'confirm') {
      configStore.update({ customGames: [...config.customGames, { name: uniqueCustomName(suggestion.name, config), path: suggestion.path }] });
    } else {
      return { success: false, error: 'Unknown action.' };
    }
    lastScan.suggestions = lastScan.suggestions.filter((item) => item.id !== id);
    return { success: true, state: await buildState(), rescan: action === 'confirm' };
  });

  const open = (target, id) => guarded(async () => {
    const config = configStore.get();
    let dir = null;
    if (target === 'backup-root') {
      dir = config.backupRoot;
    } else if (target === 'game-backup') {
      const game = pickGames([id])[0];
      if (game && config.backupRoot) dir = gameBackupDir(config.backupRoot, game.name, game.kind);
    } else if (target === 'game-location') {
      const game = pickGames([id])[0];
      dir = game && game.locations[0];
    } else if (target === 'suggestion') {
      const suggestion = lastScan && lastScan.suggestions.find((item) => item.id === id);
      dir = suggestion && suggestion.path;
    }
    if (!isDirectory(dir)) return { success: false, error: strings().folder_missing || 'The folder does not exist.' };
    const error = await shell.openPath(dir);
    return error ? { success: false, error } : { success: true };
  });

  function notify(record, t) {
    try {
      if (!Notification.isSupported()) return;
      const body = record.error
        ? format(t.notify_failed || 'The automatic backup failed: {error}', { error: record.error })
        : format(t.notify_body || '{games} game(s) backed up, {files} file(s) copied.', { games: record.backedUp, files: record.copied });
      new Notification({ title: t.notify_title || 'Game saves backup', body, icon: ICON_PATH }).show();
    } catch (err) {
      debug('warn', 'Game saves notification failed:', err.message);
    }
  }

  async function runScheduledBackup({ headless = false } = {}) {
    if (job) return { success: false, busy: true };
    const t = strings();
    const config = configStore.get();
    const trigger = headless ? 'schedule' : 'manual';
    let record;
    scheduledRuns++;
    try {
      if (!config.backupRoot) throw new Error(t.need_backup_root || 'Choose a backup folder first.');
      const result = await runWorker('scheduled', { userDataPath: app.getPath('userData'), config });
      lastScan = { ...result.scan, suggestions: lastScan ? lastScan.suggestions : [] };
      refreshBackups(result.results);
      record = {
        trigger,
        finishedAt: result.finishedAt,
        gamesFound: result.gamesFound,
        backedUp: result.backedUp,
        copied: result.results.reduce((sum, item) => sum + item.copied, 0),
        errors: result.results.reduce((sum, item) => sum + item.errors.length, 0)
      };
    } catch (err) {
      record = { trigger, finishedAt: new Date().toISOString(), error: err.message };
    } finally {
      scheduledRuns--;
    }
    try {
      writeJsonAtomic(lastRunFile, record);
    } catch (err) {
      debug('warn', 'Could not record the game saves backup run:', err.message);
    }
    if (headless && (record.error || record.backedUp > 0)) notify(record, t);
    return { success: !record.error, error: record.error, lastRun: record };
  }

  const runNow = () => guarded(async () => {
    const result = await runScheduledBackup();
    return { ...result, state: await buildState() };
  });

  return {
    getState: () => guarded(async () => ({ success: true, state: await buildState() })),
    scan,
    backup,
    restore,
    listFiles,
    cancel,
    pickBackupFolder,
    useCloudFolder,
    useFoundBackup,
    addCustomRoot,
    removeCustomRoot,
    setSchedule,
    setExcluded,
    resolveSuggestion,
    open,
    runNow,
    runScheduledBackup,
    isRunningScheduled: () => scheduledRuns > 0,
    dispose() {
      if (!job) return;
      job.cancelled = true;
      try {
        if (job.child) job.child.kill();
      } catch {  }
    }
  };
}

module.exports = {
  createGameSavesService,
  isBackupSavesLaunch
};
