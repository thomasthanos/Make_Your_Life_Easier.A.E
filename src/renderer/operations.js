import { uiText } from './ui-text.js';
import { element, progress, button } from './ui.js';
import { openActivityPanel, recordActivity, updateActivity, activities, subscribeActivity } from './notifications.js';
import { stripAnsi } from './utils.js';

const definitions = {
    flushDnsCache: ['system_maintenance', 'dns', 'cancelSystemRepair'],
    releaseRenewIp: ['system_maintenance', 'ip', 'cancelSystemRepair'],
    fixBluetooth: ['system_maintenance', 'bluetooth', 'cancelSystemRepair'],
    networkReset: ['system_maintenance', 'reset', 'cancelSystemRepair'],
    runSfcScan: ['system_maintenance', 'sfc', 'cancelSystemRepair'],
    runDismRepair: ['system_maintenance', 'dism', 'cancelSystemRepair'],
    checkDisk: ['system_maintenance', 'disk', 'cancelSystemRepair'],
    restartAudioSystem: ['system_maintenance', 'audio', 'cancelSystemRepair'],
    wingetUpgradeAll: ['system_maintenance', 'upgrade', 'cancelWingetUpgrade'],
    runCleanerTasks: ['system_cleaner', 'cleaner'],
    runChrisTitus: ['christitus', 'christitus', 'cancelChrisTitus'],
    installSpicetify: ['spicetify', 'spicetify', 'cancelSpicetifyInstall'],
    uninstallSpicetify: ['spicetify', 'spicetify'],
    fullUninstallSpotify: ['spicetify', 'spicetify', 'cancelSpicetifyInstall'],
    runSparkleDebloat: ['debloat', 'debloat'],
    processDownloadedSparkle: ['debloat', 'debloat'],
    restartToBios: ['bios', 'bios'],
    gameSavesScan: ['game_saves', 'scan', 'gameSavesCancel'],
    gameSavesBackup: ['game_saves', 'backup', 'gameSavesCancel'],
    gameSavesRestore: ['game_saves', 'restore', 'gameSavesCancel'],
    gameSavesRunNow: ['game_saves', 'backup', 'gameSavesCancel']
};
const active = new Map();
const streams = {
    system_maintenance: ['onSystemRepairOutput', 'onWingetUpgradeOutput'],
    system_cleaner: ['onCleanerProgress'], christitus: ['onChrisTitusOutput'], spicetify: ['onSpicetifyInstallOutput'], game_saves: ['onGameSavesProgress']
};
const wrapped = new Map();
export const taskApi = new Proxy({}, {
    get(_target, name) {
        const original = window.api?.[name];
        if (typeof original !== 'function' || !definitions[name]) return original;
        if (wrapped.has(name)) return wrapped.get(name);
        const fn = async (...args) => {
            const [source, label, cancel] = definitions[name];
            if (active.has(source)) return { success: false, error: uiText('task_busy', 'A task is already running. Open Activity to see its progress.') };
            const entry = recordActivity({ source, title: uiText(`task_${label}`, label), message: uiText('working', 'Working…'), status: 'running', percent: null });
            active.set(source, entry.id);
            const lines = [];
            const unsubscribers = (streams[source] || []).map(eventName => window.api?.[eventName]?.(data => {
                const text = stripAnsi(data?.text || data?.message || '').slice(-8000);
                if (text) lines.push(text);
                if (lines.length > 400) lines.shift();
                updateActivity(entry.id, { details: lines.join('').slice(-64000), phase: data?.name || uiText('working', 'Working…'), percent: Number.isFinite(data?.percent) ? data.percent : null });
            })).filter(Boolean);
            if (cancel) updateActivity(entry.id, { actionLabel: uiText('stop', 'Stop'), action: async () => {
                updateActivity(entry.id, { action: null, phase: uiText('stopping', 'Stopping…') });
                try { await window.api[cancel](); }
                catch (error) { updateActivity(entry.id, { details: error.message }); }
            } });
            try {
                const result = await original(...args);
                const cancelled = result?.cancelled;
                const partial = result?.results?.some?.(item => item.errors?.length) || result?.partial;
                const failed = result?.success === false && !cancelled && !result?.downloadUrl;
                const launched = name === 'runSparkleDebloat' && !result?.downloadUrl;
                updateActivity(entry.id, {
                    status: cancelled ? 'cancelled' : failed ? 'failed' : 'complete', type: failed ? 'error' : partial ? 'warning' : cancelled ? 'info' : 'success',
                    message: cancelled ? uiText('task_cancelled', 'Task cancelled.') : failed ? uiText('operation_failed', 'The action failed.') : launched ? uiText('tool_opened', 'The external tool opened. Continue in its window.') : uiText('operation_finished', 'The action finished.'),
                    details: result?.error || lines.join('').slice(-64000), action: null, percent: null, completedAt: Date.now()
                });
                return result;
            } catch (error) {
                updateActivity(entry.id, { status: 'failed', type: 'error', message: uiText('operation_failed', 'The action failed.'), details: error.message, action: null, completedAt: Date.now() });
                throw error;
            } finally {
                unsubscribers.forEach(unsubscribe => { try { unsubscribe(); } catch { /* A closed renderer stream is already detached. */ } });
                active.delete(source);
                updateActivity(entry.id, {});
            }
        };
        wrapped.set(name, fn);
        return fn;
    }
});

export function attachPageActivity(page, source) {
    const strip = element('section', 'page-activity');
    strip.setAttribute('aria-live', 'polite');
    page.prepend(strip);
    const disabled = new Map();
    const stop = subscribeActivity(() => {
        const entry = activities().find(item => item.source === source && item.status === 'running');
        strip.hidden = !entry;
        strip.replaceChildren();
        if (entry) {
            strip.append(progress(entry.title + ' · ' + (entry.phase || entry.message), entry.percent), button(uiText('activity', 'Activity'), openActivityPanel));
            page.querySelectorAll('button:not(.help-button), input[type="checkbox"]').forEach(control => {
                if (strip.contains(control) || control.closest('.tools-tabs') || control.classList.contains('winget-terminal-stop')) return;
                if (!disabled.has(control)) disabled.set(control, control.disabled);
                control.disabled = true;
            });
        } else if (disabled.size) {
            disabled.forEach((wasDisabled, control) => { control.disabled = control.dataset.restoreOnIdle === 'true' ? false : wasDisabled; });
            disabled.clear();
        }
    });
    (page._pageCleanup ||= []).push(stop);
}
