// The practice book: its contents (your session, the video's chapters, the
// drills by category, the songs) and a drill's own page (the neck, the key
// and where on the neck, how it moves on, how to practise it, its tab).

import { h, clear, put, segmented, toast } from '../dom.js';
import { Fretboard } from '../fretboard.js';
import {
  parseChord, mod12, intervalRole, INTERVALS, pcName, prefersFlats, fretMidi, keySignature,
} from '../theory.js';
import {
  DRILLS, CATEGORIES, VIDEO, KEYS, drillById, advanceChoices, paramsLabel, videoAt, clock,
} from '../drills.js';
import { renderNotation } from '../notation.js';
import { variationDetail } from '../parts-ui.js';

const ROLE_LEGEND = [['root', 'Root'], ['third', '3rd'], ['fifth', '5th'], ['seventh', '7th'], ['color', 'Other']];
const FINGER_LEGEND = [['root', 'Index'], ['third', 'Middle'], ['fifth', 'Ring'], ['seventh', 'Little']];

// ------------------------------------------------------------------ contents

export function mountBook(root, app) {
  const { session } = app;
  const sessionCard = h('section.book-card.book-session', { 'aria-label': 'Your session' });
  root.append(
    h('header.book-hero',
      h('h1', 'Practice book'),
      h('p.lede', 'The warm-ups, triads, pentatonic boxes and scales you’d flip through the books for, in any key and anywhere on the neck, with a band to play them over. Line them up into a session and the clock walks you through it.')),
    h('div.book-top', sessionCard, videoCard()),
    ...CATEGORIES.map((cat) => h('section.book-cat', { 'aria-labelledby': `cat-${cat.id}` },
      h('div.panel-head', h('h2', { id: `cat-${cat.id}` }, cat.title), h('p.muted', cat.blurb)),
      h('div.drill-grid', DRILLS.filter((d) => d.category === cat.id).map((d) => drillCard(d))))),
    h('section.book-cat', { 'aria-labelledby': 'cat-songs' },
      h('div.panel-head', h('h2', { id: 'cat-songs' }, 'Songs'), h('p.muted', 'Put a song at the end of a session: the reward for the scales.')),
      h('div.drill-grid', app.library().map((raw) => h('div.drill-card.song-card',
        h('a.dc-main', { href: `#/${encodeURIComponent(raw.id)}/practice` },
          h('strong', raw.title), h('span', raw.artist ?? ''), raw.skills?.length ? h('span.dc-meta', raw.skills.slice(0, 3).join(' · ')) : null),
        h('button.mini', { type: 'button', onclick: () => { session.add({ song: raw.id, minutes: 10 }); toast(`Added ${raw.title} to your session`); } }, 'Add to session'))))),
  );

  function drillCard(d) {
    const meta = [d.keyed ? 'Any key' : null, d.stops ? `${d.stops({}).length} ${d.stopsName ?? `${d.stopName.toLowerCase()}s`}` : null, d.video ? 'From the video' : null].filter(Boolean);
    return h('a.drill-card', { href: `#/book/${d.id}`, dataset: { drill: d.id } },
      h('strong', d.title), h('span', d.goal), h('span.dc-meta', meta.join(' · ')));
  }

  function renderSession() {
    const items = session.routine;
    const running = session.run?.index;
    const move = (i, j) => {
      const r = [...items];
      [r[i], r[j]] = [r[j], r[i]];
      session.setRoutine(r);
    };
    const setMinutes = (i, m) => session.setRoutine(items.map((it, k) => (k === i ? { ...it, minutes: Math.max(1, Math.min(60, m)) } : it)));
    put(clear(sessionCard),
      h('div.bc-head', h('h2', 'Your session'), h('span.muted', `${session.total} min`)),
      items.length ? h('ol.session-list', items.map((it, i) => {
        const d = it.drill && drillById(it.drill);
        const title = d ? d.title : app.library().find((r) => r.id === it.song)?.title ?? it.song;
        return h('li.si', { class: running === i ? 'now' : '' },
          h('span.si-n', String(i + 1)),
          h('span.si-t', h('strong', title), h('span.muted', d ? paramsLabel(d, it.params) || 'Default settings' : 'Song')),
          h('span.si-min',
            h('button.icon-btn', { type: 'button', 'aria-label': `Less time on ${title}`, onclick: () => setMinutes(i, it.minutes - 1) }, '−'),
            h('span', `${it.minutes} min`),
            h('button.icon-btn', { type: 'button', 'aria-label': `More time on ${title}`, onclick: () => setMinutes(i, it.minutes + 1) }, '+')),
          h('span.si-move',
            h('button.mini', { type: 'button', 'aria-label': `Move ${title} up`, disabled: i === 0, onclick: () => move(i, i - 1) }, '↑'),
            h('button.mini', { type: 'button', 'aria-label': `Move ${title} down`, disabled: i === items.length - 1, onclick: () => move(i, i + 1) }, '↓'),
            h('button.mini', { type: 'button', 'aria-label': `Remove ${title}`, onclick: () => session.setRoutine(items.filter((_, k) => k !== i)) }, '✕')));
      })) : h('p.muted', 'Nothing in it yet. Open a drill and Add to session.'),
      h('div.bc-actions',
        session.active
          ? [h('button.btn', { type: 'button', onclick: app.goToItem }, `Back to ${session.run.index + 1} of ${items.length}`),
            h('button.btn.btn-quiet', { type: 'button', onclick: () => session.end() }, 'End session')]
          : h('button.btn', { type: 'button', disabled: !items.length, onclick: () => app.startSession(0) }, 'Start session'),
        h('button.link-btn', { type: 'button', onclick: () => { if (confirm('Put the session back to the starter list?')) session.reset(); } }, 'Reset to the starter list')),
      h('p.fine', 'Each drill keeps the key and settings it had when you added it. Your list lives in this browser.'));
  }

  renderSession();
  const off = session.on(renderSession);
  return { update() {}, destroy() { off(); } };
}

