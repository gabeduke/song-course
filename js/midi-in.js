// Web MIDI input (Chrome, including Chrome on Android).
// Listens to every connected input unless one is chosen.

export const midiIn = {
  access: null,
  selected: 'all',
  listeners: new Set(),
  changeListeners: new Set(),
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

  async enable() {
    if (this.access) return this.access;
    if (!this.supported) throw new Error('This browser has no Web MIDI. Use Chrome on Android, ChromeOS, Windows, Mac or Linux.');
    this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.wire();
    this.access.onstatechange = () => {
      this.wire();
      for (const fn of this.changeListeners) fn();
    };
    for (const fn of this.changeListeners) fn();
    return this.access;
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
    const [status, d1, d2] = msg.data;
    const type = status & 0xf0;
    let ev = null;
    if (type === 0x90 && d2 > 0) ev = { type: 'on', note: d1, vel: d2 / 127 };
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) ev = { type: 'off', note: d1 };
    if (!ev) return;
    ev.time = msg.timeStamp || performance.now();
    ev.input = input.name;
    for (const fn of this.listeners) fn(ev);
  },

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  onChange(fn) {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  },
};
