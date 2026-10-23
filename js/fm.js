// Four-operator FM, DX style. Every operator is a sine wave with its own
// level and its own envelope. A carrier is heard; a modulator is wired into
// another operator's frequency and only changes that operator's tone. The
// algorithm is the wiring. Pure Web Audio, no samples; the FM lab plays it.
//
// A patch is plain data, so it can be saved, shown, or sent to a hardware
// FM engine as a DX7 voice:
//
//   {
//     name: 'Bell',
//     algorithm: 'pair',            // an id from ALGORITHMS
//     feedback: 0,                  // 0..1, on the algorithm's feedback operator
//     ops: [                        // always four; op 1 first
//       { ratio: 1, detune: 0, level: 0.8, env: { a: 0.002, d: 1.2, s: 0, r: 1 } },
//       …
//     ],
//   }
//
// ratio: frequency as a multiple of the note's, 0.5 to 16.99 (coarse 0.5 or
// 1–16 plus a fine part), all of which a DX7 can play (coarse × 1.00–1.99).
// detune: cents, −50..50, optional. level: 0..1; for a carrier it is the
// loudness, for a modulator the modulation index (level × MAX_INDEX).
// env: attack, decay and release in seconds, sustain 0..1 of the peak.

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** A modulator at level 1 swings its target by this many times its own frequency. */
export const MAX_INDEX = 10;

/** Coarse ratios on the lab's slider; the fine part (0..0.99) is added on top. */
export const COARSE = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

// Operators are numbered 1–4 as on a DX7: op 1 is at the bottom of the
// stack. `at` places each operator on a grid for drawing (column, row; row
// 0 at the top), carriers on the bottom row.
export const ALGORITHMS = [
  {
    id: 'pair', name: 'Pair', ops: [1, 2], carriers: [1], edges: [[2, 1]], feedback: 2,
    about: 'Operator 2 modulates operator 1: the classic two-operator sound.',
    at: { 1: [0, 1], 2: [0, 0] },
  },
  {
    id: 'stack', name: 'Stack', ops: [1, 2, 3, 4], carriers: [1], edges: [[4, 3], [3, 2], [2, 1]], feedback: 4,
    about: 'Each operator modulates the one below it: modulation of modulation, the most overtones from the fewest knobs.',
    at: { 1: [0, 3], 2: [0, 2], 3: [0, 1], 4: [0, 0] },
  },
  {
    id: 'two-pairs', name: 'Two pairs', ops: [1, 2, 3, 4], carriers: [1, 3], edges: [[2, 1], [4, 3]], feedback: 4,
    about: 'Two pairs side by side, mixed: one for the body, one for the attack. The electric piano’s wiring.',
    at: { 1: [0, 1], 2: [0, 0], 3: [1, 1], 4: [1, 0] },
  },
  {
    id: 'three-to-one', name: 'Three into one', ops: [1, 2, 3, 4], carriers: [1], edges: [[2, 1], [3, 1], [4, 1]], feedback: 4,
    about: 'Three modulators work on one carrier, each adding its own set of sidebands.',
    at: { 1: [1, 1], 2: [0, 0], 3: [1, 0], 4: [2, 0] },
  },
  {
    id: 'one-to-three', name: 'One into three', ops: [1, 2, 3, 4], carriers: [1, 2, 3], edges: [[4, 1], [4, 2], [4, 3]], feedback: 4,
    about: 'One modulator shared by three carriers: three layers that brighten together.',
    at: { 1: [0, 1], 2: [1, 1], 3: [2, 1], 4: [1, 0] },
  },
  {
    id: 'additive', name: 'All carriers', ops: [1, 2, 3, 4], carriers: [1, 2, 3, 4], edges: [], feedback: 4,
    about: 'Every operator is heard and none modulates: four sines mixed, like an organ’s drawbars.',
    at: { 1: [0, 0], 2: [1, 0], 3: [2, 0], 4: [3, 0] },
  },
];

export const algorithm = (id) => ALGORITHMS.find((a) => a.id === id) ?? ALGORITHMS[0];

const op = (ratio, level, a, d, s, r, detune = 0) => ({ ratio, detune, level, env: { a, d, s, r } });
const spare = [op(2, 0, 0.005, 0.4, 0.6, 0.2), op(3, 0, 0.005, 0.4, 0.6, 0.2)];

