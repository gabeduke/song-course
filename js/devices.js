// What a MIDI keyboard's controls send, by device. The SMK-37 Elite's
// panel is drawn from these (js/views/keyboard.js); the controller
// (js/controller.js) reads the bindings to know a knob from a key.
//
// A binding is a message signature: 'cc:<ch>:<n>', 'note:<ch>:<n>' or
// 'rt:start|stop|continue', with channels from 1 and '*' for any.
// Anything here can be re-learned on the unit (Keyboard → Learn).
//
// Sources: docs/hardware/smk-37-elite.md.

// The SMK-37 Elite's panel, in a 1000 × 400 drawing, left to right as on
// the unit. `does` is what the control does on the keyboard itself under
// SMK-37+VA, shown when it sends Woodshed nothing.
export const PANEL = (() => {
  const c = [];
  c.push({ id: 'bend', kind: 'wheel', label: 'PITCH', x: 30, y: 52, w: 28, h: 92, does: 'Pitch bend' });
  c.push({ id: 'mod', kind: 'wheel', label: 'MOD', x: 76, y: 52, w: 28, h: 92, does: 'Mod wheel' });
  const bank = [['knobbank', 'KNOB BANK', 'Knob banks'], ['faderbank', 'FADER BANK', 'Fader banks'], ['back', '<', 'Back'], ['enter', '>', 'Enter'], ['octdown', 'OCT −', 'Octave down'], ['octup', 'OCT +', 'Octave up']];
  bank.forEach(([id, label, does], i) => c.push({ id, kind: 'button', label, x: 140 + (i % 2) * 40, y: 118 + Math.floor(i / 2) * 18, w: 36, h: 14, does }));
  const knobDoes = ['Select', 'Adjust', 'Preset', 'Volume', 'Knob 5', 'Knob 6', 'Knob 7', 'Knob 8'];
  for (let i = 0; i < 8; i++) c.push({ id: `k${i + 1}`, kind: 'knob', label: `K${i + 1}`, cx: 274 + i * 60, cy: 44, r: 17, does: knobDoes[i] });
  for (let i = 0; i < 16; i++) {
    const row = Math.floor(i / 8);
    c.push({ id: `p${i + 1}`, kind: 'pad', label: '', x: 252 + (i % 8) * 60, y: 78 + row * 44, w: 46, h: 36, does: 'Step / note' });
  }
  for (let i = 0; i < 4; i++) c.push({ id: `f${i + 1}`, kind: 'fader', label: `F${i + 1}`, cx: 772 + i * 60, y: 26, h: 86, does: 'Mixer' });
  const btns = [
    ['arp', 'ARP', 'Arpeggiator'], ['repeat', 'NOTE REPEAT', 'Envelope'], ['scale', 'SCALE', 'LFO'], ['chord', 'CHORD', 'Auto-chord'], ['globe', 'GLOBE', 'Settings'], ['bt', 'BT', 'Bluetooth'],
    ['patch', 'PATCH', 'Save'], ['para', 'PARA', 'Parameters'], ['fx', 'FX', 'Effects'], ['seq', 'SEQ', 'Pattern'], ['seqplay', 'SEQ PLAY', 'Play pattern'], ['seqrec', 'SEQ REC', 'Record pattern'],
  ];
  btns.forEach(([id, label, does], i) => c.push({ id, kind: 'button', label, x: 742 + (i % 6) * 41, y: 132 + Math.floor(i / 6) * 22, w: 37, h: 17, does }));
  return c;
})();

// MPC-style pads: two blocks of four by two, bottom-left first. Pads are
// numbered on the panel top row first (p1–p8), then the bottom (p9–p16).
const MPC_PADS = [40, 41, 42, 43, 48, 49, 50, 51, 36, 37, 38, 39, 44, 45, 46, 47];
const padNotes = (ch, notes) => Object.fromEntries(notes.map((n, i) => [`p${i + 1}`, `note:${ch}:${n}`]));

