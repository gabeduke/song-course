// Music theory helpers: notes, scales, chords, and guitar fretboard geometry.
// Pure functions, no DOM — also runs under `node --test`.

export const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n) => ((n % 12) + 12) % 12;

/** "F#" -> 6, "Bb" -> 10. Returns null when it doesn't parse. */
export function pcOf(name) {
  const m = /^([A-Ga-g])([#b]*)/.exec(String(name).trim());
  if (!m) return null;
  let pc = LETTER_PC[m[1].toUpperCase()];
  for (const ch of m[2]) pc += ch === '#' ? 1 : -1;
  return mod12(pc);
}

/** "F#4" -> 66 (C4 = 60). Plain numbers pass through. */
export function midiOf(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-Ga-g][#b]*)(-?\d+)$/.exec(String(name).trim());
  if (!m) return null;
  const letter = m[1][0].toUpperCase();
  let semis = LETTER_PC[letter];
  for (const ch of m[1].slice(1)) semis += ch === '#' ? 1 : -1;
  return (Number(m[2]) + 1) * 12 + semis;
}

export function pcName(pc, flats = false) {
  return (flats ? FLATS : SHARPS)[mod12(pc)];
}

export function noteName(midi, flats = false) {
  return pcName(midi, flats) + (Math.floor(midi / 12) - 1);
}

// ---------------------------------------------------------------- scales

export const SCALES = {
  major: { name: 'Major (Ionian)', steps: [0, 2, 4, 5, 7, 9, 11], parent: 0 },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], parent: 2 },
  phrygian: { name: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], parent: 4 },
  lydian: { name: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], parent: 5 },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], parent: 7 },
  minor: { name: 'Natural minor (Aeolian)', steps: [0, 2, 3, 5, 7, 8, 10], parent: 9 },
  harmonicMinor: { name: 'Harmonic minor', steps: [0, 2, 3, 5, 7, 8, 11], parent: 9 },
  majorPentatonic: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], parent: 0 },
  minorPentatonic: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], parent: 9 },
  blues: { name: 'Blues', steps: [0, 3, 5, 6, 7, 10], parent: 9 },
};

export function scalePcs(rootPc, scale) {
  const s = SCALES[scale];
  if (!s) throw new Error(`Unknown scale "${scale}"`);
  return s.steps.map((st) => mod12(rootPc + st));
}

/** Whether to spell a key with flats, based on its parent major key. */
export function prefersFlats(rootPc, scale = 'major') {
  const parent = mod12(rootPc - (SCALES[scale]?.parent ?? 0));
  return [5, 10, 3, 8, 1, 6].includes(parent);
}

/** Key signature string VexFlow understands, e.g. B mixolydian -> "E". */
export function keySignature(rootPc, scale = 'major') {
  const parent = mod12(rootPc - (SCALES[scale]?.parent ?? 0));
  return pcName(parent, prefersFlats(rootPc, scale));
}

// ---------------------------------------------------------------- intervals

export const INTERVALS = ['R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/** Colour family for an interval, used consistently across the UI. */
export function intervalRole(semis) {
  switch (mod12(semis)) {
    case 0: return 'root';
    case 3: case 4: return 'third';
    case 7: return 'fifth';
    case 10: case 11: return 'seventh';
    case 6: return 'blue';
    default: return 'color';
  }
}

// ---------------------------------------------------------------- chords

export const CHORD_TYPES = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  mMaj7: [0, 3, 7, 11],
  m7b5: [0, 3, 6, 10],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  '9': [0, 4, 7, 10, 14],
  m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
};

/** "F#m7/C#" -> { symbol, root, quality, intervals, pcs, bass } */
export function parseChord(symbol) {
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(String(symbol).trim());
  if (!m) throw new Error(`Can't read chord "${symbol}"`);
  const quality = m[2];
  const intervals = CHORD_TYPES[quality];
  if (!intervals) throw new Error(`Unknown chord quality "${quality}" in "${symbol}"`);
  const root = pcOf(m[1]);
  return {
    symbol: String(symbol).trim(),
    root,
    rootName: m[1],
    quality,
    intervals,
    pcs: intervals.map((i) => mod12(root + i)),
    bass: m[3] ? pcOf(m[3]) : root,
  };
}

