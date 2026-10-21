// Interactive SVG keyboard, C2–C6. Marks show chord or scale tones; the
// left hand's notes sit low on the key, the right hand's high.

import { s, clear } from './dom.js';

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const H = 190;
const WHITE_H = 170;
const BLACK_H = 106;

export class Piano {
  constructor(el, { lo = 36, hi = 84, onTap = null, label = 'Piano keyboard' } = {}) {
    this.el = el;
    this.lo = lo;
    this.hi = hi;
    this.onTap = onTap;
    this.whites = [];
    for (let m = lo; m <= hi; m++) if (WHITE_PCS.includes(m % 12)) this.whites.push(m);
    this.ww = 1000 / this.whites.length;
    this.svg = s('svg', { viewBox: `0 0 1000 ${H}`, class: 'piano-svg', role: 'img', 'aria-label': label });
    this.keysG = s('g');
    this.marks = s('g', { class: 'pn-marks' });
    this.pings = s('g');
    this.svg.append(this.keysG, this.marks, this.pings);
    this.keyEls = new Map();
    this.build();
    clear(el).append(this.svg);
  }

  keyX(m) {
    if (WHITE_PCS.includes(m % 12)) return this.whites.indexOf(m) * this.ww;
    return this.whites.indexOf(m - 1) * this.ww + this.ww * 0.68;
  }

  isBlack(m) {
    return !WHITE_PCS.includes(m % 12);
  }

  center(m) {
    const black = this.isBlack(m);
    const w = black ? this.ww * 0.64 : this.ww;
    return this.keyX(m) + w / 2;
  }

  build() {
    for (const m of this.whites) {
      const r = s('rect', { x: this.keyX(m) + 0.5, y: 0, width: this.ww - 1, height: WHITE_H, rx: 4, class: 'pn-white', dataset: { midi: m } });
      this.keysG.append(r);
      this.keyEls.set(m, r);
      if (m % 12 === 0) this.keysG.append(s('text', { x: this.keyX(m) + this.ww / 2, y: WHITE_H + 15, 'text-anchor': 'middle', class: 'pn-oct' }, `C${Math.floor(m / 12) - 1}`));
    }
    for (let m = this.lo; m <= this.hi; m++) {
      if (!this.isBlack(m)) continue;
      const r = s('rect', { x: this.keyX(m), y: 0, width: this.ww * 0.64, height: BLACK_H, rx: 3, class: 'pn-black', dataset: { midi: m } });
      this.keysG.append(r);
      this.keyEls.set(m, r);
    }
    this.svg.addEventListener('pointerdown', (e) => {
      const m = Number(e.target?.dataset?.midi);
      if (m && this.onTap) this.onTap(m);
    });
  }

  /** marks: [{midi, role, label, hand: 'L'|'R'|null, faint}] */
  render(marks) {
    const g = clear(this.marks);
    for (const k of this.keyEls.values()) k.classList.remove('lit');
    for (const mk of marks) {
      if (mk.midi < this.lo || mk.midi > this.hi) continue;
      const black = this.isBlack(mk.midi);
      const cx = this.center(mk.midi);
      const cy = black ? BLACK_H - 20 : WHITE_H - 24;
      if (mk.hand) this.keyEls.get(mk.midi)?.classList.add('lit');
      g.append(s('g', { class: `pn-mark role-${mk.role}${mk.faint ? ' faint' : ''}`, transform: `translate(${cx} ${cy})` },
        s('circle', { r: black ? 9 : 11 }),
        mk.label ? s('text', { y: 4, 'text-anchor': 'middle' }, mk.label) : null,
        mk.hand ? s('text', { y: black ? -16 : -19, 'text-anchor': 'middle', class: 'pn-hand' }, mk.hand) : null));
    }
  }

  ping(midi, role = 'root') {
    if (midi < this.lo || midi > this.hi) return;
    const black = this.isBlack(midi);
    const r = s('rect', {
      x: this.keyX(midi) + (black ? 0 : 0.5), y: 0, width: black ? this.ww * 0.64 : this.ww - 1, height: black ? BLACK_H : WHITE_H,
      rx: 4, class: `pn-ping role-${role}`,
    });
    this.pings.append(r);
    setTimeout(() => r.remove(), 600);
  }
}