export const PROFILES = [
  {
    id: 'smk-37-va',
    name: 'SMK-37+VA',
    about: 'M-VAVE SMK-37 Elite on Baud Girl’s SMK-37+VA firmware',
    match: /\+VA/i,
    panel: true,
    // Under +VA the keys play the keyboard's own engine, and only these
    // send MIDI: K5–K8 and the faders on the MIDI CC bank, SEQ PLAY's
    // Start and Stop with Clock Out on, and the pads on their Notes bank
    // (which notes isn't documented: learn them).
    bindings: {
      k5: 'cc:*:74', k6: 'cc:*:71', k7: 'cc:*:73', k8: 'cc:*:72',
      f1: 'cc:*:7', f2: 'cc:*:10', f3: 'cc:*:91', f4: 'cc:*:93',
      seqplay: 'rt:start', seqcont: 'rt:continue', seqstop: 'rt:stop',
    },
    // It plays notes it's sent, on its MIDI Channel (All), and takes DX7
    // patches over USB. Channel 2 is its FX channel: keep CCs off it.
    engine: { notes: true, channel: 1, dx7: true, clock: true },
    // the rest are known: Learn walks the pads
    learn: Array.from({ length: 16 }, (_, i) => `p${i + 1}`),
    setup: [
      ['Faders', 'FADER BANK, turn K1 to MIDI CC, press >. The faders then set the band’s parts.'],
      ['Knobs', 'KNOB BANK, turn K1 to Knobs: MIDI CC, press >. K5–K8 then drive Woodshed; take Knobs: Preset again to shape your sound.'],
      ['Pads', 'Press KNOB BANK and FADER BANK together until it says Pads Notes, then Learn the pads here.'],
      ['Play and stop', 'GLOBE › MIDI › Clock Out: Playing. Hold SEQ PLAY to switch the Sequencer on; SEQ PLAY then starts and stops the band.'],
      ['Follow the band', 'GLOBE › Sync: On, and switch on Send clock here: the arpeggiator and patterns follow Woodshed’s tempo.'],
    ],
  },
  {
    id: 'smk-37-elite',
    name: 'SMK-37 Elite',
    about: 'M-VAVE SMK-37 Elite or Pro on M-VAVE’s own firmware',
    match: /SMK-37|SMK37/i,
    panel: true,
    // Pads on channel 10 from a community capture of the Pro; the knob and
    // fader CCs depend on the MIDI Suite preset, so learn them.
    bindings: { ...padNotes(10, MPC_PADS), seqplay: 'rt:start', seqcont: 'rt:continue', seqstop: 'rt:stop' },
    engine: { notes: true, channel: 1, dx7: false, clock: true },
    setup: [
      ['Knobs and faders', 'Their CCs come from the preset in M-VAVE’s MIDI Suite: tap Learn and move each one.'],
    ],
  },
  {
    id: 'generic',
    name: 'MIDI keyboard',
    about: 'Any class-compliant MIDI keyboard',
    match: /./,
    panel: false,
    // Pads on channel 10 from note 36 are what most pad controllers send.
    bindings: { ...padNotes(10, MPC_PADS), seqplay: 'rt:start', seqcont: 'rt:continue', seqstop: 'rt:stop' },
    engine: null,
    setup: [
      ['Controls', 'Tap Learn, then move each knob, fader and pad you want to use.'],
    ],
  },
];

export const profileFor = (name) => PROFILES.find((p) => p.match.test(name ?? '')) ?? PROFILES[PROFILES.length - 1];

/** The order Learn walks: the controls Woodshed can use, as on the panel. */
export const LEARNABLE = [
  ...Array.from({ length: 8 }, (_, i) => `k${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `f${i + 1}`),
  ...Array.from({ length: 16 }, (_, i) => `p${i + 1}`),
  'seqplay', 'seqrec',
];

/** The message signature of a parsed MIDI event, for matching bindings. */
export function signature(ev) {
  if (ev.type === 'cc') return `cc:${ev.ch + 1}:${ev.cc}`;
  if (ev.type === 'on' || ev.type === 'off') return `note:${ev.ch + 1}:${ev.note}`;
  if (ev.type === 'start' || ev.type === 'stop' || ev.type === 'continue') return `rt:${ev.type}`;
  return null;
}

/** Does a binding ('cc:*:74') match a message signature ('cc:1:74')? */
export function matches(binding, sig) {
  if (!binding || !sig) return false;
  if (binding === sig) return true;
  const [bt, bch, bn] = binding.split(':');
  const [st, , sn] = sig.split(':');
  return bch === '*' && bt === st && bn === sn;
}

/** "CC 74", "Note 36 ch 10", "Start": a binding as a person reads it. */
export function describeBinding(b) {
  if (!b) return 'Not learned';
  const [t, ch, n] = b.split(':');
  if (t === 'rt') return { start: 'MIDI Start', stop: 'MIDI Stop', continue: 'MIDI Continue' }[ch] ?? ch;
  const chan = ch === '*' ? '' : ` ch ${ch}`;
  return t === 'cc' ? `CC ${n}${chan}` : `Note ${n}${chan}`;
}