function videoCard() {
  return h('section.book-card.book-video', { 'aria-labelledby': 'video-h' },
    h('span.lab-kicker', 'From the video'),
    h('h2#video-h', VIDEO.title),
    h('p.muted', VIDEO.channel, ' · ', h('a', { href: VIDEO.url, target: '_blank', rel: 'noopener' }, 'Watch on YouTube')),
    h('p', 'Soloing over changes with triads. Each chapter, and the drill here that practises it:'),
    h('ol.chapters', VIDEO.chapters.map((c) => {
      const d = drillById(c.drill);
      return h('li',
        h('a.ch-t', { href: videoAt(c.t), target: '_blank', rel: 'noopener', 'aria-label': `${c.title}, at ${clock(c.t)} in the video` }, clock(c.t)),
        h('span.ch-body', h('strong', c.title), h('span.muted', c.note)),
        h('a.ch-drill', { href: `#/book/${d.id}` }, d.title));
    })));
}

// ------------------------------------------------------------------ a drill

export function mountDrill(root, app) {
  const { store, player, engine, session } = app;
  const drill = drillById(store.state.drillId);
  let b = app.drill;
  let song = app.song;
  const live = { step: -1 };
  const setParams = (patch) => {
    app.loadDrill(drill.id, { ...store.state.drill, ...patch });
    store.set({ drillLoop: 0 });
  };
  const flats = () => prefersFlats(song.keyRoot, song.scale);
  const chordless = !!drill.chordless;

  const cat = CATEGORIES.find((c) => c.id === drill.category);
  root.append(h('header.drill-hero',
    h('div.hero-text',
      h('a.back', { href: '#/book' }, '← Practice book'),
      h('span.lab-kicker', cat.title),
      h('h1', drill.title),
      h('p.summary', drill.goal)),
    h('div.hero-side',
      h('button.btn', {
        type: 'button',
        onclick: () => {
          session.add({ drill: drill.id, minutes: 5, params: { ...store.state.drill } });
          toast(`Added to your session: ${drill.title}${paramsLabel(drill, store.state.drill) ? `, ${paramsLabel(drill, store.state.drill)}` : ''}`);
        },
      }, 'Add to session'))));

  // ---------------------------------------------------------------- neck
  const readout = h('div.readout', { 'aria-live': 'polite' });
  const fbHolder = h('div.fb-holder');
  const controls = h('div.fb-controls');
  root.append(h('section.neck', { 'aria-label': 'Fretboard' },
    h('div.neck-top', readout, h('div.legend', (chordless ? FINGER_LEGEND : ROLE_LEGEND).map(([r, l]) => h('span', h('i', { class: `sw role-${r}` }), l)))),
    h('div.fb-scroll', fbHolder),
    controls));

  const fretboard = new Fretboard(fbHolder, {
    frets: 15,
    label: `${drill.title} on the fretboard`,
    onTap: async ({ string, fret }) => {
      await engine.init();
      const midi = fretMidi(string, fret);
      engine.audition([{ midi, string }]);
      fretboard.ping(string, fret, roleOf(midi, refNow()));
    },
  });

  function changeAt(step) {
    const sec = song.sections.drill;
    let c = sec.changes[0];
    for (const x of sec.changes) if (x.t <= Math.max(0, step)) c = x;
    return c.symbol;
  }
  const barAt = (step) => Math.floor(Math.max(0, step) / song.time.stepsPerBar);
  const refNow = () => (b.refChord ? parseChord(changeAt(live.step)).root : b.ref);
  const roleOf = (midi, ref) => (ref === null || ref === undefined ? 'color' : intervalRole(midi - ref));

  function renderNeck() {
    const sym = changeAt(live.step);
    const m = b.neck(sym, barAt(live.step));
    const chordRoot = parseChord(sym).root;
    const labels = store.state.fb.labels;
    const dots = m.dots.map((d) => {
      const midi = fretMidi(d.string, d.fret);
      const ref = d.ref ?? (b.refChord ? chordRoot : b.ref);
      const hasRef = ref !== null && ref !== undefined;
      return {
        string: d.string, fret: d.fret, faint: d.faint, ring: d.ring,
        role: d.role ?? roleOf(midi, ref),
        label: d.label ?? (labels === 'intervals' && hasRef ? INTERVALS[mod12(midi - ref)] : pcName(midi, flats())),
      };
    });
    fretboard.render({ dots, shapes: m.shapes ?? [], band: m.band ?? null, muted: m.muted ?? [] });
  }

  function renderReadout() {
    const sym = changeAt(live.step);
    const chord = parseChord(sym);
    put(clear(readout),
      chordless ? null : h('div.now-chord', sym),
      h('div.now-meta',
        chordless ? null : h('span.tones', chord.pcs.map((pc, i) => h('span', { class: `role-${intervalRole(chord.intervals[i])}` }, pcName(pc, flats())))),
        h('span.where', b.where)));
  }

  function renderControls() {
    const p = store.state.drill;
    const ctl = [];
    if (drill.keyed) {
      ctl.push(h('div.ctl', h('span.ctl-label', 'Key'),
        h('select', { 'aria-label': 'Key', onchange: (e) => setParams({ key: e.target.value }) },
          KEYS.map((k) => h('option', { value: k, selected: k === p.key }, k)))));
    }
    if (drill.stops) {
      const stops = drill.stops(p);
      const i = stops.findIndex((s) => s.value === p.stop);
      const name = drill.stopName;
      ctl.push(h('div.ctl.ctl-stop', h('span.ctl-label', name),
        h('button.icon-btn', { type: 'button', 'aria-label': `Previous ${name.toLowerCase()}`, onclick: () => setParams({ stop: stops[(i + stops.length - 1) % stops.length].value }) }, '‹'),
        stops.length > 6
          ? h('select', { 'aria-label': name, onchange: (e) => setParams({ stop: stops[Number(e.target.value)].value }) },
            stops.map((s, k) => h('option', { value: k, selected: k === i }, s.label)))
          : segmented(name, stops, p.stop, (v) => setParams({ stop: v }), { small: true }),
        h('button.icon-btn', { type: 'button', 'aria-label': `Next ${name.toLowerCase()}`, onclick: () => setParams({ stop: stops[(i + 1) % stops.length].value }) }, '›')));
    }
    for (const o of drill.options ?? []) {
      const control = o.choices.length > 4
        ? h('select', { 'aria-label': o.label, onchange: (e) => setParams({ [o.id]: o.choices[Number(e.target.value)].value }) },
          o.choices.map((c, k) => h('option', { value: k, selected: c.value === p[o.id] }, c.label)))
        : segmented(o.label, o.choices, p[o.id], (v) => setParams({ [o.id]: v }), { small: true });
      ctl.push(h('div.ctl', h('span.ctl-label', o.label), control));
    }
    if (!chordless) {
      ctl.push(h('div.ctl.ctl-end', segmented('Labels', [{ value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Intervals' }],
        store.state.fb.labels === 'intervals' ? 'intervals' : 'notes',
        (v) => store.set({ fb: { ...store.state.fb, labels: v } }), { small: true })));
    }
    put(clear(controls), ctl);
  }

  // ---------------------------------------------------------------- run
  const runPanel = h('section.drill-run', { 'aria-label': 'How the drill runs' });
  root.append(runPanel);
  const bandParts = () => song.parts.filter((x) => x.id !== 'demo').map((x) => x.id);

  function renderRun() {
    const st = store.state;
    const demoOn = !st.mutes.demo;
    const bandOn = bandParts().some((pid) => !st.mutes[pid]);
    const choices = advanceChoices(drill);
    const { how, every } = st.move;
    put(clear(runPanel),
      h('div.ctl',
        h('button.toggle', { type: 'button', 'aria-pressed': String(demoOn), class: demoOn ? 'on' : '', title: 'Hear the drill played, or mute it and play it yourself', onclick: () => store.set({ mutes: { ...st.mutes, demo: demoOn } }) }, 'Demo guitar'),
        h('button.toggle', { type: 'button', 'aria-pressed': String(bandOn), class: bandOn ? 'on' : '', onclick: () => store.set({ mutes: { ...st.mutes, ...Object.fromEntries(bandParts().map((pid) => [pid, bandOn])) } }) }, song.parts.some((x) => x.id === 'bass') ? 'Band' : 'Click track')),
      choices.length ? h('div.ctl', h('span.ctl-label', 'Move on'),
        segmented('Move on', [{ value: null, label: 'Off' }, ...choices], how, (v) => store.set({ move: { ...store.state.move, how: v }, drillLoop: 0 }), { small: true })) : null,
      how ? h('div.ctl', h('span.ctl-label', 'Every'),
        segmented('Every', [1, 2, 4, 8].map((n) => ({ value: n, label: n === 1 ? 'loop' : `${n} loops` })), every, (v) => store.set({ move: { ...store.state.move, every: v }, drillLoop: 0 }), { small: true }),
        h('span.muted.loop-count', { 'aria-live': 'polite' }, loopText())) : null);
  }

  function loopText() {
    const st = store.state;
    return st.move.how ? `loop ${Math.min(st.drillLoop + 1, st.move.every)} of ${st.move.every}` : '';
  }

  // ---------------------------------------------------------------- how-to and tab
  const howTo = h('section.drill-how', { 'aria-label': 'How to practise it' });
  const tab = h('section.drill-tab', { 'aria-label': 'Tab' });
  root.append(h('div.practice-cols', howTo, tab));

  put(howTo,
    h('div.panel-head', h('h2', 'How to practise it')),
    drill.body.map((x) => h('p', x)),
    h('ol.lesson-steps', drill.steps.map((x) => h('li', x))),
    drill.video ? h('div.drill-video',
      h('h3', 'In the video'),
      h('ul.chapters', drill.video.map((t) => {
        const c = VIDEO.chapters.find((x) => x.t === t);
        return h('li', h('a.ch-t', { href: videoAt(t), target: '_blank', rel: 'noopener' }, clock(t)), h('span.ch-body', h('strong', c.title), h('span.muted', c.note)));
      })),
      h('p.fine', VIDEO.title, ' · ', VIDEO.channel)) : null);

  let tabToken = 0;
  async function renderTab() {
    const my = ++tabToken;
    const sec = song.sections.drill;
    const v = sec.parts.demo[0];
    clear(tab).append(h('div.panel-head', h('h2', 'Tab'), h('p.muted', `${sec.bars} bar${sec.bars > 1 ? 's' : ''}, looping`)));
    const fig = h('figure.drill-sheet');
    tab.append(fig);
    if (v.type === 'notes') {
      try {
        await renderNotation(fig, {
          events: v.events, length: sec.length, time: song.time, keySig: keySignature(song.keyRoot, song.scale),
          flats: flats(), instrument: 'guitar', changes: chordless ? [] : sec.changes, maxBars: 12,
        });
      } catch (e) {
        if (my === tabToken) fig.append(h('p.notation-error', `Couldn’t draw the tab: ${e.message}`));
      }
      if (my !== tabToken) fig.remove();
    } else {
      fig.append(variationDetail(v, { section: sec, song: song.song }));
    }
  }

  // ---------------------------------------------------------------- live
  const onStep = (e) => {
    const before = live.step;
    live.step = e.detail.step;
    if (barAt(before) !== barAt(live.step) || changeAt(before) !== changeAt(live.step) || before < 0) {
      renderNeck();
      renderReadout();
    }
  };
  const onEvent = (e) => {
    const { partId, ev } = e.detail;
    if (partId !== 'demo') return;
    for (const n of ev.notes ?? (ev.string ? [ev] : [])) {
      if (n.string) fretboard.ping(n.string, n.fret, roleOf(fretMidi(n.string, n.fret), refNow()));
    }
  };
  player.addEventListener('step', onStep);
  player.addEventListener('event', onEvent);

  function renderAll() {
    renderReadout();
    renderNeck();
    renderControls();
    renderRun();
    renderTab();
  }
  renderAll();

  return {
    update(st, patch) {
      if ('drill' in patch) {
        b = app.drill;
        song = app.song;
        if (!player.playing) live.step = -1;
        renderAll();
        return;
      }
      if ('fb' in patch) { renderNeck(); renderControls(); }
      if ('mutes' in patch || 'move' in patch) renderRun();
      if ('drillLoop' in patch) {
        const el = runPanel.querySelector('.loop-count');
        if (el) el.textContent = loopText();
      }
      if ('playing' in patch && !st.playing) {
        live.step = -1;
        renderNeck();
        renderReadout();
      }
    },
    destroy() {
      player.removeEventListener('step', onStep);
      player.removeEventListener('event', onEvent);
      tabToken++;
    },
  };
}

