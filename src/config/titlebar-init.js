(function () {
    if (typeof window.api === 'undefined') {
        const titleBar = document.querySelector('.custom-title-bar');
        if (titleBar) {
            titleBar.style.display = 'none';
        }
        document.documentElement.style.setProperty('--title-bar-height', '0px');
    }

    // Attach event listeners to title bar buttons
    const minimizeBtn = document.getElementById('title-bar-minimize');
    const maximizeBtn = document.getElementById('title-bar-maximize');
    const closeBtn = document.getElementById('title-bar-close');

    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', () => {
            window.api?.minimizeWindow?.();
        });
    }

    if (maximizeBtn) {
        maximizeBtn.addEventListener('click', () => {
            window.api?.maximizeWindow?.();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.api?.closeWindow?.();
        });
    }

    // Sidebar collapse toggle (default collapsed; persisted)
    const sidebarToggle = document.getElementById('sidebar-collapse-toggle');
    const applySidebarState = (expanded) => {
        document.body.classList.toggle('sidebar-expanded', expanded);
    };
    let sidebarExpanded = false;
    try { sidebarExpanded = localStorage.getItem('sidebarExpanded') === '1'; } catch { }
    applySidebarState(sidebarExpanded);

    Promise.resolve(window.api?.getSetting?.('sidebarExpanded')).then((cloudVal) => {
        if (typeof cloudVal === 'boolean' && cloudVal !== sidebarExpanded) {
            sidebarExpanded = cloudVal;
            applySidebarState(sidebarExpanded);
            try { localStorage.setItem('sidebarExpanded', sidebarExpanded ? '1' : '0'); } catch { }
        }
    }).catch(() => { });

    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebarExpanded = !sidebarExpanded;
            applySidebarState(sidebarExpanded);
            try { localStorage.setItem('sidebarExpanded', sidebarExpanded ? '1' : '0'); } catch { }
            try { window.api?.setSetting?.('sidebarExpanded', sidebarExpanded); } catch { }
        });
    }
})();
