// Compact visual summaries of a variation: drum pads, bass steps, strum
// arrows with chord boxes, and mini tab for riffs.

import { h, s } from './dom.js';
import { chordDiagram } from './chord-diagram.js';
import { parseShape, defaultVoicing, parseChord } from './theory.js';
import { DRUM_LANES } from './song.js';

const GRID = { '16': 1, '8': 2, '8d': 3, '4': 4, '4d': 6, '2': 8, '1': 16 };

const STRUM_GLYPH = { D: '↓', d: '↓', U: '↑', u: '↑', x: '×', X: '×', '.': '', '-': '' };

function cells(tokens, gridSteps, cls, render) {
  return h(`div.steps.${cls.split(" ").join(".")}`, { dataset: { grid: gridSteps, len: tokens.length * gridSteps }, style: { '--n': tokens.length } },
    tokens.map((tok, i) => render(tok, i)));
}

export function variationDetail(v, { section, song, compact = false }) {
  const grid = GRID[String(v.grid ?? (v.type === 'drums' ? '16' : '8'))] ?? 2;
  switch (v.type) {
    case 'drums': {
      const lanes = DRUM_LANES.filter((l) => v.pattern?.[l]);
      return h('div.drum-grid', lanes.map((lane) => {
        const pat = String(v.pattern[lane]).replace(/[|\s]/g, '').split('');
        return h('div.drum-row',
          h('span.lane', lane),
          cells(pat, grid, 'pads', (ch, i) => h('span.pad', {
            class: `${ch === '.' ? '' : 'hit'} ${ch === 'X' ? 'acc' : ''} ${ch === 'o' ? 'ghost' : ''} ${i % 4 === 0 ? 'beat' : ''}`,
            dataset: { i },
          })));
      }));
    }
    case 'bassline':
    case 'degrees': {
      const toks = String(v.steps ?? v.pattern ?? '').replace(/\|/g, ' ').trim().split(/\s+/);
      return cells(toks, grid, 'tokens', (tok, i) => h('span.tok', { class: tok === '.' || tok === '-' ? 'rest' : '', dataset: { i } }, tok === '.' ? '' : tok === '-' ? '–' : tok));
    }
    case 'comp': {
      const pat = String(v.pattern ?? 'x').replace(/[|\s]/g, '').split('');
      return cells(pat, grid, 'tokens', (ch, i) => h('span.tok', { class: ch === '.' ? 'rest' : '', dataset: { i } }, ch === '.' ? '' : ch === '-' ? '–' : '●'));
    }
    case 'strum':
    case 'arpeggio': {
      const toks = v.type === 'strum'
        ? String(v.pattern ?? 'D').replace(/[|\s]/g, '').split('')
        : String(v.pattern ?? '').replace(/\|/g, ' ').trim().split(/\s+/);
      const row = cells(toks, grid, 'tokens strum', (tok, i) => h('span.tok', {
        class: `${tok === '.' || tok === '-' ? 'rest' : ''} ${/[du]/.test(tok) && v.type === 'strum' ? 'light' : ''} ${/[xX]/.test(tok) && v.type === 'strum' ? 'chuck' : ''}`,
        dataset: { i },
        title: v.type === 'strum' ? { D: 'Down', d: 'Light down', U: 'Up', u: 'Light up', x: 'Muted chuck', X: 'Muted chuck' }[tok] : undefined,
      }, v.type === 'strum' ? STRUM_GLYPH[tok] ?? tok : tok === '.' ? '' : tok));
      if (compact) return row;
      const chords = [...new Set(section.changes.map((c) => c.symbol))];
      const boxes = h('div.chord-boxes', chords.map((sym) => {
        const shape = v.voicings?.[sym] ?? song.voicings?.[sym];
        const frets = shape ? parseShape(shape) : defaultVoicing(sym, v.prefer ?? 'open');
        return chordDiagram(sym, frets, { root: parseChord(sym).root });
      }));
      return h('div.strum-detail', row, boxes);
    }
    case 'notes':
      return miniTab(v, section);
    default:
      return h('p.muted', v.type);
  }
}

/** A small, scrollable tab strip for riff/melody variations. */
export function miniTab(v, section) {
  const len = v.length ?? section.length;
  const evs = v.events.filter((e) => e.t < len && e.kind === 'note');
  const hasStrings = evs.some((e) => e.string);
  const px = 14;
  const w = Math.max(240, len * px + 30);
  const lines = hasStrings ? 6 : 1;
  const hgt = hasStrings ? 100 : 40;
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: 'mini-tab', dataset: { len } });
  const y = (str) => 12 + (str - 1) * 15;
  if (hasStrings) {
    for (let i = 1; i <= lines; i++) svg.append(s('line', { x1: 0, x2: w, y1: y(i), y2: y(i), class: 'mt-line' }));
  }
  for (let t = 0; t <= len; t += 16) svg.append(s('line', { x1: 12 + t * px, x2: 12 + t * px, y1: 6, y2: hgt - 10, class: 'mt-bar' }));
  for (const e of evs) {
    const x = 12 + e.t * px + 6;
    if (hasStrings && e.string) {
      svg.append(s('rect', { x: x - 7, y: y(e.string) - 7, width: 14, height: 14, rx: 3, class: 'mt-bg' }));
      svg.append(s('text', { x, y: y(e.string) + 4, 'text-anchor': 'middle', class: 'mt-fret' }, String(e.fret)));
    } else {
      svg.append(s('rect', { x: x - 6, y: 14, width: Math.max(6, e.d * px - 2), height: 10, rx: 3, class: 'mt-note' }));
    }
  }
  svg.append(s('line', { x1: 0, x2: 0, y1: 4, y2: hgt - 6, class: 'mt-head' }));
  return h('div.mini-tab-wrap', svg);
}

/** Highlight the current step in a rendered detail. */
export function markStep(root, step, sectionLen) {
  for (const row of root.querySelectorAll('.steps')) {
    const grid = Number(row.dataset.grid);
    const len = Number(row.dataset.len);
    const idx = Math.floor((step % len) / grid);
    const prev = row.querySelector('.now');
    const cur = row.children[idx];
    if (prev !== cur) {
      prev?.classList.remove('now');
      cur?.classList.add('now');
    }
  }
  for (const svg of root.querySelectorAll('svg.mini-tab')) {
    const len = Number(svg.dataset.len) || sectionLen;
    const x = 12 + (step % len) * 14;
    const head = svg.querySelector('.mt-head');
    head?.setAttribute('x1', x);
    head?.setAttribute('x2', x);
  }
}

export function clearSteps(root) {
  root.querySelectorAll('.steps .now').forEach((el) => el.classList.remove('now'));
}
