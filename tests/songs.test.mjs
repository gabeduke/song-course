import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileSong } from '../js/song.js';
import { parseChord, scalePositions, triadShapes, pcOf, parseShape, fretMidi } from '../js/theory.js';

const index = JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url)));

for (const file of index.songs) {
  test(`song ${file} compiles`, () => {
    const song = JSON.parse(readFileSync(new URL(`../songs/${file}`, import.meta.url)));
    const c = compileSong(song);
    assert.ok(c.arrangement.length > 0);
    for (const sec of Object.values(c.sections)) {
      for (const [pid, list] of Object.entries(sec.parts)) {
        for (const v of list) {
          assert.ok(v.events.length > 0, `${sec.id}/${pid}/${v.id} has no events`);
          for (const ev of v.events) {
            assert.ok(ev.t >= 0 && ev.t < sec.length, `${v.id} event out of range`);
            if (ev.midi !== undefined) assert.ok(Number.isFinite(ev.midi), `${v.id} bad midi`);
          }
        }
      }
    }
    for (const l of c.lessons) {
      const sid = l.setup?.section;
      if (sid) assert.ok(c.sections[sid], `lesson ${l.id} names unknown section ${sid}`);
      for (const [pid, vid] of Object.entries(l.setup?.select ?? {})) {
        if (vid === 'off') continue;
        assert.ok(c.sections[sid].parts[pid]?.some((v) => v.id === vid), `lesson ${l.id}: no ${pid} variation "${vid}" in ${sid}`);
      }
    }
  });
  test(`song ${file} voicings spell their chords`, () => {
    const song = JSON.parse(readFileSync(new URL(`../songs/${file}`, import.meta.url)));
    const check = (sym, shape) => {
      const ch = parseChord(sym);
      const frets = parseShape(shape);
      frets.forEach((f, i) => {
        if (f === null) return;
        const pc = fretMidi(i + 1, f) % 12;
        assert.ok(ch.pcs.includes(pc) || [2, 9, 10, 11].includes((pc - ch.root + 12) % 12), `${sym} ${shape}: string ${i + 1} is not a chord tone`);
      });
    };
    for (const [sym, shape] of Object.entries(song.voicings ?? {})) check(sym, shape);
    for (const sec of song.sections) for (const list of Object.values(sec.parts ?? {})) {
      if (!Array.isArray(list)) continue;
      for (const v of list) if (v && v.voicings) for (const [sym, shape] of Object.entries(v.voicings)) check(sym, shape);
    }
  });
}

test('pentatonic box 1 in A minor sits at the 5th fret', () => {
  const p = scalePositions(pcOf('A'), 'minorPentatonic')[0];
  assert.equal(p.lo, 5);
  assert.equal(p.hi, 8);
});

test('B major has root-position triad at 4-4-2 on the top strings', () => {
  const shapes = triadShapes(parseChord('B')).filter((t) => t.set === '123');
  assert.ok(shapes.some((t) => t.frets.join() === '2,4,4' && t.inversion === 'root'));
});

// A two-bar B | A vamp in B mixolydian with one lead variation.
const pedalSong = (v) => compileSong({
  id: 't', title: 'T', key: 'B', scale: 'mixolydian', tempo: 90,
  parts: [{ id: 'lead', instrument: 'guitar' }],
  sections: [{ id: 'v', chords: 'B | A', parts: { lead: [{ id: 'p', type: 'pedal', ...v }] } }],
}).sections.v.parts.lead[0].events;

test('a pedal sits on its string under the finger that holds it, and the rest fit the hand', () => {
  const evs = pedalSong({ pattern: 'P 2 P 3 P 5 P 3', string: 4, finger: 4 });
  const pedals = evs.filter((e) => e.pedal);
  assert.deepEqual([...new Set(pedals.map((e) => `${e.chord}:${e.string}:${e.fret}:${e.finger}`))], ['B:4:9:4', 'A:4:7:4']);
  for (const e of evs.filter((x) => !x.pedal)) {
    assert.ok(e.string < 4, `${e.chord} ${e.midi} is on a higher string than the pedal`);
    assert.ok(e.fret >= e.box - 1 && e.fret <= e.box + 4, `${e.chord} fret ${e.fret} is within a stretch of frets ${e.box}–${e.box + 3}`);
    assert.ok(e.finger >= 1 && e.finger <= 3, `the little finger is busy with the pedal, not ${e.finger}`);
  }
  // over B: C#, D#, F#; over A: B, C#, E
  assert.deepEqual(evs.filter((e) => !e.pedal).slice(0, 3).map((e) => e.midi), [61, 63, 66]);
  assert.deepEqual(evs.filter((e) => !e.pedal && e.chord === 'A').slice(0, 3).map((e) => e.midi), [59, 61, 64]);
});

test('a pedal rings until it is picked again, and never past the chord', () => {
  const evs = pedalSong({ pattern: 'P 3 5 3', grid: '8', finger: 4, string: [6, 5], near: 2 });
  const pedals = evs.filter((e) => e.pedal);
  assert.ok(pedals.every((e) => e.d === 8), pedals.map((e) => e.d));
  const long = pedalSong({ pattern: 'P - 5 3 5 3 5 3 5 3', grid: '8', finger: 4, string: [6, 5], near: 2 }).filter((e) => e.pedal);
  assert.ok(long.every((e) => e.t % 16 + e.d <= 16), 'the pedal stops at the bar line, where the chord changes');
});

test('an exact pedal note holds still through the changes', () => {
  const evs = pedalSong({ pedal: 'A3', pattern: 'P 3 P 5', string: 4, finger: 2 });
  assert.deepEqual([...new Set(evs.filter((e) => e.pedal).map((e) => `${e.string}:${e.fret}`))], ['4:7']);
});

test('a note the hand can’t reach is an error that says so', () => {
  // the index on B at the D string's 9th fret: the 2nd is behind the hand
  assert.throws(() => pedalSong({ pattern: 'P 2', string: 4, finger: 1 }), /out of reach/);
});

test('every pedal part in the songs keeps the fingers from crossing', () => {
  for (const file of index.songs) {
    const c = compileSong(JSON.parse(readFileSync(new URL(`../songs/${file}`, import.meta.url))));
    for (const sec of Object.values(c.sections)) {
      for (const v of Object.values(sec.parts).flat().filter((x) => x.type === 'pedal')) {
        const pedalAt = (t) => [...v.events].reverse().find((e) => e.pedal && e.t <= t && e.chord === v.events.find((x) => x.t === t)?.chord);
        for (const e of v.events.filter((x) => !x.pedal)) {
          const p = pedalAt(e.t);
          assert.ok(p, `${file} ${v.id}: a note before its pedal`);
          assert.notEqual(e.finger, p.finger, `${file} ${v.id}: the pedal finger can't play another note`);
          // on a thinner string at the same fret, only a higher finger fits
          if (e.fret === p.fret) assert.ok(e.finger > p.finger, `${file} ${v.id} t${e.t}: fingers cross`);
        }
      }
    }
  }
});
