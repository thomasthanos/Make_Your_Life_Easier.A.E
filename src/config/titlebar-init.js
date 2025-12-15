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
})();
