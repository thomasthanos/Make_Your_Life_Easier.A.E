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

  /**
   * Drop the persisted session entirely. Used when the store cannot be read or
   * rewritten but the caller still needs it gone.
   */
  function discardSessionFile() {
    cache = {};
    try {
      if (fs.existsSync(sessionPath)) fs.unlinkSync(sessionPath);
    } catch (error) {
      throw new Error(`Could not delete the stored Supabase session: ${error.message}`);
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
      // Removing a key is how sign-out happens, so it has to work even when the
      // store cannot be read or rewritten. Both load() and write() refuse to run
      // without OS encryption; without this fallback a machine where safeStorage
      // is unavailable could never sign out, and the refresh token would stay on
      // disk with the account fully usable on next launch. Deleting the file
      // needs no encryption, and discarding an unreadable session is exactly the
      // outcome sign-out wants anyway.
      let next;
      try {
        next = { ...load() };
        delete next[key];
      } catch {
        return discardSessionFile();
      }

      if (Object.keys(next).length === 0) return discardSessionFile();

      try {
        write(next);
      } catch {
        discardSessionFile();
      }
    }
  };
}

module.exports = { createSessionStorage };
