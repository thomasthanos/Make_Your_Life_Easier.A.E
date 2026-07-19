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
    if (data.phase === 'copying' && data.bytesTotal) {
        const mb = (b) => Math.round(b / 1048576).toLocaleString('en-US');
        el('progress-detail').textContent =
            `${mb(data.bytesDone)} / ${mb(data.bytesTotal)} MB · ${fmtCount(data.done)}/${fmtCount(data.total)} files`;
    } else if (data.phase === 'copying' && data.done && data.total) {
        el('progress-detail').textContent = `${fmtCount(data.done)} / ${fmtCount(data.total)} files`;
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

async function initInstall() {
    showView('config');
    const info = await api.getInfo();
    el('version').textContent = 'v' + info.version;
    el('location').textContent = info.defaultDir;
    el('location').title = 'Click to copy';
    el('location').addEventListener('click', () => {
        api.copyText(info.defaultDir);
        el('location').classList.add('copied');
        setTimeout(() => el('location').classList.remove('copied'), 900);
    });
    el('size-val').textContent = info.sizeMB
        ? `${info.sizeMB} MB · ${fmtCount(info.fileCount)} files`
        : '—';
    el('req-val').textContent = info.sizeMB ? `~${info.sizeMB * 2} MB free` : '—';

    if (!info.isPackaged) {
        const err = el('config-error');
        err.textContent = 'Preview mode — installing is only available from the packaged Setup .exe.';
        err.hidden = false;
    }

    el('cancel-btn').addEventListener('click', () => fadeOutThen(() => api.close()));

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
            el('done-badge').classList.add('is-error');
            el('done-title').textContent = 'Installation failed';
            el('done-sub').textContent = (result && result.error) || 'Something went wrong.';
            el('launch-btn').hidden = true;
            showView('done');
            return;
        }

        el('done-badge').classList.remove('is-error');
        el('done-title').textContent = 'Installation complete';
        el('done-sub').textContent = 'Installed to ' + result.targetDir;
        el('launch-btn').hidden = false;
        showView('done');
    });

    el('finish-btn').addEventListener('click', () => fadeOutThen(() => api.close()));
    el('launch-btn').addEventListener('click', () => {
        showView('launching');
        api.launchAndClose();
    });
}

async function initUninstall() {
    const info = await api.getInfo();
    el('version').textContent = 'v' + info.version;
    document.querySelector('.titlebar-label').textContent = 'Uninstall';
    showView('uninstall');

    el('uninstall-cancel').addEventListener('click', () => fadeOutThen(() => api.close()));
    el('uninstall-confirm').addEventListener('click', async () => {
        showView('progress');
        el('progress-phase').textContent = 'Removing…';
        el('progress-fill').style.width = '60%';
        el('progress-percent').textContent = '60%';
        el('progress-detail').textContent = 'Deleting files and shortcuts';
        const result = await api.uninstall();
        el('progress-fill').style.width = '100%';
        el('progress-percent').textContent = '100%';

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
