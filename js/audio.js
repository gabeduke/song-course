// Small Web Audio instrument rack: drums, bass, plucked guitar, electric piano.
// Everything is synthesised — no samples to download.

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

export class Engine {
  constructor() {
    this.ctx = null;
    this.buses = new Map();
    this.pluckCache = new Map();
    this.stringVoices = new Map(); // `${bus}:${string}` -> {src, gain}
  }

  get ready() {
    return !!this.ctx;
  }

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Must be called from a user gesture (a tap) on mobile. */
  async init() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: 'interactive' });
      const ctx = this.ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 3;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(comp).connect(ctx.destination);
      this.noise = this.makeNoise(2);
      // a touch of room for everything
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(1.6);
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.16;
      this.reverbSend.connect(this.reverb).connect(this.master);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  makeNoise(seconds) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeImpulse(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  /** One gain node per part, so parts can be muted and mixed. */
  bus(id, volume = 0.8) {
    let b = this.buses.get(id);
    if (!b) {
      const g = this.ctx.createGain();
      g.gain.value = volume;
      g.connect(this.master);
      const send = this.ctx.createGain();
      send.gain.value = 1;
      g.connect(send).connect(this.reverbSend);
      b = { gain: g, send };
      this.buses.set(id, b);
    }
    return b.gain;
  }

  setBusVolume(id, v) {
    const b = this.buses.get(id);
    if (b && this.ctx) b.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  envGain(time, peak, attack, decay, out) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
    g.connect(out);
    return g;
  }

  noiseSource(time, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(time, Math.random() * 1.5);
    src.stop(time + dur);
    return src;
  }

  // ------------------------------------------------------------- drums

  drum(lane, time, vel, out) {
    const ctx = this.ctx;
    const v = vel;
    switch (lane) {
      case 'kick': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(160, time);
        o.frequency.exponentialRampToValueAtTime(42, time + 0.11);
        o.connect(this.envGain(time, 1.0 * v, 0.002, 0.42, out));
        o.start(time);
        o.stop(time + 0.5);
        const click = this.noiseSource(time, 0.01);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2000;
        click.connect(hp).connect(this.envGain(time, 0.25 * v, 0.001, 0.01, out));
        break;
      }
      case 'snare': {
        const n = this.noiseSource(time, 0.25);
        const bp = ctx.createBiquadFilter();
        bp.type = 'highpass';
        bp.frequency.value = 1400;
        n.connect(bp).connect(this.envGain(time, 0.55 * v, 0.001, 0.17, out));
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, time);
        o.frequency.exponentialRampToValueAtTime(160, time + 0.08);
        o.connect(this.envGain(time, 0.45 * v, 0.001, 0.09, out));
        o.start(time);
        o.stop(time + 0.15);
        break;
      }
      case 'rim': {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = 1700;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        o.connect(bp).connect(this.envGain(time, 0.35 * v, 0.001, 0.03, out));
        o.start(time);
        o.stop(time + 0.06);
        break;
      }
      case 'clap': {
        for (let i = 0; i < 3; i++) {
          const t = time + i * 0.011;
          const n = this.noiseSource(t, 0.12);
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = 1300;
          bp.Q.value = 1.2;
          n.connect(bp).connect(this.envGain(t, 0.6 * v, 0.001, i === 2 ? 0.12 : 0.02, out));
        }
        break;
      }
      case 'hat':
      case 'open':
      case 'shaker': {
        const dur = lane === 'open' ? 0.32 : lane === 'shaker' ? 0.06 : 0.045;
        const n = this.noiseSource(time, dur + 0.05);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = lane === 'shaker' ? 5500 : 7500;
        const att = lane === 'shaker' ? 0.02 : 0.001;
        n.connect(hp).connect(this.envGain(time, (lane === 'shaker' ? 0.18 : 0.28) * v, att, dur, out));
        break;
      }
      case 'ride':
      case 'crash': {
        const dur = lane === 'crash' ? 1.6 : 0.7;
        const n = this.noiseSource(time, dur + 0.1);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = lane === 'crash' ? 3500 : 5000;
        n.connect(hp).connect(this.envGain(time, (lane === 'crash' ? 0.32 : 0.14) * v, 0.002, dur, out));
        if (lane === 'ride') {
          const o = ctx.createOscillator();
          o.type = 'square';
          o.frequency.value = 3150;
          o.connect(this.envGain(time, 0.02 * v, 0.001, 0.35, out));
          o.start(time);
          o.stop(time + 0.4);
        }
        break;
      }
      case 'tom': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(140, time);
        o.frequency.exponentialRampToValueAtTime(85, time + 0.25);
        o.connect(this.envGain(time, 0.7 * v, 0.002, 0.3, out));
        o.start(time);
        o.stop(time + 0.4);
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------- bass

  bass(midi, time, dur, vel, out) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(180 + 1400 * vel, time);
    lp.frequency.exponentialRampToValueAtTime(260, time + 0.18);
    const g = ctx.createGain();
    const end = time + Math.max(dur, 0.08);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.42 * vel, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.28 * vel, time + 0.12);
    g.gain.setValueAtTime(0.28 * vel, end - 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    const mix2 = ctx.createGain();
    mix2.gain.value = 0.9;
    o1.connect(lp);
    o2.connect(mix2).connect(lp);
    lp.connect(g).connect(out);
    o1.start(time);
    o2.start(time);
    o1.stop(end + 0.1);
    o2.stop(end + 0.1);
  }

  deadNote(time, vel, out) {
    const n = this.noiseSource(time, 0.05);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    n.connect(lp).connect(this.envGain(time, 0.4 * vel, 0.001, 0.04, out));
  }

  // ------------------------------------------------------------- guitar

  /** Karplus–Strong plucked string, rendered once per pitch and cached. */
  pluckBuffer(midi) {
    let entry = this.pluckCache.get(midi);
    if (entry) return entry;
    const sr = this.ctx.sampleRate;
    const f = mtof(midi);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const seconds = midi < 52 ? 3.2 : 2.4;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const y = buf.getChannelData(0);
    const t60 = 4.2 - (midi - 40) * 0.07;
    const g = 0.001 ** (1 / (f * Math.max(t60, 0.9)));
    // soft pick: smoothed noise burst
    let prev = 0;
    for (let i = 0; i < N; i++) {
      const r = Math.random() * 2 - 1;
      prev = prev * 0.45 + r * 0.55;
      y[i] = prev;
    }
    for (let i = N; i < len; i++) {
      y[i] = g * 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]);
    }
    // normalise
    let peak = 0;
    for (let i = 0; i < N * 4 && i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
    if (peak > 0) for (let i = 0; i < len; i++) y[i] /= peak;
    entry = { buffer: buf, rate: f / (sr / (N + 0.5)) };
    this.pluckCache.set(midi, entry);
    return entry;
  }

  guitarOut(out) {
    if (!this._gtrChain) this._gtrChain = new Map();
    let chain = this._gtrChain.get(out);
    if (!chain) {
      const body = this.ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = 220;
      body.gain.value = 4;
      const tone = this.ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5200;
      body.connect(tone).connect(out);
      chain = body;
      this._gtrChain.set(out, chain);
    }
    return chain;
  }

  pluck(midi, time, vel, out, { string = null, busId = '', mute = false, dur = null } = {}) {
    const ctx = this.ctx;
    const { buffer, rate } = this.pluckBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const peak = 0.32 * vel;
    g.gain.setValueAtTime(peak, time);
    if (mute) g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    src.connect(g).connect(this.guitarOut(out));
    src.start(time);
    let stopAt = time + buffer.duration / rate;
    if (dur) {
      g.gain.setValueAtTime(peak, time + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.08);
      stopAt = Math.min(stopAt, time + dur + 0.1);
    }
    src.stop(mute ? time + 0.08 : stopAt);
    // a new note on the same string chokes the old one
    if (string) {
      const key = `${busId}:${string}`;
      const old = this.stringVoices.get(key);
      if (old && old.time < time) {
        old.gain.gain.cancelScheduledValues(time);
        old.gain.gain.setTargetAtTime(0.0001, time, 0.012);
        try { old.src.stop(time + 0.08); } catch { /* already stopped */ }
      }
      this.stringVoices.set(key, { src, gain: g, time });
    }
  }

  strum(notes, time, vel, out, { dir = 'down', busId = '', mute = false } = {}) {
    const gap = dir === 'down' ? 0.011 : 0.008;
    notes.forEach((n, i) => {
      this.pluck(n.midi, time + i * gap, vel * (dir === 'up' ? 0.8 : 1), out, { string: n.string, busId, mute });
    });
    if (mute) {
      const ns = this.noiseSource(time, 0.05);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      ns.connect(bp).connect(this.envGain(time, 0.3 * vel, 0.001, 0.04, out));
    }
  }

  // ------------------------------------------------------------- keys

  epiano(midi, time, dur, vel, out) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 1;
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(f * 1.6 * vel, time);
    modGain.gain.exponentialRampToValueAtTime(f * 0.15, time + 0.6);
    mod.connect(modGain).connect(car.frequency);
    const tine = ctx.createOscillator();
    tine.frequency.value = f * 4;
    const g = ctx.createGain();
    const end = time + Math.max(dur, 0.1);
    const lvl = 0.13 * vel;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(lvl, time + 0.005);
    g.gain.exponentialRampToValueAtTime(lvl * 0.45, time + 0.9);
    g.gain.setValueAtTime(lvl * 0.4, end);
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
    const tg = this.envGain(time, 0.02 * vel, 0.002, 0.25, g);
    tine.connect(tg);
    car.connect(g).connect(out);
    for (const o of [car, mod, tine]) {
      o.start(time);
      o.stop(end + 0.3);
    }
  }

  // ------------------------------------------------------------- click

  click(time, accent) {
    const o = this.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = accent ? 1760 : 1180;
    o.connect(this.envGain(time, accent ? 0.22 : 0.13, 0.001, 0.03, this.master));
    o.start(time);
    o.stop(time + 0.06);
  }

  /** Audition a single note or chord right now (fretboard taps etc.). */
  audition(notes, instrument = 'guitar') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    const out = this.bus('_audition', 0.9);
    if (instrument === 'keys') notes.forEach((n) => this.epiano(n.midi, t, 0.8, 0.8, out));
    else if (instrument === 'bass') notes.forEach((n) => this.bass(n.midi, t, 0.6, 0.8, out));
    else if (notes.length > 1) this.strum(notes, t, 0.8, out, { busId: '_audition' });
    else this.pluck(notes[0].midi, t, 0.85, out, { string: notes[0].string, busId: '_audition' });
  }
}