export const PRESETS = {
  sine: {
    name: 'Sine', algorithm: 'pair', feedback: 0,
    ops: [op(1, 0.8, 0.005, 0.4, 1, 0.2), op(1, 0, 0.005, 0.4, 1, 0.2), ...spare],
  },
  organ: {
    name: 'Organ', algorithm: 'pair', feedback: 0,
    ops: [op(1, 0.8, 0.006, 0.2, 1, 0.07), op(1, 0.12, 0.006, 0.2, 1, 0.07), ...spare],
  },
  bell: {
    name: 'Bell', algorithm: 'pair', feedback: 0,
    ops: [op(1, 0.8, 0.002, 1.4, 0, 1.2), op(3.5, 0.45, 0.001, 0.7, 0, 0.6), ...spare],
  },
  epiano: {
    name: 'E-piano', algorithm: 'two-pairs', feedback: 0,
    ops: [
      op(1, 0.8, 0.002, 1.8, 0.25, 0.35),
      op(1, 0.17, 0.002, 1, 0.1, 0.3),
      op(1, 0.3, 0.001, 0.5, 0, 0.2, 3),
      op(14, 0.22, 0.001, 0.12, 0, 0.1),
    ],
  },
  bass: {
    name: 'Bass', algorithm: 'pair', feedback: 0.35,
    ops: [op(1, 0.9, 0.002, 0.5, 0.6, 0.08), op(1, 0.55, 0.001, 0.22, 0.12, 0.08), ...spare],
  },
  brass: {
    name: 'Brass', algorithm: 'pair', feedback: 0.4,
    ops: [op(1, 0.8, 0.05, 0.3, 0.85, 0.15), op(1, 0.42, 0.14, 0.4, 0.35, 0.15), ...spare],
  },
};

export const clonePatch = (p) => structuredClone(p);

/** Is operator n a carrier in this algorithm, a modulator, or unused? */
export function opRole(alg, n) {
  if (!alg.ops.includes(n)) return 'unused';
  return alg.carriers.includes(n) ? 'carrier' : 'modulator';
}

// ------------------------------------------------------------- analysis

/** Bessel function of the first kind, J_n(x), by its series (fine for x ≤ 12). */
export function besselJ(n, x) {
  n = Math.abs(n);
  let term = (x / 2) ** n;
  for (let i = 2; i <= n; i++) term /= i;
  let sum = term;
  for (let m = 1; m < 60; m++) {
    term *= -((x / 2) ** 2) / (m * (m + n));
    sum += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return sum;
}

/**
 * The partials one carrier/modulator pair makes, as multiples of the note's
 * frequency: carrier ratio ± k × modulator ratio, each as loud as |J_k(index)|.
 * Negative ones fold back over zero. Partials weaker than `floor` are left out.
 */
export function sidebands(carrierRatio, modRatio, index, { count = 12, floor = 0.02 } = {}) {
  const out = [];
  for (let k = -count; k <= count; k++) {
    const amp = Math.abs(besselJ(k, index));
    if (amp < floor && k !== 0) continue;
    out.push({ k, x: Math.abs(carrierRatio + k * modRatio), amp });
  }
  return out;
}

/**
 * What the patch predicts: for each carrier, the sidebands its first
 * modulator makes (deeper stacks only add more, so this is the first
 * layer of the answer), or the carrier's own sine when nothing modulates
 * it. Partials are scaled by their carrier's level against the loudest
 * carrier. `pair` is the first carrier/modulator pair, the one the lab
 * explains; null when nothing modulates.
 */
export function predictedPartials(patch, opts = {}) {
  const alg = algorithm(patch.algorithm);
  const loudest = Math.max(1e-6, ...alg.carriers.map((c) => patch.ops[c - 1].level));
  const partials = [];
  let pair = null;
  for (const c of alg.carriers) {
    const car = patch.ops[c - 1];
    if (car.level <= 0) continue;
    const scale = car.level / loudest;
    const m = alg.edges.filter(([, to]) => to === c).map(([from]) => from).find((n) => patch.ops[n - 1].level > 0);
    if (!m) {
      partials.push({ k: 0, x: car.ratio, amp: scale, op: c });
      continue;
    }
    const index = patch.ops[m - 1].level * MAX_INDEX;
    const side = sidebands(car.ratio, patch.ops[m - 1].ratio, index, opts);
    for (const p of side) partials.push({ ...p, amp: p.amp * scale, op: c });
    pair ??= { carrier: c, modulator: m, index, carrierRatio: car.ratio, modRatio: patch.ops[m - 1].ratio, partials: side };
  }
  return { pair, partials };
}

/**
 * Do these partials sit on the note's harmonics (1, 2, 3…)? On half-steps
 * of them with the half-step itself sounding (pitched an octave down)? Or
 * between them, the note's own harmonics missing (a bell, metal)? 1:3.5
 * is the last kind: its partials (1, 2.5, 4.5, 6…) share a grid only with
 * a fundamental an octave down that never sounds.
 */
export function harmonicity(partials) {
  const xs = partials.filter((p) => p.amp >= 0.05).map((p) => p.x).filter((x) => x > 0.01);
  const on = (x, grid) => Math.abs(x * grid - Math.round(x * grid)) < 0.02 * grid;
  if (xs.every((x) => on(x, 1))) return 'harmonic';
  if (xs.every((x) => on(x, 2)) && xs.some((x) => Math.abs(x - 0.5) < 0.02)) return 'octave-down';
  return 'inharmonic';
}

/**
 * One cycle of the patch's tone, worked out rather than heard: each
 * operator in wiring order, every modulator at its peak level. Used to draw
 * the waveform before anything plays.
 */
export function previewWave(patch, n = 400, cycles = 2) {
  const alg = algorithm(patch.algorithm);
  const order = [];
  const seen = new Set();
  const visit = (o) => {
    if (seen.has(o)) return;
    seen.add(o);
    for (const [from, to] of alg.edges) if (to === o) visit(from);
    order.push(o);
  };
  for (const o of alg.ops) visit(o);
  const beta = feedbackBeta(patch.feedback);
  const ys = new Float32Array(n);
  const prev = { y1: 0, y2: 0 };
  for (let i = 0; i < n; i++) {
    const t = (i / n) * cycles;
    const out = {};
    for (const o of order) {
      const p = patch.ops[o - 1];
      let phase = 2 * Math.PI * p.ratio * t;
      for (const [from, to] of alg.edges) if (to === o) phase += out[from] * patch.ops[from - 1].level * MAX_INDEX;
      if (o === alg.feedback && beta > 0) {
        phase += beta * (prev.y1 + prev.y2) / 2;
        out[o] = Math.sin(phase);
        prev.y2 = prev.y1;
        prev.y1 = out[o];
      } else {
        out[o] = Math.sin(phase);
      }
    }
    let y = 0;
    for (const c of alg.carriers) y += out[c] * patch.ops[c - 1].level;
    ys[i] = y / Math.max(1, alg.carriers.length);
  }
  return ys;
}

// ------------------------------------------------------------- feedback

const feedbackBeta = (fb) => Math.max(0, Math.min(1, fb ?? 0)) * 1.5;

/**
 * An operator modulating itself: one cycle worked out sample by sample, as
 * a DX7 does (the average of its last two outputs fed back into its own
 * phase), turned into a PeriodicWave. More feedback leans a sine towards a
 * sawtooth. Steady and cheap, where a real delay loop in Web Audio would be
 * a whole render quantum late.
 */
function feedbackHarmonics(beta, harmonics = 40) {
  const N = 512;
  const y = new Float32Array(N);
  let y1 = 0;
  let y2 = 0;
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < N; i++) {
      const v = Math.sin((2 * Math.PI * i) / N + beta * (y1 + y2) / 2);
      y2 = y1;
      y1 = v;
      y[i] = v;
    }
  }
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < N; i++) {
      re += y[i] * Math.cos((2 * Math.PI * k * i) / N);
      im += y[i] * Math.sin((2 * Math.PI * k * i) / N);
    }
    real[k] = (2 * re) / N;
    imag[k] = (2 * im) / N;
  }
  return { real, imag };
}

