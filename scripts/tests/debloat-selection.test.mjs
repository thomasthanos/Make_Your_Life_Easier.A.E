import assert from 'node:assert/strict';
import test from 'node:test';
import { initialSkipped, pendingTweakIds, tweakPresetSkipped, appPresetIds } from '../../frontend/app/pages/windows-optimization/debloat/selection.ts';

const tweak = (id, extra = {}) => ({ id, title: id, summary: '', category: 'privacy', risk: 'safe', debloat: true, state: 'notApplied', canUndo: false, confirm: null, ...extra });
const tweaks = [tweak('privacy'), tweak('edge', { risk: 'caution' }), tweak('already', { state: 'applied' }), tweak('partial', { state: 'partial' }), tweak('unsupported', { state: 'unavailable' }), tweak('manual-only', { debloat: false })];

test('first-use selection excludes caution even when that tweak is currently unavailable', () => {
  assert.deepEqual([...initialSkipped([...tweaks, tweak('future-caution', { risk: 'caution', state: 'unavailable' })], null)], ['edge', 'future-caution']);
});
test('saved choices, including an explicitly empty skipped list, override first-use defaults', () => {
  assert.deepEqual([...initialSkipped(tweaks, [])], []);
  assert.deepEqual([...initialSkipped(tweaks, ['privacy', 'legacy-id'])], ['privacy', 'legacy-id']);
});
test('run IDs exclude applied, unavailable, skipped and non-Debloat tweaks', () => {
  assert.deepEqual(pendingTweakIds(tweaks, new Set(['edge'])), ['privacy', 'partial']);
});
test('recommended preset keeps unrelated preferences and deselects caution', () => {
  assert.deepEqual([...tweakPresetSkipped(tweaks, new Set(['privacy', 'legacy-id']), 'recommended')], ['legacy-id', 'edge']);
});
test('all and none presets affect the full available Debloat catalog', () => {
  const all = tweakPresetSkipped(tweaks, new Set(['edge', 'legacy-id']), 'all');
  assert.deepEqual(pendingTweakIds(tweaks, all), ['privacy', 'edge', 'partial']);
  assert.deepEqual(pendingTweakIds(tweaks, tweakPresetSkipped(tweaks, all, 'none')), []);
});
test('app presets use installed packages and the supplied recommendation flag', () => {
  const apps = [{ id: 'recommended', packages: ['Package.A'], recommended: true }, { id: 'xbox', packages: ['Package.X'], recommended: false }, { id: 'absent', packages: [], recommended: true }];
  assert.deepEqual(appPresetIds(apps, 'recommended'), ['recommended']);
  assert.deepEqual(appPresetIds(apps, 'all'), ['recommended', 'xbox']);
  assert.deepEqual(appPresetIds(apps, 'none'), []);
});
