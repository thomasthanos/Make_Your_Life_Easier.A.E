
const fs = require('fs');
const path = require('path');

const MAGIC = /[*?[]/;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeGlob(text) {
  return String(text).replace(/[*?[\]]/g, (ch) => `[${ch}]`);
}

function toSlash(value) {
  return String(value).replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
}

function classEnd(segment, start) {
  let index = start + 1;
  if (segment[index] === '!') index++;
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
  constructor({ fsImpl = fs, maxDepth = 10, maxMatches = 5000 } = {}) {
    this.fs = fsImpl;
    this.maxDepth = maxDepth;
    this.maxMatches = maxMatches;
    this.listings = new Map();
    this.expressions = new Map();
  }

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

  match(pattern) {
    const { root, segments } = splitAbsolute(pattern);
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
