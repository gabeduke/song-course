// Interactive SVG fretboard. High e on top, like tab.

import { s, clear } from './dom.js';

const W = 1000;
const H = 210;
const NUT_X = 54;
const TOP = 26;
const BOTTOM = H - 30;
const INLAYS = [3, 5, 7, 9, 15, 17, 19, 21];

let uid = 0;

export class Fretboard {
  constructor(el, { frets = 15, onTap = null, label = 'Guitar fretboard' } = {}) {
    this.el = el;
    this.frets = frets;
    this.onTap = onTap;
    this.id = `fb${++uid}`;
    // real fret spacing, squeezed so the last fret lands at the right edge
    const k = 1 - 2 ** (-frets / 12);
    this.fx = (f) => NUT_X + (W - NUT_X - 14) * ((1 - 2 ** (-f / 12)) / k);
    this.sy = (str) => TOP + ((str - 1) * (BOTTOM - TOP)) / 5;
    this.svg = s('svg', {
      viewBox: `0 0 ${W} ${H}`,
      class: 'fretboard-svg',
      role: 'img',
      'aria-label': label,
      preserveAspectRatio: 'xMidYMid meet',
    });
    this.buildStatic();
    this.layer = s('g', { class: 'fb-layer' });
    this.pings = s('g', { class: 'fb-pings' });
    this.svg.append(this.layer, this.pings);
    clear(el).append(this.svg);
    this.svg.addEventListener('pointerdown', (e) => this.handleTap(e));
  }

  /** Centre x of the space where you'd fret this note. */
  noteX(f) {
    if (f === 0) return NUT_X - 26;
    return (this.fx(f - 1) + this.fx(f)) / 2;
  }

