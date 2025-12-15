/**
 * Version Utilities Module
 * Provides helpers for version comparison
 */

/**
 * Compare two semantic version strings of the form x.y.z
 * @param {string} a - Version string e.g. '2.9.2'
 * @param {string} b - Version string to compare against
 * @returns {number} - 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  try {
    const pa = String(a).split('.').map((x) => parseInt(x.replace(/[^0-9]/g, '') || '0', 10));
    const pb = String(b).split('.').map((x) => parseInt(x.replace(/[^0-9]/g, '') || '0', 10));
    const len = Math.max(pa.length, pb.length);
    
    for (let i = 0; i < len; i++) {
      const va = pa[i] || 0;
      const vb = pb[i] || 0;
      if (va > vb) return 1;
      if (va < vb) return -1;
    }
    return 0;
  } catch {
    // Fallback to lexical comparison if parsing fails
    if (String(a) > String(b)) return 1;
    if (String(a) < String(b)) return -1;
    return 0;
  }
}

module.exports = { compareVersions };
