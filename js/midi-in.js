// Web MIDI (Chrome, including Chrome on Android): every message from every
// connected input, parsed, plus the outputs, so Woodshed can play a
// keyboard's own sound engine and send it a clock.
//
// Messages go to the controller first (js/controller.js), which takes the
// knobs, faders, pads and transport it knows; the notes it leaves are the
// keys, and go to the note listeners (the neck, Capture).

export const midiIn = {
  access: null,
  sysex: false,
  selected: 'all',
  listeners: new Set(),
  changeListeners: new Set(),
  rawListeners: new Set(),
  filter: null,
  held: new Map(),

  get supported() {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  },

  get enabled() {
    return !!this.access;
  },

  inputs() {
    return this.access ? [...this.access.inputs.values()] : [];
  },

  outputs() {
    return this.access ? [...this.access.outputs.values()] : [];
  },

  /** The output on the same device as an input: same name, or the closest. */
  outputFor(input) {
    const outs = this.outputs();
    if (!input) return outs[0] ?? null;
    const base = (n) => String(n ?? '').replace(/\s*(MIDI\s*)?\d*$/i, '').trim().toLowerCase();
    return outs.find((o) => o.name === input.name) ?? outs.find((o) => base(o.name) === base(input.name)) ?? null;
  },

  /**
   * Ask for MIDI. `sysex` asks for the stronger permission too (sending a
   * patch to a keyboard); Chrome shows its own prompt for that.
   */
  async enable({ sysex = false } = {}) {
    if (this.access && (!sysex || this.sysex)) return this.access;
    if (!this.supported) throw new Error('This browser has no Web MIDI. Use Chrome on Android, ChromeOS, Windows, Mac or Linux.');
    const access = await navigator.requestMIDIAccess({ sysex });
    this.access = access;
    this.sysex = !!access.sysexEnabled || sysex;
    this.wire();
    access.onstatechange = () => {
      this.wire();
      for (const fn of this.changeListeners) fn();
    };
    for (const fn of this.changeListeners) fn();
    return access;
  },

  /** Connect without a prompt if this site was allowed MIDI before. */
  async resume() {
    if (this.access || !this.supported || !navigator.permissions?.query) return false;
    try {
      const st = await navigator.permissions.query({ name: 'midi', sysex: false });
      if (st.state !== 'granted') return false;
      await this.enable();
      return true;
    } catch {
      return false;
    }
  },

  wire() {
    for (const input of this.inputs()) {
      input.onmidimessage = (msg) => this.handle(input, msg);
    }
  },

  select(id) {
    this.selected = id;
  },

  handle(input, msg) {
    if (this.selected !== 'all' && input.id !== this.selected) return;
    const ev = parse(msg.data);
    if (!ev) return;
    ev.time = msg.timeStamp || performance.now();
    ev.input = input.name;
    ev.inputId = input.id;
    for (const fn of this.rawListeners) fn(ev);
    if (this.filter?.(ev)) return;
    if (ev.type !== 'on' && ev.type !== 'off') return;
    for (const fn of this.listeners) fn(ev);
  },

  /** Note on/off from the keys (what the controller didn't take). */
  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  /** Every parsed message, before the controller sees it. */
  onAny(fn) {
    this.rawListeners.add(fn);
    return () => this.rawListeners.delete(fn);
  },

  onChange(fn) {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  },
};

/**
 * One MIDI message as an event: on, off, cc, bend, pc, pressure, poly,
 * clock, start, continue, stop, sysex. Channels count from 0.
 */
export function parse(data) {
  const [status, d1 = 0, d2 = 0] = data;
  if (status === 0xf0) return { type: 'sysex', data: [...data] };
  if (status >= 0xf8) {
    const rt = { 0xf8: 'clock', 0xfa: 'start', 0xfb: 'continue', 0xfc: 'stop' }[status];
    return rt ? { type: rt } : null;
  }
  const type = status & 0xf0;
  const ch = status & 0x0f;
  switch (type) {
    case 0x90: return d2 > 0 ? { type: 'on', ch, note: d1, vel: d2 / 127 } : { type: 'off', ch, note: d1 };
    case 0x80: return { type: 'off', ch, note: d1 };
    case 0xb0: return { type: 'cc', ch, cc: d1, value: d2 };
    case 0xe0: return { type: 'bend', ch, value: ((d2 << 7) | d1) / 8192 - 1 };
    case 0xc0: return { type: 'pc', ch, program: d1 };
    case 0xd0: return { type: 'pressure', ch, value: d1 / 127 };
    case 0xa0: return { type: 'poly', ch, note: d1, value: d2 / 127 };
    default: return null;
  }
}
