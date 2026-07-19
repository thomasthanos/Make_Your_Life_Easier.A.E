const api = window.installer;

const el = (id) => document.getElementById(id);
const views = {
    config: el('view-config'),
    progress: el('view-progress'),
    done: el('view-done'),
    uninstall: el('view-uninstall')
};

const viewHeights = {
    config: 520,
    progress: 400,
    done: 430,
    uninstall: 340
};

function showView(name) {
    for (const key of Object.keys(views)) {
        views[key].hidden = key !== name;
    }
    api.setHeight(viewHeights[name] || 560);
}

function fmtCount(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
}

const phaseLabels = {
    preparing: 'Preparing…',
    copying: 'Copying files…',
    shortcuts: 'Creating shortcuts…',
    registry: 'Registering…',
    done: 'Finishing…'
};

function setProgress(data) {
    const percent = Math.max(0, Math.min(100, data.percent || 0));
    el('progress-fill').style.width = percent + '%';
    el('progress-percent').textContent = percent + '%';
    el('progress-phase').textContent = phaseLabels[data.phase] || 'Working…';
    if (data.phase === 'copying' && data.done && data.total) {
        el('progress-detail').textContent = `${fmtCount(data.done)} / ${fmtCount(data.total)} files`;
    } else {
        el('progress-detail').textContent = ' ';
    }
}

el('min-btn').addEventListener('click', () => api.minimize());
el('close-btn').addEventListener('click', () => api.close());

async function initInstall() {
    showView('config');
    const info = await api.getInfo();
    el('version').textContent = 'v' + info.version;
    el('location').textContent = info.defaultDir;
    el('size-val').textContent = info.sizeMB ? `${info.sizeMB} MB` : '—';
    el('files-val').textContent = info.fileCount ? fmtCount(info.fileCount) : '—';

    if (!info.isPackaged) {
        const err = el('config-error');
        err.textContent = 'Preview mode — installing is only available from the packaged Setup .exe.';
        err.hidden = false;
    }

    el('cancel-btn').addEventListener('click', () => api.close());

    el('install-btn').addEventListener('click', async () => {
        el('config-error').hidden = true;
        showView('progress');
        setProgress({ phase: 'preparing', percent: 0 });

        const unsub = api.onProgress(setProgress);
        const result = await api.install({
            desktopShortcut: el('opt-desktop').checked,
            startMenuShortcut: el('opt-startmenu').checked,
            startupShortcut: el('opt-startup').checked
        });
        unsub();

        if (!result || !result.success) {
            el('done-badge').textContent = '✕';
            el('done-badge').classList.add('is-error');
            el('done-title').textContent = 'Installation failed';
            el('done-sub').textContent = (result && result.error) || 'Something went wrong.';
            el('launch-btn').hidden = true;
            showView('done');
            return;
        }

        el('done-badge').textContent = '✓';
        el('done-badge').classList.remove('is-error');
        el('done-title').textContent = 'Installation complete';
        el('done-sub').textContent = 'Installed to ' + result.targetDir;
        el('launch-btn').hidden = false;
        showView('done');
    });

    el('finish-btn').addEventListener('click', () => api.close());
    el('launch-btn').addEventListener('click', () => api.launchAndClose());
}

async function initUninstall() {
    const info = await api.getInfo();
    el('version').textContent = 'v' + info.version;
    document.querySelector('.titlebar-label').textContent = 'Uninstall';
    showView('uninstall');

    el('uninstall-cancel').addEventListener('click', () => api.close());
    el('uninstall-confirm').addEventListener('click', async () => {
        showView('progress');
        el('progress-phase').textContent = 'Removing…';
        el('progress-fill').style.width = '60%';
        el('progress-percent').textContent = '60%';
        el('progress-detail').textContent = 'Deleting files and shortcuts';
        const result = await api.uninstall();
        el('progress-fill').style.width = '100%';
        el('progress-percent').textContent = '100%';

        el('done-badge').textContent = result && result.success ? '✓' : '✕';
        el('done-badge').classList.toggle('is-error', !(result && result.success));
        el('done-title').textContent = result && result.success ? 'Uninstalled' : 'Uninstall failed';
        el('done-sub').textContent = result && result.success
            ? 'Make Your Life Easier has been removed.'
            : (result && result.error) || 'Something went wrong.';
        el('launch-btn').hidden = true;
        showView('done');
    });
}

(async () => {
    const mode = await api.getMode();
    if (mode === 'uninstall') {
        await initUninstall();
    } else {
        await initInstall();
    }
})();
