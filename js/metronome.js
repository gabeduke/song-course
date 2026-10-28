// The metronome: a click on its own, for the pages where nothing else
// plays (the book's front page, the lessons). Its tempo is its own; songs
// and drills keep theirs. It schedules ahead on the audio clock like the
// player does, and tells the page about each beat when it's heard.

import { loadPrefs, savePrefs } from './store.js';

export const BEATS = [2, 3, 4, 6];
const DEFAULTS = { tempo: 80, beats: 4, backbeat: false };

export class Metronome extends EventTarget {
  constructor(engine) {
    super();
    this.engine = engine;
    this.settings = { ...DEFAULTS, ...(loadPrefs().metronome ?? {}) };
    this.timer = null;
    this.taps = [];
  }

  get playing() { return !!this.timer; }

  set(patch) {
    const next = { ...this.settings, ...patch };
    next.tempo = Math.max(30, Math.min(260, Math.round(next.tempo)));
    if (!BEATS.includes(next.beats)) next.beats = DEFAULTS.beats;
    this.settings = next;
    savePrefs({ ...loadPrefs(), metronome: next });
    this.dispatchEvent(new CustomEvent('change', { detail: next }));
  }

  async start() {
    if (this.timer) return;
    await this.engine.init();
    this.beat = 0;
    this.next = this.engine.now + 0.08;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    this.dispatchEvent(new CustomEvent('state', { detail: { playing: true } }));
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    for (const t of this.pending ?? []) clearTimeout(t);
    this.pending = [];
    this.dispatchEvent(new CustomEvent('state', { detail: { playing: false } }));
  }

  toggle() { return this.playing ? this.stop() : this.start(); }

  tick() {
    const { beats, backbeat } = this.settings;
    const horizon = this.engine.now + 0.12;
    while (this.next < horizon) {
      const beat = this.beat % beats;
      // On 2 and 4 only: the backbeat, where a drummer's snare would be.
      const sounds = !backbeat || beat % 2 === 1;
      if (sounds) this.engine.click(this.next, !backbeat && beat === 0);
      this.announce(this.next, beat, sounds);
      this.beat = beat + 1;
      // read the tempo every beat, so a change lands on the next one
      this.next += 60 / this.settings.tempo;
    }
  }

  /** A 'beat' event when the click is heard, not when it was scheduled. */
  announce(time, beat, sounds) {
    this.pending = (this.pending ?? []).filter(Boolean);
    const ms = Math.max(0, (time - this.engine.now) * 1000);
    const id = setTimeout(() => {
      this.pending = this.pending.filter((x) => x !== id);
      this.dispatchEvent(new CustomEvent('beat', { detail: { beat, beats: this.settings.beats, sounds } }));
    }, ms);
    this.pending.push(id);
  }

  /** Tap tempo: the average gap between the last few taps, a new count after a pause. */
  tap(now = performance.now()) {
    if (this.taps.length && now - this.taps.at(-1) > 2000) this.taps = [];
    this.taps = [...this.taps, now].slice(-5);
    if (this.taps.length < 2) return null;
    const gaps = this.taps.slice(1).map((t, i) => t - this.taps[i]);
    const tempo = 60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length);
    this.set({ tempo });
    return this.settings.tempo;
  }
}
