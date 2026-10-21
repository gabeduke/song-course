// Small vertical chord box: strings left (low E) to right (high e).

import { s } from './dom.js';
import { fretMidi, mod12, intervalRole, INTERVALS } from './theory.js';

export function chordDiagram(name, frets, { root = null, size = 1 } = {}) {
  const fretted = frets.filter((f) => f !== null && f > 0);
  const maxF = fretted.length ? Math.max(...fretted) : 0;
  const minF = fretted.length ? Math.min(...fretted) : 1;
  const base = maxF <= 5 ? 1 : minF;
  const rows = Math.max(4, maxF - base + 1);
  const sx = 14;
  const fy = 18;
  const left = 22;
  const top = 36;
  const w = left + sx * 5 + 18;
  const hgt = top + fy * rows + 10;
  const svg = s('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w * size, height: hgt * size, class: 'chord-box', role: 'img', 'aria-label': `${name} chord` });
  svg.append(s('text', { x: left + sx * 2.5, y: 14, 'text-anchor': 'middle', class: 'cb-name' }, name));
  if (base === 1) svg.append(s('rect', { x: left - 1, y: top - 4, width: sx * 5 + 2, height: 4, class: 'cb-nut' }));
  else svg.append(s('text', { x: left - 8, y: top + fy * 0.68, 'text-anchor': 'end', class: 'cb-base' }, `${base}`));
  for (let r = 0; r <= rows; r++) svg.append(s('line', { x1: left, x2: left + sx * 5, y1: top + r * fy, y2: top + r * fy, class: 'cb-fret' }));
  for (let i = 0; i < 6; i++) svg.append(s('line', { x1: left + i * sx, x2: left + i * sx, y1: top, y2: top + rows * fy, class: 'cb-string' }));
  // column i = string 6 - i
  for (let i = 0; i < 6; i++) {
    const str = 6 - i;
    const f = frets[str - 1];
    const x = left + i * sx;
    if (f === null || f === undefined) {
      svg.append(s('text', { x, y: top - 9, 'text-anchor': 'middle', class: 'cb-x' }, '×'));
    } else if (f === 0) {
      svg.append(s('circle', { cx: x, cy: top - 13, r: 4, class: 'cb-open' }));
    } else {
      const iv = root === null ? 0 : mod12(fretMidi(str, f) - root);
      const role = root === null ? 'color' : intervalRole(iv);
      const y = top + (f - base + 0.5) * fy;
      svg.append(s('g', { class: `cb-dot role-${role}` },
        s('circle', { cx: x, cy: y, r: 6 }),
        s('title', root === null ? '' : INTERVALS[iv])));
    }
  }
  return svg;
}
