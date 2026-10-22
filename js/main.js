// Woodshed — app shell: song library, routing, transport, view switching.

import { h, clear, put, download, toast, segmented } from './dom.js';
import { createStore, loadDrafts, saveDraft, deleteDraft, loadPrefs, savePrefs } from './store.js';
import { compileSong } from './song.js';
import { Engine } from './audio.js';
import { Player } from './player.js';
import { buildMidi } from './midi-file.js';
import { pcName, prefersFlats, SCALES } from './theory.js';
import { mountPractice } from './views/practice.js';
import { mountSheet } from './views/sheet.js';
import { mountCapture } from './views/capture.js';
import { midiIn } from './midi-in.js';

const prefs = loadPrefs();

const store = createStore({
  library: [],
  songId: null,
  view: 'practice',
  sectionId: null,
  loopMode: 'section',
  tempo: 100,
  countIn: prefs.countIn ?? true,
  click: prefs.click ?? false,
  mutes: {},
  solo: null,
  volumes: {},
  selection: {},
  fb: { layer: 'chord', scale: null, position: 0, labels: prefs.labels ?? 'notes', triadSet: 'all', part: null, instrument: 'guitar', keysPart: null },
  lessonId: null,
  lessonFilter: 'guitar',
  playing: false,
  error: null,
});

const engine = new Engine();
const player = new Player(engine, store);
const songs = new Map(); // id -> { raw, source: 'repo' | 'draft', repoRaw }
let compiled = null;
let songRev = 0;

const app = {
  store, engine, player, midiIn,
  get song() { return compiled; },
  get raw() { return songs.get(store.state.songId)?.raw; },
  isDraft: (id) => songs.get(id ?? store.state.songId)?.source === 'draft',
  isEdited: (id) => !!songs.get(id ?? store.state.songId)?.repoRaw && songs.get(id ?? store.state.songId)?.source === 'draft',
  navigate,
  applyLesson,
  saveRaw,
  revertSong,
  downloadSong,
  exportMidi,
  togglePlay,
};

// ------------------------------------------------------------------ library

async function loadLibrary() {
  try {
    const idx = await (await fetch('songs/index.json', { cache: 'no-cache' })).json();
    const results = await Promise.allSettled(idx.songs.map(async (file) => {
      const raw = await (await fetch(`songs/${file}`, { cache: 'no-cache' })).json();
      return raw;
    }));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') songs.set(r.value.id, { raw: r.value, source: 'repo' });
      else console.warn(`Couldn't load ${idx.songs[i]}`, r.reason);
    });
  } catch (e) {
    console.warn('Song index failed to load', e);
  }
  for (const [id, raw] of Object.entries(loadDrafts())) {
    const repo = songs.get(id);
    songs.set(id, { raw, source: 'draft', repoRaw: repo?.raw });
  }
  refreshLibrary();
}

function refreshLibrary() {
  store.set({
    library: [...songs.values()].map(({ raw, source, repoRaw }) => ({
      id: raw.id, title: raw.title, artist: raw.artist, source, edited: !!repoRaw,
    })),
  });
}

function saveRaw(raw, { select = true } = {}) {
  compileSong(raw); // throws if invalid
  const existing = songs.get(raw.id);
  songs.set(raw.id, { raw, source: 'draft', repoRaw: existing?.repoRaw ?? (existing?.source === 'repo' ? existing.raw : undefined) });
  const ok = saveDraft(raw);
  refreshLibrary();
  if (select) openSong(raw.id, { keepState: raw.id === store.state.songId });
  if (!ok) toast('Saved for this session only — this browser blocked storage');
}

function revertSong() {
  const id = store.state.songId;
  const entry = songs.get(id);
  if (!entry) return;
  deleteDraft(id);
  if (entry.repoRaw) songs.set(id, { raw: entry.repoRaw, source: 'repo' });
  else songs.delete(id);
  refreshLibrary();
  // Back to the repo's file: open it again here, as navigating to the same
  // address wouldn't reload it.
  if (songs.has(id)) openSong(id);
  else navigate([...songs.keys()][0], store.state.view);
}