/** The chord's own third / fifth / seventh in semitones (or null). */
export function chordTone(chord, which) {
  const iv = chord.intervals;
  const find = (opts) => iv.find((x) => opts.includes(mod12(x)));
  switch (which) {
    case '3': return find([3, 4]) ?? find([2, 5]) ?? 4;
    case '5': return find([7, 6, 8]) ?? 7;
    case '7': return find([10, 11, 9]) ?? 10;
    default: return 0;
  }
}

// ---------------------------------------------------------------- guitar

/** Standard tuning, string 1 (high e) .. string 6 (low E), as MIDI numbers. */
export const TUNING = [64, 59, 55, 50, 45, 40];
export const BASS_TUNING = [43, 38, 33, 28]; // G D A E

export const fretMidi = (string, fret, tuning = TUNING) => tuning[string - 1] + fret;

/**
 * Parse a chord shape written low string to high: "x24442", "577655",
 * or with separators for frets above 9: "x.14.16.16.16.14" / "x 14 16 ...".
 * Returns an array indexed by string-1 (high e first) of fret|null.
 */
export function parseShape(shape) {
  const raw = String(shape).trim();
  const tokens = /[\s.,-]/.test(raw) ? raw.split(/[\s.,-]+/).filter(Boolean) : raw.split('');
  if (tokens.length !== 6) throw new Error(`Chord shape "${shape}" needs 6 strings`);
  return tokens.map((t) => (/^[xX]$/.test(t) ? null : Number(t))).reverse();
}

export function shapeToString(frets) {
  const lowToHigh = [...frets].reverse();
  const big = lowToHigh.some((f) => f !== null && f > 9);
  const toks = lowToHigh.map((f) => (f === null ? 'x' : String(f)));
  return big ? toks.join('.') : toks.join('');
}

export function shapeMidis(frets) {
  const out = [];
  for (let s = 6; s >= 1; s--) {
    const f = frets[s - 1];
    if (f !== null && f !== undefined) out.push({ string: s, fret: f, midi: fretMidi(s, f) });
  }
  return out; // low to high
}

// Movable shapes, written low to high relative to the root fret.
const E_SHAPES = {
  '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0], maj7: [0, null, 1, 1, 0, null], '5': [0, 2, 2, null, null, null],
  sus4: [0, 2, 2, 2, 0, 0], '6': [0, null, -1, 1, 0, null], dim: [0, 1, 2, 0, null, null],
};
const A_SHAPES = {
  '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0],
  m7: [null, 0, 2, 0, 1, 0], maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0],
  sus4: [null, 0, 2, 2, 3, 0], '5': [null, 0, 2, 2, null, null], '6': [null, 0, 2, 2, 2, 2],
  m7b5: [null, 0, 1, 0, 1, null], dim7: [null, 0, 1, -1, 1, null], '9': [null, 0, -1, 0, 0, 0],
  add9: [null, 0, 2, 4, 2, 0],
};

export const OPEN_CHORDS = {
  C: 'x32010', Cmaj7: 'x32000', C7: 'x32310', Cadd9: 'x32030',
  D: 'xx0232', Dm: 'xx0231', D7: 'xx0212', Dsus4: 'xx0233', Dsus2: 'xx0230', Dmaj7: 'xx0222', Dm7: 'xx0211',
  E: '022100', Em: '022000', E7: '020100', Em7: '022030', Esus4: '022200',
  F: '133211', Fmaj7: 'xx3210',
  G: '320003', G7: '320001', Gmaj7: '320002', Gsus4: '330013',
  A: 'x02220', Am: 'x02210', A7: 'x02020', Am7: 'x02010', Asus2: 'x02200', Asus4: 'x02230', Amaj7: 'x02120',
  B7: 'x21202', Bm: 'x24432', Bm7: 'x20202',
};

