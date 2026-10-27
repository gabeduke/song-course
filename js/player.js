// Transport: a lookahead scheduler that walks the arrangement step by step
// and hands events to the audio engine. UI updates are queued against the
// audio clock and released on animation frames, so visuals stay in sync.

export class Player extends EventTarget {
  constructor(engine, store) {
    super();
    this.engine = engine;
    this.store = store;
    this.song = null;
    this.timer = null;
    this.raf = null;
    this.queue = [];
    this.lookahead = 0.12;
    // Set by the controller (js/controller.js): tap(e) hears what's
    // scheduled, ahead of time, to send it to a keyboard as MIDI;
    // external(partId) is true for a part the keyboard plays instead.
    this.tap = null;
    this.external = null;
    // Set by the app: called as a loop comes round, before its first step.
    this.onLoop = null;
  }

  get playing() {
    return !!this.timer;
  }

  setSong(compiled) {
    this.stop();
    this.swapSong(compiled);
  }

  /** Replace the song without stopping (live preview while editing). */
  swapSong(compiled) {
    this.song = compiled;
    // index every variation's events by step
    for (const sec of Object.values(compiled.sections)) {
      for (const list of Object.values(sec.parts)) {
        for (const v of list) {
          v.byStep = new Map();
          for (const ev of v.events) {
            if (!v.byStep.has(ev.t)) v.byStep.set(ev.t, []);
            v.byStep.get(ev.t).push(ev);
          }
        }
      }
    }
  }

  /** Pre-render plucked strings so the first bar doesn't stutter. */
  prewarm() {
    if (!this.song || !this.engine.ready) return;
    const seen = new Set();
    for (const sec of Object.values(this.song.sections)) {
      for (const [pid, list] of Object.entries(sec.parts)) {
        const part = this.song.parts.find((p) => p.id === pid);
        if (part?.instrument !== 'guitar') continue;
        for (const v of list) for (const ev of v.events) {
          for (const n of ev.notes ?? [ev]) if (n.midi && !seen.has(n.midi)) { seen.add(n.midi); this.engine.pluckBuffer(n.midi); }
        }
      }
    }
  }

  stepDur() {
    const s = this.store.state;
    return 60 / s.tempo / this.song.time.stepsPerBeat;
  }

  variationFor(sectionId, partId) {
    const sec = this.song.sections[sectionId];
    const list = sec.parts[partId] ?? [];
    const sel = this.store.state.selection[sectionId]?.[partId];
    if (sel === 'off') return null;
    if (sel === undefined && this.song.song.parts?.find((p) => p.id === partId)?.start === 'off') return null;
    return list.find((v) => v.id === sel) ?? list[0] ?? null;
  }

  partAudible(partId) {
    const s = this.store.state;
    if (s.solo) return s.solo === partId;
    return !s.mutes[partId];
  }

  async start() {
    if (!this.song) return;
    await this.engine.init();
    this.prewarm();
    const s = this.store.state;
    for (const p of this.song.parts) this.engine.bus(p.id, s.volumes[p.id] ?? p.volume);
    const arr = this.song.arrangement;
    let arrIndex = arr.indexOf(s.sectionId);
    if (arrIndex < 0) arrIndex = 0;
    this.pos = { arrIndex, step: 0 };
    this.countSteps = s.countIn ? this.song.time.stepsPerBar : 0;
    this.countStep = 0;
    this.begun = false;
    this.nextTime = this.engine.now + 0.1;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    const loop = () => {
      this.drain();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.dispatchEvent(new CustomEvent('state', { detail: { playing: true } }));
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.tap?.({ kind: 'stop' });
    }
    if (this.raf) cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = null;
    this.queue = [];
    this.dispatchEvent(new CustomEvent('state', { detail: { playing: false } }));
  }

  /** Jump to an arrangement slot on the next step. */
  jumpTo(arrIndex) {
    if (!this.pos) return;
    this.pos.arrIndex = arrIndex;
    this.pos.step = 0;
  }

  currentSectionId() {
    const s = this.store.state;
    if (s.loopMode === 'section') return s.sectionId;
    return this.song.arrangement[this.pos.arrIndex];
  }