// ------------------------------------------------------------- the synth

function hold(param, t) {
  if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
  else {
    const v = param.value;
    param.cancelScheduledValues(t);
    param.setValueAtTime(v, t);
  }
}

export class FmSynth {
  constructor(ctx, out, { voices = 8 } = {}) {
    this.ctx = ctx;
    this.out = out;
    this.maxVoices = voices;
    this.voices = [];
    this.patch = clonePatch(PRESETS.organ);
    this.bendSemis = 0;
    this.modAmount = 0;
    this.waves = new Map();
  }

  setPatch(patch) {
    const rewired = patch.algorithm !== this.patch.algorithm;
    this.patch = patch;
    if (rewired) this.allOff();
    else this.refresh();
  }

  wave(fb) {
    const q = Math.round(Math.max(0, Math.min(1, fb)) * 24);
    let w = this.waves.get(q);
    if (!w) {
      const { real, imag } = feedbackHarmonics(feedbackBeta(q / 24));
      w = this.ctx.createPeriodicWave(real, imag, { disableNormalization: true });
      this.waves.set(q, w);
    }
    return w;
  }

  peak(o, role, f, vel) {
    if (role === 'carrier') return o.level * (0.3 + 0.7 * vel);
    return o.level * MAX_INDEX * f * (0.6 + 0.4 * vel) * (1 + this.modAmount);
  }

