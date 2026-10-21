// Practice view: live fretboard, arrangement strip, parts mixer, lessons.

import { h, clear, put, segmented } from '../dom.js';
import { Fretboard } from '../fretboard.js';
import { Piano } from '../piano.js';
import {
  parseChord, mod12, intervalRole, INTERVALS, pcName, prefersFlats, SCALES, scalePcs,
  scalePositions, triadShapes, parseShape, defaultVoicing, fretMidi, TUNING, placeOnNeck,
} from '../theory.js';
import { variationDetail, markStep, clearSteps } from '../parts-ui.js';

const LAYERS = [
  { value: 'chord', label: 'Chord tones' },
  { value: 'triads', label: 'Triads' },
  { value: 'scale', label: 'Scale' },
  { value: 'shape', label: 'Part' },
];

const ROLE_LEGEND = [
  ['root', 'Root'], ['third', '3rd'], ['fifth', '5th'], ['seventh', '7th'], ['color', 'Other'],
];

export function mountPractice(root, app) {
  const { store, player, engine, midiIn } = app;
  const song = app.song;
  const flats = prefersFlats(song.keyRoot, song.scale);

  const hero = h('section.song-hero');
  const neck = h('section.neck', { 'aria-label': 'Fretboard' });
  const arrangement = h('section.arrangement', { 'aria-label': 'Arrangement' });
  const parts = h('section.parts', { 'aria-label': 'Parts' });
  const lessons = h('section.lessons', { 'aria-label': 'Lessons' });
  root.append(hero, neck, arrangement, h('div.practice-cols', parts, lessons));

  // ---------------------------------------------------------------- live state
  const live = { chord: null, step: -1, sectionId: null, arrIndex: -1 };

  function firstChord(sectionId) {
    return song.sections[sectionId].changes[0].symbol;
  }

  function chordAt(sectionId, step) {
    const sec = song.sections[sectionId];
    let sym = sec.changes[0].symbol;
    for (const c of sec.changes) if (c.t <= step) sym = c.symbol;
    return sym;
  }

  function nextChord(sectionId, step) {
    const sec = song.sections[sectionId];
    const after = sec.changes.find((c) => c.t > step);
    return (after ?? sec.changes[0]).symbol;
  }

  // ---------------------------------------------------------------- hero
  function renderHero() {
    clear(hero);
    const raw = song.song;
    const scaleName = SCALES[song.scale]?.name ?? song.scale;
    hero.append(
      h('div.hero-text',
        h('h1', song.title),
        h('p.byline', raw.artist ?? ''),
        h('p.facts',
          h('span', `Key of ${pcName(song.keyRoot, flats)} ${scaleName.toLowerCase()}`),
          h('span', song.time.meter),
          h('span', `${song.tempo} bpm${raw.tempoNote ? ` (${raw.tempoNote})` : ''}`)),
        raw.summary ? h('p.summary', raw.summary) : null),
      h('div.hero-side',
        raw.skills?.length ? h('ul.skills', { 'aria-label': 'What you\'ll practise' }, raw.skills.map((sk) => h('li', sk))) : null,
        app.isDraft() ? h('div.draft-actions',
          h('p.muted', app.isEdited() ? 'You\'ve changed this song in this browser.' : 'This song lives in this browser only.'),
          h('button.btn', { type: 'button', onclick: app.downloadSong }, 'Download song file'),
          h('button.btn.btn-quiet', { type: 'button', onclick: () => { if (confirm('Discard your changes to this song?')) app.revertSong(); } }, app.isEdited() ? 'Discard changes' : 'Delete draft')) : null),
    );
    if (raw.notes) hero.append(h('p.fine', raw.notes));
  }

  // ---------------------------------------------------------------- fretboard
  const readout = h('div.readout', { 'aria-live': 'polite' });
  const fbHolder = h('div.fb-holder');
  const pnHolder = h('div.pn-holder');
  const fbScroll = h('div.fb-scroll', fbHolder);
  const pnScroll = h('div.fb-scroll.pn-scroll', pnHolder);
  const controls = h('div.fb-controls');
  neck.append(h('div.neck-top', readout, h('div.legend', ROLE_LEGEND.map(([r, l]) => h('span', h('i', { class: `sw role-${r}` }), l)))), fbScroll, pnScroll, controls);
  const keysParts = song.parts.filter((p) => p.instrument === 'keys');
  const isKeys = () => store.state.fb.instrument === 'keys';

  const fretboard = new Fretboard(fbHolder, {
    frets: 15,
    onTap: async ({ string, fret }) => {
      await engine.init();
      const midi = fretMidi(string, fret);
      engine.audition([{ midi, string }]);
      const chord = parseChord(live.chord);
      fretboard.ping(string, fret, intervalRole(midi - chord.root));
    },
  });

  const piano = new Piano(pnHolder, {
    onTap: async (midi) => {
      await engine.init();
      engine.audition([{ midi }], 'keys');
      piano.ping(midi, intervalRole(midi - parseChord(live.chord).root));
    },
  });

  function keysPartId() {
    const want = store.state.fb.keysPart;
    return keysParts.find((p) => p.id === want)?.id ?? keysParts[0]?.id ?? null;
  }

  function renderPiano() {
    const st = store.state;
    const fb = st.fb;
    const chord = parseChord(live.chord);
    const marks = [];
    const layer = fb.layer === 'triads' ? 'chord' : fb.layer;
    if (layer === 'chord') {
      for (let m = piano.lo; m <= piano.hi; m++) {
        const iv = mod12(m - chord.root);
        if (chord.intervals.some((x) => mod12(x) === iv)) marks.push({ midi: m, role: intervalRole(iv), label: label(m, chord.root) });
      }
    } else if (layer === 'scale') {
      const pcs = scalePcs(song.keyRoot, fb.scale ?? song.scale);
      for (let m = piano.lo; m <= piano.hi; m++) {
        if (!pcs.includes(mod12(m))) continue;
        marks.push({ midi: m, role: intervalRole(m - song.keyRoot), label: label(m, song.keyRoot), faint: !chord.pcs.includes(mod12(m)) });
      }
    } else {
      const pid = keysPartId();
      const v = pid ? player.variationFor(live.sectionId ?? st.sectionId, pid) : null;
      const sec = song.sections[live.sectionId ?? st.sectionId];
      const change = [...sec.changes].reverse().find((c) => c.t <= Math.max(0, live.step)) ?? sec.changes[0];
      const next = sec.changes.find((c) => c.t > change.t)?.t ?? sec.length;
      const seen = new Map();
      for (const ev of v?.events ?? []) {
        if (ev.kind !== 'note' || ev.t < change.t || ev.t >= next) continue;
        const hand = ev.hand ?? (ev.midi < 52 ? 'L' : 'R');
        if (!seen.has(ev.midi)) seen.set(ev.midi, hand);
      }
      for (const [m, hand] of seen) marks.push({ midi: m, role: intervalRole(m - chord.root), label: label(m, chord.root), hand });
    }
    piano.render(marks);
  }

  function renderNeck() {
    const keys = isKeys();
    fbScroll.hidden = keys;
    pnScroll.hidden = !keys;
    if (keys) renderPiano();
    else renderFretboard();
  }

  function label(midi, ref) {
    return store.state.fb.labels === 'intervals' ? INTERVALS[mod12(midi - ref)] : pcName(midi, flats);
  }

  function focusVariation() {
    const pid = store.state.fb.part;
    if (!pid) return null;
    return player.variationFor(live.sectionId ?? store.state.sectionId, pid);
  }

  function voicingNow(v, sym) {
    if (v) {
      const ev = v.events.find((e) => e.chord === sym && e.frets);
      if (ev) return ev.frets;
      const shape = v.voicings?.[sym] ?? song.song.voicings?.[sym];
      if (shape) return parseShape(shape);
    }
    const shape = song.song.voicings?.[sym];
    return shape ? parseShape(shape) : defaultVoicing(sym);
  }

  function renderReadout() {
    const st = store.state;
    const sid = live.sectionId ?? st.sectionId;
    const chord = parseChord(live.chord);
    const nxt = nextChord(sid, Math.max(0, live.step));
    put(clear(readout), 
      h('div.now-chord', chord.symbol),
      h('div.now-meta',
        h('span.tones', chord.pcs.map((pc, i) => h('span', { class: `role-${intervalRole(chord.intervals[i])}` }, pcName(pc, flats)))),
        nxt !== chord.symbol ? h('span.next', `then ${nxt}`) : null),
    );
  }

  function renderFretboard() {
    const st = store.state;
    const fb = st.fb;
    const chord = parseChord(live.chord);
    const dots = [];
    const shapes = [];
    let band = null;
    let muted = [];
    if (fb.layer === 'chord') {
      for (let str = 1; str <= 6; str++) {
        for (let f = 0; f <= 15; f++) {
          const m = fretMidi(str, f);
          const iv = mod12(m - chord.root);
          if (chord.intervals.some((x) => mod12(x) === iv)) dots.push({ string: str, fret: f, role: intervalRole(iv), label: label(m, chord.root) });
        }
      }
    } else if (fb.layer === 'triads') {
      const all = triadShapes(chord).filter((t) => fb.triadSet === 'all' || t.set === fb.triadSet);
      const seen = new Set();
      for (const t of all) {
        shapes.push({ points: t.strings.map((str, i) => ({ string: str, fret: t.frets[i] })), role: t.inversion === 'root' ? 'root' : t.inversion === 'first' ? 'third' : 'fifth' });
        t.strings.forEach((str, i) => {
          const key = `${str}:${t.frets[i]}`;
          if (seen.has(key)) return;
          seen.add(key);
          const m = fretMidi(str, t.frets[i]);
          dots.push({ string: str, fret: t.frets[i], role: intervalRole(m - chord.root), label: label(m, chord.root) });
        });
      }
    } else if (fb.layer === 'scale') {
      const scale = fb.scale ?? song.scale;
      const pcs = scalePcs(song.keyRoot, scale);
      const positions = scalePositions(song.keyRoot, scale);
      const pos = fb.position ? positions[fb.position - 1] : null;
      const inPos = new Set(pos ? pos.notes.map((n) => `${n.string}:${n.fret}`) : []);
      if (pos) band = [pos.lo, pos.hi];
      for (let str = 1; str <= 6; str++) {
        for (let f = 0; f <= 15; f++) {
          const m = fretMidi(str, f);
          if (!pcs.includes(mod12(m))) continue;
          dots.push({
            string: str, fret: f,
            role: intervalRole(m - song.keyRoot),
            label: label(m, song.keyRoot),
            faint: pos ? !inPos.has(`${str}:${f}`) : false,
            ring: chord.pcs.includes(mod12(m)),
          });
        }
      }
    } else if (fb.layer === 'shape') {
      const v = focusVariation();
      if (v && (v.type === 'notes' || v.type === 'degrees')) {
        const seen = new Set();
        for (const ev of v.events) {
          if (!ev.string) continue;
          const key = `${ev.string}:${ev.fret}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const m = fretMidi(ev.string, ev.fret);
          dots.push({ string: ev.string, fret: ev.fret, role: intervalRole(m - song.keyRoot), label: label(m, song.keyRoot), ring: chord.pcs.includes(mod12(m)) });
        }
      } else {
        const frets = voicingNow(v, chord.symbol);
        frets.forEach((f, i) => {
          if (f === null || f === undefined) { muted.push(i + 1); return; }
          const m = fretMidi(i + 1, f);
          dots.push({ string: i + 1, fret: f, role: intervalRole(m - chord.root), label: label(m, chord.root) });
        });
        const fretted = frets.filter((f) => f !== null && f > 0);
        if (fretted.length) band = [Math.min(...fretted), Math.max(...fretted)];
      }
    }
    fretboard.render({ dots, shapes, band, muted });
  }

  function renderControls() {
    const st = store.state;
    const fb = st.fb;
    const setFb = (patch) => store.set({ fb: { ...store.state.fb, ...patch } });
    const guitarParts = song.parts.filter((p) => p.instrument === 'guitar');
    const extra = [];
    if (fb.layer === 'triads') {
      extra.push(h('div.ctl', h('span.ctl-label', 'Strings'),
        segmented('Strings', [
          { value: 'all', label: 'All' }, { value: '123', label: '1–3' }, { value: '234', label: '2–4' },
          { value: '345', label: '3–5' }, { value: '456', label: '4–6' },
        ], fb.triadSet, (v) => setFb({ triadSet: v }), { small: true })));
    }
    if (fb.layer === 'scale') {
      extra.push(h('div.ctl', h('span.ctl-label', 'Scale'),
        h('select', { 'aria-label': 'Scale', onchange: (e) => setFb({ scale: e.target.value }) },
          Object.entries(SCALES).map(([id, sc]) => h('option', { value: id, selected: id === (fb.scale ?? song.scale) }, `${pcName(song.keyRoot, flats)} ${sc.name.toLowerCase()}`)))));
      extra.push(h('div.ctl', h('span.ctl-label', 'Position'),
        segmented('Position', [{ value: 0, label: 'All' }, ...[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))],
          fb.position, (v) => setFb({ position: v }), { small: true })));
    }
    if (fb.layer === 'shape' && guitarParts.length > 1) {
      extra.push(h('div.ctl', h('span.ctl-label', 'Follow'),
        segmented('Follow part', guitarParts.map((p) => ({ value: p.id, label: p.name })), fb.part, (v) => setFb({ part: v }), { small: true })));
    }
    const layers = isKeys() ? LAYERS.filter((l) => l.value !== 'triads') : LAYERS;
    const layerValue = isKeys() && fb.layer === 'triads' ? 'chord' : fb.layer;
    if (isKeys()) extra.length = 0;
    if (isKeys() && fb.layer === 'scale') {
      extra.push(h('div.ctl', h('span.ctl-label', 'Scale'),
        h('select', { 'aria-label': 'Scale', onchange: (e) => setFb({ scale: e.target.value }) },
          Object.entries(SCALES).map(([id, sc]) => h('option', { value: id, selected: id === (fb.scale ?? song.scale) }, `${pcName(song.keyRoot, flats)} ${sc.name.toLowerCase()}`)))));
    }
    if (isKeys() && fb.layer === 'shape' && keysParts.length > 1) {
      extra.push(h('div.ctl', h('span.ctl-label', 'Follow'),
        segmented('Follow part', keysParts.map((p) => ({ value: p.id, label: p.name })), keysPartId(), (v) => setFb({ keysPart: v }), { small: true })));
    }
    put(clear(controls), 
      keysParts.length ? h('div.ctl', segmented('Instrument', [{ value: 'guitar', label: 'Guitar' }, { value: 'keys', label: 'Keys' }], fb.instrument ?? 'guitar', (v) => store.set({ fb: { ...store.state.fb, instrument: v }, ...(song.lessons.some((l) => l.instrument === v) ? { lessonFilter: v } : {}) }))) : null,
      h('div.ctl', segmented('Layer', layers, layerValue, (v) => setFb({ layer: v }))),
      ...extra,
      h('div.ctl.ctl-end', segmented('Labels', [{ value: 'notes', label: 'Notes' }, { value: 'intervals', label: 'Intervals' }], fb.labels, (v) => setFb({ labels: v }), { small: true })),
    );
  }

  // ---------------------------------------------------------------- arrangement
  function renderArrangement() {
    const st = store.state;
    clear(arrangement);
    const strip = h('div.arr-strip');
    song.arrangement.forEach((sid, idx) => {
      const sec = song.sections[sid];
      const active = st.sectionId === sid;
      const block = h('button.arr-block', {
        type: 'button',
        class: active ? 'active' : '',
        style: { flexGrow: sec.bars },
        dataset: { idx, sid },
        'aria-pressed': String(active),
        onclick: () => {
          store.set({ sectionId: sid });
          if (player.playing && store.state.loopMode === 'song') player.jumpTo(idx);
        },
      },
      h('span.arr-name', sec.name),
      h('span.arr-bars', sec.chart.map((bar, bi) => h('span.arr-bar', { dataset: { bar: bi } }, bar.map((c) => c.symbol).join(' ')))));
      strip.append(block);
    });
    arrangement.append(h('div.arr-head', h('h2', 'Arrangement'), h('p.muted', 'Tap a section to loop it.')), h('div.arr-scroll', strip));
  }

  function markArrangement(sid, arrIndex, step) {
    const bar = Math.floor(step / song.time.stepsPerBar);
    arrangement.querySelectorAll('.arr-bar.now').forEach((el) => el.classList.remove('now'));
    const st = store.state;
    let block;
    if (st.loopMode === 'song') block = arrangement.querySelector(`.arr-block[data-idx="${arrIndex}"]`);
    else block = arrangement.querySelector(`.arr-block[data-sid="${sid}"]`);
    block?.querySelector(`.arr-bar[data-bar="${bar}"]`)?.classList.add('now');
    if (st.loopMode === 'song') {
      arrangement.querySelectorAll('.arr-block').forEach((b) => b.classList.toggle('playing', b === block));
    }
  }

  // ---------------------------------------------------------------- parts
  function renderParts() {
    const st = store.state;
    const sec = song.sections[st.sectionId];
    put(clear(parts), h('div.panel-head', h('h2', 'Parts'), h('p.muted', `${sec.name}: pick a variation, mute a part to play it yourself.`)));
    for (const part of song.parts) {
      const list = sec.parts[part.id] ?? [];
      const current = player.variationFor(sec.id, part.id);
      const muted = !!st.mutes[part.id];
      const soloed = st.solo === part.id;
      const setSel = (vid) => {
        const selection = structuredClone(store.state.selection);
        (selection[sec.id] ??= {})[part.id] = vid;
        store.set({ selection });
      };
      const row = h('article.part', { class: `${muted ? 'muted' : ''} ${st.solo && !soloed ? 'dimmed' : ''}`, dataset: { part: part.id } },
        h('header.part-head',
          h('h3', part.name),
          h('span.inst', part.instrument),
          h('div.part-btns',
            h('button.mini', { type: 'button', 'aria-pressed': String(muted), class: muted ? 'on' : '', title: muted ? 'Unmute' : 'Mute and play it yourself', onclick: () => store.set({ mutes: { ...store.state.mutes, [part.id]: !muted } }) }, 'Mute'),
            h('button.mini', { type: 'button', 'aria-pressed': String(soloed), class: soloed ? 'on' : '', onclick: () => store.set({ solo: soloed ? null : part.id }) }, 'Solo'),
            h('input.vol', {
              type: 'range', min: 0, max: 1, step: 0.01, value: st.volumes[part.id] ?? part.volume, 'aria-label': `${part.name} volume`,
              oninput: (e) => { const v = Number(e.target.value); store.state.volumes[part.id] = v; engine.setBusVolume(part.id, v); },
            }))),
        list.length
          ? h('div.pills', { role: 'radiogroup', 'aria-label': `${part.name} variation` },
            list.map((v) => h('button.pill', {
              type: 'button', role: 'radio', 'aria-checked': String(current?.id === v.id), class: current?.id === v.id ? 'on' : '',
              onclick: () => setSel(v.id),
            }, v.name)),
            h('button.pill.pill-off', { type: 'button', role: 'radio', 'aria-checked': String(!current), class: !current ? 'on' : '', onclick: () => setSel('off') }, 'Off'))
          : h('p.muted.tacet', 'Doesn\'t play in this section.'),
        current ? h('div.part-detail', variationDetail(current, { section: sec, song: song.song })) : null);
      parts.append(row);
    }
  }

  // ---------------------------------------------------------------- lessons
  function renderLessons() {
    const st = store.state;
    clear(lessons);
    if (!song.lessons.length) {
      lessons.append(h('div.panel-head', h('h2', 'Lessons')), h('p.muted', 'No lessons for this song yet. Add some to the song file\'s "lessons" list.'));
      return;
    }
    const instruments = [...new Set(song.lessons.map((l) => l.instrument ?? 'guitar'))];
    const filter = instruments.includes(st.lessonFilter) ? st.lessonFilter : instruments[0];
    lessons.append(h('div.panel-head', h('h2', 'Lessons'), h('p.muted', 'Work through them in order. Each one sets up the loop for you.')));
    if (instruments.length > 1) {
      lessons.append(h('div.lesson-filter', segmented('Lesson track', instruments.map((i) => ({ value: i, label: i.charAt(0).toUpperCase() + i.slice(1) })), filter, (v) => store.set({ lessonFilter: v }), { small: true })));
    }
    const ol = h('ol.lesson-list');
    song.lessons.filter((l) => (l.instrument ?? 'guitar') === filter).forEach((l, i) => {
      const open = st.lessonId === l.id;
      ol.append(h('li.lesson', { class: open ? 'open' : '' },
        h('button.lesson-title', { type: 'button', 'aria-expanded': String(open), onclick: () => store.set({ lessonId: open ? null : l.id }) },
          h('span.lesson-n', String(i + 1)),
          h('span.lesson-t', l.title),
          h('span.lesson-goal', l.goal ?? '')),
        open ? h('div.lesson-body',
          (l.body ?? []).map((p) => h('p', p)),
          l.steps?.length ? h('ol.lesson-steps', l.steps.map((s) => h('li', s))) : null,
          h('div.lesson-actions',
            h('button.btn', { type: 'button', onclick: () => app.applyLesson(l) }, 'Set up this exercise'),
            h('button.btn.btn-quiet', { type: 'button', onclick: async () => { app.applyLesson(l); if (!player.playing) await app.togglePlay(); } }, 'Set up and play'))) : null));
    });
    lessons.append(ol);
  }

  // ---------------------------------------------------------------- live events
  const onStep = (e) => {
    const { sectionId, step, arrIndex } = e.detail;
    const sym = chordAt(sectionId, step);
    const sectionChanged = sectionId !== live.sectionId;
    live.step = step;
    live.arrIndex = arrIndex;
    if (sectionChanged) {
      live.sectionId = sectionId;
      if (store.state.loopMode === 'song' && sectionId !== store.state.sectionId) {
        // follow the song: show this section's parts
        store.set({ sectionId });
      }
    }
    if (sym !== live.chord || sectionChanged) {
      live.chord = sym;
      renderReadout();
      renderNeck();
    } else if (step % song.time.stepsPerBar === 0) {
      renderReadout();
    }
    markArrangement(sectionId, arrIndex, step);
    markStep(parts, step, song.sections[sectionId].length);
  };

  const onEvent = (e) => {
    const { partId, instrument, ev } = e.detail;
    const chord = parseChord(live.chord);
    if (isKeys()) {
      if (instrument === 'keys' && partId === keysPartId() && ev.midi) piano.ping(ev.midi, intervalRole(ev.midi - chord.root));
      return;
    }
    if (instrument !== 'guitar' || partId !== store.state.fb.part) return;
    const notes = ev.notes ?? (ev.string ? [ev] : []);
    for (const n of notes) {
      if (n.string) fretboard.ping(n.string, n.fret, intervalRole(fretMidi(n.string, n.fret) - chord.root));
    }
  };

  const onMidi = (m) => {
    if (m.type !== 'on') return;
    const st = store.state;
    if (isKeys()) { piano.ping(m.note, intervalRole(m.note - parseChord(live.chord).root)); return; }
    let win = { lo: 0, hi: 12 };
    if (st.fb.layer === 'scale' && st.fb.position) {
      const p = scalePositions(song.keyRoot, st.fb.scale ?? song.scale)[st.fb.position - 1];
      win = { lo: p.lo, hi: p.hi };
    }
    const spot = placeOnNeck(m.note, win);
    if (spot) fretboard.ping(spot.string, spot.fret, intervalRole(m.note - parseChord(live.chord).root));
  };

  player.addEventListener('step', onStep);
  player.addEventListener('event', onEvent);
  const offMidi = midiIn.on(onMidi);

  function resetLive() {
    const st = store.state;
    live.sectionId = st.sectionId;
    live.chord = firstChord(st.sectionId);
    live.step = -1;
  }

  resetLive();
  renderHero();
  renderReadout();
  renderNeck();
  renderControls();
  renderArrangement();
  renderParts();
  renderLessons();

  return {
    update(st, patch) {
      if ('sectionId' in patch) {
        if (!player.playing || st.loopMode === 'section') {
          if (!player.playing) resetLive();
          renderReadout();
          renderNeck();
        }
        renderArrangement();
        renderParts();
      }
      if ('fb' in patch) {
        renderControls();
        renderNeck();
      }
      if ('selection' in patch || 'mutes' in patch || 'solo' in patch) {
        if (!('sectionId' in patch)) renderParts();
        if (st.fb.layer === 'shape') renderNeck();
      }
      if ('lessonId' in patch || 'lessonFilter' in patch) renderLessons();
      if ('loopMode' in patch) renderArrangement();
      if ('playing' in patch && !st.playing) {
        resetLive();
        renderReadout();
        renderNeck();
        clearSteps(parts);
        arrangement.querySelectorAll('.now, .playing').forEach((el) => el.classList.remove('now', 'playing'));
      }
    },
    destroy() {
      player.removeEventListener('step', onStep);
      player.removeEventListener('event', onEvent);
      offMidi();
    },
  };
}

export { TUNING };