function downloadSong() {
  const raw = app.raw;
  if (!raw) return;
  download(`${raw.id}.json`, `${JSON.stringify(raw, null, 2)}\n`);
  toast(`Downloaded ${raw.id}.json — add it to songs/ and songs/index.json`);
}

function exportMidi() {
  const st = store.state;
  if (!compiled) return;
  const ids = st.loopMode === 'section' ? [st.sectionId, st.sectionId] : compiled.arrangement;
  const bytes = buildMidi(compiled, ids, (sid, pid) => player.variationFor(sid, pid), st.tempo);
  const name = st.loopMode === 'section' ? `${compiled.id}-${st.sectionId}` : compiled.id;
  download(`${name}.mid`, new Blob([bytes], { type: 'audio/midi' }));
  toast(`Downloaded ${name}.mid`);
}

// ------------------------------------------------------------------ songs

function openSong(id, { keepState = false } = {}) {
  const entry = songs.get(id);
  if (!entry) return false;
  try {
    compiled = compileSong(entry.raw);
    songRev++;
  } catch (e) {
    store.set({ songId: id, error: `This song file has a problem: ${e.message}` });
    compiled = null;
    return true;
  }
  player.setSong(compiled);
  const st = store.state;
  const sameSong = keepState && st.songId === id;
  store.set({
    songId: id,
    error: null,
    sectionId: sameSong && compiled.sections[st.sectionId] ? st.sectionId : compiled.order[0],
    tempo: sameSong ? st.tempo : compiled.tempo,
    mutes: sameSong ? st.mutes : {},
    solo: sameSong ? st.solo : null,
    selection: sameSong ? st.selection : {},
    lessonId: sameSong ? st.lessonId : null,
    playing: false,
    fb: {
      ...st.fb,
      scale: sameSong ? st.fb.scale : compiled.scale,
      position: sameSong ? st.fb.position : 0,
      part: compiled.parts.find((p) => p.id === 'rhythm' && p.instrument === 'guitar')?.id
        ?? compiled.parts.find((p) => p.instrument === 'guitar')?.id ?? null,
    },
  });
  document.title = `${compiled.title} · Woodshed`;
  return true;
}

function applyLesson(lesson) {
  const st = store.state;
  const setup = lesson.setup ?? {};
  const selection = structuredClone(st.selection);
  for (const [pid, vid] of Object.entries(setup.select ?? {})) {
    for (const sid of compiled.order) {
      const has = vid === 'off' || compiled.sections[sid].parts[pid]?.some((v) => v.id === vid);
      if (has) (selection[sid] ??= {})[pid] = vid;
    }
  }
  const mutes = {};
  for (const pid of setup.mute ?? []) mutes[pid] = true;
  store.set({
    lessonId: lesson.id,
    sectionId: setup.section ?? st.sectionId,
    loopMode: 'section',
    tempo: setup.tempo ?? st.tempo,
    selection,
    mutes,
    solo: setup.solo ?? null,
    lessonFilter: lesson.instrument ?? 'guitar',
    fb: {
      ...st.fb,
      position: 0,
      layer: 'chord',
      instrument: ['keys', 'synth'].includes(lesson.instrument) ? 'keys' : 'guitar',
      ...(setup.fretboard ?? {}),
      scale: setup.fretboard?.scale ?? compiled.scale,
    },
  });
}

async function togglePlay() {
  if (!compiled) return;
  if (player.playing) {
    player.stop();
  } else {
    try {
      await player.start();
    } catch (e) {
      toast(`Audio couldn't start: ${e.message}`);
    }
  }
}

player.addEventListener('state', (e) => store.set({ playing: e.detail.playing }));

// ------------------------------------------------------------------ routing

function parseHash() {
  const [, id, view] = /^#\/([^/]+)(?:\/(\w+))?/.exec(location.hash) ?? [];
  return { id: id && decodeURIComponent(id), view: ['practice', 'sheet', 'capture'].includes(view) ? view : 'practice' };
}

function navigate(id, view = store.state.view) {
  const target = `#/${encodeURIComponent(id)}/${view}`;
  if (location.hash !== target) location.hash = target;
  else route();
}

