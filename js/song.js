// Song files: load, validate and compile into playable events.
//
// A song is flat JSON (see docs/song-format.md). compileSong() turns it into
// a structure the player, fretboard and notation views all share.

import {
  parseChord, pcOf, mod12, chordTone, scalePcs, parseShape, shapeMidis, defaultVoicing,
  midiOf, placeOnNeck, fretMidi, BASS_TUNING, SCALES,
} from './theory.js';

export const INSTRUMENTS = ['drums', 'bass', 'guitar', 'keys'];

export const DRUM_LANES = ['kick', 'snare', 'rim', 'hat', 'open', 'ride', 'crash', 'tom', 'clap', 'shaker'];

const GRID_STEPS = { '16': 1, '8': 2, '8d': 3, '4': 4, '4d': 6, '2': 8, '1': 16 };

// Where each instrument places a chord-relative root.
const RANGE = {
  bass: [28, 39], // E1..D#2
  guitar: [40, 51], // E2..D#3 — the low-string riff zone
  keys: [48, 59],
};

export function parseMeter(meter = '4/4') {
  const m = /^(\d+)\/(\d+)$/.exec(String(meter).trim());
  if (!m) throw new Error(`Can't read meter "${meter}"`);
  const num = Number(m[1]);
  const den = Number(m[2]);
  const stepsPerBeat = 16 / den;
  const compound = den === 8 && num % 3 === 0 && num > 3;
  return {
    meter: `${num}/${den}`,
    beatsPerBar: num,
    beatUnit: den,
    stepsPerBeat,
    stepsPerBar: num * stepsPerBeat,
    // where the felt pulses land (for the click and the count-in)
    pulses: compound
      ? Array.from({ length: num / 3 }, (_, i) => i * 3 * stepsPerBeat)
      : Array.from({ length: num }, (_, i) => i * stepsPerBeat),
  };
}

/**
 * "B | A | B . A . | %" -> bars of chords. Each bar is split evenly among its
 * tokens; "." holds the previous chord, "%" repeats the previous bar.
 */
export function parseChart(chart, time) {
  const barsRaw = String(chart).split('|').map((b) => b.trim()).filter((b) => b.length);
  const bars = [];
  let prev = null;
  for (const raw of barsRaw) {
    if (raw === '%') {
      if (!bars.length) throw new Error('A chart can\'t start with "%"');
      bars.push(bars[bars.length - 1].map((c) => ({ ...c })));
      continue;
    }
    const toks = raw.split(/\s+/);
    const slot = time.stepsPerBar / toks.length;
    const bar = [];
    toks.forEach((tok, i) => {
      if (tok === '.' || tok === '-') return;
      prev = tok;
      bar.push({ symbol: tok, at: Math.round(i * slot) });
    });
    if (!bar.length || bar[0].at !== 0) {
      if (!prev) throw new Error(`Bar "${raw}" has no chord`);
      bar.unshift({ symbol: findPrev(bars, prev), at: 0 });
    }
    bars.push(bar);
  }
  return bars;
}

function findPrev(bars, fallback) {
  for (let i = bars.length - 1; i >= 0; i--) {
    const b = bars[i];
    if (b.length) return b[b.length - 1].symbol;
  }
  return fallback;
}

// ------------------------------------------------------------------ helpers

function stripBars(s) {
  return String(s).replace(/\|/g, ' ');
}

function gridOf(v, fallback) {
  const g = String(v.grid ?? fallback);
  if (!(g in GRID_STEPS)) throw new Error(`Unknown grid "${g}" — use 16, 8, 8d, 4, 4d, 2 or 1`);
  return GRID_STEPS[g];
}

function velOf(ch) {
  if (ch === 'X' || ch === 'D' || ch === 'U') return 1;
  if (ch === 'o') return 0.35;
  if (ch === 'd' || ch === 'u') return 0.55;
  return 0.8;
}

/** Fit a pitch class into a MIDI range. */
function placePc(pc, [lo]) {
  let m = lo + mod12(pc - lo);
  return m;
}

