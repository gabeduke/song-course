// Sheet view: chord charts, notation and tab for every part. Prints cleanly.

import { h, clear, put, segmented } from '../dom.js';
import { keySignature, prefersFlats, pcName, SCALES } from '../theory.js';
import { renderNotation } from '../notation.js';
import { variationDetail } from '../parts-ui.js';

export function mountSheet(root, app) {
  const { store, player } = app;
  const song = app.song;
  const flats = prefersFlats(song.keyRoot, song.scale);
  const keySig = keySignature(song.keyRoot, song.scale);
  const opts = { which: 'selected', drums: false, only: 'all' };
  const head = h('div.sheet-controls.no-print');
  const body = h('div.sheet');
  root.append(head, body);
  let token = 0;

  function renderControls() {
    put(clear(head), 
      h('div.ctl', h('span.ctl-label', 'Show'),
        segmented('Variations', [{ value: 'selected', label: 'Chosen variations' }, { value: 'all', label: 'Every variation' }], opts.which, (v) => { opts.which = v; renderControls(); renderSheet(); }, { small: true })),
      h('div.ctl', h('span.ctl-label', 'Section'),
        h('select', { 'aria-label': 'Section', onchange: (e) => { opts.only = e.target.value; renderSheet(); } },
          h('option', { value: 'all', selected: opts.only === 'all' }, 'All sections'),
          song.order.map((sid) => h('option', { value: sid, selected: opts.only === sid }, song.sections[sid].name)))),
      h('label.check', h('input', { type: 'checkbox', checked: opts.drums, onchange: (e) => { opts.drums = e.target.checked; renderSheet(); } }), 'Include drums'),
      h('button.btn', { type: 'button', onclick: () => window.print() }, 'Print'),
    );
  }

  const byline = () => [song.song.artist, `${pcName(song.keyRoot, flats)} ${SCALES[song.scale].name.toLowerCase()}`, song.time.meter, `${store.state.tempo} bpm`].filter(Boolean).join(' / ');

  async function renderSheet() {
    const my = ++token;
    clear(body);
    const raw = song.song;
    body.append(h('header.sheet-head', h('h1', song.title), h('p.byline', byline())));
    for (const sid of song.order) {
      if (opts.only !== 'all' && opts.only !== sid) continue;
      const sec = song.sections[sid];
      const block = h('section.sheet-section');
      body.append(block);
      block.append(h('h2', sec.name));
      block.append(h('div.chart', sec.chart.map((bar, i) => h('div.chart-bar', h('span.chart-n', String(i + 1)), bar.map((c) => c.symbol).join('  ')))));
      for (const part of song.parts) {
        if (part.instrument === 'drums' && !opts.drums) continue;
        const list = sec.parts[part.id] ?? [];
        const chosen = player.variationFor(sid, part.id);
        const vars = opts.which === 'all' ? list : chosen ? [chosen] : [];
        for (const v of vars) {
          if (my !== token) return;
          const fig = h('figure.sheet-part');
          block.append(fig);
          fig.append(h('figcaption', h('strong', part.name), ` ${v.name}`));
          if (['notes', 'degrees', 'arpeggio', 'bassline', 'hands'].includes(v.type) || (v.type === 'comp' && part.instrument === 'keys')) {
            const events = v.events;
            const length = (v.type === 'notes' || v.type === 'hands') && v.length ? Math.min(v.length, sec.length) : sec.length;
            await renderNotation(fig, {
              events, length, time: song.time, keySig, flats, instrument: part.instrument, changes: sec.changes, maxBars: 16,
            });
            if (v.type === 'arpeggio') fig.append(variationDetail(v, { section: sec, song: raw }));
          } else {
            fig.append(variationDetail(v, { section: sec, song: raw }));
          }
        }
      }
    }
    if (song.lessons.length) {
      const ls = h('section.sheet-section.sheet-lessons', h('h2', 'Practice plan'),
        h('ol', song.lessons.map((l) => h('li', h('strong', l.title), l.goal ? ` ${l.goal}` : ''))));
      body.append(ls);
    }
  }

  renderControls();
  renderSheet();

  return {
    update(st, patch) {
      if ('selection' in patch) renderSheet();
      else if ('tempo' in patch) body.querySelector('.sheet-head .byline').textContent = byline();
    },
    destroy() { token++; },
  };
}
