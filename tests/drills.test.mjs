import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSong } from '../js/song.js';
import { mod12, scalePcs, pcOf } from '../js/theory.js';
import {
  DRILLS, KEYS, CATEGORIES, VIDEO, DEFAULT_ROUTINE, drillById, drillParams, buildDrill, advance, advanceChoices, paramsLabel,
} from '../js/drills.js';

/** Every key and stop, and each option's every value on its own (not every product). */
function settings(drill) {
  const base = drillParams(drill);
  const out = [];
  for (const key of drill.keyed ? KEYS : [null]) {
    for (const stop of drill.stops?.(base) ?? [{ value: null }]) out.push({ ...base, key, stop: stop.value });
  }
  for (const o of drill.options ?? []) {
    for (const c of o.choices) {
      for (const stop of drill.stops?.(base) ?? [{ value: null }]) out.push({ ...base, [o.id]: c.value, stop: stop.value });
    }
  }
  return out;
}

for (const drill of DRILLS) {
  test(`drill ${drill.id} builds and compiles in every key and position`, () => {
    assert.ok(CATEGORIES.some((c) => c.id === drill.category), `${drill.id}: unknown category`);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const at = `${drill.id} ${JSON.stringify(built.params)}`;
      const c = compileSong(built.raw);
      const sec = c.sections.drill;
      const demo = sec.parts.demo[0];
      assert.ok(demo.events.length > 0, `${at}: the demo plays nothing`);
      for (const ev of demo.events) {
        assert.ok(ev.t >= 0 && ev.t < sec.length, `${at}: a note outside the section`);
        if (ev.string) assert.ok(ev.fret >= 0 && ev.fret <= 15, `${at}: fret ${ev.fret} is off the neck`);
        for (const n of ev.notes ?? []) assert.ok(n.fret >= 0 && n.fret <= 15, `${at}: a chord off the neck`);
      }
      const model = built.neck(sec.changes[0].symbol, 0);
      assert.ok(model.dots.length > 0, `${at}: the neck shows nothing`);
      for (const d of model.dots) assert.ok(d.string >= 1 && d.string <= 6 && d.fret >= 0 && d.fret <= 15, `${at}: a dot off the neck`);
      assert.ok(built.where.length > 0);
    }
  });
}

test('scale drills only play notes of their scale', () => {
  for (const id of ['pentatonic-boxes', 'scale-positions', 'pentatonic-connect']) {
    const drill = drillById(id);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const pcs = scalePcs(pcOf(built.raw.key), built.params.scale);
      for (const ev of compileSong(built.raw).sections.drill.parts.demo[0].events) {
        assert.ok(pcs.includes(mod12(ev.midi)), `${id} ${JSON.stringify(built.params)}: ${ev.midi} isn't in the scale`);
      }
    }
  }
});

test('triad drills play the bar’s chord, and the solo lands on a chord tone on every downbeat', () => {
  for (const id of ['triad-inversions', 'triads-in-key', 'triad-changes', 'triad-solo']) {
    const drill = drillById(id);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const c = compileSong(built.raw);
      const sec = c.sections.drill;
      for (const ev of sec.parts.demo[0].events) {
        const chord = sec.ctx.chordAt(ev.t);
        const onBeatOne = ev.t % 16 === 0;
        if (id !== 'triad-solo' || onBeatOne) {
          assert.ok(chord.pcs.includes(mod12(ev.midi)), `${id} ${JSON.stringify(built.params)}: ${ev.midi} at ${ev.t} isn't in ${chord.symbol}`);
        }
      }
    }
  }
});

test('voice-led triads stay close: no chord change jumps more than five frets', () => {
  for (const id of ['triad-changes', 'triad-solo']) {
    const drill = drillById(id);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const ev = compileSong(built.raw).sections.drill.parts.demo[0].events.filter((e) => e.t % 16 === 0);
      for (let i = 1; i < ev.length; i++) {
        assert.ok(Math.abs(ev[i].fret - ev[i - 1].fret) <= 5, `${id} ${JSON.stringify(built.params)}: jump at bar ${i + 1}`);
      }
    }
  }
});

test('moving on: twelve fourths come home, stops wrap round', () => {
  const drill = drillById('pentatonic-boxes');
  let p = drillParams(drill, { key: 'A' });
  for (let i = 0; i < 12; i++) p = advance(drill, p, 'fourth');
  assert.equal(p.key, 'A');
  assert.equal(advance(drill, { key: 'A' }, 'fourth').key, 'D');
  assert.equal(advance(drill, { key: 'B' }, 'half').key, 'C');
  let q = drillParams(drill, { stop: 1 });
  for (let i = 0; i < 4; i++) q = advance(drill, q, 'stop');
  assert.equal(q.stop, 5);
  assert.equal(advance(drill, q, 'stop').stop, 1);
  assert.deepEqual(advanceChoices(drillById('chromatic')).map((c) => c.value), ['stop']);
  assert.equal(advance(drillById('chromatic'), { stop: 3 }, 'fourth').stop, 3);
});

test('settings that make no sense fall back to the drill’s own', () => {
  const drill = drillById('triad-inversions');
  const p = drillParams(drill, { key: 'H', stop: '999', quality: 'aug' });
  assert.equal(p.key, drill.defaultKey);
  assert.equal(p.stop, '123');
  assert.equal(p.quality, '');
  assert.equal(paramsLabel(drill, { key: 'D', stop: '234' }), 'D · Strings 2–4');
});

test('the session and the video point at drills that exist', () => {
  for (const item of DEFAULT_ROUTINE) if (item.drill) assert.ok(drillById(item.drill), item.drill);
  for (const ch of VIDEO.chapters) assert.ok(drillById(ch.drill), ch.drill);
  for (const d of DRILLS) for (const t of d.video ?? []) assert.ok(VIDEO.chapters.some((c) => c.t === t), `${d.id}: no chapter at ${t}`);
});
