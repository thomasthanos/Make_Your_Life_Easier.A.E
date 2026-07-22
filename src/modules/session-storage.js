const fs = require('fs');
const path = require('path');

function looksLikeJson(buffer) {
  const text = Buffer.from(buffer).toString('utf8').trimStart();
  return text.startsWith('{');
}

function createSessionStorage({ userDataPath, safeStorage }) {
  if (!userDataPath || !safeStorage) {
    throw new TypeError('userDataPath and safeStorage are required');
  }

  const sessionPath = path.join(userDataPath, 'supabase-session.json');
  let cache = null;

  function encryptionAvailable() {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  function load() {
    if (cache !== null) return cache;
    if (!fs.existsSync(sessionPath)) {
      cache = {};
      return cache;
    }

    const raw = fs.readFileSync(sessionPath);
    let text;

    if (looksLikeJson(raw)) {
      text = raw.toString('utf8');
    } else {
      if (!encryptionAvailable()) {
        throw new Error('The stored Supabase session is encrypted, but OS encryption is unavailable. The session file was preserved.');
      }
      text = safeStorage.decryptString(raw);
    }

    const parsed = JSON.parse(String(text).trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Stored Supabase session must be a JSON object. The session file was preserved.');
    }

    cache = parsed;
    return cache;
  }

  function write(next) {
    if (!encryptionAvailable()) {
      throw new Error('Supabase session was not saved because OS encryption is unavailable.');
    }

    fs.mkdirSync(userDataPath, { recursive: true });
    const encrypted = safeStorage.encryptString(JSON.stringify(next));
    const tempPath = `${sessionPath}.${process.pid}.${Date.now()}.tmp`;

    try {
      fs.writeFileSync(tempPath, encrypted);
      fs.renameSync(tempPath, sessionPath);
      cache = next;
    } catch (error) {
      try { fs.unlinkSync(tempPath); } catch { }
      throw error;
    }
  }

  return {
    getItem(key) {
      const store = load();
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      write({ ...load(), [key]: value });
    },
    removeItem(key) {
      const next = { ...load() };
      delete next[key];
      write(next);
    }
  };
}

module.exports = { createSessionStorage };
