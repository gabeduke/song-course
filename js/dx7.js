// A lab patch (js/fm.js: four operators, an algorithm, envelopes in
// seconds) as a Yamaha DX7 single-voice SysEx message, the format the
// SMK-37+VA firmware loads into the preset it's playing. The DX7 has six
// operators and 32 fixed algorithms: each lab algorithm goes to the one
// that holds its wiring, on operators whose feedback lands where the
// lab's does, and the operators it doesn't need are silent.
//
// Levels and times don't map one to one (the DX7's are rates and levels on
// 0–99 log scales), so the result is close, not identical: a starting
// point to finish on the keyboard.

const MAX_INDEX = 10; // js/fm.js: a modulator at level 1

// lab algorithm id -> [DX7 algorithm (1–32), DX7 operator for lab op 1..4]
const ALGS = {
  pair: [5, [5, 6]],
  stack: [1, [3, 4, 5, 6]],
  'two-pairs': [5, [1, 2, 5, 6]],
  'three-to-one': [13, [3, 4, 5, 6]],
  'one-to-three': [22, [3, 4, 5, 6]],
  additive: [32, [3, 4, 5, 6]],
};

const clamp = (v, lo = 0, hi = 99) => Math.max(lo, Math.min(hi, Math.round(v)));

/** Seconds for a full sweep to a DX7 EG rate: 99 is a few milliseconds, 0 about half a minute. */
export function rateFor(seconds) {
  return clamp(99 - 7.5 * Math.log2(Math.max(seconds, 0.003) / 0.003));
}

/** An amplitude (0..1) to a DX7 level: about 0.75 dB a step. */
export function levelFor(amp) {
  return amp <= 0.0005 ? 0 : clamp(99 + (20 * Math.log10(amp)) / 0.75);
}

/** A modulation index to the output level that gives it (12.6 at 99, halving every 8). */
export function levelForIndex(index) {
  return index <= 0.01 ? 0 : clamp(99 + 8 * Math.log2(index / 12.6));
}

export function coarseFine(ratio) {
  if (ratio < 1) return [0, clamp((ratio / 0.5 - 1) * 100)];
  const coarse = Math.min(31, Math.floor(ratio));
  return [coarse, clamp((ratio / coarse - 1) * 100)];
}

/** The 155 voice parameters (VCED), operator 6 first. */
export function vced(patch) {
  const [alg, map] = ALGS[patch.algorithm] ?? ALGS.pair;
  const labAlg = patch.algorithm;
  const carriersByAlg = { pair: [1], stack: [1], 'two-pairs': [1, 3], 'three-to-one': [1], 'one-to-three': [1, 2, 3], additive: [1, 2, 3, 4] };
  const carriers = carriersByAlg[labAlg] ?? [1];
  const used = new Map(map.map((dx, i) => [dx, i]));
  const p = [];
  for (let dx = 6; dx >= 1; dx--) {
    const i = used.get(dx);
    const o = i === undefined ? null : patch.ops[i];
    if (!o) {
      p.push(99, 99, 99, 99, 0, 0, 0, 0, 39, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 7);
      continue;
    }
    const carrier = carriers.includes(i + 1);
    const { a, d, s, r } = o.env;
    const peak = 99;
    const sus = levelFor(s); // the envelope is relative to the operator's own level
    const ol = carrier ? levelFor(o.level) : levelForIndex(o.level * MAX_INDEX);
    const [coarse, fine] = coarseFine(o.ratio);
    const det = clamp(7 + (o.detune ?? 0) / 7, 0, 14);
    p.push(
      rateFor(a), rateFor(d), 99, rateFor(r), // R1–R4
      peak, sus, sus, 0, // L1–L4
      39, 0, 0, 0, 0, // break point C3, no level scaling
      1, // rate scaling
      0, // amp mod sensitivity
      carrier ? 1 : 3, // key velocity sensitivity
      o.level > 0 ? ol : 0,
      0, coarse, fine, det, // ratio mode
    );
  }
  p.push(99, 99, 99, 99, 50, 50, 50, 50); // pitch EG: flat
  p.push(alg - 1, clamp((patch.feedback ?? 0) * 7, 0, 7), 1); // algorithm, feedback, osc key sync
  p.push(35, 0, 0, 0, 1, 0, 3); // LFO: speed, delay, pitch depth, amp depth, sync, triangle, pitch mod sens (the mod wheel)
  p.push(24); // transpose: C3
  const name = String(patch.name ?? 'Woodshed').replace(/[^\x20-\x7e]/g, '?').padEnd(10).slice(0, 10);
  for (const ch of name) p.push(ch.charCodeAt(0));
  return p;
}

/** F0 43 00 00 01 1B <155 bytes> <checksum> F7 */
export function dx7Voice(patch) {
  const data = vced(patch);
  if (data.length !== 155) throw new Error(`DX7 voice came out ${data.length} bytes, not 155`);
  const sum = data.reduce((acc, b) => acc + b, 0);
  return new Uint8Array([0xf0, 0x43, 0x00, 0x00, 0x01, 0x1b, ...data, (-sum) & 0x7f, 0xf7]);
}
