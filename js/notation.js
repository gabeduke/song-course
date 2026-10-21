// Standard notation + tab with VexFlow (vendored, loaded as window.VexFlow).

import { h } from './dom.js';
import { mod12, pcName } from './theory.js';

const VALUES = [16, 12, 8, 6, 4, 3, 2, 1];
const DUR = { 16: 'w', 12: 'hd', 8: 'h', 6: 'qd', 4: 'q', 3: '8d', 2: '8', 1: '16' };
const DOTTED = new Set([12, 6, 3]);

let fontsReady = null;
export function notationReady() {
  if (!window.VexFlow) return Promise.reject(new Error('VexFlow did not load'));
  if (!fontsReady) {
    fontsReady = (document.fonts?.load ? Promise.all([
      document.fonts.load('30px Bravura'),
      document.fonts.load('12px Academico'),
    ]) : Promise.resolve()).catch(() => null);
  }
  return fontsReady;
}

function aligned(v, p) {
  if (v === 12) return p % 8 === 0;
  if (v === 6) return p % 4 === 0 || p % 6 === 0;
  if (v === 3) return p % 4 === 0;
  return p % v === 0 || (v >= 4 && p % 4 === 0);
}

/** Split a duration (in 16ths) starting at position p into note values. */
export function splitDuration(p, d) {
  const out = [];
  let pos = p;
  let rem = d;
  while (rem > 0) {
    const v = VALUES.find((x) => x <= rem && aligned(x, pos)) ?? 1;
    out.push(v);
    pos += v;
    rem -= v;
  }
  return out;
}

/**
 * Turn events into bars of {start, dur, notes|null, tieIn, tieOut, chord}.
 */
export function toBars(events, length, stepsPerBar, changes = []) {
  const notes = events.filter((e) => e.kind === 'note' && e.t < length);
  const onsets = [...new Set(notes.map((e) => e.t))].sort((a, b) => a - b);
  const segs = [];
  onsets.forEach((t, i) => {
    const group = notes.filter((e) => e.t === t);
    const next = onsets[i + 1] ?? length;
    const end = Math.min(t + Math.max(...group.map((e) => e.d)), next, length);
    segs.push({ start: t, end, notes: group });
  });
  // fill gaps with rests
  const all = [];
  let cursor = 0;
  for (const sg of segs) {
    if (sg.start > cursor) all.push({ start: cursor, end: sg.start, notes: null });
    all.push(sg);
    cursor = sg.end;
  }
  if (cursor < length) all.push({ start: cursor, end: length, notes: null });
  // cut at bar lines and chord changes
  const cuts = new Set();
  for (let b = 0; b <= length; b += stepsPerBar) cuts.add(b);
  for (const c of changes) if (c.t < length) cuts.add(c.t);
  const pieces = [];
  for (const sg of all) {
    let a = sg.start;
    const points = [...cuts].filter((c) => c > sg.start && c < sg.end).sort((x, y) => x - y);
    for (const c of [...points, sg.end]) {
      pieces.push({ start: a, dur: c - a, notes: sg.notes, tieIn: a > sg.start && !!sg.notes, tieOut: c < sg.end && !!sg.notes });
      a = c;
    }
  }
  const bars = [];
  for (let b = 0; b < length / stepsPerBar; b++) bars.push([]);
  for (const pc of pieces) {
    const bi = Math.floor(pc.start / stepsPerBar);
    const inBar = pc.start - bi * stepsPerBar;
    const vals = splitDuration(inBar, pc.dur);
    let p = pc.start;
    vals.forEach((v, i) => {
      const chg = changes.find((c) => c.t === p);
      bars[bi].push({
        start: p,
        dur: v,
        notes: pc.notes,
        tieIn: pc.tieIn || i > 0,
        tieOut: pc.tieOut || i < vals.length - 1,
        chord: chg && (i === 0) ? chg.symbol : null,
      });
      p += v;
    });
  }
  return bars;
}

function vfKey(midi, flats, transpose) {
  const m = midi + transpose;
  const name = pcName(mod12(m), flats).toLowerCase();
  return `${name}/${Math.floor(m / 12) - 1}`;
}

/**
 * Render notation into a container. Guitar and bass get tab underneath;
 * keys get a grand staff (right hand treble, left hand bass).
 * opts: { events, length, time, keySig, flats, instrument, changes, maxBars }
 */
