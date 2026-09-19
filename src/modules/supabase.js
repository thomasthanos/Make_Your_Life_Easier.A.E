require('dotenv').config({ quiet: true });

const { app, safeStorage } = require('electron');
const { createClient } = require('@supabase/supabase-js');
const { debug } = require('./debug');
const { createSessionStorage } = require('./session-storage');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://oofcywdbmhmqpowmwykz.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9vZmN5d2RibWhtcXBvd213eWt6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMDU5NTIsImV4cCI6MjA5ODU4MTk1Mn0.lu8JE-CfgcfPc3TaeDBFFu1nuwbihwtEgCr9wK0P9ps';

let client = null;

function initialize(userDataPath = app.getPath('userData')) {
  if (client) return client;
  if (!app.isReady()) {
    throw new Error('Supabase must be initialized after Electron app.whenReady().');
  }

  const storage = createSessionStorage({ userDataPath, safeStorage });
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      storage
    }
  });
  return client;
}

function getClient() {
  if (!client) throw new Error('Supabase has not been initialized.');
  return client;
}

function isConfigured() {
  return Boolean(SUPABASE_URL) && Boolean(SUPABASE_ANON_KEY);
}

async function getSessionUser() {
  const { data, error } = await getClient().auth.getSession();
  if (error) throw error;
  return data?.session?.user || null;
}

/**
 * Read the user straight from the auth server instead of the stored session.
 *
 * `getSession()` only decodes the JWT that was persisted to disk, so the
 * `user_metadata` it carries is a snapshot from the moment that token was issued.
 * An avatar or display name the user changed on Discord/Google after that point
 * never reaches us, and a rotated avatar hash leaves a dead CDN URL cached
 * forever. `getUser()` performs a GET /auth/v1/user round-trip and returns the
 * current record, including the `identities` array needed to tell linked Google
 * and Discord accounts apart.
 *
 * Falls back to the stored session when the auth server is unreachable so the
 * app still shows the signed-in user while offline.
 * @returns {Promise<Object|null>} The Supabase user, or null when signed out
 */
async function getFreshUser() {
  try {
    const { data, error } = await getClient().auth.getUser();
    if (!error && data?.user) return data.user;
    if (error) debug('warn', 'Could not refresh the user from Supabase:', error.message);
  } catch (err) {
    debug('warn', 'Could not reach Supabase to refresh the user:', err?.message || err);
  }
  return getSessionUser().catch(() => null);
}

async function signOut() {
  const { error } = await getClient().auth.signOut();
  if (error) {
    debug('warn', 'Supabase signOut failed:', error.message);
    throw error;
  }
}

module.exports = {
  initialize,
  getClient,
  isConfigured,
  getSessionUser,
  getFreshUser,
  signOut
};
