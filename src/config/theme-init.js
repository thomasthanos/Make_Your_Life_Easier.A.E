/**
 * Theme initialization script
 * Runs before page load to prevent flash of unstyled content
 * Moved to external file for CSP compliance (no 'unsafe-inline')
 */
(function () {
    try {
        const storedTheme = localStorage.getItem('myle-theme');
        if (storedTheme) {
            document.documentElement.setAttribute('data-theme', storedTheme);
        }
    } catch (_) {
        // localStorage may not be available, use default theme
    }
})();