export async function renderNotation(container, opts) {
  const host = h('div.notation');
  container.append(host);
  try {
    await notationReady();
  } catch (e) {
    host.append(h('p.notation-error', 'Notation needs the VexFlow file in vendor/. ', e.message));
    return host;
  }
  const VF = window.VexFlow;
  const { Renderer, Stave, TabStave, StaveNote, TabNote, GhostNote, Voice, Formatter, Beam, Accidental, Dot, StaveTie, Annotation, Fraction, StaveConnector } = VF;
  const { time, instrument } = opts;
  const length = Math.min(opts.length, (opts.maxBars ?? 16) * time.stepsPerBar);
  const notes = opts.events.filter((e) => e.kind === 'note');
  const grand = instrument === 'keys';
  let upperEvents = notes;
  let lowerEvents = [];
  if (grand) {
    const isLeft = (e) => (e.hand ? e.hand === 'L' : e.midi < 60);
    upperEvents = notes.filter((e) => !isLeft(e));
    lowerEvents = notes.filter(isLeft);
  }
  const upperBars = toBars(upperEvents, length, time.stepsPerBar, opts.changes ?? []);
  const lowerBars = grand ? toBars(lowerEvents, length, time.stepsPerBar, []) : null;
  const hasTab = !grand && notes.some((e) => e.string);
  const tabLines = instrument === 'bass' ? 4 : 6;
  const transpose = grand ? 0 : 12; // guitar and bass read an octave up
  const clef = instrument === 'bass' ? 'bass' : 'treble';

  const width = Math.max(320, Math.min(container.clientWidth || 900, 1200));
  const perLine = width >= 1000 ? 4 : width >= 640 ? 3 : 2;
  const firstExtra = 70;
  const left = grand ? 24 : 6;
  const mw = (width - left - 6 - firstExtra) / perLine;
  const lineH = hasTab || grand ? 210 : 120;
  const lines = Math.ceil(upperBars.length / perLine);
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(width, lines * lineH + 20);
  const ctx = renderer.getContext();
  ctx.setFont('Academico', 11);

  const ties = [];
  const prev = { upper: null, lower: null };

  function staveNotes(bar, staffClef, which) {
    const out = [];
    for (const it of bar) {
      let sn;
      if (it.notes) {
        const keyList = [...new Set(it.notes.map((n) => n.midi).sort((a, b) => a - b).map((m) => vfKey(m, opts.flats, transpose)))];
        sn = new StaveNote({ keys: keyList, duration: DUR[it.dur], clef: staffClef });
      } else {
        sn = new StaveNote({ keys: [staffClef === 'bass' ? 'd/3' : 'b/4'], duration: `${DUR[it.dur]}r`, clef: staffClef });
      }
      if (DOTTED.has(it.dur)) Dot.buildAndAttach([sn], { all: true });
      if (it.chord) {
        const ann = new Annotation(it.chord);
        ann.setVerticalJustification(Annotation.VerticalJustify.TOP);
        ann.setFont('Academico', 13, 'bold');
        sn.addModifier(ann, 0);
      }
      if (it.tieIn && prev[which] && it.notes) ties.push([prev[which], sn]);
      prev[which] = it.notes ? sn : null;
      out.push(sn);
    }
    return out;
  }

  function tabNotes(bar) {
    return bar.map((it) => {
      const pos = (it.notes ?? []).filter((n) => n.string).map((n) => ({ str: n.string, fret: n.fret }));
      if (it.notes && pos.length && !it.tieIn) return new TabNote({ positions: pos, duration: DUR[it.dur] });
      const g = new GhostNote({ duration: DUR[it.dur] });
      if (DOTTED.has(it.dur)) Dot.buildAndAttach([g], { all: true });
      return g;
    });
  }

  const voiceOf = (tickables) => {
    const v = new Voice({ numBeats: time.beatsPerBar, beatValue: time.beatUnit }).setMode(Voice.Mode.SOFT);
    v.addTickables(tickables);
    return v;
  };
  const groups = time.beatUnit === 8 ? [new Fraction(3, 8)] : [new Fraction(2, 8)];

  upperBars.forEach((bar, bi) => {
    const line = Math.floor(bi / perLine);
    const col = bi % perLine;
    const x = left + (col === 0 ? 0 : firstExtra + col * mw);
    const w = col === 0 ? mw + firstExtra : mw;
    const y = 10 + line * lineH;
    const top = new Stave(x, y + 10, w);
    if (col === 0) {
      top.addClef(grand ? 'treble' : clef).addKeySignature(opts.keySig);
      if (bi === 0) top.addTimeSignature(time.meter);
    }
    top.setContext(ctx).draw();
    let bottom = null;
    if (grand) {
      bottom = new Stave(x, y + 100, w);
      if (col === 0) {
        bottom.addClef('bass').addKeySignature(opts.keySig);
        if (bi === 0) bottom.addTimeSignature(time.meter);
      }
      bottom.setContext(ctx).draw();
      if (col === 0) new StaveConnector(top, bottom).setType('brace').setContext(ctx).draw();
      new StaveConnector(top, bottom).setType(col === 0 ? 'singleLeft' : 'singleLeft').setContext(ctx).draw();
      if (col === perLine - 1 || bi === upperBars.length - 1) new StaveConnector(top, bottom).setType('singleRight').setContext(ctx).draw();
    } else if (hasTab) {
      bottom = new TabStave(x, y + 92, w, { numLines: tabLines });
      if (col === 0) bottom.addClef('tab');
      bottom.setContext(ctx).draw();
    }

    const upperNotes = staveNotes(bar, grand ? 'treble' : clef, 'upper');
    const upper = voiceOf(upperNotes);
    Accidental.applyAccidentals([upper], opts.keySig);
    let lower = null;
    let lowerNotes = [];
    if (grand) {
      lowerNotes = staveNotes(lowerBars[bi], 'bass', 'lower');
      lower = voiceOf(lowerNotes);
      Accidental.applyAccidentals([lower], opts.keySig);
    } else if (hasTab) {
      lower = voiceOf(tabNotes(bar));
    }
    const fmt = new Formatter();
    fmt.joinVoices([upper]);
    if (lower) fmt.joinVoices([lower]);
    fmt.format(lower ? [upper, lower] : [upper], top.getNoteEndX() - top.getNoteStartX() - 12);
    const beams = Beam.generateBeams(upperNotes, { groups });
    const lowBeams = grand ? Beam.generateBeams(lowerNotes, { groups }) : [];
    upper.draw(ctx, top);
    if (lower) lower.draw(ctx, bottom);
    [...beams, ...lowBeams].forEach((b) => b.setContext(ctx).draw());
  });
  for (const [a, b] of ties) {
    try {
      new StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw();
    } catch { /* a tie across a line break can fail; skip it */ }
  }
  if (opts.length > length) host.append(h('p.notation-more', `First ${opts.maxBars ?? 16} bars shown.`));
  return host;
}
