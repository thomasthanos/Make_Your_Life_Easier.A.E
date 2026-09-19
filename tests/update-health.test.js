const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { acknowledgeUpdateHealth, readUpdateHealth } = require('../src/main/update-health');

test('renderer health acknowledgement matches the pending update version', (t) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'myle-health-'));
  t.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }));
  fs.writeFileSync(path.join(userDataPath, '.update-health-pending'), '4.6.4', 'utf8');

  assert.equal(acknowledgeUpdateHealth(userDataPath, '4.6.4'), true);
  assert.deepEqual(readUpdateHealth(userDataPath), {
    pendingVersion: '4.6.4',
    acknowledgedVersion: '4.6.4',
    pending: true,
    acknowledged: true
  });
});

test('no acknowledgement is created without a pending update', (t) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'myle-health-'));
  t.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }));

  assert.equal(acknowledgeUpdateHealth(userDataPath, '4.6.4'), false);
  assert.equal(fs.existsSync(path.join(userDataPath, '.update-health-ok')), false);
});

test('an old executable cannot acknowledge a newer pending version', (t) => {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'myle-health-'));
  t.after(() => fs.rmSync(userDataPath, { recursive: true, force: true }));
  fs.writeFileSync(path.join(userDataPath, '.update-health-pending'), '4.6.4', 'utf8');

  assert.equal(acknowledgeUpdateHealth(userDataPath, '4.6.3'), false);
  assert.equal(fs.existsSync(path.join(userDataPath, '.update-health-ok')), false);
});