/** A playable default voicing for a chord symbol. */
export function defaultVoicing(symbol, prefer = 'open') {
  const c = parseChord(symbol);
  const q = c.quality === 'maj' ? '' : c.quality === 'min' ? 'm' : c.quality === 'sus' ? 'sus4' : c.quality;
  const key = c.rootName + q;
  if (prefer === 'open' && OPEN_CHORDS[key] && !symbol.includes('/')) return parseShape(OPEN_CHORDS[key]);
  const build = (shape, rootString) => {
    const base = mod12(c.root - TUNING[rootString - 1]);
    const fret = base === 0 && prefer !== 'open' ? 12 : base;
    return shape.map((d) => (d === null ? null : fret + d)).reverse();
  };
  const options = [];
  if (E_SHAPES[q]) options.push(build(E_SHAPES[q], 6));
  if (A_SHAPES[q]) options.push(build(A_SHAPES[q], 5));
  const valid = options.filter((f) => f.every((x) => x === null || x >= 0));
  if (valid.length) {
    valid.sort((a, b) => minFret(a) - minFret(b));
    return valid.find((v) => minFret(v) >= 1 && minFret(v) <= 9) ?? valid[0];
  }
  // Last resort: stack the chord tones from the A string up.
  return [null, null, null, null, null, null].map((_, i) => {
    const s = i + 1;
    if (s > 4) return null;
    const target = c.pcs[(4 - s) % c.pcs.length];
    return mod12(target - TUNING[s - 1]);
  });
}

export function minFret(frets) {
  const fr = frets.filter((f) => f !== null && f > 0);
  return fr.length ? Math.min(...fr) : 0;
}

/**
 * Every 3-string triad shape for a chord on adjacent string sets.
 * Returns [{ strings:[hi,mid,lo], frets:[..], inversion, set }]
 */
export function triadShapes(chord, { maxFret = 15, maxSpan = 3 } = {}) {
  const third = chordTone(chord, '3');
  const fifth = chordTone(chord, '5');
  const tones = [0, third, fifth].map((i) => mod12(chord.root + i));
  const sets = [[1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6]];
  const out = [];
  for (const set of sets) {
    const [a, b, c] = set;
    for (let fa = 0; fa <= maxFret; fa++) {
      const pa = mod12(fretMidi(a, fa));
      if (!tones.includes(pa)) continue;
      for (let fb = Math.max(0, fa - maxSpan); fb <= Math.min(maxFret, fa + maxSpan); fb++) {
        const pb = mod12(fretMidi(b, fb));
        if (!tones.includes(pb) || pb === pa) continue;
        for (let fc = Math.max(0, fa - maxSpan); fc <= Math.min(maxFret, fa + maxSpan); fc++) {
          const pc = mod12(fretMidi(c, fc));
          if (!tones.includes(pc) || pc === pa || pc === pb) continue;
          const frets = [fa, fb, fc];
          if (Math.max(...frets) - Math.min(...frets) > maxSpan) continue;
          const bassIv = mod12(pc - chord.root);
          const inversion = bassIv === 0 ? 'root' : bassIv === mod12(third) ? 'first' : 'second';
          out.push({ strings: set, frets, inversion, set: set.join('') });
        }
      }
    }
  }
  return out.sort((x, y) => Math.min(...x.frets) - Math.min(...y.frets));
}

/**
 * Fretboard positions for a scale — five overlapping boxes up the neck.
 * Built from the matching pentatonic (2 notes per string, by pitch), then
 * filled with any extra scale tones inside each box's fret window.
 * Position 1 starts on the tonic on the low E string.
 */
