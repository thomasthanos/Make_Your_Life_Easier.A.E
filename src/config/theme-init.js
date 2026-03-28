/**
 * Theme initialization script
 * Runs before page load to prevent flash of unstyled content
 * Moved to external file for CSP compliance (no 'unsafe-inline')
 */
(function () {
    document.documentElement.setAttribute('data-theme', 'dark');
})();
