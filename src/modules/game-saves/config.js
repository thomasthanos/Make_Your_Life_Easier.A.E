/**
 * Game-saves settings for this machine.
 *
 * Kept in its own file rather than settings-store.js on purpose: that store is
 * synced to the signed-in account, and a backup folder or a game path means
 * nothing on a different PC.
 */

const path = require('path');
const { readJson, writeJsonAtomic } = require('./io');

const SCHEDULE_MODES = ['off', 'daily', 'weekly'];
const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const LIST_LIMIT = 1000;

function absolutePath(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed && path.isAbsolute(trimmed) ? path.normalize(trimmed) : '';
}

function uniqueStrings(values, map = (value) => value) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(values) ? values : []) {
    const value = typeof raw === 'string' ? map(raw.trim()) : '';
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length >= LIST_LIMIT) break;
  }
  return out;
}

function normalizeSchedule(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    mode: SCHEDULE_MODES.includes(input.mode) ? input.mode : 'off',
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : '20:00',
    day: WEEK_DAYS.includes(input.day) ? input.day : 'SUN'
  };
}

/**
 * Coerce stored or incoming config into its expected shape.
 * @param {Object} value - Raw config
 * @returns {Object} A complete, valid config
 */
function normalizeConfig(value) {
  const input = value && typeof value === 'object' ? value : {};
  const customGames = [];
  const names = new Set();
  for (const game of Array.isArray(input.customGames) ? input.customGames : []) {
    const name = game && typeof game.name === 'string' ? game.name.trim().slice(0, 200) : '';
    const dir = absolutePath(game && game.path);
    if (!name || !dir || names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    customGames.push({ name, path: dir });
    if (customGames.length >= LIST_LIMIT) break;
  }
  return {
    backupRoot: absolutePath(input.backupRoot),
    customRoots: uniqueStrings(input.customRoots, absolutePath),
    customGames,
    ignoredSuggestions: uniqueStrings(input.ignoredSuggestions, absolutePath),
    excludedGames: uniqueStrings(input.excludedGames),
    schedule: normalizeSchedule(input.schedule)
  };
}

/**
 * @param {string} filePath - Where the config is stored
 * @returns {{get: Function, update: Function}}
 */
function createConfigStore(filePath) {
  let current = null;
  const load = () => {
    if (!current) current = normalizeConfig(readJson(filePath, {}));
    return current;
  };
  return {
    get: () => structuredClone(load()),
    update(patch) {
      current = normalizeConfig({ ...load(), ...patch });
      writeJsonAtomic(filePath, current);
      return structuredClone(current);
    }
  };
}

module.exports = {
  WEEK_DAYS,
  createConfigStore,
  normalizeConfig,
  normalizeSchedule
};