/** Resolve a degree token like "R", "5", "b7", "8", "3'", "5,", "A", "B2". */
export function resolveDegree(tok, ctx) {
  const { chord, nextChord, keyRoot, scale, range } = ctx;
  let t = tok;
  let octave = 0;
  while (t.endsWith("'")) { octave += 12; t = t.slice(0, -1); }
  while (t.endsWith(',')) { octave -= 12; t = t.slice(0, -1); }
  const rootMidi = placePc(chord.root, range);
  if (/^[A-G][#b]?-?\d$/.test(t)) return midiOf(t) + octave;
  if (t === 'A') {
    // chromatic approach from below into the next chord's root
    const target = placePc((nextChord ?? chord).root, range);
    return target - 1 + octave;
  }
  if (t === 'R' || t === '1') return rootMidi + octave;
  if (t === '8') return rootMidi + 12 + octave;
  if (t === '3' || t === '5' || t === '7') return rootMidi + chordTone(chord, t) + octave;
  const m = /^([b#]?)(\d+)$/.exec(t);
  if (m) {
    const n = Number(m[2]);
    const natural = { 2: 2, 4: 5, 6: 9, 9: 14, 11: 17, 13: 21 }[n] ?? [0, 0, 2, 4, 5, 7, 9, 11][n];
    if (natural === undefined) throw new Error(`Unknown degree "${tok}"`);
    if (m[1]) return rootMidi + natural + (m[1] === '#' ? 1 : -1) + octave;
    // plain 2/4/6: take the key's scale tone nearest that interval
    const pcs = scalePcs(keyRoot, scale);
    const cands = [natural - 1, natural, natural + 1].filter((iv) => pcs.includes(mod12(chord.root + iv)));
    const iv = cands.includes(natural) ? natural : (cands[0] ?? natural);
    return rootMidi + iv + octave;
  }
  throw new Error(`Unknown note token "${tok}"`);
}

// ------------------------------------------------------------------ compile parts

function compileDrums(v, ctx) {
  const step = gridOf(v, '16');
  const events = [];
  for (const [lane, patRaw] of Object.entries(v.pattern ?? {})) {
    if (!DRUM_LANES.includes(lane)) throw new Error(`Unknown drum "${lane}" — use ${DRUM_LANES.join(', ')}`);
    const pat = stripBars(patRaw).replace(/\s+/g, '');
    if (!pat.length) continue;
    const len = pat.length * step;
    for (let t = 0; t < ctx.length; t += step) {
      const ch = pat[Math.floor((t % len) / step)];
      if (ch === '.' || ch === '-') continue;
      events.push({ t, d: step, kind: 'drum', drum: lane, vel: velOf(ch) });
    }
  }
  return events;
}

function compileDegrees(v, ctx, instrument) {
  const step = gridOf(v, '8');
  const toks = stripBars(v.steps ?? v.pattern ?? '').trim().split(/\s+/).filter(Boolean);
  if (!toks.length) return [];
  const len = toks.length * step;
  const range = v.range ?? RANGE[instrument] ?? RANGE.bass;
  const events = [];
  for (let t = 0; t < ctx.length; t += step) {
    const idx = Math.floor((t % len) / step);
    const tok = toks[idx];
    if (tok === '.' || tok === '-') continue;
    let holds = 0;
    for (let j = 1; j < toks.length && toks[(idx + j) % toks.length] === '-'; j++) holds++;
    const d = step * (1 + holds);
    if (tok === 'x' || tok === 'X') {
      events.push({ t, d: step, kind: 'dead', vel: velOf(tok) });
      continue;
    }
    const chord = ctx.chordAt(t);
    const nextChord = ctx.nextChordAfter(t);
    const midis = tok.split('+').map((part) => resolveDegree(part, {
      chord, nextChord, keyRoot: ctx.keyRoot, scale: ctx.scale, range,
    }));
    for (const midi of midis) {
      const ev = { t, d, kind: 'note', midi, vel: 0.85 };
      if (instrument === 'guitar') Object.assign(ev, placeOnNeck(midi, { lo: 0, hi: 7 }));
      if (instrument === 'bass') Object.assign(ev, placeOnNeck(midi, { lo: 0, hi: 7, tuning: BASS_TUNING }));
      events.push(ev);
    }
  }
  return events;
}

function voicingFor(symbol, v, ctx) {
  const vv = v.voicings?.[symbol] ?? ctx.song.voicings?.[symbol];
  if (vv) return parseShape(vv);
  return defaultVoicing(symbol, v.prefer ?? 'open');
}

function compileStrum(v, ctx) {
  const step = gridOf(v, '8');
  const pat = stripBars(v.pattern ?? 'D').replace(/\s+/g, '');
  const len = pat.length * step;
  const events = [];
  for (let t = 0; t < ctx.length; t += step) {
    const ch = pat[Math.floor((t % len) / step)];
    if (ch === '.' || ch === '-') continue;
    const chord = ctx.chordAt(t);
    const frets = voicingFor(chord.symbol, v, ctx);
    let notes = shapeMidis(frets);
    const dir = ch.toUpperCase() === 'U' ? 'up' : 'down';
    if (ch === 'u') notes = notes.slice(-3);
    if (ch === 'd') notes = notes.slice(0, Math.max(3, notes.length - 1));
    if (ch === 'x' || ch === 'X') {
      events.push({ t, d: step, kind: 'chuck', vel: velOf(ch), notes, chord: chord.symbol, frets });
      continue;
    }
    if (dir === 'up') notes = [...notes].reverse();
    events.push({ t, d: step, kind: 'strum', dir, vel: velOf(ch), notes, chord: chord.symbol, frets });
  }
  return events;
}

function compileArpeggio(v, ctx) {
  const step = gridOf(v, '8');
  const toks = stripBars(v.pattern ?? 'B 3 2 1').trim().split(/\s+/);
  const len = toks.length * step;
  const events = [];
  for (let t = 0; t < ctx.length; t += step) {
    const tok = toks[Math.floor((t % len) / step)];
    if (tok === '.' || tok === '-') continue;
    const chord = ctx.chordAt(t);
    const frets = voicingFor(chord.symbol, v, ctx);
    const sounding = shapeMidis(frets); // low -> high
    for (const part of tok.split('+')) {
      let s;
      if (part === 'B') s = sounding[0]?.string;
      else s = Number(part);
      const f = frets[s - 1];
      if (!s || f === null || f === undefined) continue;
      events.push({ t, d: step * 3, kind: 'note', midi: fretMidi(s, f), string: s, fret: f, vel: 0.8, chord: chord.symbol, frets });
    }
  }
  return events;
}

/** Close-voiced chord around middle C plus a left-hand root. */
export function keysVoicing(chord, { lh = true, range = [55, 66] } = {}) {
  const rh = chord.intervals.map((iv) => placePc(chord.root + iv, range)).sort((a, b) => a - b);
  const notes = [...new Set(rh)];
  if (lh) notes.unshift(placePc(chord.bass, [36, 47]));
  return notes;
}

function compileComp(v, ctx, instrument) {
  const step = gridOf(v, '8');
  const pat = stripBars(v.pattern ?? 'x').replace(/\s+/g, '');
  const len = pat.length * step;
  const events = [];
  for (let t = 0; t < ctx.length; t += step) {
    const idx = Math.floor((t % len) / step);
    const ch = pat[idx];
    if (ch === '.' || ch === '-') continue;
    let holds = 0;
    for (let j = 1; j < pat.length && pat[(idx + j) % pat.length] === '-'; j++) holds++;
    const chord = ctx.chordAt(t);
    const d = Math.min(step * (1 + holds), ctx.chordEnd(t) - t);
    const midis = instrument === 'keys' ? keysVoicing(chord, { lh: v.leftHand !== false, range: v.range }) : [];
    for (const midi of midis) events.push({ t, d, kind: 'note', midi, vel: velOf(ch) * 0.8, chord: chord.symbol });
  }
  return events;
}

function compileNotes(v, ctx, instrument) {
  const notes = v.notes ?? [];
  const len = v.length ?? ctx.length;
  const events = [];
  for (let base = 0; base < ctx.length; base += len) {
    for (const n of notes) {
      const t = base + n.t;
      if (t >= ctx.length) continue;
      const ev = { t, d: n.d ?? 2, kind: 'note', vel: n.v ?? 0.85 };
      if (n.s !== undefined && n.f !== undefined) {
        const tuning = instrument === 'bass' ? BASS_TUNING : undefined;
        ev.string = n.s;
        ev.fret = n.f;
        ev.midi = fretMidi(n.s, n.f, tuning);
      } else if (n.n !== undefined) {
        ev.midi = midiOf(n.n);
        if (ev.midi === null) throw new Error(`Can't read note "${n.n}"`);
        if (instrument === 'guitar') Object.assign(ev, placeOnNeck(ev.midi, { lo: v.position?.[0] ?? 0, hi: v.position?.[1] ?? 12 }));
      } else {
        throw new Error('Each note needs either "s"+"f" (string and fret) or "n" (note name)');
      }
      if (n.tech) ev.tech = n.tech;
      if (n.h) ev.hand = n.h;
      events.push(ev);
    }
  }
  return events.sort((a, b) => a.t - b.t);
}

/** Two-handed keyboard part: left-hand degrees, right-hand chords and/or melody. */
function compileHands(v, ctx) {
  const out = [];
  if (v.left) {
    out.push(...compileDegrees({ steps: v.left, grid: v.leftGrid ?? '4', range: v.leftRange ?? [36, 47] }, ctx, 'keys')
      .map((e) => ({ ...e, hand: 'L' })));
  }
  if (v.right) {
    out.push(...compileComp({ pattern: v.right, grid: v.rightGrid ?? '8', leftHand: false, range: v.rightRange }, ctx, 'keys')
      .map((e) => ({ ...e, hand: 'R' })));
  }
  if (v.melody) {
    out.push(...compileNotes({ notes: v.melody, length: v.length }, ctx, 'keys')
      .map((e) => ({ ...e, hand: e.hand ?? 'R' })));
  }
  return out.sort((a, b) => a.t - b.t);
}

const COMPILERS = {
  hands: compileHands,
  drums: compileDrums,
  bassline: compileDegrees,
  degrees: compileDegrees,
  strum: compileStrum,
  arpeggio: compileArpeggio,
  comp: compileComp,
  notes: compileNotes,
};

export const VARIATION_TYPES = Object.keys(COMPILERS);

// ------------------------------------------------------------------ main compile

export function compileSong(song) {
  const errors = [];
  if (!song || typeof song !== 'object') throw new Error('Song file is not a JSON object');
  for (const k of ['id', 'title', 'key', 'tempo', 'sections']) {
    if (song[k] === undefined) errors.push(`Missing "${k}"`);
  }
  if (errors.length) throw new Error(errors.join('; '));

  const time = parseMeter(song.meter);
  const keyRoot = pcOf(song.key);
  if (keyRoot === null) throw new Error(`Can't read key "${song.key}"`);
  const scale = song.scale ?? 'major';
  if (!SCALES[scale]) throw new Error(`Unknown scale "${scale}"`);

  const parts = (song.parts ?? INSTRUMENTS.map((i) => ({ id: i, instrument: i }))).map((p) => ({
    id: p.id,
    name: p.name ?? capitalize(p.id),
    instrument: p.instrument ?? p.id,
    volume: p.volume ?? 0.8,
  }));

  const sections = {};
  const order = [];
  for (const sec of song.sections) {
    if (!sec.id) throw new Error('Every section needs an "id"');
    let chart;
    try {
      chart = parseChart(sec.chords, time);
    } catch (e) {
      throw new Error(`Section "${sec.id}": ${e.message}`);
    }
    const bars = chart.length;
    const length = bars * time.stepsPerBar;
    // flatten chord changes
    const changes = [];
    chart.forEach((bar, bi) => bar.forEach((c) => {
      changes.push({ t: bi * time.stepsPerBar + c.at, symbol: c.symbol, chord: parseChord(c.symbol) });
    }));
    const chordIdxAt = (t) => {
      const tt = ((t % length) + length) % length;
      let idx = 0;
      for (let i = 0; i < changes.length; i++) if (changes[i].t <= tt) idx = i;
      return idx;
    };
    const ctx = {
      song, length, keyRoot, scale, time,
      chordAt: (t) => changes[chordIdxAt(t)].chord,
      nextChordAfter: (t) => changes[(chordIdxAt(t) + 1) % changes.length].chord,
      chordEnd: (t) => {
        const i = chordIdxAt(t);
        return i + 1 < changes.length ? changes[i + 1].t : length;
      },
    };
    sections[sec.id] = {
      id: sec.id, name: sec.name ?? capitalize(sec.id), bars, length, chart, changes,
      ctx, raw: sec, parts: {}, notes: sec.notes,
    };
    order.push(sec.id);
  }

  // compile variations (after all sections exist so "use" can point anywhere)
  for (const id of order) {
    const sec = sections[id];
    for (const part of parts) {
      let list = sec.raw.parts?.[part.id] ?? song.defaults?.[part.id];
      let guard = 0;
      while (typeof list === 'string' && guard++ < 8) {
        const other = song.sections.find((s) => s.id === list);
        if (!other) throw new Error(`Section "${id}" part "${part.id}" uses unknown section "${list}"`);
        list = other.parts?.[part.id] ?? song.defaults?.[part.id];
      }
      if (!list) { sec.parts[part.id] = []; continue; }
      if (!Array.isArray(list)) list = [list];
      // a string inside the list pulls in another section's variations
      list = list.flatMap((v) => {
        if (typeof v !== 'string') return [v];
        const other = song.sections.find((s) => s.id === v);
        const src = other?.parts?.[part.id];
        if (!Array.isArray(src)) throw new Error(`Section "${id}" part "${part.id}" can't borrow from "${v}"`);
        return src.filter((x) => typeof x !== 'string');
      });
      const ids = new Set();
      list = list.filter((v) => {
        const k = v.id ?? v.name;
        if (k && ids.has(k)) return false;
        if (k) ids.add(k);
        return true;
      });
      sec.parts[part.id] = list.map((v, i) => {
        const type = v.type ?? defaultType(part.instrument);
        const fn = COMPILERS[type];
        if (!fn) throw new Error(`Section "${id}" ${part.id}: unknown type "${type}" — use ${VARIATION_TYPES.join(', ')}`);
        let events;
        try {
          events = fn(v, sec.ctx, part.instrument);
        } catch (e) {
          throw new Error(`Section "${id}" ${part.id} "${v.name ?? v.id ?? i}": ${e.message}`);
        }
        return {
          ...v,
          id: v.id ?? slug(v.name ?? `${type}-${i + 1}`),
          name: v.name ?? `Variation ${i + 1}`,
          type,
          events,
        };
      });
    }
  }

  const arrangement = [];
  for (const item of song.arrangement ?? order) {
    const sid = typeof item === 'string' ? item : item.section;
    const times = typeof item === 'string' ? 1 : item.repeat ?? 1;
    if (!sections[sid]) throw new Error(`Arrangement names unknown section "${sid}"`);
    for (let i = 0; i < times; i++) arrangement.push(sid);
  }

  return {
    song,
    id: song.id,
    title: song.title,
    keyRoot,
    scale,
    tempo: song.tempo,
    swing: song.swing ?? 0,
    time,
    parts,
    sections,
    order,
    arrangement,
    lessons: song.lessons ?? [],
  };
}

function defaultType(instrument) {
  return { drums: 'drums', bass: 'bassline', guitar: 'strum', keys: 'comp' }[instrument] ?? 'notes';
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part';
}

function capitalize(s) {
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

/** Every chord symbol a song uses, in order of appearance. */
export function songChords(compiled) {
  const seen = [];
  for (const id of compiled.order) {
    for (const c of compiled.sections[id].changes) if (!seen.includes(c.symbol)) seen.push(c.symbol);
  }
  return seen;
}
