// Hardware controls → Woodshed. A MIDI keyboard's knobs, faders, pads and
// transport each get a job here, and its keys can sound through the
// band's speakers. The other way, Woodshed can hand a part of the band to
// the keyboard's own sound engine, send it a clock, and send it a patch.
//
// What a control sends comes from its device profile (js/devices.js), or
// from Learn, which records it off the unit. What it does is decided here,
// by rank: the first knob that sends anything sets the tempo, the second
// the section, and so on, so a keyboard with four live knobs (the SMK-37
// under +VA) gets the four that matter most. A lab can claim the knobs
// and keys while it's open (claim()).

import { midiIn } from './midi-in.js';
import { loadPrefs, savePrefs } from './store.js';
import { profileFor, signature, matches, LEARNABLE } from './devices.js';
import { dx7Voice } from './dx7.js';

const DEFAULTS = { sound: 'auto', voice: 'auto', padMode: 'auto', learned: {}, sendPart: null, clockOut: false, liveVol: 0.85 };

const KNOB_ACTIONS = ['tempo', 'section', 'layer', 'position', 'strings', 'liveVol', 'bandVol', 'labels'];
const LAYERS = [['chord', 'Chord tones'], ['triads', 'Triads'], ['scale', 'Scale'], ['shape', 'Part']];
const STRINGS = [['all', 'All strings'], ['123', 'Strings 1–3'], ['234', 'Strings 2–4'], ['345', 'Strings 3–5'], ['456', 'Strings 4–6']];
// Drums mode: the bottom row is the kit, the top row the extras.
export const PAD_DRUMS = { p9: 'kick', p10: 'snare', p11: 'hat', p12: 'open', p13: 'clap', p14: 'rim', p15: 'tom', p16: 'crash', p1: 'ride', p2: 'shaker' };
const DRUM_NAMES = { kick: 'Kick', snare: 'Snare', hat: 'Hi-hat', open: 'Open hat', clap: 'Clap', rim: 'Rim', tom: 'Tom', crash: 'Crash', ride: 'Ride', shaker: 'Shaker' };
// General MIDI drum notes, for a drum part sent to a keyboard.
const GM_DRUMS = { kick: 36, snare: 38, rim: 37, hat: 42, open: 46, ride: 51, crash: 49, tom: 45, clap: 39, shaker: 70 };

