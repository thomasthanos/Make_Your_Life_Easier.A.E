const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createSessionStorage } = require('../src/modules/session-storage');

function createFakeSafeStorage(available = true) {
  const prefix = Buffer.from('encrypted:');
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.concat([prefix, Buffer.from(value, 'utf8')]),
    decryptString: (value) => {
      if (!Buffer.from(value).subarray(0, prefix.length).equals(prefix)) {
        throw new Error('not encrypted');
      }
      return Buffer.from(value).subarray(prefix.length).toString('utf8');
    }
  };
}

function makeTempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'myle-session-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('encrypted Supabase session survives a fresh app instance after update', (t) => {
  const userDataPath = makeTempDir(t);
  const safeStorage = createFakeSafeStorage();
  const firstRun = createSessionStorage({ userDataPath, safeStorage });

  firstRun.setItem('supabase.auth.token', 'refresh-token-value');

  const secondRun = createSessionStorage({ userDataPath, safeStorage });
  assert.equal(secondRun.getItem('supabase.auth.token'), 'refresh-token-value');
});

test('encrypted session is preserved when OS encryption is temporarily unavailable', (t) => {
  const userDataPath = makeTempDir(t);
  const availableStorage = createFakeSafeStorage();
  const firstRun = createSessionStorage({ userDataPath, safeStorage: availableStorage });
  firstRun.setItem('supabase.auth.token', 'refresh-token-value');

  const sessionPath = path.join(userDataPath, 'supabase-session.json');
  const original = fs.readFileSync(sessionPath);
  const unavailableStorage = createSessionStorage({
    userDataPath,
    safeStorage: createFakeSafeStorage(false)
  });

  assert.throws(() => unavailableStorage.getItem('supabase.auth.token'), /encryption is unavailable/i);
  assert.deepEqual(fs.readFileSync(sessionPath), original);
});

test('legacy plaintext session is read and encrypted on its next write', (t) => {
  const userDataPath = makeTempDir(t);
  const sessionPath = path.join(userDataPath, 'supabase-session.json');
  fs.writeFileSync(sessionPath, JSON.stringify({ legacy: 'value' }), 'utf8');

  const storage = createSessionStorage({ userDataPath, safeStorage: createFakeSafeStorage() });
  assert.equal(storage.getItem('legacy'), 'value');

  storage.setItem('new-key', 'new-value');
  assert.equal(fs.readFileSync(sessionPath, 'utf8').startsWith('encrypted:'), true);
});
