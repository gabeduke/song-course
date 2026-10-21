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