  buildStatic() {
    const id = this.id;
    const defs = s('defs', {},
      s('linearGradient', { id: `${id}-wood`, x1: 0, y1: 0, x2: 0, y2: 1 },
        s('stop', { offset: '0', 'stop-color': 'var(--wood-hi)' }),
        s('stop', { offset: '0.5', 'stop-color': 'var(--wood)' }),
        s('stop', { offset: '1', 'stop-color': 'var(--wood-lo)' })),
      s('filter', { id: `${id}-grain`, x: 0, y: 0, width: '100%', height: '100%' },
        s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.004 0.22', numOctaves: 3, seed: 7, result: 'n' }),
        s('feColorMatrix', { in: 'n', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.22 0' }),
        s('feComposite', { in2: 'SourceGraphic', operator: 'in' })),
      s('radialGradient', { id: `${id}-pearl` },
        s('stop', { offset: '0', 'stop-color': 'var(--pearl)' }),
        s('stop', { offset: '1', 'stop-color': 'var(--pearl-edge)' })),
    );
    const g = s('g', { class: 'fb-static' });
    const boardTop = TOP - 14;
    const boardBottom = BOTTOM + 14;
    g.append(
      s('rect', { x: NUT_X, y: boardTop, width: W - NUT_X, height: boardBottom - boardTop, rx: 3, fill: `url(#${id}-wood)` }),
      s('rect', { x: NUT_X, y: boardTop, width: W - NUT_X, height: boardBottom - boardTop, fill: 'var(--wood-lo)', filter: `url(#${id}-grain)` }),
    );
    // position band (filled in later)
    this.band = s('rect', { class: 'fb-band', y: boardTop, height: boardBottom - boardTop, x: 0, width: 0, rx: 4 });
    g.append(this.band);
    // inlays
    for (const f of INLAYS) {
      if (f > this.frets) continue;
      g.append(this.inlay(this.noteX(f), (TOP + BOTTOM) / 2));
    }
    if (this.frets >= 12) {
      for (const y of [this.sy(2) + (this.sy(3) - this.sy(2)) / 2, this.sy(4) + (this.sy(5) - this.sy(4)) / 2]) {
        g.append(this.inlay(this.noteX(12), y));
      }
    }
    // frets
    for (let f = 1; f <= this.frets; f++) {
      const x = this.fx(f);
      g.append(s('line', { x1: x, x2: x, y1: boardTop, y2: boardBottom, class: 'fb-fret' }));
      g.append(s('line', { x1: x - 1.2, x2: x - 1.2, y1: boardTop, y2: boardBottom, class: 'fb-fret-hi' }));
    }
    // nut
    g.append(s('rect', { x: NUT_X - 7, y: boardTop - 2, width: 9, height: boardBottom - boardTop + 4, rx: 2, class: 'fb-nut' }));
    // strings
    for (let str = 1; str <= 6; str++) {
      const y = this.sy(str);
      const w = 0.9 + (str - 1) * 0.45;
      g.append(s('line', { x1: NUT_X - 40, x2: W, y1: y, y2: y, class: `fb-string${str >= 4 ? ' wound' : ''}`, 'stroke-width': w }));
    }
    // fret numbers
    for (const f of [0, 3, 5, 7, 9, 12, 15, 17, 19, 21]) {
      if (f > this.frets) continue;
      g.append(s('text', { x: this.noteX(f), y: H - 6, class: 'fb-num', 'text-anchor': 'middle' }, String(f)));
    }
    this.svg.append(defs, g);
  }

  inlay(x, y) {
    return s('rect', { x: x - 5, y: y - 5, width: 10, height: 10, rx: 1.5, transform: `rotate(45 ${x} ${y})`, fill: `url(#${this.id}-pearl)`, class: 'fb-inlay' });
  }

  handleTap(e) {
    if (!this.onTap) return;
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM().inverse());
    const str = Math.max(1, Math.min(6, Math.round(((p.y - TOP) / (BOTTOM - TOP)) * 5) + 1));
    let fret = 0;
    if (p.x > NUT_X) {
      for (let f = 1; f <= this.frets; f++) {
        if (p.x <= this.fx(f)) { fret = f; break; }
        fret = this.frets;
      }
    }
    this.onTap({ string: str, fret });
  }

  /**
   * model: {
   *   dots: [{string, fret, role, label, faint, ring}],
   *   shapes: [{points:[{string,fret}], role}],
   *   band: [lo, hi] | null,
   *   muted: [string numbers shown with an x at the nut]
   * }
   */
  render(model) {
    const g = clear(this.layer);
    if (model.band) {
      const [lo, hi] = model.band;
      const x1 = lo <= 0 ? NUT_X - 44 : this.fx(lo - 1) - 3;
      const x2 = this.fx(Math.min(hi, this.frets)) + 3;
      this.band.setAttribute('x', x1);
      this.band.setAttribute('width', Math.max(0, x2 - x1));
      this.band.classList.add('on');
    } else {
      this.band.classList.remove('on');
    }
    for (const sh of model.shapes ?? []) {
      const pts = sh.points.filter((p) => p.fret <= this.frets).map((p) => `${this.noteX(p.fret)},${this.sy(p.string)}`);
      if (pts.length > 1) g.append(s('polyline', { points: pts.join(' '), class: `fb-shape role-${sh.role ?? 'root'}${sh.faint ? ' faint' : ''}` }));
    }
    for (const str of model.muted ?? []) {
      g.append(s('text', { x: NUT_X - 26, y: this.sy(str) + 5, class: 'fb-mute', 'text-anchor': 'middle' }, '×'));
    }
    for (const d of model.dots) {
      if (d.fret > this.frets) continue;
      const x = this.noteX(d.fret);
      const y = this.sy(d.string);
      const dot = s('g', { class: `fb-dot role-${d.role}${d.faint ? ' faint' : ''}${d.ring ? ' ring' : ''}`, transform: `translate(${x} ${y})` },
        d.ring ? s('circle', { r: 14.5, class: 'fb-ring' }) : null,
        s('circle', { r: 11 }),
        d.label ? s('text', { y: 4, 'text-anchor': 'middle' }, d.label) : null);
      g.append(dot);
    }
  }

  ping(string, fret, role = 'root') {
    if (fret > this.frets) return;
    const c = s('circle', { cx: this.noteX(fret), cy: this.sy(string), r: 12, class: `fb-ping role-${role}` });
    this.pings.append(c);
    setTimeout(() => c.remove(), 700);
  }
}