export function createController(app) {
  const { store, engine, player } = app;
  const prefs = { ...DEFAULTS, ...(loadPrefs().controller ?? {}) };
  const events = new EventTarget();
  const claims = [];
  const steps = new Map(); // control -> last step index, so a stepped knob acts once per step
  const context = { drums: false };
  let learning = null;
  let lastInput = null;
  let hinted = false;

  // ------------------------------------------------------------ device

  function deviceName() {
    const inputs = midiIn.inputs();
    if (midiIn.selected !== 'all') return inputs.find((i) => i.id === midiIn.selected)?.name ?? null;
    if (lastInput && inputs.some((i) => i.name === lastInput)) return lastInput;
    return inputs[0]?.name ?? null;
  }

  function bindings(profile = ctl.profile) {
    const learned = prefs.learned[profile.id] ?? {};
    const out = { ...profile.bindings };
    for (const [k, v] of Object.entries(learned)) {
      if (v) out[k] = v;
      else delete out[k];
    }
    return out;
  }

  function controlFor(profile, sig) {
    for (const [control, b] of Object.entries(bindings(profile))) if (matches(b, sig)) return control;
    return null;
  }

  function output() {
    const name = deviceName();
    const input = midiIn.inputs().find((i) => i.name === name);
    return input ? midiIn.outputFor(input) : null;
  }

  function save() {
    savePrefs({ ...loadPrefs(), controller: prefs });
  }

  const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

  // ------------------------------------------------------------ actions

  const st = () => store.state;
  const song = () => app.song;
  const setFb = (patch) => store.set({ fb: { ...st().fb, ...patch } });
  const isKeys = () => st().fb.instrument === 'keys';
  const lesson = () => song()?.lessons.find((l) => l.id === st().lessonId) ?? null;

  function stepped(control, v, list, apply) {
    const i = Math.min(list.length - 1, Math.floor(v * list.length));
    if (steps.get(control) !== i) {
      steps.set(control, i);
      apply(list[i], i);
    }
    return i;
  }

  function goSection(sid) {
    store.set({ sectionId: sid });
    if (player.playing && st().loopMode === 'song') player.jumpTo(song().arrangement.indexOf(sid));
  }

  const KNOB = {
    tempo: {
      label: 'Tempo', short: 'Tempo',
      apply: (c, v) => store.set({ tempo: Math.round(40 + v * 180) }),
      text: () => `${st().tempo} bpm`,
    },
    section: {
      label: 'Section', short: 'Section',
      apply: (c, v) => stepped(c, v, song().order, (sid) => goSection(sid)),
      text: () => song().sections[st().sectionId]?.name ?? '',
    },
    layer: {
      label: 'Neck shows', short: 'Neck',
      apply: (c, v) => stepped(c, v, LAYERS.filter(([id]) => !(isKeys() && id === 'triads')), ([layer]) => setFb({ layer })),
      text: () => LAYERS.find(([id]) => id === st().fb.layer)?.[1] ?? '',
    },
    position: {
      label: 'Scale position', short: 'Position',
      apply: (c, v) => stepped(c, v, [0, 1, 2, 3, 4, 5], (position) => setFb({ layer: 'scale', position })),
      text: () => (st().fb.position ? `Position ${st().fb.position}` : 'Whole neck'),
    },
    strings: {
      label: 'Triad strings', short: 'Strings',
      apply: (c, v) => stepped(c, v, STRINGS, ([triadSet]) => setFb({ layer: 'triads', triadSet })),
      text: () => STRINGS.find(([id]) => id === st().fb.triadSet)?.[1] ?? '',
    },
    liveVol: {
      label: 'My sound', short: 'My level',
      apply: (c, v) => { prefs.liveVol = v; engine.setBusVolume('_live', v); saveSoon(); },
      text: () => `${Math.round(prefs.liveVol * 100)}%`,
    },
    bandVol: {
      label: 'Band level', short: 'Band',
      apply: (c, v) => { if (engine.master) engine.master.gain.setTargetAtTime(v, engine.now, 0.02); ctl.bandLevel = v; },
      text: () => `${Math.round((ctl.bandLevel ?? 0.9) * 100)}%`,
    },
    labels: {
      label: 'Labels', short: 'Labels',
      apply: (c, v) => stepped(c, v, ['notes', 'intervals'], (labels) => setFb({ labels })),
      text: () => (st().fb.labels === 'intervals' ? 'Intervals' : 'Note names'),
    },
  };

  let saveTimer = null;
  function saveSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }

  const ranked = (prefix, n) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`).filter((c) => bindings()[c]);

  function padMode() {
    if (prefs.padMode !== 'auto') return prefs.padMode;
    if (context.drums) return 'drums';
    return lesson()?.instrument === 'drums' && st().view === 'practice' ? 'drums' : 'mix';
  }

  function drumPart() {
    return song()?.parts.find((p) => p.instrument === 'drums')?.id ?? 'drums';
  }

  /** What a control does right now: { label, text(), apply(v, ev) } or null. */
  function actionFor(control) {
    if (!song()) return null;
    const claim = claims.at(-1);
    if (/^k\d$/.test(control)) {
      const rank = ranked('k', 8).indexOf(control);
      if (claim?.knobs) {
        const item = claim.knobs[rank];
        return item ? { label: item.label, short: item.short ?? item.label, text: () => item.text?.() ?? '', apply: (v) => item.set(v), owner: claim.owner } : null;
      }
      const a = KNOB[KNOB_ACTIONS[rank]];
      return a ? { label: a.label, short: a.short, text: a.text, apply: (v) => a.apply(control, v) } : null;
    }
    if (/^f\d$/.test(control)) {
      const part = song().parts[ranked('f', 8).indexOf(control)];
      if (!part) return null;
      return {
        label: `${part.name} level`,
        short: part.name,
        text: () => `${Math.round((st().volumes[part.id] ?? part.volume) * 100)}%`,
        apply: (v) => store.set({ volumes: { ...st().volumes, [part.id]: v } }),
      };
    }
    if (/^p\d+$/.test(control)) {
      const n = Number(control.slice(1));
      if (padMode() === 'drums') {
        const lane = PAD_DRUMS[control];
        if (!lane) return null;
        return {
          label: DRUM_NAMES[lane], drum: lane, text: () => '',
          apply: (v, ev) => {
            if (!engine.ready) { needSound(); return; }
            engine.drum(lane, engine.now + 0.005, Math.max(0.25, v), engine.bus(drumPart()));
            emit('drum', { lane, vel: v, time: ev?.time ?? performance.now() });
          },
        };
      }
      if (n <= 8) {
        const sid = song().order[n - 1];
        if (!sid) return null;
        return { label: song().sections[sid].name, text: () => 'loop this section', apply: () => goSection(sid) };
      }
      const part = song().parts[n - 9];
      if (!part) return null;
      return {
        label: part.name,
        text: () => (st().mutes[part.id] ? 'muted: your turn' : 'playing'),
        apply: () => store.set({ mutes: { ...st().mutes, [part.id]: !st().mutes[part.id] } }),
      };
    }
    if (control === 'seqplay' || control === 'seqcont') {
      return { label: 'Play', text: () => '', apply: () => { if (!player.playing) app.togglePlay(); } };
    }
    if (control === 'seqstop') return { label: 'Stop', text: () => '', apply: () => { if (player.playing) app.togglePlay(); } };
    if (control === 'seqrec') {
      return {
        label: 'Record a pass', text: () => '',
        apply: () => {
          if (st().view !== 'capture') app.navigate(st().songId, 'capture');
          else emit('rec');
        },
      };
    }
    return null;
  }

  function fire(control, ev) {
    const a = actionFor(control);
    const v = ev.type === 'cc' ? ev.value / 127 : ev.vel ?? 1;
    emit('touch', { control, value: v });
    if (!a) {
      emit('hud', { control, label: 'Not used here', text: '' });
      return;
    }
    a.apply(v, ev);
    emit('hud', { control, label: a.label, text: a.text(), owner: a.owner });
  }

  // ------------------------------------------------------------ keys

  function soundFrom() {
    if (prefs.sound !== 'auto') return prefs.sound;
    return ctl.profile.engine?.notes ? 'keyboard' : 'woodshed';
  }

  function voice() {
    if (prefs.voice !== 'auto') return prefs.voice;
    if (lesson()?.instrument === 'synth') return 'synth';
    return isKeys() ? 'keys' : 'guitar';
  }

  function needSound() {
    if (hinted) return;
    hinted = true;
    emit('hud', { control: null, label: 'Tap the screen once', text: 'so the browser lets Woodshed make sound' });
  }

  function playNote(ev) {
    const claim = claims.findLast((c) => c.notes);
    if (claim) {
      if (ev.type === 'on') claim.notes.on(ev.note, ev.vel);
      else claim.notes.off(ev.note);
      return;
    }
    if (soundFrom() !== 'woodshed') return;
    if (!engine.ready) { if (ev.type === 'on') needSound(); return; }
    if (ev.type === 'off') { engine.liveOff(ev.note); return; }
    let v = voice();
    if (v === 'synth' && !engine.live?.fm) {
      engine.liveSynth().catch((e) => console.warn('FM voice failed to load', e));
      v = 'keys';
    }
    engine.setBusVolume('_live', prefs.liveVol);
    engine.liveOn(ev.note, ev.vel, v);
  }

  function wheel(kind, value) {
    const claim = claims.findLast((c) => c[kind]);
    if (claim) { claim[kind](value); return; }
    if (soundFrom() !== 'woodshed' || !engine.ready) return;
    if (kind === 'bend') engine.liveBend(value);
    else if (kind === 'mod') engine.liveMod(value);
    else engine.liveSustain(value);
  }

  // ------------------------------------------------------------ learn

  function learnable(ev) {
    return ev.type === 'on' || ev.type === 'cc' || ev.type === 'start' || ev.type === 'stop' || ev.type === 'continue';
  }

  function learnStep(ev) {
    const sig = signature(ev);
    if (!sig || learning.taken.has(sig) || performance.now() - learning.at < 300) return;
    const control = learning.queue[0];
    const pid = learning.profileId;
    const learned = (prefs.learned[pid] ??= {});
    // one message, one control: whatever had it before lets it go
    for (const [c, b] of Object.entries(bindings(ctl.profile))) if (c !== control && matches(b, sig)) learned[c] = null;
    learned[control] = sig;
    learning.taken.add(sig);
    learning.at = performance.now();
    learning.queue.shift();
    save();
    emit('touch', { control, value: 1 });
    emit('learn', { ...ctl.learning, bound: { control, sig } });
    if (!learning.queue.length) { learning = null; emit('learn', null); }
  }

  // ------------------------------------------------------------ input

  function filter(ev) {
    lastInput = ev.input;
    const profile = profileFor(ev.input);
    if (learning && learnable(ev)) {
      if (profile.id === learning.profileId) learnStep(ev);
      return true;
    }
    if (ev.type === 'clock') return true;
    if (ev.type === 'bend') { wheel('bend', ev.value * 2); return true; }
    const sig = signature(ev);
    const control = sig && controlFor(profile, sig);
    if (control) {
      if (ev.type !== 'off') fire(control, ev);
      return true;
    }
    if (ev.type === 'cc') {
      if (ev.cc === 1) wheel('mod', ev.value / 127);
      else if (ev.cc === 64) wheel('sustain', ev.value >= 64);
      else if (ev.cc === 123 || ev.cc === 120) engine.liveAllOff?.();
      return true;
    }
    if (ev.type === 'on' || ev.type === 'off') {
      playNote(ev);
      return false; // the keys go on to the neck and Capture
    }
    return true;
  }

  // ------------------------------------------------------------ out

  /** Audio-clock time to the performance.now() time it is heard at. */
  function perfAt(t) {
    const ts = engine.ctx?.getOutputTimestamp?.();
    if (ts?.performanceTime) return ts.performanceTime + (t - ts.contextTime) * 1000;
    return performance.now() + (t - engine.now) * 1000;
  }

  function send(bytes, t) {
    const out = output();
    if (!out) return;
    try {
      out.send(bytes, t === undefined ? undefined : Math.max(performance.now(), perfAt(t)));
    } catch (e) {
      console.warn('MIDI send failed', e);
    }
  }

  function sendNote(midi, vel, t, dur, ch) {
    const c = ch - 1;
    send([0x90 | c, midi, Math.max(1, Math.round(vel * 127))], t);
    send([0x80 | c, midi, 0], t + Math.max(0.03, dur * 0.95));
  }

  const sentNotes = new Set();
  player.external = (partId) => !!prefs.sendPart && prefs.sendPart === partId && !!output();
  player.tap = (e) => {
    if (!output()) return;
    const ch = ctl.profile.engine?.channel ?? 1;
    if (e.kind === 'start' && prefs.clockOut) send([0xfa], e.time - 0.001);
    if (e.kind === 'step' && prefs.clockOut) for (let i = 0; i < 6; i++) send([0xf8], e.time + (e.dur * i) / 6);
    if (e.kind === 'stop') {
      if (prefs.clockOut) send([0xfc]);
      for (const c of sentNotes) send([0xb0 | (c - 1), 123, 0]);
      sentNotes.clear();
    }
    if (e.kind === 'note' && e.part.id === prefs.sendPart) {
      const { ev } = e;
      const chan = e.part.instrument === 'drums' ? 10 : ch;
      sentNotes.add(chan);
      if (ev.kind === 'drum') sendNote(GM_DRUMS[ev.drum] ?? 38, ev.vel, e.time, 0.05, chan);
      else for (const n of ev.notes ?? [ev]) if (n.midi) sendNote(n.midi, ev.vel ?? 0.8, e.time + (ev.notes ? ev.notes.indexOf(n) * 0.01 : 0), e.dur, chan);
    }
  };

  // ------------------------------------------------------------ the object

  const ctl = {
    prefs,
    context,
    bandLevel: null,

    get profile() {
      return profileFor(deviceName());
    },
    get deviceName() {
      return deviceName();
    },
    get connected() {
      return midiIn.enabled && midiIn.inputs().length > 0;
    },
    get learning() {
      return learning ? { control: learning.queue[0], left: learning.queue.length, profileId: learning.profileId } : null;
    },

    bindings: () => bindings(),
    actionFor,
    padMode,
    soundFrom,
    voice,
    output,

    on(type, fn) {
      const h = (e) => fn(e.detail);
      events.addEventListener(type, h);
      return () => events.removeEventListener(type, h);
    },

    set(patch) {
      Object.assign(prefs, patch);
      save();
      if ('liveVol' in patch && engine.ready) engine.setBusVolume('_live', prefs.liveVol);
      if ('sound' in patch || 'voice' in patch) engine.liveAllOff?.();
      if ('voice' in patch && prefs.voice === 'synth' && engine.ready) engine.liveSynth().catch(() => {});
      emit('change', patch);
    },

    setContext(patch) {
      Object.assign(context, patch);
      emit('change', {});
    },

    /** Walk the controls (or just these), recording what each sends. */
    learn(controls = ctl.profile.learn ?? LEARNABLE) {
      learning = { queue: [...controls], profileId: ctl.profile.id, taken: new Set(), at: 0 };
      emit('learn', ctl.learning);
    },
    skipLearn() {
      if (!learning) return;
      learning.queue.shift();
      if (!learning.queue.length) learning = null;
      emit('learn', ctl.learning);
    },
    stopLearn() {
      learning = null;
      emit('learn', null);
    },
    forget(control) {
      (prefs.learned[ctl.profile.id] ??= {})[control] = null;
      save();
      emit('change', {});
    },
    resetLearned() {
      delete prefs.learned[ctl.profile.id];
      save();
      emit('change', {});
    },

    /**
     * A lab takes the knobs and keys while it's open:
     * { owner, knobs: [{ label, value(), set(v01), text() }], notes: { on, off }, bend, mod }.
     * Returns release().
     */
    claim(spec) {
      claims.push(spec);
      emit('change', {});
      return () => {
        const i = claims.indexOf(spec);
        if (i >= 0) claims.splice(i, 1);
        emit('change', {});
      };
    },
    get claimedBy() {
      return claims.at(-1)?.owner ?? null;
    },

    canSendPatch() {
      return !!output() && !!ctl.profile.engine?.dx7;
    },
    async sendFmPatch(patch) {
      if (!ctl.canSendPatch()) throw new Error('Connect the SMK-37 over USB to send it a patch.');
      await midiIn.enable({ sysex: true }).catch(() => {
        throw new Error('Chrome needs permission for SysEx to send a patch: allow it and try again.');
      });
      const out = output();
      out.send(dx7Voice(patch));
      return out.name;
    },
    /** Play a test note on the keyboard's own engine. */
    ping(midi = 60) {
      const ch = ctl.profile.engine?.channel ?? 1;
      send([0x90 | (ch - 1), midi, 100]);
      setTimeout(() => send([0x80 | (ch - 1), midi, 0]), 400);
    },
  };

  midiIn.filter = filter;
  return ctl;
}