function route() {
  const { id, view } = parseHash();
  const fallback = songs.has('fire-on-the-mountain') ? 'fire-on-the-mountain' : [...songs.keys()][0];
  const songId = songs.has(id) ? id : fallback;
  if (!songId) {
    store.set({ error: 'No songs found. Add a song file to songs/ and list it in songs/index.json.' });
    renderShell();
    return;
  }
  if (songId !== store.state.songId) {
    player.stop();
    openSong(songId);
  }
  if (view !== store.state.view) store.set({ view });
  renderShell();
}

// ------------------------------------------------------------------ shell

const root = document.getElementById('app');
let mounted = null;
let mountedKey = '';

function renderShell() {
  const st = store.state;
  const key = `${st.songId}|${st.view}|${st.error ?? ''}|${songRev}`;
  renderHeader();
  renderTransport();
  if (key === mountedKey && mounted) return;
  mounted?.destroy?.();
  mountedKey = key;
  const main = clear(document.getElementById('view'));
  if (st.error) {
    main.append(h('div.error-card', h('h2', 'Something needs fixing'), h('p', st.error),
      app.isDraft() ? h('button.btn', { onclick: revertSong }, 'Discard my changes to this song') : null));
    mounted = null;
    return;
  }
  if (!compiled) return;
  const mount = { practice: mountPractice, sheet: mountSheet, capture: mountCapture }[st.view];
  mounted = mount(main, app);
}

function renderHeader() {
  const st = store.state;
  const header = clear(document.getElementById('top'));
  const select = h('select.song-select', {
    'aria-label': 'Song',
    onchange: (e) => navigate(e.target.value, st.view),
  }, st.library.map((s) => h('option', { value: s.id, selected: s.id === st.songId },
    `${s.title}${s.source === 'draft' ? (s.edited ? ' (edited)' : ' (draft)') : ''}`)));
  const tabs = h('nav.tabs', { 'aria-label': 'View' },
    [['practice', 'Practice'], ['sheet', 'Sheet'], ['capture', 'Capture']].map(([v, label]) =>
      h('a', { href: `#/${encodeURIComponent(st.songId ?? '')}/${v}`, class: v === st.view ? 'on' : '', 'aria-current': v === st.view ? 'page' : undefined }, label)));
  header.append(
    h('a.wordmark', { href: '#', title: 'Woodshed' }, h('span.wm-mark', { 'aria-hidden': 'true' }), 'Woodshed'),
    select,
    tabs,
  );
}

function renderTransport() {
  const st = store.state;
  const bar = clear(document.getElementById('transport'));
  if (!compiled) return;
  const sec = compiled.sections[st.sectionId];
  const tempoInput = h('input', {
    type: 'range', min: 40, max: 220, value: st.tempo, 'aria-label': 'Tempo',
    oninput: (e) => store.set({ tempo: Number(e.target.value) }),
  });
  const nudge = (d) => store.set({ tempo: Math.max(40, Math.min(220, store.state.tempo + d)) });
  const tempoUnit = compiled.song.tempoNote ? ` ${compiled.song.tempoNote}` : '';
  bar.append(
    h('button.play', {
      type: 'button',
      'aria-label': st.playing ? 'Stop' : 'Play',
      class: st.playing ? 'on' : '',
      onclick: togglePlay,
    }, h('span.play-icon', { 'aria-hidden': 'true' })),
    h('div.t-where',
      h('span.t-sec', st.loopMode === 'section' ? sec?.name ?? '' : 'Whole song'),
      h('span.t-count#t-count', st.playing ? '' : `${sec?.bars ?? 0} bars`)),
    h('div.t-tempo',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Slower', onclick: () => nudge(-4) }, '−'),
      h('label.t-bpm', h('strong', String(st.tempo)), h('span', `bpm${tempoUnit}`)),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Faster', onclick: () => nudge(4) }, '+'),
      tempoInput,
      compiled.song.originalTempo ? h('button.link-btn', {
        type: 'button', title: 'Set the record tempo',
        onclick: () => store.set({ tempo: compiled.song.originalTempo }),
      }, `Record: ${compiled.song.originalTempo}`) : null),
    h('div.t-opts',
      segmented('Loop', [{ value: 'section', label: 'Loop section' }, { value: 'song', label: 'Whole song' }], st.loopMode, (v) => store.set({ loopMode: v }), { small: true }),
      toggle('Count-in', st.countIn, (v) => { store.set({ countIn: v }); savePrefs({ ...loadPrefs(), countIn: v }); }),
      toggle('Click', st.click, (v) => { store.set({ click: v }); savePrefs({ ...loadPrefs(), click: v }); }),
      h('button.btn.btn-quiet', { type: 'button', onclick: exportMidi, title: 'Download the backing as a MIDI file for your MPC or DAW' }, 'Export MIDI')),
  );
}