  noteOn(midi, vel = 0.8, time = this.ctx.currentTime) {
    const ctx = this.ctx;
    const p = this.patch;
    const alg = algorithm(p.algorithm);
    this.noteOff(midi, time);
    this.voices = this.voices.filter((v) => !v.done);
    while (this.voices.length >= this.maxVoices) this.kill(this.voices.shift(), time);
    const f0 = mtof(midi);
    const vout = ctx.createGain();
    vout.gain.value = 0.34 / Math.sqrt(alg.carriers.length);
    vout.connect(this.out);
    const ops = new Map();
    for (const n of alg.ops) {
      const o = p.ops[n - 1];
      const osc = ctx.createOscillator();
      if (n === alg.feedback && p.feedback > 0) osc.setPeriodicWave(this.wave(p.feedback));
      osc.frequency.value = f0 * o.ratio;
      osc.detune.value = (o.detune ?? 0) + this.bendSemis * 100;
      const env = ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      ops.set(n, { n, osc, env, role: opRole(alg, n), peak: 0 });
    }
    for (const v of ops.values()) {
      if (v.role === 'carrier') v.env.connect(vout);
      for (const [from, to] of alg.edges) if (from === v.n) v.env.connect(ops.get(to).osc.frequency);
    }
    const voice = { midi, f0, vel, start: time, ops, vout, released: false, done: false };
    for (const v of ops.values()) {
      const o = p.ops[v.n - 1];
      v.peak = this.peak(o, v.role, f0 * o.ratio, vel);
      const { a, d, s } = o.env;
      const g = v.env.gain;
      g.setValueAtTime(0, time);
      g.linearRampToValueAtTime(v.peak, time + Math.max(a, 0.002));
      g.setTargetAtTime(v.peak * s, time + Math.max(a, 0.002), Math.max(d, 0.005) / 3);
      v.osc.start(time);
    }
    this.voices.push(voice);
    return voice;
  }

  noteOff(midi, time = this.ctx.currentTime) {
    for (const v of this.voices) if (v.midi === midi && !v.released) this.release(v, time);
  }

  release(voice, time, fast = false) {
    voice.released = true;
    let end = time;
    for (const v of voice.ops.values()) {
      const r = fast ? 0.02 : Math.max(this.patch.ops[v.n - 1].env.r, 0.005);
      hold(v.env.gain, time);
      v.env.gain.setTargetAtTime(0, time, r / 4);
      if (v.role === 'carrier') end = Math.max(end, time + r * 1.6);
    }
    end += 0.05;
    let first = true;
    for (const v of voice.ops.values()) {
      v.osc.stop(end);
      if (first) {
        first = false;
        v.osc.onended = () => this.cleanup(voice);
      }
    }
  }

  kill(voice, time) {
    if (!voice.released) this.release(voice, time, true);
  }

  cleanup(voice) {
    voice.done = true;
    for (const v of voice.ops.values()) {
      v.osc.disconnect();
      v.env.disconnect();
    }
    voice.vout.disconnect();
    this.voices = this.voices.filter((v) => v !== voice);
  }

  /** Bring held notes up to date after the patch changed under them. */
  refresh() {
    const t = this.ctx.currentTime;
    const alg = algorithm(this.patch.algorithm);
    for (const voice of this.voices) {
      if (voice.done) continue;
      for (const v of voice.ops.values()) {
        const o = this.patch.ops[v.n - 1];
        v.osc.frequency.setTargetAtTime(voice.f0 * o.ratio, t, 0.01);
        v.osc.detune.setTargetAtTime((o.detune ?? 0) + this.bendSemis * 100, t, 0.01);
        if (v.n === alg.feedback) v.osc.setPeriodicWave(this.patch.feedback > 0 ? this.wave(this.patch.feedback) : this.wave(0));
        if (voice.released) continue;
        v.peak = this.peak(o, v.role, voice.f0 * o.ratio, voice.vel);
        hold(v.env.gain, t);
        v.env.gain.setTargetAtTime(v.peak * o.env.s, t, 0.02);
      }
    }
  }

  bend(semitones) {
    this.bendSemis = semitones;
    const t = this.ctx.currentTime;
    for (const voice of this.voices) {
      for (const v of voice.ops.values()) v.osc.detune.setTargetAtTime((this.patch.ops[v.n - 1].detune ?? 0) + semitones * 100, t, 0.01);
    }
  }

  /** The mod wheel: more modulation on every modulator, so a brighter tone. */
  mod(v01) {
    this.modAmount = Math.max(0, Math.min(1, v01));
    this.refresh();
  }

  /** How far through its envelope each operator of the newest sounding note is, 0..1. */
  levels() {
    const voice = [...this.voices].reverse().find((v) => !v.done);
    const out = [0, 0, 0, 0];
    if (!voice) return out;
    for (const v of voice.ops.values()) out[v.n - 1] = v.peak > 0 ? Math.min(1, v.env.gain.value / v.peak) : 0;
    return out;
  }

  get sounding() {
    return this.voices.filter((v) => !v.done).length;
  }

  allOff() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) this.kill(v, t);
  }
}
