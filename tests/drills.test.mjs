import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileSong } from '../js/song.js';
import { mod12, scalePcs, pcOf, parseChord } from '../js/theory.js';
import {
  DRILLS, KEYS, CATEGORIES, DEFAULT_ROUTINE, drillById, drillParams, buildDrill, advance, advanceChoices, paramsLabel, cagedShapes,
} from '../js/drills.js';
import { LESSONS, lessonsFor } from '../js/lessons.js';

/** Every key and stop, and each option's every value on its own (not every product). */
function settings(drill) {
  const base = drillParams(drill);
  const out = [];
  const stopsFor = (p) => drill.stops?.(drillParams(drill, p)) ?? [{ value: null }];
  for (const key of drill.keyed ? KEYS : [null]) {
    for (const stop of stopsFor({ ...base, key })) out.push({ ...base, key, stop: stop.value });
  }
  for (const o of drill.options ?? []) {
    for (const c of o.choices) {
      for (const stop of stopsFor({ ...base, [o.id]: c.value })) out.push({ ...base, [o.id]: c.value, stop: stop.value });
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
  for (const id of ['pentatonic-boxes', 'scale-positions', 'pentatonic-connect', 'string-skipping', 'octaves', 'double-stops', 'scale-degrees', 'call-response']) {
    const drill = drillById(id);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const pcs = scalePcs(pcOf(built.raw.key), built.raw.scale);
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

test('the session and the lessons point at drills that exist', () => {
  for (const item of DEFAULT_ROUTINE) if (item.drill) assert.ok(drillById(item.drill), item.drill);
  for (const l of LESSONS) for (const id of l.drills) assert.ok(drillById(id), `${l.id}: ${id}`);
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  const unread = DRILLS.filter((d) => !lessonsFor(d.id).length).map((d) => d.id);
  assert.deepEqual(unread, [], 'every drill has a lesson that sends you to it');
});

/** The demo's notes grouped by the step they start on. */
function chords(built) {
  const by = new Map();
  for (const ev of compileSong(built.raw).sections.drill.parts.demo[0].events) {
    if (!by.has(ev.t)) by.set(ev.t, []);
    by.get(ev.t).push(ev);
  }
  return [...by.values()];
}

test('octaves are octaves, and double stops are 3rds or 6ths, two strings at a time', () => {
  for (const p of settings(drillById('octaves'))) {
    for (const pair of chords(buildDrill(drillById('octaves'), p))) {
      assert.equal(pair.length, 2);
      assert.equal(Math.abs(pair[0].midi - pair[1].midi), 12, JSON.stringify(p));
    }
  }
  for (const p of settings(drillById('double-stops'))) {
    const built = buildDrill(drillById('double-stops'), p);
    const ok = built.params.interval === 'sixths' ? [8, 9] : [3, 4];
    const pairs = chords(built);
    assert.ok(pairs.length >= 4, `${JSON.stringify(built.params)}: only ${pairs.length} pairs`);
    for (const pair of pairs) {
      assert.equal(pair.length, 2);
      assert.ok(ok.includes(Math.abs(pair[0].midi - pair[1].midi)), `${JSON.stringify(built.params)}: ${pair.map((x) => x.midi)}`);
    }
  }
});

test('CAGED: five different shapes up the neck in C A G E D order, every note in the chord', () => {
  const cycle = 'CAGED';
  for (const key of KEYS) {
    const pc = pcOf(key);
    const shapes = cagedShapes(pc);
    assert.equal(shapes.length, 5, key);
    for (let i = 1; i < 5; i++) {
      assert.equal(cycle[(cycle.indexOf(shapes[i - 1].name) + 1) % 5], shapes[i].name, `${key}: ${shapes.map((s) => s.name).join('')}`);
    }
    const triad = parseChord(key).pcs;
    for (const s of shapes) {
      s.frets.forEach((f, i) => {
        if (f === null) return;
        assert.ok(f >= 0 && f <= 15);
        assert.ok(triad.includes(mod12([64, 59, 55, 50, 45, 40][i] + f)), `${key} ${s.name} shape, string ${i + 1}`);
      });
    }
  }
});

test('find every note plays only that note, on all six strings', () => {
  const drill = drillById('find-notes');
  for (const key of KEYS) {
    const evs = compileSong(buildDrill(drill, { key }).raw).sections.drill.parts.demo[0].events;
    assert.ok(evs.every((ev) => mod12(ev.midi) === pcOf(key)), key);
    assert.equal(new Set(evs.map((ev) => ev.string)).size, 6, key);
  }
});

test('ear drills: the same settings give the same notes, a new round new ones, and every other bar is yours', () => {
  for (const id of ['call-response', 'scale-degrees']) {
    const drill = drillById(id);
    const notes = (p) => JSON.stringify(buildDrill(drill, p).raw.sections[0].parts.demo[0].notes);
    assert.equal(notes({ key: 'A', round: 2 }), notes({ key: 'A', round: 2 }), id);
    assert.notEqual(notes({ key: 'A', round: 1 }), notes({ key: 'A', round: 2 }), id);
    for (const p of settings(drill)) {
      const built = buildDrill(drill, p);
      const c = compileSong(built.raw);
      for (const ev of c.sections.drill.parts.demo[0].events) {
        assert.equal(Math.floor(ev.t / 16) % 2, 0, `${id} ${JSON.stringify(built.params)}: a note in your bar`);
        assert.ok(ev.t + ev.d <= (Math.floor(ev.t / 16) + 1) * 16, `${id}: a note held into your bar`);
      }
    }
  }
  // each call ends on a chord tone of the minor chord
  for (const p of settings(drillById('call-response'))) {
    const built = buildDrill(drillById('call-response'), p);
    const evs = compileSong(built.raw).sections.drill.parts.demo[0].events;
    const root = pcOf(built.raw.key);
    for (let bar = 0; bar < 8; bar += 2) {
      const last = evs.filter((e) => Math.floor(e.t / 16) === bar).at(-1);
      assert.ok([0, 3, 7].includes(mod12(last.midi - root)), `${JSON.stringify(built.params)} bar ${bar + 1}`);
    }
  }
});