  tick() {
    const horizon = this.engine.now + this.lookahead;
    while (this.nextTime < horizon) {
      const dur = this.stepDur();
      if (this.countStep < this.countSteps) {
        const t = this.countStep;
        if (this.song.time.pulses.includes(t)) {
          this.engine.click(this.nextTime, t === 0);
          const n = this.song.time.pulses.indexOf(t) + 1;
          this.push(this.nextTime, { type: 'count', n, of: this.song.time.pulses.length });
        }
        this.countStep++;
      } else {
        this.scheduleStep(this.nextTime, dur);
        this.advance();
      }
      this.nextTime += dur;
    }
  }

  advance() {
    const s = this.store.state;
    const sid = this.currentSectionId();
    const sec = this.song.sections[sid];
    this.pos.step++;
    if (this.pos.step >= sec.length) {
      this.pos.step = 0;
      if (s.loopMode === 'song') {
        this.pos.arrIndex = (this.pos.arrIndex + 1) % this.song.arrangement.length;
      }
      // Ahead of the loop's first step being scheduled, so whatever this
      // swaps in (a drill moving to its next key) starts exactly on the one.
      this.onLoop?.();
    }
  }

  swingOffset(step, dur) {
    const swing = this.store.state.swing ?? this.song.swing;
    if (!swing) return 0;
    const spb = this.song.time.stepsPerBeat;
    if (spb === 4 && step % 4 === 2) return swing * 2 * dur; // offbeat 8ths
    if (spb === 2 && step % 2 === 1) return swing * dur;
    return 0;
  }

  scheduleStep(time, dur) {
    const s = this.store.state;
    const sid = this.currentSectionId();
    const sec = this.song.sections[sid];
    if (this.pos.step >= sec.length) this.pos.step = 0;
    const step = this.pos.step;
    const eng = this.engine;
    const t = time + this.swingOffset(step, dur);
    if (!this.begun) {
      this.begun = true;
      this.tap?.({ kind: 'start', time });
    }
    this.tap?.({ kind: 'step', time, dur, step });

    if (s.click && this.song.time.pulses.includes(step % this.song.time.stepsPerBar)) {
      eng.click(time, step % this.song.time.stepsPerBar === 0);
    }

    for (const part of this.song.parts) {
      const v = this.variationFor(sid, part.id);
      if (!v) continue;
      const evs = v.byStep.get(step);
      if (!evs) continue;
      const audible = this.partAudible(part.id);
      const external = audible && !!this.external?.(part.id);
      const out = eng.bus(part.id, part.volume);
      for (const ev of evs) {
        const evDur = ev.d * dur;
        if (external) this.tap?.({ kind: 'note', part, ev, time: t, dur: evDur });
        else if (audible) {
          switch (ev.kind) {
            case 'drum': eng.drum(ev.drum, t, ev.vel, out); break;
            case 'dead': eng.deadNote(t, ev.vel, out); break;
            case 'strum': eng.strum(ev.notes, t, ev.vel, out, { dir: ev.dir, busId: part.id }); break;
            case 'chuck': eng.strum(ev.notes, t, ev.vel, out, { busId: part.id, mute: true }); break;
            case 'note':
              if (part.instrument === 'bass') eng.bass(ev.midi, t, evDur, ev.vel, out);
              else if (part.instrument === 'keys') eng.epiano(ev.midi, t, evDur, ev.vel, out);
              else eng.pluck(ev.midi, t, ev.vel, out, { string: ev.string, busId: part.id, dur: ['notes', 'degrees', 'pedal'].includes(v.type) ? Math.max(evDur, 0.12) : null });
              break;
            default: break;
          }
        }
        this.push(t, { type: 'event', partId: part.id, instrument: part.instrument, ev, audible, dur: evDur });
      }
    }
    this.push(time, { type: 'step', sectionId: sid, arrIndex: this.pos.arrIndex, step });
  }

  push(time, detail) {
    let i = this.queue.length;
    while (i > 0 && this.queue[i - 1].time > time) i--;
    this.queue.splice(i, 0, { time, detail });
  }

  drain() {
    const now = this.engine.now;
    const due = [];
    while (this.queue.length && this.queue[0].time <= now) due.push(this.queue.shift());
    for (const d of due) this.dispatchEvent(new CustomEvent(d.detail.type, { detail: { ...d.detail, time: d.time } }));
  }
}
