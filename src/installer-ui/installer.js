import { loadStandaloneText } from '../i18n/standalone-text.js';
let t;
const api = window.installer;

const el = (id) => document.getElementById(id);
const views = {
    config: el('view-config'),
    progress: el('view-progress'),
    done: el('view-done'),
    launching: el('view-launching'),
    uninstall: el('view-uninstall')
};

const viewHeights = {
    config: 462,
    progress: 265,
    done: 305,
    launching: 230,
    uninstall: 275
};

function showView(name) {
    for (const key of Object.keys(views)) {
        views[key].hidden = key !== name;
    }
    api.setHeight(viewHeights[name] || 560);
}

function fmtCount(n) {
    return typeof n === 'number' ? n.toLocaleString(document.documentElement.lang) : '—';
}

function setProgress(data) {
    const measured = Number.isFinite(data.percent);
    const percent = measured ? Math.round(Math.max(0, Math.min(100, data.percent))) : 0;
    el('progress-fill').classList.toggle('indeterminate', !measured);
    el('progress-percent').hidden = !measured;
    el('progress-fill').style.width = percent + '%';
    el('progress-percent').textContent = percent + '%';
    el('progress-phase').textContent = t(data.phase || 'working');
    if (data.phase === 'copying' && data.bytesTotal) {
        const mb = (b) => Math.round(b / 1048576).toLocaleString(document.documentElement.lang);
        el('progress-detail').textContent =
            `${mb(data.bytesDone)} / ${mb(data.bytesTotal)} MB · ${fmtCount(data.done)}/${fmtCount(data.total)} ${t('files')}`;
    } else if (data.phase === 'copying' && data.done && data.total) {
        el('progress-detail').textContent = `${fmtCount(data.done)} / ${fmtCount(data.total)} ${t('files')}`;
    } else {
        el('progress-detail').textContent = ' ';
    }
}

function fadeOutThen(action) {
    el('card').classList.add('closing');
    setTimeout(action, 220);
}

el('min-btn').addEventListener('click', () => api.minimize());
el('close-btn').addEventListener('click', () => fadeOutThen(() => api.close()));

async function initInstall(info) {
    showView('config');
    el('version').textContent = 'v' + info.version;
    el('location').textContent = info.defaultDir;
    el('location').title = t('copy') + ': ' + info.defaultDir;
    el('location').addEventListener('click', () => {
        api.copyText(info.defaultDir);
        el('location').classList.add('copied');
        setTimeout(() => el('location').classList.remove('copied'), 900);
    });
    el('size-val').textContent = info.sizeMB
        ? `${info.sizeMB} MB · ${fmtCount(info.fileCount)} ${t('files')}`
        : '—';
    el('req-val').textContent = info.sizeMB ? `~${info.sizeMB * 2} MB ${t('free')}` : '—';

    if (!info.isPackaged) {
        const err = el('config-error');
        err.textContent = t('preview');
        err.hidden = false;
        el('install-btn').disabled = true;
    }

    el('cancel-btn').addEventListener('click', () => fadeOutThen(() => api.close()));

    el('install-btn').addEventListener('click', async () => {
        el('config-error').hidden = true;
        showView('progress');
        setProgress({ phase: 'preparing', percent: 0 });

        const unsub = api.onProgress(setProgress);
        let result;
        try { result = await api.install({
            desktopShortcut: el('opt-desktop').checked,
            startMenuShortcut: el('opt-startmenu').checked,
            startupShortcut: el('opt-startup').checked
        }); } catch (error) { result = { success: false, error: error.message }; }
        finally { unsub(); }

        if (!result || !result.success) {
            el('done-badge').classList.add('is-error');
            el('done-title').textContent = t('failed');
            el('done-sub').textContent = (result && result.error) || t('error');
            el('launch-btn').hidden = true;
            showView('done');
            return;
        }

        el('done-badge').classList.remove('is-error');
        el('done-title').textContent = t('complete');
        el('done-sub').textContent = t('installed_to') + ' ' + result.targetDir;
        el('launch-btn').hidden = false;
        showView('done');
    });

    el('finish-btn').addEventListener('click', () => fadeOutThen(() => api.close()));
    el('launch-btn').addEventListener('click', () => {
        showView('launching');
        api.launchAndClose();
    });
}

async function initUninstall(info) {
    el('version').textContent = 'v' + info.version;
    document.querySelector('.titlebar-label').textContent = t('uninstall');
    showView('uninstall');

    el('uninstall-cancel').addEventListener('click', () => fadeOutThen(() => api.close()));
    el('uninstall-confirm').addEventListener('click', async () => {
        showView('progress');
        setProgress({ phase: 'removing' });
        el('progress-detail').textContent = t('deleting');
        let result;
        try { result = await api.uninstall(); }
        catch (error) { result = { success: false, error: error.message }; }

        el('done-badge').classList.toggle('is-error', !(result && result.success));
        el('done-title').textContent = result && result.success ? t('uninstalled') : t('uninstall_failed');
        el('done-sub').textContent = result && result.success
            ? t('removed')
            : (result && result.error) || t('error');
        el('launch-btn').hidden = true;
        showView('done');
    });
}

(async () => {
    const [mode, info] = await Promise.all([api.getMode(), api.getInfo()]);
    t = await loadStandaloneText(info.lang, 'setup');
    const labels = { '.titlebar-label':'title', '#cancel-btn':'cancel', '#install-btn':'install', '#progress-phase':'preparing', '#done-title':'complete', '#done-sub':'ready', '#finish-btn':'close', '#launch-btn':'launch', '.launching-text':'launching', '.uninstall-text':'remove_question', '#uninstall-cancel':'keep', '#uninstall-confirm':'uninstall' };
    for (const [selector, key] of Object.entries(labels)) document.querySelector(selector).textContent = t(key);
    document.querySelectorAll('.row-label').forEach((node, i) => { node.textContent = t(['location','size','needs','desktop','startmenu','startup'][i]); });
    for (const [id, key] of [['min-btn','minimize'],['close-btn','close']]) { el(id).title = t(key); el(id).setAttribute('aria-label', t(key)); }
    document.title = 'Make Your Life Easier — ' + t(mode === 'uninstall' ? 'uninstall' : 'title');
    if (mode === 'uninstall') {
        await initUninstall(info);
    } else {
        await initInstall(info);
    }
})();
