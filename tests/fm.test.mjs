// The FM lab's sums: Bessel sidebands, where partials land, and that every
// preset is a patch a DX7-style engine can play.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ALGORITHMS, PRESETS, besselJ, sidebands, harmonicity, predictedPartials, previewWave, algorithm,
} from '../js/fm.js';

const near = (a, b, eps = 1e-4) => Math.abs(a - b) < eps;

test('Bessel J matches known values', () => {
  assert.ok(near(besselJ(0, 0), 1));
  assert.ok(near(besselJ(1, 0), 0));
  assert.ok(near(besselJ(0, 1), 0.765198));
  assert.ok(near(besselJ(1, 2.4048), 0.519147, 1e-3));
  assert.ok(near(besselJ(0, 2.4048), 0, 1e-3)); // first zero: the carrier vanishes
  assert.ok(near(besselJ(-1, 1), besselJ(1, 1))); // magnitudes are used, so the sign doesn't matter here
});

test('sidebands sit at carrier ± k × modulator, folded over zero', () => {
  const xs = sidebands(1, 3.5, 4.5).map((p) => p.x);
  for (const x of [1, 4.5, 2.5, 8, 6]) assert.ok(xs.some((v) => near(v, x)), `missing ${x}`);
  assert.ok(sidebands(1, 1, 0).filter((p) => p.amp > 0.05).every((p) => p.x === 1), 'index 0 leaves just the carrier');
});

test('harmonic, octave down, or bell-like', () => {
  assert.equal(harmonicity(sidebands(1, 1, 3)), 'harmonic');
  assert.equal(harmonicity(sidebands(1, 2, 3)), 'harmonic');
  assert.equal(harmonicity(sidebands(1, 3.5, 4)), 'inharmonic');
  assert.equal(harmonicity(sidebands(1, 1.41, 3)), 'inharmonic');
  assert.equal(harmonicity(sidebands(1, 0.5, 3)), 'octave-down');
});

test('every preset is a playable four-operator patch', () => {
  for (const [id, p] of Object.entries(PRESETS)) {
    assert.ok(ALGORITHMS.some((a) => a.id === p.algorithm), `${id}: algorithm`);
    assert.equal(p.ops.length, 4, `${id}: four operators`);
    assert.ok(p.feedback >= 0 && p.feedback <= 1, `${id}: feedback`);
    for (const o of p.ops) {
      assert.ok(o.ratio >= 0.5 && o.ratio < 32, `${id}: ratio ${o.ratio}`);
      assert.ok(o.level >= 0 && o.level <= 1, `${id}: level`);
      for (const k of ['a', 'd', 'r']) assert.ok(o.env[k] >= 0 && o.env[k] <= 4, `${id}: env.${k}`);
      assert.ok(o.env.s >= 0 && o.env.s <= 1, `${id}: env.s`);
    }
    const wave = previewWave(p, 100);
    assert.ok(wave.every(Number.isFinite), `${id}: preview wave`);
  }
});

test('algorithms are wired consistently', () => {
  for (const a of ALGORITHMS) {
    for (const n of a.carriers) assert.ok(a.ops.includes(n), `${a.id}: carrier ${n} is used`);
    for (const [from, to] of a.edges) {
      assert.ok(a.ops.includes(from) && a.ops.includes(to), `${a.id}: edge ${from}→${to}`);
      assert.ok(!a.carriers.includes(from), `${a.id}: op ${from} is a modulator, not a carrier`);
    }
    for (const n of a.ops) assert.ok(a.at[n], `${a.id}: op ${n} has a place in the drawing`);
  }
  assert.equal(algorithm('nope').id, 'pair');
});

test('the presets say what the lessons say they are', () => {
  assert.equal(predictedPartials(PRESETS.sine).pair, null);
  assert.equal(harmonicity(predictedPartials(PRESETS.organ).pair.partials), 'harmonic');
  assert.equal(harmonicity(predictedPartials(PRESETS.bell).pair.partials), 'inharmonic');
  const ep = predictedPartials(PRESETS.epiano);
  assert.ok(ep.partials.some((p) => p.op === 3 && near(p.x, 15)), 'the tine pair (14 into 1) is predicted too');
});

test('every lesson lab names a lab and a patch that exist', () => {
  const index = JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url)));
  for (const f of index.songs) {
    const song = JSON.parse(readFileSync(new URL(`../songs/${f}`, import.meta.url)));
    for (const l of song.lessons ?? []) {
      if (!l.lab) continue;
      assert.equal(l.lab, 'fm', `${song.id}/${l.id}: lab`);
      if (l.patch) assert.ok(PRESETS[l.patch], `${song.id}/${l.id}: patch ${l.patch}`);
    }
  }
});
