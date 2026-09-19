/**
 * Glob matching in the dialect the Ludusavi manifest is written in.
 *
 * Manifest paths are evaluated as globs, but with the rules of Rust's `glob`
 * crate rather than the ones most Node libraries follow: `*`, `?`, `**` and
 * `[...]` classes are special, while braces and parentheses are plain text.
 * Wiki editors write things like `{random}` and `Saves (1)` into paths, so a
 * matcher that expands braces or extglobs would look in the wrong place.
 *
 * The walker reads each directory at most once. Nearly every manifest path dies
 * at its first missing folder, and answering that from a cached listing keeps a
 * full scan to a few hundred directory reads instead of tens of thousands of
 * stat calls.
 */

const fs = require('fs');
const path = require('path');

const MAGIC = /[*?[]/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Make text match only itself, for real paths spliced into a pattern.
 * @param {string} text - Literal text
 * @returns {string} Glob-safe text
 */
function escapeGlob(text) {
  return String(text).replace(/[*?[\]]/g, (ch) => `[${ch}]`);
}

/**
 * Normalise separators to `/` and drop duplicate or trailing slashes.
 * @param {string} value - A path or pattern
 * @returns {string} The normalised form
 */
function toSlash(value) {
  return String(value).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

function classEnd(segment, start) {
  let index = start + 1;
  if (segment[index] === '!') index++;
  // A `]` straight after the opening bracket is a member, not the end.
  if (segment[index] === ']') index++;
  return segment.indexOf(']', index);
}

function segmentSource(segment) {
  let source = '';
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    const end = ch === '[' ? classEnd(segment, i) : -1;
    if (ch === '*') {
      source += '[^/]*';
    } else if (ch === '?') {
      source += '[^/]';
    } else if (end !== -1) {
      let body = segment.slice(i + 1, end);
      const negate = body.startsWith('!');
      if (negate) body = body.slice(1);
      source += `[${negate ? '^/' : ''}${body.replace(/[\\\]^[]/g, '\\$&')}]`;
      i = end;
    } else {
      source += escapeRegExp(ch);
    }
  }
  return source;
}

/**
 * Compile an absolute pattern into one case-insensitive expression over
 * `/`-separated paths.
 * @param {string} pattern - Absolute glob pattern
 * @returns {RegExp} Expression matching whole paths
 */
function globToRegExp(pattern) {
  let source = '';
  toSlash(pattern).split('/').forEach((segment, index) => {
    if (segment === '**') {
      source += index === 0 ? '(?:[^/]+/)*' : '(?:/[^/]+)*';
    } else {
      source += (index === 0 ? '' : '/') + segmentSource(segment);
    }
  });
  return new RegExp(`^${source}$`, 'i');
}

/**
 * Whether a path is matched by a pattern, or lies inside something it matches.
 * Manifest entries name folders as often as files, so a file under a matched
 * folder counts.
 * @param {string} target - Absolute path
 * @param {string} pattern - Absolute glob pattern
 * @returns {boolean} True when covered
 */
function isCoveredByPattern(target, pattern) {
  const expression = globToRegExp(pattern);
  let current = toSlash(path.resolve(target));
  for (;;) {
    if (expression.test(current)) return true;
    const cut = current.lastIndexOf('/');
    if (cut <= 0) return false;
    current = current.slice(0, cut);
  }
}

function splitAbsolute(pattern) {
  const normalized = toSlash(pattern);
  const drive = /^([a-zA-Z]):(?:\/|$)/.exec(normalized);
  if (drive) {
    return {
      root: `${drive[1].toUpperCase()}:\\`,
      segments: normalized.slice(drive[0].length).split('/').filter(Boolean)
    };
  }
  if (normalized.startsWith('/') && path.sep === '/') {
    return { root: '/', segments: normalized.slice(1).split('/').filter(Boolean) };
  }
  return { root: null, segments: [] };
}

class GlobWalker {
  /**
   * @param {Object} [options]
   * @param {Object} [options.fsImpl] - fs implementation
   * @param {number} [options.maxDepth=10] - Deepest level a `**` descends to
   * @param {number} [options.maxMatches=5000] - Matches kept per pattern
   */
  constructor({ fsImpl = fs, maxDepth = 10, maxMatches = 5000 } = {}) {
    this.fs = fsImpl;
    this.maxDepth = maxDepth;
    this.maxMatches = maxMatches;
    this.listings = new Map();
    this.expressions = new Map();
  }

  /**
   * A directory's entries keyed by lower-case name, or null when unreadable.
   * @param {string} dir - Absolute directory
   * @returns {Map<string, {name: string, dir: boolean, link: boolean}>|null}
   */
  list(dir) {
    const key = dir.toLowerCase();
    if (this.listings.has(key)) return this.listings.get(key);
    let entries = null;
    try {
      entries = new Map();
      for (const dirent of this.fs.readdirSync(dir, { withFileTypes: true })) {
        entries.set(dirent.name.toLowerCase(), {
          name: dirent.name,
          dir: dirent.isDirectory(),
          link: dirent.isSymbolicLink()
        });
      }
    } catch {
      entries = null;
    }
    this.listings.set(key, entries);
    return entries;
  }

  /**
   * Whether an entry leads to a directory. A link — a Windows junction
   * included — is followed for this single step, so a relocated "My Games"
   * folder is still found; only the recursive `**` descent skips links, which
   * is where a junction loop would bite.
   */
  isDirectory(parent, entry) {
    if (!entry.link) return entry.dir;
    if (entry.linkDir === undefined) {
      try {
        entry.linkDir = this.fs.statSync(path.join(parent, entry.name)).isDirectory();
      } catch {
        entry.linkDir = false;
      }
    }
    return entry.linkDir;
  }

  expression(segment) {
    let expression = this.expressions.get(segment);
    if (!expression) {
      expression = new RegExp(`^${segmentSource(segment)}$`, 'i');
      this.expressions.set(segment, expression);
    }
    return expression;
  }

  descend(dir, depth, add) {
    if (!add(dir) || depth >= this.maxDepth) return;
    const listing = this.list(dir);
    if (!listing) return;
    for (const entry of listing.values()) {
      if (entry.dir && !entry.link) this.descend(path.join(dir, entry.name), depth + 1, add);
    }
  }

  /**
   * Every existing file or directory an absolute pattern matches.
   * @param {string} pattern - Absolute glob pattern
   * @returns {string[]} Matched paths
   */
  match(pattern) {
    const { root, segments } = splitAbsolute(pattern);
    // A bare drive is never a save location, whatever a malformed entry says.
    if (!root || segments.length === 0) return [];

    let current = [root];
    for (let index = 0; index < segments.length && current.length; index++) {
      const segment = segments[index];
      const last = index === segments.length - 1;
      const next = new Map();
      const add = (candidate) => {
        if (next.size >= this.maxMatches) return false;
        next.set(candidate.toLowerCase(), candidate);
        return true;
      };

      for (const dir of current) {
        if (segment === '.') {
          add(dir);
        } else if (segment === '..') {
          add(path.dirname(dir));
        } else if (segment === '**') {
          this.descend(dir, 0, add);
        } else {
          const listing = this.list(dir);
          if (!listing) continue;
          if (!MAGIC.test(segment)) {
            const entry = listing.get(segment.toLowerCase());
            if (entry && (last || this.isDirectory(dir, entry))) add(path.join(dir, entry.name));
            continue;
          }
          const expression = this.expression(segment);
          for (const entry of listing.values()) {
            if (expression.test(entry.name) && (last || this.isDirectory(dir, entry))) {
              add(path.join(dir, entry.name));
            }
          }
        }
      }
      current = [...next.values()];
    }
    return current;
  }
}

module.exports = {
  GlobWalker,
  escapeGlob,
  globToRegExp,
  isCoveredByPattern,
  toSlash
};
