// The practice book: warm-ups, triads, pentatonic boxes and scales that
// build themselves in any key and at any spot on the neck. Each drill turns
// its settings into a song file (docs/song-format.md) with a demo guitar
// part and a small band, so the transport, the band and the neck work on a
// drill exactly as they do on a song.
// Pure functions, no DOM — also runs under `node --test`.

import {
  pcOf, pcName, prefersFlats, mod12, parseChord, scalePcs, scalePositions, triadShapes,
  fretMidi, defaultVoicing, placeOnNeck, SCALES, TUNING,
} from './theory.js';

export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// "Next key" walks the cycle of fourths, the way the books drill a shape
// through every key.
export const FOURTHS = ['C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'F#', 'B', 'E', 'A', 'D', 'G'];

export const CATEGORIES = [
  { id: 'warmup', title: 'Warm-ups', blurb: 'Hands and time first: five minutes before anything else.' },
  { id: 'technique', title: 'Technique', blurb: 'Strumming, string crossing, octaves and double stops: the skills under the songs.' },
  { id: 'triads', title: 'Triads', blurb: 'Three-note chord shapes on every string set, through the key and over changes.' },
  { id: 'pentatonic', title: 'Pentatonic', blurb: 'The five boxes, then joining them up the neck.' },
  { id: 'scales', title: 'Scales', blurb: 'Major, minor and the modes in five positions, straight and in patterns.' },
  { id: 'neck', title: 'The neck', blurb: 'Where every note is, and the five shapes every chord has.' },
  { id: 'ear', title: 'Ear training', blurb: 'Hear it, then find it: notes of the key and phrases to play back.' },
];

// ------------------------------------------------------------------ helpers

const keyName = (pc, flats) => pcName(pc, flats);

/** The note list for a run of {string, fret}s, `step` sixteenths apiece, padded to whole bars. */
function run(spots, step = 2, { bar = 16 } = {}) {
  const notes = spots.map((sp, i) => ({ t: i * step, s: sp.string, f: sp.fret, d: step }));
  const total = Math.max(bar, Math.ceil((spots.length * step) / bar) * bar);
  if (notes.length) notes[notes.length - 1].d = total - notes[notes.length - 1].t;
  return { notes, bars: total / bar };
}

const DRUMS = {
  click: { id: 'click', name: 'Click', pattern: { rim: 'x...x...x...x...', kick: 'x...............' } },
  groove: { id: 'groove', name: 'Groove', pattern: { hat: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.......', snare: '....x.......x...' } },
};

/**
 * A drill's song file. `chords` is one chord a bar; `demo` the guitar's
 * variation; `band` 'vamp' (drums, bass, a keys pad), 'groove' (drums and
 * bass, the guitar has the chords) or 'click' (a rim click).
 */
function drillSong({ id, title, key, scale, tempo, chords, demo, band = 'vamp' }) {
  const parts = [{ id: 'demo', name: 'Demo guitar', instrument: 'guitar' }];
  const play = { demo: [demo] };
  if (band === 'vamp' || band === 'groove') {
    parts.push({ id: 'bass', name: 'Bass', instrument: 'bass', volume: 0.55 });
    play.bass = [{ id: 'roots', name: 'Roots', steps: 'R - - - 5 - - -' }];
  }
  if (band === 'vamp') {
    parts.push({ id: 'keys', name: 'Keys', instrument: 'keys', volume: 0.35 });
    play.keys = [{ id: 'pad', name: 'Pad', pattern: 'x-------', leftHand: false }];
  }
  parts.push({ id: 'drums', name: 'Drums', instrument: 'drums', volume: band === 'click' ? 0.6 : 0.7 });
  play.drums = [band === 'click' ? DRUMS.click : DRUMS.groove];
  return {
    format: 1,
    id: `drill-${id}`,
    title,
    key,
    scale,
    meter: '4/4',
    tempo,
    parts,
    sections: [{ id: 'drill', name: title, chords: chords.join(' | '), parts: play }],
  };
}

const opt = (id, label, choices, value) => ({ id, label, choices, default: value ?? choices[0].value });
const RHYTHM = opt('rhythm', 'Notes', [{ value: 2, label: '8ths' }, { value: 1, label: '16ths' }]);

const STRING_SETS = [
  { value: '123', label: '1–3' }, { value: '234', label: '2–4' }, { value: '345', label: '3–5' }, { value: '456', label: '4–6' },
];

const AREAS = [
  { value: 'low', label: 'Low', center: 3 },
  { value: 'mid', label: 'Middle', center: 7 },
  { value: 'high', label: 'High', center: 11 },
];

const PROGRESSIONS = {
  'I-IV-V-I': { label: 'I–IV–V–I', degrees: ['I', 'IV', 'V', 'I'] },
  'I-vi-IV-V': { label: 'I–vi–IV–V', degrees: ['I', 'vi', 'IV', 'V'] },
  'I-V-vi-IV': { label: 'I–V–vi–IV', degrees: ['I', 'V', 'vi', 'IV'] },
  'ii-V-I-I': { label: 'ii–V–I', degrees: ['ii', 'V', 'I', 'I'] },
  blues: { label: '12-bar blues', degrees: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'] },
};
const ROMAN = { I: [0, ''], ii: [2, 'm'], iii: [4, 'm'], IV: [5, ''], V: [7, ''], vi: [9, 'm'], vii: [11, 'dim'] };
const PROGRESSION = opt('progression', 'Changes', Object.entries(PROGRESSIONS).map(([value, p]) => ({ value, label: p.label })));

function progressionChords(rootPc, progression, flats) {
  return PROGRESSIONS[progression].degrees.map((r) => {
    const [st, q] = ROMAN[r];
    return keyName(rootPc + st, flats) + q;
  });
}

const shapeKey = (t) => `${t.set}:${t.frets.join(',')}`;
const center = (t) => t.frets.reduce((a, b) => a + b, 0) / 3;
const minOf = (t) => Math.min(...t.frets);

function shapesOn(symbol, set, maxSpan = 3) {
  const seen = new Set();
  return triadShapes(parseChord(symbol), { maxSpan }).filter((t) => {
    if (t.set !== set || seen.has(shapeKey(t))) return false;
    seen.add(shapeKey(t));
    return true;
  });
}

/** low to high: [{string, fret}] for a triad shape. */
const spotsOf = (t) => [2, 1, 0].map((i) => ({ string: t.strings[i], fret: t.frets[i] }));

/** One bar on a triad: up the shape, back to the middle, then the three together. */
function triadBar(t, at) {
  const [lo, mid, hi] = spotsOf(t);
  return [
    { t: at, s: lo.string, f: lo.fret, d: 2 },
    { t: at + 2, s: mid.string, f: mid.fret, d: 2 },
    { t: at + 4, s: hi.string, f: hi.fret, d: 2 },
    { t: at + 6, s: mid.string, f: mid.fret, d: 2 },
    ...[lo, mid, hi].map((p) => ({ t: at + 8, s: p.string, f: p.fret, d: 8 })),
  ];
}

const INV_ROLE = { root: 'root', first: 'third', second: 'fifth' };

function triadModel(chosen, others = []) {
  const dots = [];
  const shapes = [];
  const seen = new Set();
  const add = (t, faint) => {
    shapes.push({ points: t.strings.map((s, i) => ({ string: s, fret: t.frets[i] })), role: INV_ROLE[t.inversion], faint });
    t.strings.forEach((s, i) => {
      const k = `${s}:${t.frets[i]}`;
      if (seen.has(k)) return;
      seen.add(k);
      dots.push({ string: s, fret: t.frets[i], faint });
    });
  };
  for (const t of chosen) add(t, false);
  for (const t of others) if (!chosen.some((c) => shapeKey(c) === shapeKey(t))) add(t, true);
  return { dots, shapes };
}

const fretSpan = (spots) => {
  const fr = spots.map((s) => s.fret);
  return [Math.min(...fr), Math.max(...fr)];
};

// ------------------------------------------------------------------ scale boxes

function boxSequence(notes, pattern) {
  const n = notes.length;
  const idx = [];
  if (pattern === 'threes' || pattern === 'fours') {
    const g = pattern === 'threes' ? 3 : 4;
    for (let i = 0; i + g <= n; i++) for (let j = 0; j < g; j++) idx.push(i + j);
    for (let i = n - 1; i - g + 1 >= 0; i--) for (let j = 0; j < g; j++) idx.push(i - j);
  } else if (pattern === 'thirds') {
    for (let i = 0; i + 2 < n; i++) idx.push(i, i + 2);
    for (let i = n - 1; i - 2 >= 0; i--) idx.push(i, i - 2);
  } else {
    for (let i = 0; i < n; i++) idx.push(i);
    for (let i = n - 2; i > 0; i--) idx.push(i);
  }
  return idx.map((i) => notes[i]);
}

const TONIC_CHORD = {
  major: 'maj7', lydian: 'maj7', mixolydian: '7', dorian: 'm7', phrygian: 'm7', minor: 'm7',
  harmonicMinor: 'm', majorPentatonic: '6', minorPentatonic: 'm7', blues: '7',
};

function boxes(rootPc, scale) {
  return scalePositions(rootPc, scale, { maxFret: 15 });
}

/** The scale everywhere on the neck, faint, and the box lit. */
function boxModel(rootPc, scale, pos) {
  const pcs = scalePcs(rootPc, scale);
  const inBox = new Set(pos.notes.map((n) => `${n.string}:${n.fret}`));
  const dots = [];
  for (let s = 1; s <= 6; s++) {
    for (let f = 0; f <= 15; f++) {
      if (!pcs.includes(mod12(fretMidi(s, f)))) continue;
      dots.push({ string: s, fret: f, faint: !inBox.has(`${s}:${f}`) });
    }
  }
  return { dots, band: [pos.lo, pos.hi] };
}

const boxDrill = ({ id, category, title, goal, scales, body, steps, tempo = 80 }) => ({
  id,
  category,
  title,
  goal,
  body,
  steps,
  keyed: true,
  defaultKey: 'A',
  tempo,
  stopName: 'Box',
  stopsName: 'boxes',
  moveName: 'Next box',
  stops: () => [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
  options: [
    opt('scale', 'Scale', scales.map((s) => ({ value: s, label: SCALES[s].name }))),
    opt('pattern', 'Pattern', [
      { value: 'updown', label: 'Up and down' }, { value: 'threes', label: 'Threes' },
      { value: 'fours', label: 'Fours' }, { value: 'thirds', label: 'Thirds' },
    ]),
    RHYTHM,
  ],
  build(p) {
    const rootPc = pcOf(p.key);
    const flats = prefersFlats(rootPc, p.scale);
    const pos = boxes(rootPc, p.scale)[p.stop - 1];
    const { notes, bars } = run(boxSequence(pos.notes, p.pattern), p.rhythm);
    const tonic = keyName(rootPc, flats) + TONIC_CHORD[p.scale];
    return {
      raw: drillSong({
        id, title, key: keyName(rootPc, flats), scale: p.scale, tempo: this.tempo,
        chords: Array(bars).fill(tonic), demo: { id: 'run', name: 'The run', type: 'notes', notes },
      }),
      where: `${keyName(rootPc, flats)} ${SCALES[p.scale].name.toLowerCase()} · box ${p.stop} · frets ${pos.lo}–${pos.hi}`,
      ref: rootPc,
      neck: () => boxModel(rootPc, p.scale, pos),
    };
  },
});

// ------------------------------------------------------------------ for the technique, neck and ear drills

/** A chord's usual shape on the neck, for drills where you strum it. */
function chordNeck(sym) {
  const frets = defaultVoicing(sym);
  const root = parseChord(sym).root;
  const dots = [];
  const muted = [];
  frets.forEach((f, i) => (f === null ? muted.push(i + 1) : dots.push({ string: i + 1, fret: f, ref: root })));
  return { dots, muted };
}

const STRUMS = [
  { value: 'downs', label: 'All downs', pattern: 'D.D.D.D.' },
  { value: 'eighths', label: 'Eighths', pattern: 'DUDUDUDU' },
  { value: 'folk', label: 'D DU UDU', pattern: 'D.DU.UDU' },
  { value: 'chuck', label: 'Chuck on 2 and 4', pattern: 'D.xUD.xU' },
  { value: 'offbeat', label: 'Offbeats', pattern: '.U.U.U.U' },
  { value: 'gallop', label: 'Gallop', grid: '16', pattern: 'D.DUD.DUD.DUD.DU' },
];

/** "1 - 2 & - & 4 &": the count, with a dash where the hand misses the strings. */
function strumCount({ pattern, grid }) {
  const say = grid === '16' ? ['1', 'e', '&', 'a', '2', 'e', '&', 'a', '3', 'e', '&', 'a', '4', 'e', '&', 'a'] : ['1', '&', '2', '&', '3', '&', '4', '&'];
  return [...pattern].map((c, i) => (c === '.' ? '-' : say[i])).join(' ');
}

const PACE = opt('rhythm', 'Notes', [{ value: 4, label: 'Quarters' }, { value: 2, label: '8ths' }]);
const ROUND = opt('round', 'Round', [1, 2, 3, 4].map((n) => ({ value: n, label: String(n) })));

const OCTAVE_PAIRS = [{ value: '64', label: '6 & 4' }, { value: '53', label: '5 & 3' }, { value: '42', label: '4 & 2' }, { value: '31', label: '3 & 1' }];
// Frets from the root: up the scale to the 5th and back; down to the 5th
// below and back when there's no room above; a shorter one as a last resort.
const OCTAVE_TUNES = [[0, 2, 4, 5, 7, 5, 4, 2], [0, -1, -3, -5, -7, -5, -3, -1], [0, 2, 4, 5, 4, 2]];

const DOUBLE_PAIRS = {
  thirds: [{ value: '21', label: '2 & 1' }, { value: '32', label: '3 & 2' }, { value: '43', label: '4 & 3' }],
  sixths: [{ value: '31', label: '3 & 1' }, { value: '42', label: '4 & 2' }],
};

/** Drop a note that repeats the one before it (and the first, at the loop). */
function noRepeats(spots) {
  const same = (a, b) => a && b && a.string === b.string && a.fret === b.fret;
  const out = spots.filter((sp, i) => !same(sp, spots[i - 1]));
  if (out.length > 1 && same(out[0], out.at(-1))) out.pop();
  return out;
}

// Movable open-chord shapes, low string to high, frets from the root on `string`.
const CAGED = {
  C: { string: 5, shape: [null, 0, -1, -3, -2, -3] },
  A: { string: 5, shape: [null, 0, 2, 2, 2, 0] },
  G: { string: 6, shape: [0, -1, -3, -3, -3, 0] },
  E: { string: 6, shape: [0, 2, 2, 1, 0, 0] },
  D: { string: 4, shape: [null, null, 0, 2, 3, 2] },
};

/** The five CAGED shapes of a major chord, lowest first; frets high e first. */
export function cagedShapes(rootPc) {
  const all = [];
  for (const [name, { string, shape }] of Object.entries(CAGED)) {
    for (let r = mod12(rootPc - TUNING[string - 1]); r <= 15; r += 12) {
      const frets = shape.map((d) => (d === null ? null : r + d));
      const played = frets.filter((f) => f !== null);
      const lo = Math.min(...played);
      const hi = Math.max(...played);
      if (lo >= 0 && hi <= 15) all.push({ name, frets: frets.reverse(), lo, hi });
    }
  }
  all.sort((a, b) => a.lo - b.lo || a.hi - b.hi);
  return all.filter((s, i) => all.findIndex((x) => x.name === s.name) === i);
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

// Where the notes of a phrase start in the bar, in sixteenths.
const EASY_CELLS = [[0, 4, 8], [0, 4, 6, 8], [0, 2, 4, 8], [2, 4, 8], [0, 4, 8, 12]];
const HARD_CELLS = [[0, 2, 3, 4, 8], [0, 2, 4, 6, 8, 12], [2, 3, 4, 6, 8], [0, 3, 6, 8, 10, 12], [0, 1, 2, 4, 6, 8]];

/** A small seeded random: the same settings always make the same phrases. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The index of the box note nearest `i` that is one of `tones` above the root. */
function nearestTone(box, i, rootPc, tones) {
  let best = i;
  let dist = Infinity;
  box.forEach((n, k) => {
    if (tones.includes(mod12(n.midi - rootPc)) && Math.abs(k - i) < dist) { best = k; dist = Math.abs(k - i); }
  });
  return best;
}

/** An ear drill's neck: the box faint, only the roots lit. */
function earNeck(model, rootPc) {
  return {
    ...model,
    dots: model.dots.map((d) => (mod12(fretMidi(d.string, d.fret) - rootPc) === 0 ? { ...d, faint: false } : { ...d, faint: true, role: 'color' })),
  };
}

// ------------------------------------------------------------------ the drills

const FINGER_ROLE = ['root', 'third', 'fifth', 'seventh'];

const ORDERS = {
  1234: [1, 2, 3, 4], 1324: [1, 3, 2, 4], 1243: [1, 2, 4, 3], 1423: [1, 4, 2, 3], 1342: [1, 3, 4, 2],
};

export const DRILLS = [
  {
    id: 'chromatic',
    category: 'warmup',
    title: 'Chromatic spider',
    chordless: true,
    goal: 'One finger a fret, across all six strings and back, then a fret higher.',
    body: [
      'The oldest warm-up there is, and still the best for waking up the fretting hand. Each finger owns one fret, so the hand never moves until the pass is done.',
      'Alternate pick every note. Keep the fingers you aren’t using hovering just over the strings, not flying away.',
    ],
    steps: [
      'Start slow enough that every note is clean, about 60 bpm in 8ths.',
      'Turn on Move on → Up a fret so each pass starts a fret higher.',
      'Try the other finger orders: 1-3-2-4 and 1-4-2-3 are the ones that bite.',
      'When it’s easy, switch to 16ths at the same tempo.',
    ],
    keyed: false,
    tempo: 70,
    stopName: 'Start fret',
    moveName: 'Up a fret',
    stops: () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    options: [opt('order', 'Fingers', Object.keys(ORDERS).map((k) => ({ value: k, label: k.split('').join('-') }))), RHYTHM],
    build(p) {
      const order = ORDERS[p.order];
      const spots = [];
      for (let s = 6; s >= 1; s--) for (const f of order) spots.push({ string: s, fret: p.stop + f - 1, finger: f });
      for (let s = 1; s <= 6; s++) for (const f of [...order].reverse()) spots.push({ string: s, fret: p.stop + f - 1, finger: f });
      const { notes, bars } = run(spots, p.rhythm);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: 'C', scale: 'major', tempo: this.tempo, chords: Array(bars).fill('E5'), demo: { id: 'run', name: 'The run', type: 'notes', notes }, band: 'click' }),
        where: `Frets ${p.stop}–${p.stop + 3} · fingers ${order.join('-')}`,
        ref: null,
        neck: () => ({
          dots: [1, 2, 3, 4, 5, 6].flatMap((s) => [1, 2, 3, 4].map((f) => ({ string: s, fret: p.stop + f - 1, role: FINGER_ROLE[f - 1], label: String(f) }))),
          band: [p.stop, p.stop + 3],
        }),
      };
    },
  },
  {
    id: 'legato',
    category: 'warmup',
    title: 'Hammer-ons and pull-offs',
    chordless: true,
    goal: 'Trill two fingers on every string: pick once, let the fretting hand do the rest.',
    body: [
      'Pick only the first note on each string. Hammer the higher finger down hard enough to sound the note on its own, then pull off with a little sideways flick so the lower note rings.',
      'The pairs with the little finger (1–4, 2–4, 3–4) are the weak ones. Spend your time there.',
    ],
    steps: [
      'Mute the demo and play along with the click.',
      'Keep the lower finger planted the whole time.',
      'Work through every finger pair, then Move on → Up a fret.',
    ],
    keyed: false,
    tempo: 70,
    stopName: 'Start fret',
    moveName: 'Up a fret',
    stops: () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    options: [
      opt('pair', 'Fingers', ['12', '13', '14', '23', '24', '34'].map((v) => ({ value: v, label: `${v[0]}–${v[1]}` }))),
      RHYTHM,
    ],
    build(p) {
      const [a, b] = p.pair.split('').map(Number);
      const per = 16 / p.rhythm;
      const spots = [];
      for (let s = 6; s >= 1; s--) for (let i = 0; i < per; i++) spots.push({ string: s, fret: p.stop + (i % 2 ? b : a) - 1 });
      const { notes, bars } = run(spots, p.rhythm);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: 'C', scale: 'major', tempo: this.tempo, chords: Array(bars).fill('E5'), demo: { id: 'trill', name: 'Trills', type: 'notes', notes }, band: 'click' }),
        where: `Frets ${p.stop + a - 1} and ${p.stop + b - 1} · fingers ${a} and ${b}`,
        ref: null,
        neck: () => ({
          dots: [1, 2, 3, 4, 5, 6].flatMap((s) => [a, b].map((f) => ({ string: s, fret: p.stop + f - 1, role: FINGER_ROLE[f - 1], label: String(f) }))),
          band: [p.stop, p.stop + 3],
        }),
      };
    },
  },
  {
    id: 'chord-changes',
    category: 'warmup',
    title: 'One-minute changes',
    goal: 'Two open chords, back and forth, until the change is in time.',
    body: [
      'Switching chords on the beat is most of rhythm guitar. Look at the shape you’re going to before you leave the one you’re on, and move all the fingers together.',
      'Count how many clean changes you get in a minute and write it down. It goes up quicker than you’d think.',
    ],
    steps: [
      'Play just the downbeats until the change lands on beat 1.',
      'Switch the strum to the folk pattern when it does.',
      'Move on → Next pair walks through them all.',
    ],
    keyed: false,
    tempo: 80,
    stopName: 'Chords',
    stopsName: 'chord pairs',
    moveName: 'Next pair',
    stops: () => CHANGE_PAIRS.map((pr, i) => ({ value: i + 1, label: pr.join('–') })),
    options: [opt('strum', 'Strum', [{ value: 'down', label: 'Downstrokes' }, { value: 'folk', label: 'D DU UDU' }])],
    build(p) {
      const [x, y] = CHANGE_PAIRS[p.stop - 1];
      const demo = p.strum === 'down'
        ? { id: 'strum', name: 'Downstrokes', type: 'strum', grid: '4', pattern: 'DDDD' }
        : { id: 'strum', name: 'D DU UDU', type: 'strum', pattern: 'D.DU.UDU' };
      return {
        raw: drillSong({ id: this.id, title: this.title, key: 'C', scale: 'major', tempo: this.tempo, chords: [x, y, x, y], demo, band: 'groove' }),
        where: `${x} to ${y}`,
        ref: null,
        neck: (sym) => chordNeck(sym),
      };
    },
  },
  {
    id: 'rhythm-ladder',
    category: 'warmup',
    title: 'Subdivision ladder',
    goal: 'Quarters, eighths, sixteenths and back down, locked to the click.',
    body: [
      'Timing is what makes a few notes sound like a solo. This drill climbs the subdivisions one bar at a time: four strums, eight, sixteen, then back to eight.',
      'Your strumming hand never stops moving down-up in sixteenths. The subdivision only changes which of those motions touch the strings.',
    ],
    steps: [
      'Turn the Click on in the transport, mute the demo, and play along.',
      'Say the count out loud: “1 e & a 2 e & a”.',
      'Try Muted for a percussive chuck that shows every timing wobble.',
      'Move on → Next key (4ths) to keep your hands honest on barre chords.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 72,
    options: [opt('sound', 'Sound', [{ value: 'chord', label: 'Chord' }, { value: 'muted', label: 'Muted' }])],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const sym = keyName(rootPc, flats);
      let pattern = 'D...D...D...D... D.U.D.U.D.U.D.U. DUDUDUDUDUDUDUDU D.U.D.U.D.U.D.U.';
      if (p.sound === 'muted') pattern = pattern.replace(/[DU]/g, 'x');
      return {
        raw: drillSong({ id: this.id, title: this.title, key: sym, scale: 'major', tempo: this.tempo, chords: [sym, sym, sym, sym], demo: { id: 'ladder', name: 'Ladder', type: 'strum', grid: '16', pattern }, band: 'click' }),
        where: `${sym} · bar 1 quarters, 2 eighths, 3 sixteenths, 4 eighths`,
        ref: rootPc,
        neck: () => {
          const frets = defaultVoicing(sym);
          const dots = [];
          const muted = [];
          frets.forEach((f, i) => (f === null ? muted.push(i + 1) : dots.push({ string: i + 1, fret: f })));
          return { dots, muted };
        },
      };
    },
  },
  {
    id: 'triad-inversions',
    category: 'triads',
    title: 'Triad inversions on one string set',
    goal: 'One chord, three shapes, climbing the neck on three strings.',
    body: [
      'A triad is the chord with nothing extra: root, third, fifth. On three neighbouring strings it has three shapes, one for each note on the bottom, and they stack up the neck in order and repeat at the octave.',
      'Learn them as a set, on one group of strings at a time. The colours tell you which note is which: amber root, teal third, periwinkle fifth.',
    ],
    steps: [
      'Listen to the demo once with the labels on Intervals.',
      'Mute the demo and play each shape: up the three notes, then all three together.',
      'Say the inversion out loud as you land on it: root, first, second.',
      'Move on → Next string set takes it across the neck; Next key (4ths) through the keys.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 70,
    stopName: 'Strings',
    stopsName: 'string sets',
    moveName: 'Next string set',
    stops: () => STRING_SETS,
    options: [opt('quality', 'Chord', [{ value: '', label: 'Major' }, { value: 'm', label: 'Minor' }])],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc, p.quality === 'm' ? 'minor' : 'major');
      const sym = keyName(rootPc, flats) + p.quality;
      const all = shapesOn(sym, p.stop);
      const climb = all.slice(0, 4);
      const order = climb.length >= 4 ? [0, 1, 2, 3, 2, 1] : climb.map((_, i) => i).concat(climb.map((_, i) => i).slice(1, -1).reverse());
      const notes = order.flatMap((i, bar) => triadBar(climb[i], bar * 16));
      const [lo, hi] = fretSpan(climb.flatMap(spotsOf));
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: p.quality === 'm' ? 'minor' : 'major', tempo: this.tempo, chords: order.map(() => sym), demo: { id: 'shapes', name: 'The shapes', type: 'notes', notes } }),
        where: `${sym} on strings ${p.stop.split('').join('–')} · frets ${lo}–${hi}`,
        ref: rootPc,
        neck: (s, bar) => triadModel([climb[order[bar % order.length]]], all),
      };
    },
  },
  {
    id: 'triads-in-key',
    category: 'triads',
    title: 'Triads through the key',
    goal: 'I ii iii IV V vi vii°: every chord in the key, same inversion, walking up the neck.',
    body: [
      'Harmonise the major scale and you get seven triads: major on I, IV and V, minor on ii, iii and vi, diminished on vii. Played in one inversion on one string set, they walk up the neck a scale step at a time.',
      'This is the map of the key. Once you can see it, any progression in the key is a few of these shapes.',
    ],
    steps: [
      'Play along with the demo, naming each chord as it comes.',
      'Change the inversion and do it again: each inversion is its own walk.',
      'Move on → Next string set when one set is easy.',
    ],
    keyed: true,
    defaultKey: 'C',
    tempo: 70,
    stopName: 'Strings',
    stopsName: 'string sets',
    moveName: 'Next string set',
    stops: () => STRING_SETS,
    options: [opt('inversion', 'Inversion', [{ value: 'root', label: 'Root' }, { value: 'first', label: '1st' }, { value: 'second', label: '2nd' }])],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const chords = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii', 'I'].map((r) => keyName(rootPc + ROMAN[r][0], flats) + ROMAN[r][1]);
      const picked = [];
      let floor = 0;
      chords.forEach((sym, i) => {
        // a diminished triad in root position on the low strings needs a four-fret stretch
        let cands = shapesOn(sym, p.stop).filter((t) => t.inversion === p.inversion);
        if (!cands.length) cands = shapesOn(sym, p.stop, 4).filter((t) => t.inversion === p.inversion);
        let t = cands.find((c) => minOf(c) >= floor) ?? cands[0];
        if (i === 7 && !cands.some((c) => minOf(c) >= floor)) t = picked[0];
        picked.push(t);
        floor = minOf(t);
      });
      const notes = picked.flatMap((t, bar) => triadBar(t, bar * 16));
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: 'major', tempo: this.tempo, chords, demo: { id: 'walk', name: 'The walk', type: 'notes', notes } }),
        where: `${keyName(rootPc, flats)} major · ${p.inversion === 'root' ? 'root position' : `${p.inversion} inversion`} · strings ${p.stop.split('').join('–')}`,
        ref: rootPc,
        refChord: true,
        neck: (s, bar) => triadModel([picked[bar % picked.length]], shapesOn(s, p.stop)),
      };
    },
  },
  {
    id: 'triad-changes',
    category: 'triads',
    title: 'Triads over changes',
    goal: 'Play a progression with the nearest triad each time, so the hand barely moves.',
    body: [
      'Instead of jumping between open chords, take each chord as the triad shape nearest the one you’re on. The notes move a step or two at most; that’s voice leading, and it’s why triads sound good under a singer or a solo.',
      'The lit shape is the one to play; the faint ones are the same chord elsewhere on these strings.',
    ],
    steps: [
      'Play along with the demo and watch the shape change on the neck.',
      'Mute the demo and play just the three notes together on beat 1.',
      'Change the area to Middle and High: same changes, new shapes.',
      'Move on → Next key (4ths) once a progression is easy.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 76,
    stopName: 'Area',
    stopsName: 'areas',
    moveName: 'Next area',
    stops: () => AREAS.map(({ value, label }) => ({ value, label })),
    options: [PROGRESSION, opt('set', 'Strings', STRING_SETS.slice(0, 3))],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const chords = progressionChords(rootPc, p.progression, flats);
      const shapes = voiceLead(chords, p.set, AREAS.find((a) => a.value === p.stop).center);
      const notes = shapes.flatMap((t, bar) => triadBar(t, bar * 16));
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: 'major', tempo: this.tempo, chords, demo: { id: 'voices', name: 'Voice-led triads', type: 'notes', notes } }),
        where: `${PROGRESSIONS[p.progression].label} in ${keyName(rootPc, flats)} · strings ${p.set.split('').join('–')} · ${p.stop} on the neck`,
        ref: rootPc,
        refChord: true,
        neck: (s, bar) => triadModel([shapes[bar % shapes.length]], shapesOn(s, p.set)),
      };
    },
  },
  {
    id: 'triad-solo',
    category: 'triads',
    title: 'Solo over changes with triads',
    goal: 'Short phrases built on each chord’s triad, landing on a chord tone as each chord arrives.',
    body: [
      'The neck shows the triad of the chord that’s playing, lit, and the key’s other notes around it, faint. The faint notes are where you walk; the lit ones are where you land.',
      'The demo plays one simple shape of phrase over every chord: a chord tone on beat 1, two scale steps, a chord tone held, and a pickup into the next chord’s nearest note. That’s all a solo over changes needs to start.',
    ],
    steps: [
      'Listen with the demo on and watch where each phrase lands.',
      'Mute the demo. Play only the triad notes, one per beat, and change exactly when the chord does.',
      'Add the faint notes between them, but always land on a lit note on beat 1.',
      'Keep it to three or four notes a bar and leave rests. Simple is the point.',
      'Move the area, then Move on → Next key (4ths): the method doesn’t change, only where it sits.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 76,
    stopName: 'Area',
    stopsName: 'areas',
    moveName: 'Next area',
    stops: () => AREAS.map(({ value, label }) => ({ value, label })),
    options: [PROGRESSION, opt('set', 'Strings', STRING_SETS.slice(0, 2))],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const chords = progressionChords(rootPc, p.progression, flats);
      const shapes = voiceLead(chords, p.set, AREAS.find((a) => a.value === p.stop).center);
      const pcs = scalePcs(rootPc, 'major');
      const ladders = shapes.map((t, i) => ladder(t, pcs, parseChord(chords[i])));
      const notes = phrases(ladders);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: 'major', tempo: this.tempo, chords, demo: { id: 'phrases', name: 'Simple phrases', type: 'notes', notes } }),
        where: `${PROGRESSIONS[p.progression].label} in ${keyName(rootPc, flats)} · strings ${p.set.split('').join('–')} · ${p.stop} on the neck`,
        ref: rootPc,
        refChord: true,
        neck: (s, bar) => {
          const i = bar % shapes.length;
          const model = triadModel([shapes[i]]);
          const lit = new Set(model.dots.map((d) => `${d.string}:${d.fret}`));
          for (const n of ladders[i]) if (!lit.has(`${n.string}:${n.fret}`)) model.dots.push({ string: n.string, fret: n.fret, faint: !n.chord });
          return model;
        },
      };
    },
  },
  boxDrill({
    id: 'pentatonic-boxes',
    category: 'pentatonic',
    title: 'The five pentatonic boxes',
    goal: 'Each box up and down over a one-chord vamp, then the next box up the neck.',
    scales: ['minorPentatonic', 'majorPentatonic', 'blues'],
    body: [
      'Five notes, five shapes, and they link end to end up the neck. Box 1 starts on the root on the low E string; each box after starts where the last one’s second note was.',
      'The lit notes are the box, the faint ones the same scale in the other boxes. Amber dots are the root: always know where they are.',
    ],
    steps: [
      'Play the box up and down with the demo, then without it.',
      'Try Threes and Fours: sequences turn a scale into phrases.',
      'Move on → Next box walks you through all five.',
      'Then Move on → Next key (4ths) and do box 1 in every key.',
    ],
  }),
  {
    id: 'pentatonic-connect',
    category: 'pentatonic',
    title: 'Connect the boxes',
    goal: 'Up one box, down the next: the slide between them is the point.',
    body: [
      'Boxes are only useful if you can get out of them. This climbs one box and comes down the next one up, so the top of the run shifts position on the high strings.',
      'Slide into the new box with whichever finger lands on its first note. Keep your eyes on the next root.',
    ],
    steps: [
      'Play along with the demo for each pair.',
      'Move on → Next pair goes 1→2, 2→3, and on round.',
      'When all five links are smooth, play from box 1 to box 5 in one go.',
    ],
    keyed: true,
    defaultKey: 'A',
    tempo: 76,
    stopName: 'Boxes',
    stopsName: 'box pairs',
    moveName: 'Next pair',
    stops: () => [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}→${(n % 5) + 1}` })),
    options: [opt('scale', 'Scale', ['minorPentatonic', 'majorPentatonic'].map((s) => ({ value: s, label: SCALES[s].name }))), RHYTHM],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc, p.scale);
      const all = boxes(rootPc, p.scale);
      const a = all[p.stop - 1];
      const b = all[p.stop % 5];
      const { notes, bars } = run([...a.notes, ...[...b.notes].reverse()], p.rhythm);
      const tonic = keyName(rootPc, flats) + TONIC_CHORD[p.scale];
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: p.scale, tempo: this.tempo, chords: Array(bars).fill(tonic), demo: { id: 'link', name: 'The link', type: 'notes', notes } }),
        where: `${keyName(rootPc, flats)} ${SCALES[p.scale].name.toLowerCase()} · up box ${a.index}, down box ${b.index}`,
        ref: rootPc,
        neck: () => {
          const lit = new Set([...a.notes, ...b.notes].map((n) => `${n.string}:${n.fret}`));
          const m = boxModel(rootPc, p.scale, { ...a, notes: [...a.notes, ...b.notes] });
          return { dots: m.dots.map((d) => ({ ...d, faint: !lit.has(`${d.string}:${d.fret}`) })), band: [Math.min(a.lo, b.lo), Math.max(a.hi, b.hi)] };
        },
      };
    },
  },
  boxDrill({
    id: 'scale-positions',
    category: 'scales',
    title: 'Scale positions',
    goal: 'The full scale in five positions, straight and in sequences.',
    scales: ['major', 'minor', 'dorian', 'mixolydian', 'harmonicMinor', 'lydian', 'phrygian'],
    tempo: 72,
    body: [
      'The seven-note scales sit on the same five boxes as the pentatonic, with two more notes filled in. Learn them as the pentatonic box you already know plus the extras.',
      'The modes change the colour over the same vamp. Play dorian then minor over the same chord and listen to the one note that’s different.',
    ],
    steps: [
      'Up and down with the demo in position 1, then without.',
      'Thirds next: they make a scale sound like a melody.',
      'Move on → Next box for the next position, Next key (4ths) for the next key.',
    ],
  }),
  {
    id: 'strumming',
    category: 'technique',
    title: 'Strumming patterns',
    goal: 'Six patterns every strummer leans on, over a four-chord loop.',
    body: [
      'The strumming hand goes down on every beat and up on every “and”, all the time, whether it hits the strings or not. A pattern is only a choice of which of those motions touch the strings. That’s what keeps it steady.',
      'x is a chuck: lay the fretting hand flat on the strings so the strum is a percussive click. It’s what makes the backbeat on 2 and 4.',
    ],
    steps: [
      'Mute the demo and play the pattern on one chord until it’s automatic. Count “1 & 2 & 3 & 4 &” out loud.',
      'Then over the changes: the chord changes on beat 1, so start moving on the “and” of 4.',
      'Move on → Next pattern when one feels easy; try each over the 12-bar blues too.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 84,
    stopName: 'Pattern',
    stopsName: 'patterns',
    moveName: 'Next pattern',
    stops: () => STRUMS.map(({ value, label }) => ({ value, label })),
    options: [PROGRESSION],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const chords = progressionChords(rootPc, p.progression, flats);
      const s = STRUMS.find((x) => x.value === p.stop);
      const demo = { id: 'strum', name: s.label, type: 'strum', pattern: s.pattern, ...(s.grid ? { grid: s.grid } : {}) };
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: 'major', tempo: this.tempo, chords, demo, band: 'groove' }),
        where: `${s.label}: ${strumCount(s)} · ${PROGRESSIONS[p.progression].label} in ${keyName(rootPc, flats)}`,
        ref: rootPc,
        refChord: true,
        neck: (sym) => chordNeck(sym),
      };
    },
  },
  {
    id: 'string-skipping',
    category: 'technique',
    title: 'String skipping',
    goal: 'A pentatonic box played two strings apart: 6 and 4, 5 and 3, 4 and 2, 3 and 1.',
    body: [
      'Running a box string by string trains the hand to play scales, not music. Skipping a string breaks that habit, gives you wider intervals that sound like melodies, and makes the picking hand jump accurately.',
      'Alternate pick throughout. The jump over a string is the hard part: keep the motion small and let the pick travel just past the string you skip.',
    ],
    steps: [
      'Slowly with the demo, watching the pick land on the right string.',
      'Mute the demo; keep the string you skip quiet with the side of the picking hand.',
      'Move on → Next box takes it up the neck.',
    ],
    keyed: true,
    defaultKey: 'A',
    tempo: 72,
    stopName: 'Box',
    stopsName: 'boxes',
    moveName: 'Next box',
    stops: () => [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
    options: [opt('scale', 'Scale', ['minorPentatonic', 'majorPentatonic'].map((s) => ({ value: s, label: SCALES[s].name }))), RHYTHM],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc, p.scale);
      const pos = boxes(rootPc, p.scale)[p.stop - 1];
      const on = (s) => pos.notes.filter((n) => n.string === s).sort((a, b) => a.fret - b.fret);
      const spots = [];
      for (const [lo, hi] of [[6, 4], [5, 3], [4, 2], [3, 1]]) spots.push(...on(lo), ...on(hi));
      for (const [lo, hi] of [[3, 1], [4, 2], [5, 3], [6, 4]]) spots.push(...on(hi).reverse(), ...on(lo).reverse());
      const { notes, bars } = run(noRepeats(spots), p.rhythm);
      const tonic = keyName(rootPc, flats) + TONIC_CHORD[p.scale];
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale: p.scale, tempo: this.tempo, chords: Array(bars).fill(tonic), demo: { id: 'skip', name: 'Skipping', type: 'notes', notes } }),
        where: `${keyName(rootPc, flats)} ${SCALES[p.scale].name.toLowerCase()} · box ${p.stop} · frets ${pos.lo}–${pos.hi}`,
        ref: rootPc,
        neck: () => boxModel(rootPc, p.scale, pos),
      };
    },
  },
  {
    id: 'octaves',
    category: 'technique',
    title: 'Octaves',
    goal: 'A tune in octaves on two strings with one muted between them.',
    body: [
      'An octave shape is two notes, two strings apart: the higher one two frets up, or three when the pair crosses the B string. Strum all three strings and mute the middle one with the underside of the finger on the lower note.',
      'It’s a muting lesson as much as anything: it only sounds right when the string in the middle and everything outside the pair stay quiet. And it’s the quickest way to find any note an octave up.',
    ],
    steps: [
      'Play just the two notes, picked together, with the demo.',
      'Then strum through the muted string: the fretting hand does the muting, the strum can be loose.',
      'Move on → Next string pair; the shape stretches a fret on 4 & 2 and 3 & 1.',
      'Next key (4ths) when all four pairs are clean.',
    ],
    keyed: true,
    defaultKey: 'G',
    tempo: 76,
    stopName: 'Strings',
    stopsName: 'string pairs',
    moveName: 'Next string pair',
    stops: () => OCTAVE_PAIRS,
    options: [PACE],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const [lo, hi] = p.stop.split('').map(Number);
      const up = 12 - (TUNING[hi - 1] - TUNING[lo - 1]);
      const r0 = mod12(rootPc - TUNING[lo - 1]);
      let tune = null;
      let root = r0;
      for (const r of [r0, r0 + 12].filter((x) => x >= 1)) {
        tune = OCTAVE_TUNES.find((t) => t.every((o) => r + o >= 1 && r + o + up <= 15));
        if (tune) { root = r; break; }
      }
      tune ??= OCTAVE_TUNES.at(-1);
      const notes = tune.flatMap((o, i) => [
        { t: i * p.rhythm, s: lo, f: root + o, d: p.rhythm },
        { t: i * p.rhythm, s: hi, f: root + o + up, d: p.rhythm },
      ]);
      const bars = Math.ceil((tune.length * p.rhythm) / 16);
      notes.at(-1).d = notes.at(-2).d = bars * 16 - notes.at(-1).t;
      const sym = keyName(rootPc, flats);
      const frets = tune.map((o) => root + o);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: sym, scale: 'major', tempo: this.tempo, chords: Array(bars).fill(sym), demo: { id: 'octaves', name: 'Octaves', type: 'notes', notes } }),
        where: `${sym} major · strings ${lo} and ${hi}, ${lo - 1} muted · frets ${Math.min(...frets)}–${Math.max(...frets) + up}`,
        ref: rootPc,
        neck: () => {
          const dots = [];
          for (const f of new Set(frets)) dots.push({ string: lo, fret: f }, { string: hi, fret: f + up });
          return { dots, shapes: [...new Set(frets)].map((f) => ({ points: [{ string: lo, fret: f }, { string: hi, fret: f + up }], role: mod12(fretMidi(lo, f) - rootPc) === 0 ? 'root' : 'color' })), muted: [lo - 1] };
        },
      };
    },
  },
  {
    id: 'double-stops',
    category: 'technique',
    title: 'Double stops in 3rds and 6ths',
    goal: 'The key’s scale in pairs of notes, sliding up the neck on two strings.',
    body: [
      'Two notes at once, a 3rd or a 6th apart, both from the key. It’s the sweet two-note sound of soul, country and Motown guitar, and every pair is a little piece of a chord.',
      '3rds sit on neighbouring strings. 6ths skip a string: pick the lower note with the pick and the higher with the middle finger, or mute the string between.',
    ],
    steps: [
      'Play along with the demo and listen to the pairs change between major and minor 3rds.',
      'Slide between pairs instead of picking each one, keeping the finger shapes.',
      'Try the area higher up the neck, then Move on → Next string pair.',
    ],
    keyed: true,
    defaultKey: 'C',
    tempo: 72,
    stopName: 'Strings',
    stopsName: 'string pairs',
    moveName: 'Next string pair',
    stops: (p) => DOUBLE_PAIRS[p.interval ?? 'thirds'],
    options: [
      opt('interval', 'Interval', [{ value: 'thirds', label: '3rds' }, { value: 'sixths', label: '6ths' }]),
      opt('area', 'Where', AREAS.map(({ value, label }) => ({ value, label }))),
      PACE,
    ],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const [lo, hi] = p.stop.split('').map(Number);
      const pcs = scalePcs(rootPc, 'major');
      const gap = p.interval === 'sixths' ? 5 : 2;
      const c = AREAS.find((a) => a.value === p.area).center;
      const pairs = [];
      for (let f = Math.max(0, c - 4); f <= Math.min(15, c + 4); f++) {
        const m = fretMidi(lo, f);
        const d = pcs.indexOf(mod12(m));
        if (d < 0) continue;
        let top = m + 1;
        while (mod12(top) !== pcs[(d + gap) % 7]) top++;
        const g = top - TUNING[hi - 1];
        if (g >= 0 && g <= 15) pairs.push({ lo: f, hi: g });
      }
      const seq = [...pairs, ...pairs.slice(1, -1).reverse()];
      const notes = seq.flatMap((pr, i) => [
        { t: i * p.rhythm, s: lo, f: pr.lo, d: p.rhythm },
        { t: i * p.rhythm, s: hi, f: pr.hi, d: p.rhythm },
      ]);
      const bars = Math.ceil((seq.length * p.rhythm) / 16);
      notes.at(-1).d = notes.at(-2).d = bars * 16 - notes.at(-1).t;
      const sym = keyName(rootPc, flats);
      const all = pairs.flatMap((pr) => [pr.lo, pr.hi]);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: sym, scale: 'major', tempo: this.tempo, chords: Array(bars).fill(sym), demo: { id: 'pairs', name: 'Double stops', type: 'notes', notes } }),
        where: `${sym} major in ${p.interval === 'sixths' ? '6ths' : '3rds'} · strings ${lo} and ${hi} · frets ${Math.min(...all)}–${Math.max(...all)}`,
        ref: rootPc,
        neck: () => ({
          dots: pairs.flatMap((pr) => [{ string: lo, fret: pr.lo }, { string: hi, fret: pr.hi }]),
          shapes: pairs.map((pr) => ({ points: [{ string: lo, fret: pr.lo }, { string: hi, fret: pr.hi }], role: 'color' })),
        }),
      };
    },
  },
  {
    id: 'find-notes',
    category: 'neck',
    title: 'Find every note',
    chordless: true,
    legend: 'none',
    goal: 'One note on every string, low to high and back, saying its name.',
    body: [
      'The quickest way to learn the neck is one note at a time. Find it on the low E, then the A, and on across: every note is somewhere in the first twelve frets of every string.',
      'Use the octave shapes to jump: two strings up and two frets higher, or three frets higher once you cross onto the B string.',
    ],
    steps: [
      'Before each note sounds, find it yourself and say its name.',
      'Mute the demo when you can stay ahead of it.',
      'Move on → Next note (4ths): C, F, B♭, E♭ and on round, a few loops each.',
      'Two or three minutes a day is plenty; it adds up quickly.',
    ],
    keyed: true,
    keyLabel: 'Note',
    defaultKey: 'C',
    tempo: 60,
    options: [opt('pace', 'Pace', [{ value: 8, label: 'Every 2 beats' }, { value: 4, label: 'Every beat' }])],
    build(p) {
      const pc = pcOf(p.key);
      const flats = p.key.includes('b');
      const name = pcName(pc, flats);
      const at = (s) => [mod12(pc - TUNING[s - 1])].flatMap((f) => (f + 12 <= 15 ? [f, f + 12] : [f]));
      const spots = [];
      for (let s = 6; s >= 1; s--) spots.push({ string: s, fret: at(s)[0] });
      for (let s = 1; s <= 6; s++) spots.push({ string: s, fret: at(s).at(-1) });
      const { notes, bars } = run(spots, p.pace);
      return {
        raw: drillSong({ id: this.id, title: this.title, key: 'C', scale: 'major', tempo: this.tempo, chords: Array(bars).fill('C'), demo: { id: 'find', name: 'Every string', type: 'notes', notes }, band: 'click' }),
        where: `${name} on every string`,
        ref: pc,
        flats,
        neck: () => ({
          dots: [1, 2, 3, 4, 5, 6].flatMap((s) => at(s).map((f) => ({ string: s, fret: f, role: 'root', label: name }))),
        }),
      };
    },
  },
  {
    id: 'caged',
    category: 'neck',
    title: 'CAGED: one chord, five shapes',
    goal: 'The open C, A, G, E and D shapes moved up the neck: five places to play the same chord.',
    body: [
      'Each open-chord shape can slide up the neck as a barre shape, and in the order C, A, G, E, D they link end to end. Any major chord can be played in all five places.',
      'Each shape is also a home for a scale box and the triads around it. Knowing where the chord sits in a position is knowing where the strong notes are.',
    ],
    steps: [
      'Play the shape, saying its name, then find every root in it (the amber dots).',
      'Bar 2 is the next shape up. Watch where the two share notes: that’s where they join.',
      'Move on → Next shape walks up the neck; then Next key (4ths).',
      'You don’t need to fret every shape as a full chord: three or four strings of it is how you’ll use it.',
    ],
    keyed: true,
    defaultKey: 'C',
    tempo: 66,
    stopName: 'Shape',
    stopsName: 'shapes',
    moveName: 'Next shape',
    stops: (p) => cagedShapes(pcOf(p.key ?? 'C')).map((s) => ({ value: s.name, label: `${s.name} shape` })),
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const sym = keyName(rootPc, flats);
      const all = cagedShapes(rootPc);
      const i = all.findIndex((s) => s.name === p.stop);
      const pair = [all[i], all[(i + 1) % all.length]];
      const notes = pair.flatMap((sh, bar) => {
        const spots = [];
        for (let s = 6; s >= 1; s--) if (sh.frets[s - 1] !== null) spots.push({ string: s, fret: sh.frets[s - 1] });
        return [
          ...spots.map((sp, k) => ({ t: bar * 16 + k * 2, s: sp.string, f: sp.fret, d: 2 })),
          ...spots.map((sp) => ({ t: bar * 16 + 12, s: sp.string, f: sp.fret, d: 4 })),
        ];
      });
      return {
        raw: drillSong({ id: this.id, title: this.title, key: sym, scale: 'major', tempo: this.tempo, chords: [sym, sym], demo: { id: 'shapes', name: 'Two shapes', type: 'notes', notes } }),
        where: `${sym}: the ${pair[0].name} shape at frets ${pair[0].lo}–${pair[0].hi}, then the ${pair[1].name} shape`,
        ref: rootPc,
        neck: (s, bar) => {
          const cur = pair[bar % 2];
          const dots = [];
          const seen = new Set();
          for (const sh of [cur, ...all]) {
            sh.frets.forEach((f, k) => {
              if (f === null || seen.has(`${k + 1}:${f}`)) return;
              seen.add(`${k + 1}:${f}`);
              dots.push({ string: k + 1, fret: f, faint: sh !== cur });
            });
          }
          return { dots, band: [cur.lo, cur.hi], muted: cur.frets.flatMap((f, k) => (f === null ? [k + 1] : [])) };
        },
      };
    },
  },
  {
    id: 'scale-degrees',
    category: 'ear',
    title: 'Hear the scale degrees',
    ear: true,
    goal: 'The root, then another note of the key: name it by ear, then find it.',
    body: [
      'Every note of a key has its own feel against the root: the 3rd sounds settled, the 7th leans up into the root, the 4th wants to fall to the 3rd. Learn those feelings and you can name a note without seeing it.',
      'Each round plays the root, then a note from the set, then leaves a bar for you. Keep the neck out of sight: the point is to hear it.',
    ],
    steps: [
      'Start with 1 3 5. Sing the note back, name the degree, then find it on the guitar in the gap.',
      'Show the notes to check yourself after a loop or two, then hide them again.',
      'Move on → Next set adds notes: 1–5, then all seven.',
      'Change the Round for a new order, and the key once you’re getting them right.',
    ],
    keyed: true,
    defaultKey: 'C',
    tempo: 72,
    stopName: 'Notes',
    stopsName: 'note sets',
    moveName: 'Next set',
    stops: () => [{ value: '135', label: '1 3 5' }, { value: '12345', label: '1–5' }, { value: '1234567', label: 'All 7' }],
    options: [ROUND],
    build(p) {
      const rootPc = pcOf(p.key);
      const flats = prefersFlats(rootPc);
      const sym = keyName(rootPc, flats);
      const pos = boxes(rootPc, 'major')[0];
      const inBox = pos.notes.map((n) => ({ ...n, midi: fretMidi(n.string, n.fret) }));
      const root = inBox.filter((n) => mod12(n.midi - rootPc) === 0).reduce((a, b) => (Math.abs(b.midi - 52) < Math.abs(a.midi - 52) ? b : a));
      const degrees = p.stop.split('').map(Number);
      const rand = rng(pcOf(p.key) * 31 + p.round * 977 + p.stop.length);
      const order = [];
      while (order.length < 6) {
        for (const d of shuffle(degrees, rand)) if (order.length < 6 && d !== order.at(-1)) order.push(d);
      }
      const notes = [];
      order.forEach((d, k) => {
        const midi = root.midi + MAJOR_STEPS[d - 1];
        const at = inBox.find((n) => n.midi === midi) ?? placeOnNeck(midi, { lo: pos.lo, hi: pos.hi });
        notes.push({ t: k * 32, s: root.string, f: root.fret, d: 4 }, { t: k * 32 + 8, s: at.string, f: at.fret, d: 8 });
      });
      return {
        raw: drillSong({ id: this.id, title: this.title, key: sym, scale: 'major', tempo: this.tempo, chords: Array(12).fill(sym), demo: { id: 'degrees', name: 'Root, then a note', type: 'notes', notes } }),
        where: `${sym} major · ${this.stops().find((x) => x.value === p.stop).label} · round ${p.round}`,
        ref: rootPc,
        neck: () => earNeck(boxModel(rootPc, 'major', pos), rootPc),
      };
    },
  },
  {
    id: 'call-response',
    category: 'ear',
    title: 'Call and response',
    ear: true,
    goal: 'The guitar plays a short phrase in a pentatonic box; you play it back in the bar after.',
    body: [
      'This is how players learned before there was tab: hear a phrase, copy it. The demo plays a phrase, then leaves you a bar to answer with the same notes in the same rhythm.',
      'The neck shows the box, faint, so you know which notes you’re choosing from. Every phrase ends on a chord tone, often the root.',
    ],
    steps: [
      'Listen to the first phrase. Sing it before you play it.',
      'Find the first note; then for each next note, ask: up or down, and a step or a jump?',
      'Show the notes only to check yourself. Then Round for new phrases, Harder for longer ones.',
      'Move on → Next box: the same game somewhere else on the neck.',
    ],
    keyed: true,
    defaultKey: 'A',
    tempo: 80,
    stopName: 'Box',
    stopsName: 'boxes',
    moveName: 'Next box',
    stops: () => [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
    options: [opt('level', 'Level', [{ value: 'easy', label: 'Easy' }, { value: 'harder', label: 'Harder' }]), ROUND],
    build(p) {
      const rootPc = pcOf(p.key);
      const scale = 'minorPentatonic';
      const flats = prefersFlats(rootPc, scale);
      const pos = boxes(rootPc, scale)[p.stop - 1];
      const box = pos.notes.map((n) => ({ ...n, midi: fretMidi(n.string, n.fret) })).sort((a, b) => a.midi - b.midi);
      const rand = rng(rootPc * 13 + p.stop * 101 + p.round * 997 + (p.level === 'easy' ? 0 : 5003));
      const cells = p.level === 'easy' ? EASY_CELLS : HARD_CELLS;
      const notes = [];
      for (let k = 0; k < 4; k++) {
        const cell = cells[Math.floor(rand() * cells.length)];
        let i = Math.floor(box.length / 2 - 2 + rand() * 4);
        const seq = cell.map((_, j) => {
          if (j > 0) {
            const moves = p.level === 'easy' ? [-1, 1] : [-2, -1, -1, 1, 1, 2];
            i += moves[Math.floor(rand() * moves.length)];
            if (i < 0 || i >= box.length) i = Math.max(0, Math.min(box.length - 1, i - 2 * Math.sign(i)));
          }
          return i;
        });
        seq[seq.length - 1] = nearestTone(box, seq.at(-1), rootPc, [0, 3, 7]);
        cell.forEach((t, j) => {
          const n = box[seq[j]];
          const end = j + 1 < cell.length ? cell[j + 1] : Math.min(16, t + 8);
          notes.push({ t: k * 32 + t, s: n.string, f: n.fret, d: end - t });
        });
      }
      const tonic = `${keyName(rootPc, flats)}m7`;
      return {
        raw: drillSong({ id: this.id, title: this.title, key: keyName(rootPc, flats), scale, tempo: this.tempo, chords: Array(8).fill(tonic), demo: { id: 'calls', name: 'Calls', type: 'notes', notes } }),
        where: `${keyName(rootPc, flats)} minor pentatonic · box ${p.stop} · ${p.level === 'easy' ? 'easy' : 'harder'}, round ${p.round}`,
        ref: rootPc,
        neck: () => earNeck(boxModel(rootPc, scale, pos), rootPc),
      };
    },
  },
];

const CHANGE_PAIRS = [['G', 'C'], ['C', 'D'], ['D', 'A'], ['A', 'E'], ['E', 'Am'], ['Am', 'Dm'], ['G', 'D'], ['Em', 'C'], ['C', 'F'], ['D', 'G']];

/** Nearest triad for each chord, starting near `start`, staying near it. */
function voiceLead(chords, set, start) {
  let prev = start;
  return chords.map((sym) => {
    const cands = shapesOn(sym, set);
    const best = cands.reduce((a, b) => {
      const score = (t) => Math.abs(center(t) - prev) + 0.5 * Math.abs(center(t) - start);
      return score(b) < score(a) ? b : a;
    });
    prev = center(best);
    return best;
  });
}

/** The key's notes on the shape's strings, a fret or two either side, low to high. */
function ladder(shape, pcs, chord) {
  const [lo, hi] = fretSpan(spotsOf(shape));
  const mid = (lo + hi) / 2;
  const byMidi = new Map();
  for (const s of shape.strings) {
    for (let f = Math.max(0, lo - 2); f <= Math.min(15, hi + 2); f++) {
      const m = fretMidi(s, f);
      if (!pcs.includes(mod12(m))) continue;
      const cur = byMidi.get(m);
      if (!cur || Math.abs(f - mid) < Math.abs(cur.fret - mid)) byMidi.set(m, { string: s, fret: f, midi: m, chord: chord.pcs.includes(mod12(m)) });
    }
  }
  // the shape's own notes are where the hand is: they win their pitch
  for (const sp of spotsOf(shape)) {
    const m = fretMidi(sp.string, sp.fret);
    byMidi.set(m, { ...sp, midi: m, chord: true });
  }
  return [...byMidi.values()].sort((a, b) => a.midi - b.midi);
}

const nearestChordTone = (lad, midi) => lad.reduce((best, n, i) => (n.chord && (best < 0 || Math.abs(n.midi - midi) < Math.abs(lad[best].midi - midi)) ? i : best), -1);

/**
 * A bar a chord: a chord tone on 1, two scale steps, a chord tone held
 * through 3, and a pickup on the "and" of 4 into the next chord's nearest
 * chord tone. The direction turns round each bar.
 */
function phrases(ladders) {
  const notes = [];
  const starts = [];
  const shapeMid = (lad) => lad.filter((n) => n.chord)[1] ?? lad.find((n) => n.chord);
  starts[0] = ladders[0].indexOf(shapeMid(ladders[0]));
  const ends = [];
  ladders.forEach((lad, bar) => {
    let dir = bar % 2 ? -1 : 1;
    const i0 = starts[bar];
    if (!lad[i0 + 2 * dir]) dir = -dir;
    const a = lad[i0];
    const b = lad[i0 + dir] ?? a;
    const c = lad[i0 + 2 * dir] ?? b;
    const e = lad[nearestChordTone(lad, c.midi)];
    const at = bar * 16;
    notes.push({ t: at, s: a.string, f: a.fret, d: 2 }, { t: at + 2, s: b.string, f: b.fret, d: 2 });
    if (e === c) notes.push({ t: at + 4, s: c.string, f: c.fret, d: 8 });
    else notes.push({ t: at + 4, s: c.string, f: c.fret, d: 2 }, { t: at + 6, s: e.string, f: e.fret, d: 6 });
    ends[bar] = e;
    if (bar + 1 < ladders.length) starts[bar + 1] = nearestChordTone(ladders[bar + 1], e.midi);
  });
  // pickups, once every bar knows where the next one starts
  ladders.forEach((lad, bar) => {
    const nextLad = ladders[(bar + 1) % ladders.length];
    const ti = starts[(bar + 1) % ladders.length];
    const below = nextLad[ti - 1];
    const above = nextLad[ti + 1];
    const pick = below && below.midi !== ends[bar].midi ? below : above ?? below;
    if (pick) notes.push({ t: bar * 16 + 14, s: pick.string, f: pick.fret, d: 2 });
  });
  return notes.sort((x, y) => x.t - y.t);
}

// ------------------------------------------------------------------ settings

export function drillById(id) {
  return DRILLS.find((d) => d.id === id) ?? null;
}

/** The drill's settings with every gap filled and every value one it offers. */
export function drillParams(drill, p = {}) {
  const out = {};
  out.key = drill.keyed ? (KEYS.includes(p.key) ? p.key : drill.defaultKey ?? 'C') : null;
  for (const o of drill.options ?? []) {
    out[o.id] = o.choices.some((c) => c.value === p[o.id]) ? p[o.id] : o.default;
  }
  const stops = drill.stops?.(out) ?? [];
  out.stop = stops.some((s) => s.value === p.stop) ? p.stop : stops[0]?.value ?? null;
  return out;
}

/** Build the drill: its song file, where it sits, and what the neck shows. */
export function buildDrill(drill, p) {
  const params = drillParams(drill, p);
  return { ...drill.build(params), params };
}

/**
 * Move on: 'stop' to the drill's next stop (up the neck, the next string
 * set, the next box), 'fourth' to the next key round the cycle of fourths,
 * 'half' up a half step.
 */
export function advance(drill, p, how) {
  const params = drillParams(drill, p);
  if (how === 'stop') {
    const stops = drill.stops?.(params) ?? [];
    if (!stops.length) return params;
    const i = stops.findIndex((s) => s.value === params.stop);
    return { ...params, stop: stops[(i + 1) % stops.length].value };
  }
  if (!drill.keyed) return params;
  const pc = pcOf(params.key);
  if (how === 'fourth') {
    const i = FOURTHS.findIndex((k) => pcOf(k) === pc);
    return { ...params, key: KEYS.find((k) => pcOf(k) === pcOf(FOURTHS[(i + 1) % 12])) };
  }
  if (how === 'half') return { ...params, key: KEYS[(pc + 1) % 12] };
  return params;
}

/** Ways a drill can move on by itself; the ones that make sense for it. */
export function advanceChoices(drill) {
  const out = [];
  if (drill.stops) out.push({ value: 'stop', label: drill.moveName });
  if (drill.keyed) out.push({ value: 'fourth', label: `Next ${(drill.keyLabel ?? 'key').toLowerCase()} (4ths)` }, { value: 'half', label: 'Up a half step' });
  return out;
}

/** "A · box 2", a short name for the settings, for the session list. */
export function paramsLabel(drill, p) {
  const params = drillParams(drill, p);
  const bits = [];
  if (drill.keyed) bits.push(params.key);
  const stop = drill.stops?.(params).find((s) => s.value === params.stop);
  if (stop) bits.push(`${drill.stopName ?? 'Stop'} ${stop.label}`);
  for (const o of drill.options ?? []) {
    if (params[o.id] !== o.default) bits.push(o.choices.find((c) => c.value === params[o.id])?.label);
  }
  return bits.join(' · ');
}

// ------------------------------------------------------------------ session

/** A practice session: drills (with their settings) and songs, minutes each. */
export const DEFAULT_ROUTINE = [
  { drill: 'chromatic', minutes: 3, params: {} },
  { drill: 'find-notes', minutes: 2, params: { key: 'C' } },
  { drill: 'triad-inversions', minutes: 5, params: { key: 'G' } },
  { drill: 'triad-solo', minutes: 5, params: { key: 'G' } },
  { drill: 'pentatonic-boxes', minutes: 5, params: { key: 'A' } },
  { drill: 'call-response', minutes: 4, params: { key: 'A' } },
  { drill: 'scale-positions', minutes: 5, params: { key: 'G', scale: 'major' } },
  { song: 'fire-on-the-mountain', minutes: 10 },
];
