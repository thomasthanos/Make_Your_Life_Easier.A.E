require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const { debug } = require('./debug');

function encryptionAvailable() {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oofcywdbmhmqpowmwykz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZmN5d2RibWhtcXBvd213eWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDU5NTIsImV4cCI6MjA5ODU4MTk1Mn0.lu8JE-CfgcfPc3TaeDBFFu1nuwbihwtEgCr9wK0P9ps';

let sessionPath = null;
let cache = null;

function ensureLoaded() {
  if (cache) return cache;
  cache = {};
  try {
    if (!sessionPath) sessionPath = path.join(app.getPath('userData'), 'supabase-session.json');
    if (fs.existsSync(sessionPath)) {
      const raw = fs.readFileSync(sessionPath);
      let text;
      if (encryptionAvailable()) {
        // Encrypted payload written by a previous run; fall back to plaintext for
        // sessions saved before encryption was enabled (migrated on next persist).
        try { text = safeStorage.decryptString(raw); }
        catch { text = raw.toString('utf-8'); }
      } else {
        text = raw.toString('utf-8');
      }
      cache = JSON.parse(text) || {};
    }
  } catch (err) {
    debug('warn', 'Failed to load Supabase session:', err.message);
    cache = {};
  }
  return cache;
}

function persist() {
  try {
    if (!sessionPath) sessionPath = path.join(app.getPath('userData'), 'supabase-session.json');
    const json = JSON.stringify(cache);
    if (encryptionAvailable()) {
      fs.writeFileSync(sessionPath, safeStorage.encryptString(json));
    } else {
      fs.writeFileSync(sessionPath, json, 'utf8');
    }
  } catch (err) {
    debug('warn', 'Failed to persist Supabase session:', err.message);
  }
}

const fileStorage = {
  getItem(key) {
    const store = ensureLoaded();
    return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
  },
  setItem(key, value) {
    ensureLoaded()[key] = value;
    persist();
  },
  removeItem(key) {
    delete ensureLoaded()[key];
    persist();
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    storage: fileStorage
  }
});

function isConfigured() {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
}

async function getSessionUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    debug('warn', 'Supabase signOut failed:', err.message);
  }
}

module.exports = {
  supabase,
  isConfigured,
  getSessionUser,
  signOut,
  SUPABASE_URL,
  SUPABASE_ANON_KEY
};