export function scalePositions(rootPc, scale, { maxFret = 17 } = {}) {
  const steps = SCALES[scale].steps;
  const isMinorish = !steps.includes(4);
  const pentSteps = isMinorish ? SCALES.minorPentatonic.steps : SCALES.majorPentatonic.steps;
  const pcs = new Set(scalePcs(rootPc, scale));
  const rootFret = mod12(rootPc - TUNING[5]);
  const positions = [];
  for (let k = 0; k < 5; k++) {
    const startFret = rootFret + pentSteps[k];
    const startMidi = fretMidi(6, startFret);
    // ascending pentatonic pitches from the start note
    const pent = [];
    for (let m = startMidi; pent.length < 12; m++) {
      if (pentSteps.includes(mod12(m - rootPc))) pent.push(m);
    }
    const notes = [];
    let i = 0;
    for (let s = 6; s >= 1; s--) {
      for (let j = 0; j < 2; j++, i++) {
        // A note that would sit behind the nut (E major's G# on the A
        // string) goes on the next string down instead.
        const f = pent[i] - TUNING[s - 1];
        notes.push(f < 0 && s < 6 ? { string: s + 1, fret: pent[i] - TUNING[s] } : { string: s, fret: f });
      }
    }
    let lo = Math.min(...notes.map((n) => n.fret));
    let hi = Math.max(...notes.map((n) => n.fret));
    // Fill in the scale tones that sit between neighbouring pentatonic
    // anchors, on whichever of the two strings keeps the hand in the box.
    let full = notes.map((n) => ({ ...n }));
    const outside = (f) => (f < lo ? lo - f : f > hi ? f - hi : 0);
    for (let a = 0; a < notes.length - 1; a++) {
      const lowN = notes[a];
      const highN = notes[a + 1];
      const pLow = fretMidi(lowN.string, lowN.fret);
      const pHigh = fretMidi(highN.string, highN.fret);
      for (let p = pLow + 1; p < pHigh; p++) {
        if (!pcs.has(mod12(p))) continue;
        const onLow = { string: lowN.string, fret: p - TUNING[lowN.string - 1] };
        const onHigh = { string: highN.string, fret: p - TUNING[highN.string - 1] };
        const opts = [onLow, onHigh].filter((o) => o.fret >= 0);
        opts.sort((x, y) => outside(x.fret) - outside(y.fret));
        full.push(opts[0]);
      }
    }
    // The pentatonic outline can hold a note the scale doesn't (harmonic
    // minor's b7): the fill above has already put the scale's own one in.
    full = full.filter((n) => pcs.has(mod12(fretMidi(n.string, n.fret))));
    full.sort((x, y) => fretMidi(x.string, x.fret) - fretMidi(y.string, y.fret));
    lo = Math.min(...full.map((n) => n.fret));
    hi = Math.max(...full.map((n) => n.fret));
    let shift = 0;
    if (lo >= 12) shift = -12;
    if (hi + shift > maxFret) shift -= 12;
    if (lo + shift < 0) shift = 0;
    full = full.map((n) => ({ ...n, fret: n.fret + shift }));
    lo += shift; hi += shift;
    positions.push({ index: k + 1, lo, hi, notes: dedupe(full) });
  }
  return positions;
}

function dedupe(notes) {
  const seen = new Set();
  return notes.filter((n) => {
    const k = `${n.string}:${n.fret}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Map a MIDI note to the closest fretboard spot, preferring a fret window. */
export function placeOnNeck(midi, { lo = 0, hi = 15, tuning = TUNING } = {}) {
  let best = null;
  for (let s = 1; s <= tuning.length; s++) {
    const f = midi - tuning[s - 1];
    if (f < 0 || f > 22) continue;
    const dist = f < lo ? lo - f : f > hi ? f - hi : 0;
    const score = dist * 10 + Math.abs(f - (lo + hi) / 2) * 0.1 + (f === 0 ? 0.5 : 0);
    if (!best || score < best.score) best = { string: s, fret: f, score };
  }
  return best && { string: best.string, fret: best.fret };
}
