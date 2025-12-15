// Shared debug logger for password manager (renderer scope)
// Usage: window.pmDebug('info', 'Message', { foo: 'bar' });
(function () {
  const emojiMap = { info: 'ℹ️', warn: '⚠️', error: '❌', success: '✅' };
  const colorMap = {
    info: 'color:#2196F3; font-weight:bold;',
    warn: 'color:#FF9800; font-weight:bold;',
    error: 'color:#F44336; font-weight:bold;',
    success: 'color:#4CAF50; font-weight:bold;'
  };

  function debug(level, ...args) {
    const emoji = emojiMap[level] || '';
    const style = colorMap[level] || '';
    const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    const fn =
      level === 'error' ? console.error :
      level === 'warn' ? console.warn :
      console.log;

    if (isBrowser) {
      fn.call(console, `%c${emoji}`, style, ...args);
    } else {
      fn.call(console, `${emoji}`, ...args);
    }
  }

  // Expose globally for other password-manager scripts
  if (typeof window !== 'undefined') {
    window.pmDebug = debug;
  } else {
    global.pmDebug = debug;
  }
})();