// The tempo changes in place: rebuilding the transport would swap the
// slider out from under a drag.
function syncTempo(tempo) {
  const bar = document.getElementById('transport');
  const input = bar.querySelector('input[aria-label="Tempo"]');
  if (input && Number(input.value) !== tempo) input.value = tempo;
  const bpm = bar.querySelector('.t-bpm strong');
  if (bpm) bpm.textContent = String(tempo);
}

function toggle(label, on, onChange) {
  return h('button.toggle', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', onclick: () => onChange(!on) }, label);
}

// keep the transport readout live
player.addEventListener('step', (e) => {
  const el = document.getElementById('t-count');
  if (!el || !compiled) return;
  const { step, sectionId } = e.detail;
  const sec = compiled.sections[sectionId];
  const bar = Math.floor(step / compiled.time.stepsPerBar) + 1;
  const beat = Math.floor((step % compiled.time.stepsPerBar) / compiled.time.stepsPerBeat) + 1;
  el.textContent = `${store.state.loopMode === 'song' ? `${sec.name} · ` : ''}bar ${bar}/${sec.bars} · ${beat}`;
});
player.addEventListener('count', (e) => {
  const el = document.getElementById('t-count');
  if (el) el.textContent = `Count-in ${e.detail.n}`;
});

let lastShellKeys = '';
store.on((st, patch) => {
  if ('tempo' in patch && player.playing) { /* read live by the scheduler */ }
  if ('volumes' in patch) for (const [k, v] of Object.entries(patch.volumes)) engine.setBusVolume(k, v);
  const shellKeys = JSON.stringify([st.songId, st.view, st.library.length, st.library.map((l) => l.source).join()]);
  if (shellKeys !== lastShellKeys) { lastShellKeys = shellKeys; renderHeader(); }
  if (['playing', 'loopMode', 'countIn', 'click', 'sectionId', 'songId'].some((k) => k in patch)) renderTransport();
  else if ('tempo' in patch) syncTempo(st.tempo);
  if (['songId', 'view', 'error'].some((k) => k in patch)) renderShell();
  mounted?.update?.(st, patch);
  if ('fb' in patch && patch.fb.labels) savePrefs({ ...loadPrefs(), labels: patch.fb.labels });
});

// keyboard: space toggles play when not typing. A control keeps Space for
// itself only when it was reached from the keyboard (Tab); one that was
// clicked would take every Space as another click (Export MIDI again).
// Chrome counts any focus as keyboard focus once a key is down, so the
// control a pointer last focused is remembered instead.
const CONTROLS = 'button, input, summary, [role=button]';
let clicked = null;
document.addEventListener('pointerdown', (e) => {
  clicked = e.target.closest?.('label')?.control ?? e.target.closest?.(CONTROLS) ?? null;
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') clicked = null;
  if (e.code !== 'Space' || e.repeat) return;
  const el = document.activeElement;
  if (el?.matches('input:not([type=range], [type=checkbox], [type=radio]), textarea, select, [contenteditable]')) return;
  if (el?.matches(CONTROLS) && el !== clicked) return;
  e.preventDefault();
  togglePlay();
});

window.addEventListener('hashchange', route);

(async function boot() {
  await loadLibrary();
  route();
})();

export { app, pcName, prefersFlats, SCALES };
