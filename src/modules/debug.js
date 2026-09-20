
const colorMap = {
  info: 'color:#2196F3; font-weight:bold;',
  warn: 'color:#FF9800; font-weight:bold;',
  error: 'color:#F44336; font-weight:bold;',
  success: 'color:#4CAF50; font-weight:bold;'
};

function debug(level, ...args) {
  const style = colorMap[level] || '';
  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

  const fn =
    level === 'error'
      ? console.error
      : level === 'warn'
        ? console.warn
        : console.log;

  if (isBrowser) {
    fn.call(console, '%c', style, ...args);
  } else {
    fn.call(console, ...args);
  }
}

module.exports = { debug };
