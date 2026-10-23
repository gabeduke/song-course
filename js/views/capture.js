// Capture view: record or tap in a part over the loop, preview it as
// notation + tab, save it into the song, and start brand-new songs.

import { h, clear, put, segmented, toast, download } from '../dom.js';
import { Fretboard } from '../fretboard.js';
import {
  fretMidi, placeOnNeck, keySignature, prefersFlats, intervalRole, pcName, SHARPS, SCALES, parseChord,
} from '../theory.js';
import { renderNotation } from '../notation.js';
import { compileSong, slug, DRUM_LANES } from '../song.js';

const WINDOWS = [
  { value: '0-4', label: 'Open', lo: 0, hi: 4 },
  { value: '2-6', label: '2nd', lo: 2, hi: 6 },
  { value: '5-8', label: '5th', lo: 5, hi: 8 },
  { value: '7-10', label: '7th', lo: 7, hi: 10 },
  { value: '9-12', label: '9th', lo: 9, hi: 12 },
  { value: '12-15', label: '12th', lo: 12, hi: 15 },
];

const STEP_LENS = [
  { value: 1, label: '16th' }, { value: 2, label: '8th' }, { value: 4, label: 'Quarter' }, { value: 8, label: 'Half' },
];

export function mountCapture(root, app) {
  const { store, player, engine, midiIn } = app;
  const song = app.song;
  const flats = prefersFlats(song.keyRoot, song.scale);
  const notable = song.parts;
  const cap = {
    sectionId: store.state.sectionId,
    partId: notable.find((p) => p.id === 'lead')?.id ?? notable[0]?.id,
    drum: null,
    previewing: false,
    window: '5-8',
    quant: 2,
    stepLen: 2,
    stack: false,
    notes: [],
    cursor: 0,
    recording: false,
    armed: false,
    startTime: null,
    held: new Map(),
    name: '',
  };

  const intro = h('section.cap-intro');
  const setup = h('section.cap-setup');
  const neck = h('section.neck.cap-neck');
  const take = h('section.cap-take');
  const builder = h('section.cap-new');
  root.append(intro, setup, neck, take, builder);

  intro.append(h('h1', 'Capture'), h('p.lede',
    'Record a riff or melody over the loop with a MIDI keyboard, tap it in on the fretboard, or pick Drums and program a groove on the pads. Save it to the song and it becomes a variation you can loop, print and commit.'));

  const part = () => song.parts.find((p) => p.id === cap.partId);
  const sec = () => song.sections[cap.sectionId];
  const win = () => WINDOWS.find((w) => w.value === cap.window);

  // ---------------------------------------------------------------- setup
  function renderSetup() {
    const inputs = midiIn.inputs();
    const drums = part()?.instrument === 'drums';
    app.controller?.setContext({ drums });
    neck.hidden = drums;
    put(clear(setup), 
      h('div.cap-row',
        h('label.field', h('span', 'Section'),
          h('select', { onchange: (e) => { cap.sectionId = e.target.value; cap.cursor = 0; cap.drum = null; store.set({ sectionId: cap.sectionId }); renderTake(); } },
            song.order.map((sid) => h('option', { value: sid, selected: sid === cap.sectionId }, `${song.sections[sid].name} (${song.sections[sid].chart.map((b) => b.map((c) => c.symbol).join(' ')).join(' | ')})`)))),
        h('label.field', h('span', 'Part'),
          h('select', { onchange: (e) => { cap.partId = e.target.value; cap.drum = null; renderSetup(); renderTake(); } },
            notable.map((p) => h('option', { value: p.id, selected: p.id === cap.partId }, `${p.name} (${p.instrument})`)))),
        drums ? null : h('div.field', h('span', 'Hand position'), segmented('Hand position', WINDOWS, cap.window, (v) => { cap.window = v; renderSetup(); renderNeck(); }, { small: true }))),
      drums ? null : h('div.cap-row',
        h('div.cap-card',
          h('h2', 'Record from MIDI'),
          !midiIn.supported ? h('p.muted', 'This browser has no Web MIDI. Chrome on Android, Windows, Mac or Linux works.')
            : !midiIn.enabled ? h('button.btn', { type: 'button', onclick: connectMidi }, 'Connect MIDI keyboard')
              : h('div.cap-midi',
                h('label.field', h('span', 'Input'),
                  h('select', { onchange: (e) => midiIn.select(e.target.value) },
                    h('option', { value: 'all' }, inputs.length ? 'All inputs' : 'No devices yet: plug one in'),
                    inputs.map((i) => h('option', { value: i.id, selected: midiIn.selected === i.id }, i.name)))),
                h('div.field', h('span', 'Snap to'), segmented('Snap', [{ value: 1, label: '16th' }, { value: 2, label: '8th' }], cap.quant, (v) => { cap.quant = v; renderSetup(); }, { small: true })),
                h('button.btn.rec', { type: 'button', class: cap.recording || cap.armed ? 'on' : '', onclick: toggleRecord },
                  cap.recording ? 'Recording…' : cap.armed ? 'Count-in…' : 'Record one pass')),
          h('p.muted', 'With MIDI connected and not recording, each key you press is also entered at the cursor, like tapping the fretboard.')),
        h('div.cap-card',
          h('h2', 'Tap it in'),
          h('p.muted', 'Tap the fretboard below. Each note goes in at the cursor, then the cursor moves on.'),
          h('div.field', h('span', 'Note length'), segmented('Note length', STEP_LENS, cap.stepLen, (v) => { cap.stepLen = v; renderSetup(); }, { small: true })),
          h('div.cap-btns',
            h('button.toggle', { type: 'button', 'aria-pressed': String(cap.stack), class: cap.stack ? 'on' : '', onclick: () => { cap.stack = !cap.stack; renderSetup(); }, title: 'Keep the cursor still so notes stack into double stops or chords' }, 'Stack notes'),
            h('button.btn.btn-quiet', { type: 'button', onclick: () => { cap.cursor = (cap.cursor + cap.stepLen) % sec().length; renderTake(); } }, 'Rest'),
            h('button.btn.btn-quiet', { type: 'button', onclick: undo }, 'Undo'),
            h('button.btn.btn-quiet', { type: 'button', onclick: () => { cap.notes = []; cap.cursor = 0; renderTake(); } }, 'Clear')))),
    );
  }

  async function connectMidi() {
    try {
      await midiIn.enable();
      toast(`MIDI connected: ${midiIn.inputs().map((i) => i.name).join(', ') || 'no devices yet'}`);
    } catch (e) {
      toast(e.message);
    }
    renderSetup();
  }

  // ---------------------------------------------------------------- neck
  const fbHolder = h('div.fb-holder');
  neck.append(h('div.fb-scroll', fbHolder));
  const fretboard = new Fretboard(fbHolder, {
    frets: 15,
    label: 'Fretboard for entering notes',
    onTap: async ({ string, fret }) => {
      await engine.init();
      const midi = fretMidi(string, fret);
      engine.audition([{ midi, string }], part()?.instrument === 'keys' ? 'keys' : 'guitar');
      addNote({ midi, string, fret });
    },
  });

  function chordAt(t) {
    let sym = sec().changes[0].symbol;
    for (const c of sec().changes) if (c.t <= t) sym = c.symbol;
    return parseChord(sym);
  }

  function renderNeck() {
    const w = win();
    const chord = chordAt(cap.cursor);
    const dots = cap.notes.filter((n) => n.string).map((n) => ({
      string: n.string, fret: n.fret, role: intervalRole(n.midi - chord.root), label: pcName(n.midi, flats), faint: n.t !== lastT(),
    }));
    fretboard.render({ dots, band: [w.lo, w.hi], shapes: [] });
  }

  const lastT = () => (cap.notes.length ? cap.notes[cap.notes.length - 1].t : -1);

  function addNote({ midi, string, fret, t = cap.cursor, d = cap.stepLen }) {
    let spot = { string, fret };
    if (!string && part()?.instrument === 'guitar') spot = placeOnNeck(midi, win()) ?? {};
    cap.notes.push({ t, d, midi, string: spot.string, fret: spot.fret });
    if (!cap.stack) cap.cursor = (t + d) % sec().length;
    renderTake();
  }

  function undo() {
    const n = cap.notes.pop();
    if (n) cap.cursor = n.t;
    renderTake();
  }

  // ---------------------------------------------------------------- recording
  async function toggleRecord() {
    if (cap.recording || cap.armed) {
      finishTake();
      return;
    }
    store.set({ sectionId: cap.sectionId, loopMode: 'section', countIn: true });
    cap.armed = true;
    cap.held.clear();
    cap.raw = [];
    renderSetup();
    if (!player.playing) await app.togglePlay();
    else {
      player.stop();
      await app.togglePlay();
    }
  }

  const onStep = (e) => {
    const { step, time } = e.detail;
    cap.lastStep = { step, time };
    if (cap.armed && step === 0) {
      cap.armed = false;
      cap.recording = true;
      cap.startTime = time;
      renderSetup();
    } else if (cap.recording && step === 0 && time > cap.startTime + 0.1) {
      finishTake();
    }
    if (!cap.recording && !cap.armed) {
      const head = take.querySelector('.cap-head-pos');
      if (head) head.textContent = '';
    }
  };

  function midiToCtxTime(perfMs) {
    const ctx = engine.ctx;
    const ts = ctx.getOutputTimestamp?.();
    const lat = ctx.outputLatency || ctx.baseLatency || 0;
    if (ts && ts.performanceTime) return ts.contextTime + (perfMs - ts.performanceTime) / 1000 - lat;
    return ctx.currentTime - lat;
  }

  const onMidi = (m) => {
    if (cap.recording) {
      const t = midiToCtxTime(m.time);
      if (m.type === 'on') cap.held.set(m.note, { t, vel: m.vel });
      else {
        const on = cap.held.get(m.note);
        if (on) { cap.raw.push({ midi: m.note, on: on.t, off: t, vel: on.vel }); cap.held.delete(m.note); }
      }
    } else if (!cap.armed && m.type === 'on') {
      engine.ready && engine.audition([{ midi: m.note }], part()?.instrument === 'keys' ? 'keys' : 'guitar');
      addNote({ midi: m.note });
    }
  };

  function finishTake() {
    if (!cap.recording && !cap.armed) return;
    const wasRecording = cap.recording;
    cap.recording = false;
    cap.armed = false;
    player.stop();
    if (wasRecording) {
      const end = engine.now;
      for (const [note, on] of cap.held) cap.raw.push({ midi: note, on: on.t, off: end, vel: on.vel });
      cap.held.clear();
      const stepDur = 60 / store.state.tempo / song.time.stepsPerBeat;
      const q = cap.quant;
      const len = sec().length;
      const notes = [];
      for (const r of cap.raw) {
        const t = Math.round((r.on - cap.startTime) / stepDur / q) * q;
        if (t < 0 || t >= len) continue;
        const d = Math.max(q, Math.round((r.off - r.on) / stepDur / q) * q);
        const spot = part()?.instrument === 'guitar' ? placeOnNeck(r.midi, win()) ?? {} : {};
        notes.push({ t, d: Math.min(d, len - t), midi: r.midi, string: spot.string, fret: spot.fret });
      }
      notes.sort((a, b) => a.t - b.t || a.midi - b.midi);
      cap.notes = notes;
      cap.cursor = 0;
      toast(notes.length ? `Captured ${notes.length} notes` : 'No notes came in. Check the MIDI input.');
    }
    renderSetup();
    renderTake();
  }

  // ---------------------------------------------------------------- take
  function takeEvents() {
    return cap.notes.map((n) => ({ t: n.t, d: n.d, kind: 'note', midi: n.midi, string: n.string, fret: n.fret }));
  }

  let takeToken = 0;
  async function renderTake() {
    const my = ++takeToken;
    if (part()?.instrument === 'drums') { renderDrumEditor(); return; }
    stopPreview();
    renderNeck();
    clear(take);
    const s = sec();
    const p = part();
    take.append(h('div.panel-head',
      h('h2', 'Your take'),
      h('p.muted', `${cap.notes.length} notes · cursor at bar ${Math.floor(cap.cursor / song.time.stepsPerBar) + 1}, beat ${Math.floor((cap.cursor % song.time.stepsPerBar) / song.time.stepsPerBeat) + 1} · ${s.name}, ${p?.name}`)));
    const holder = h('div.cap-notation');
    take.append(holder);
    if (cap.notes.length) {
      await renderNotation(holder, {
        events: takeEvents(), length: s.length, time: song.time, keySig: keySignature(song.keyRoot, song.scale),
        flats, instrument: p?.instrument ?? 'guitar', changes: s.changes, maxBars: 16,
      });
      if (my !== takeToken) return;
    } else {
      holder.append(h('p.empty', 'Nothing yet. Tap the fretboard or record a pass to see notation and tab here.'));
    }
    take.append(h('div.cap-save',
      h('label.field', h('span', 'Name'),
        h('input', { type: 'text', value: cap.name, placeholder: 'e.g. My first fill', oninput: (e) => { cap.name = e.target.value; } })),
      h('button.btn', { type: 'button', disabled: !cap.notes.length, onclick: save }, 'Save to song'),
      h('button.btn.btn-quiet', { type: 'button', disabled: !cap.notes.length, onclick: copyJson }, 'Copy as JSON')));
  }

  function variationJson() {
    const p = part();
    const name = cap.name.trim() || `Take ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const notes = cap.notes.map((n) => (p.instrument === 'guitar' && n.string
      ? { t: n.t, s: n.string, f: n.fret, d: n.d }
      : { t: n.t, n: pcName(n.midi, flats) + (Math.floor(n.midi / 12) - 1), d: n.d }));
    return { id: slug(name), name, type: 'notes', length: sec().length, notes };
  }

  function save() {
    const raw = structuredClone(app.raw);
    const v = variationJson();
    const rs = raw.sections.find((x) => x.id === cap.sectionId);
    rs.parts ??= {};
    let list = rs.parts[cap.partId];
    // resolve borrowed lists so the new take only lands in this section
    if (typeof list === 'string') list = [list];
    if (!Array.isArray(list)) list = raw.defaults?.[cap.partId] ? structuredClone(raw.defaults[cap.partId]) : [];
    let id = v.id;
    let n = 2;
    const existing = (x) => list.some((y) => typeof y === 'object' && y.id === x);
    while (existing(id)) id = `${v.id}-${n++}`;
    v.id = id;
    list.push(v);
    rs.parts[cap.partId] = list;
    try {
      compileSong(raw);
    } catch (e) {
      toast(`Couldn't save: ${e.message}`);
      return;
    }
    const selection = structuredClone(store.state.selection);
    (selection[cap.sectionId] ??= {})[cap.partId] = v.id;
    app.saveRaw(raw);
    store.set({ selection });
    toast(`Saved "${v.name}". It's now playing in Practice for ${song.sections[cap.sectionId].name}.`);
  }

  async function copyJson() {
    const text = JSON.stringify(variationJson(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied the variation JSON');
    } catch {
      download(`${slug(cap.name || 'take')}.json`, text);
    }
  }

  // ---------------------------------------------------------------- drum editor
  const CYCLE = { '.': 'x', x: 'X', X: 'o', o: '.' };

  function drumFrom(v, bars) {
    const len = song.time.stepsPerBar * bars;
    const lanes = {};
    for (const lane of DRUM_LANES) {
      const pat = String(v?.pattern?.[lane] ?? '').replace(/[|\s]/g, '');
      lanes[lane] = Array.from({ length: len }, (_, i) => (pat.length ? pat[i % pat.length] : '.'));
    }
    return { bars, lanes, base: v?.id ?? null };
  }

  function drumVariation(id, name) {
    const pattern = {};
    for (const [lane, cells] of Object.entries(cap.drum.lanes)) {
      if (cells.some((c) => c !== '.')) {
        const bar = song.time.stepsPerBar;
        const chunks = [];
        for (let i = 0; i < cells.length; i += bar) chunks.push(cells.slice(i, i + bar).join(''));
        pattern[lane] = chunks.join(' | ');
      }
    }
    return { id, name, pattern };
  }

  function drumRaw(variation) {
    const raw = structuredClone(app.raw);
    const rs = raw.sections.find((x) => x.id === cap.sectionId);
    rs.parts ??= {};
    let list = rs.parts[cap.partId];
    if (typeof list === 'string') list = [list];
    if (!Array.isArray(list)) list = raw.defaults?.[cap.partId] ? structuredClone(raw.defaults[cap.partId]) : [];
    list = list.filter((x) => typeof x !== 'object' || x.id !== variation.id);
    list.unshift(variation);
    rs.parts[cap.partId] = list;
    return raw;
  }

  function preview() {
    if (!cap.previewing) return;
    try {
      const compiled = compileSong(drumRaw(drumVariation('_draft', 'Draft')));
      player.swapSong(compiled);
      const selection = structuredClone(store.state.selection);
      (selection[cap.sectionId] ??= {})[cap.partId] = '_draft';
      store.state.selection = selection;
    } catch (e) {
      toast(e.message);
    }
  }

  function stopPreview() {
    if (!cap.previewing && player.song === app.song) return;
    cap.previewing = false;
    player.swapSong(app.song);
    const sel = store.state.selection[cap.sectionId];
    if (sel?.[cap.partId] === '_draft') {
      const selection = structuredClone(store.state.selection);
      delete selection[cap.sectionId][cap.partId];
      store.state.selection = selection;
    }
  }

  function renderDrumEditor() {
    const s = sec();
    const list = s.parts[cap.partId] ?? [];
    if (!cap.drum) cap.drum = drumFrom(player.variationFor(s.id, cap.partId) ?? list[0], 1);
    const d = cap.drum;
    const per = song.time.stepsPerBar;
    const beat = song.time.stepsPerBeat;
    clear(take);
    take.append(h('div.panel-head',
      h('h2', `Drum pattern for ${s.name}`),
      h('p.muted', 'Tap a pad to cycle it: hit, accent, ghost, off. Start from an existing groove and change one lane at a time.')));
    take.append(h('div.cap-row.drum-tools',
      h('label.field', h('span', 'Start from'),
        h('select', { onchange: (e) => { cap.drum = drumFrom(list.find((v) => v.id === e.target.value), d.bars); renderDrumEditor(); preview(); } },
          h('option', { value: '' }, 'Empty'),
          list.map((v) => h('option', { value: v.id, selected: v.id === d.base }, v.name)))),
      h('div.field', h('span', 'Length'), segmented('Length', [{ value: 1, label: '1 bar' }, { value: 2, label: '2 bars' }], d.bars, (v) => {
        const len = per * v;
        for (const lane of DRUM_LANES) d.lanes[lane] = Array.from({ length: len }, (_, i) => d.lanes[lane][i % d.lanes[lane].length]);
        d.bars = v;
        renderDrumEditor();
        preview();
      }, { small: true })),
      h('button.toggle', {
        type: 'button', 'aria-pressed': String(cap.previewing), class: cap.previewing ? 'on' : '',
        onclick: async () => {
          cap.previewing = !cap.previewing;
          if (cap.previewing) {
            store.set({ sectionId: cap.sectionId, loopMode: 'section' });
            preview();
            if (!player.playing) await app.togglePlay();
          } else {
            stopPreview();
          }
          renderDrumEditor();
        },
      }, cap.previewing ? 'Hearing it in the loop' : 'Hear it in the loop')));
    const grid = h('div.drum-editor', { style: { '--n': per * d.bars } });
    for (const lane of DRUM_LANES) {
      const cells = d.lanes[lane];
      grid.append(h('div.de-row',
        h('span.lane', lane),
        h('div.de-cells', cells.map((c, i) => h('button.pad.de-pad', {
          type: 'button',
          'aria-label': `${lane} step ${i + 1}`,
          class: `${c === '.' ? '' : 'hit'} ${c === 'X' ? 'acc' : ''} ${c === 'o' ? 'ghost' : ''} ${i % beat === 0 ? 'beat' : ''} ${i % per === 0 ? 'bar' : ''}`,
          onclick: () => {
            cells[i] = CYCLE[cells[i]] ?? '.';
            if (cells[i] !== '.' && engine.ready) engine.drum(lane, engine.now + 0.01, cells[i] === 'X' ? 1 : cells[i] === 'o' ? 0.35 : 0.8, engine.bus(cap.partId));
            renderDrumEditor();
            preview();
          },
        })))));
    }
    take.append(grid);
    take.append(h('div.cap-save',
      h('label.field', h('span', 'Name'),
        h('input', { type: 'text', value: cap.name, placeholder: 'e.g. Busier hats', oninput: (e) => { cap.name = e.target.value; } })),
      h('button.btn', { type: 'button', onclick: saveDrums }, 'Save to song'),
      h('button.btn.btn-quiet', {
        type: 'button',
        onclick: async () => {
          const v = drumVariation(slug(cap.name || 'my-groove'), cap.name || 'My groove');
          try { await navigator.clipboard.writeText(JSON.stringify(v, null, 2)); toast('Copied the pattern JSON'); } catch { download(`${v.id}.json`, JSON.stringify(v, null, 2)); }
        },
      }, 'Copy as JSON')));
  }

  function saveDrums() {
    const name = cap.name.trim() || 'My groove';
    const list = sec().parts[cap.partId] ?? [];
    let id = slug(name);
    let n = 2;
    while (list.some((v) => v.id === id)) id = `${slug(name)}-${n++}`;
    const raw = drumRaw(drumVariation(id, name));
    // keep the new groove after the existing ones
    const rs = raw.sections.find((x) => x.id === cap.sectionId);
    rs.parts[cap.partId].push(rs.parts[cap.partId].shift());
    stopPreview();
    const selection = structuredClone(store.state.selection);
    (selection[cap.sectionId] ??= {})[cap.partId] = id;
    app.saveRaw(raw);
    store.set({ selection });
    toast(`Saved "${name}". It's selected for ${song.sections[cap.sectionId].name}.`);
  }

  // ---------------------------------------------------------------- new song
  function renderBuilder() {
    const f = { title: '', artist: '', key: 'G', scale: 'major', meter: '4/4', tempo: 100, sections: 'Verse: G | C | G | D\nChorus: C | G | D | G' };
    const form = h('form.new-song', {
      onsubmit: (e) => {
        e.preventDefault();
        createSong(f);
      },
    },
    h('div.cap-row',
      h('label.field', h('span', 'Title'), h('input', { type: 'text', required: true, placeholder: 'Untitled jam', oninput: (e) => { f.title = e.target.value; } })),
      h('label.field', h('span', 'Artist (optional)'), h('input', { type: 'text', oninput: (e) => { f.artist = e.target.value; } }))),
    h('div.cap-row',
      h('label.field', h('span', 'Key'), h('select', { onchange: (e) => { f.key = e.target.value; } }, SHARPS.map((n) => h('option', { value: n, selected: n === f.key }, n)))),
      h('label.field', h('span', 'Scale'), h('select', { onchange: (e) => { f.scale = e.target.value; } }, Object.entries(SCALES).map(([id, sc]) => h('option', { value: id, selected: id === f.scale }, sc.name)))),
      h('label.field', h('span', 'Meter'), h('select', { onchange: (e) => { f.meter = e.target.value; } }, ['4/4', '3/4', '6/8'].map((m) => h('option', { value: m }, m)))),
      h('label.field', h('span', 'Tempo'), h('input', { type: 'number', min: 40, max: 240, value: f.tempo, oninput: (e) => { f.tempo = Number(e.target.value) || 100; } }))),
    h('label.field.wide', h('span', 'Sections, one per line: Name: chords split into bars with |'),
      h('textarea', { rows: 4, oninput: (e) => { f.sections = e.target.value; } }, f.sections)),
    h('button.btn', { type: 'submit' }, 'Create song'));
    put(clear(builder), 
      h('details', h('summary', h('h2', 'Start a new song')),
        h('p.muted', 'Gives you drums, bass, rhythm guitar and keys to play over straight away. Capture your own parts on top, then download the file.'),
        form));
  }

  function createSong(f) {
    const title = f.title.trim() || 'Untitled jam';
    let id = slug(title);
    const taken = new Set(store.state.library.map((l) => l.id));
    let n = 2;
    while (taken.has(id)) id = `${slug(title)}-${n++}`;
    const presets = {
      '4/4': { drums: { hat: 'x.x.x.x.x.x.x.x.', kick: 'x.......x.x.....', snare: '....x.......x...' }, bass: 'R . . R 5 . . .', strum: 'D.DU.UDU', pad: { grid: '4', pattern: 'x---' } },
      '3/4': { drums: { hat: 'x.x.x.x.x.x.', kick: 'x...........', snare: '....x...x...' }, bass: 'R . 5 . 5 .', strum: 'D.DUDU', pad: { grid: '4', pattern: 'x--' } },
      '6/8': { drums: { shaker: 'x.x.x.x.x.x.', kick: 'x.....x.....', snare: '......x.....' }, bass: 'R - - 5 - -', strum: 'D.DUDU', pad: { grid: '8', pattern: 'x-----' } },
    }[f.meter];
    const sections = f.sections.split('\n').map((line) => line.trim()).filter(Boolean).map((line, i) => {
      const m = /^([^:]+):(.*)$/.exec(line);
      const name = m ? m[1].trim() : `Section ${i + 1}`;
      return { id: slug(name), name, chords: (m ? m[2] : line).trim() };
    });
    const raw = {
      format: 1,
      id,
      title,
      artist: f.artist.trim() || undefined,
      key: f.key,
      scale: f.scale,
      meter: f.meter,
      tempo: f.tempo,
      summary: 'A song of my own.',
      parts: [
        { id: 'drums', instrument: 'drums' },
        { id: 'bass', instrument: 'bass' },
        { id: 'rhythm', name: 'Rhythm guitar', instrument: 'guitar' },
        { id: 'lead', name: 'Lead guitar', instrument: 'guitar', start: 'off' },
        { id: 'keys', instrument: 'keys', volume: 0.55 },
      ],
      sections: sections.map((s) => ({ ...s, parts: {} })),
      defaults: {
        drums: [{ id: 'groove', name: 'Groove', pattern: presets.drums }],
        bass: [{ id: 'roots', name: 'Roots', steps: presets.bass }],
        rhythm: [{ id: 'strum', name: 'Strum', type: 'strum', pattern: presets.strum }],
        keys: [{ id: 'pad', name: 'Pad', type: 'comp', ...presets.pad }],
      },
      lessons: [],
    };
    try {
      compileSong(raw);
    } catch (e) {
      toast(`Check the chords: ${e.message}`);
      return;
    }
    app.saveRaw(raw, { select: false });
    app.navigate(id, 'practice');
    toast(`Created "${title}". It's saved in this browser until you download it.`);
  }

  player.addEventListener('step', onStep);
  const offMidi = midiIn.on(onMidi);
  const offChange = midiIn.onChange(renderSetup);
  // REC on the keyboard records a pass; its pads, in Drums, play into the
  // grid at the step you hit them, while the groove loops.
  const offRec = app.controller?.on('rec', () => { if (part()?.instrument !== 'drums') toggleRecord(); });
  const offDrum = app.controller?.on('drum', ({ lane, vel, time }) => {
    if (part()?.instrument !== 'drums' || !cap.drum || !player.playing || !cap.previewing || !cap.lastStep) return;
    const cells = cap.drum.lanes[lane];
    const n = Math.round((midiToCtxTime(time) - cap.lastStep.time) / player.stepDur());
    const i = (((cap.lastStep.step + n) % cells.length) + cells.length) % cells.length;
    cells[i] = vel > 0.85 ? 'X' : vel < 0.3 ? 'o' : 'x';
    renderDrumEditor();
    preview();
  });

  renderSetup();
  renderTake();
  renderBuilder();

  return {
    update(st, patch) {
      if ('playing' in patch && !st.playing && (cap.recording || cap.armed)) finishTake();
    },
    destroy() {
      stopPreview();
      player.removeEventListener('step', onStep);
      offMidi();
      offChange();
      offRec?.();
      offDrum?.();
      app.controller?.setContext({ drums: false });
      if (cap.recording || cap.armed) player.stop();
    },
  };
}
