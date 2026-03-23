/**
 * Theme initialization script
 * Runs before page load to prevent flash of unstyled content
 * Moved to external file for CSP compliance (no 'unsafe-inline')
 */
(function () {
    try {
        const saved = JSON.parse(localStorage.getItem('myAppSettings'));
        if (saved && saved.theme) {
            document.documentElement.setAttribute('data-theme', saved.theme);
        }
    } catch (_) {
        // localStorage may not be available or parse error, use default theme
    }
})();
