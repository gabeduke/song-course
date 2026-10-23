// FM lab: four operators, the wiring between them, and what comes out. A
// lesson with "lab": "fm" opens it under the neck. Turn an operator's ratio
// or level and the predicted sidebands move on the spectrum; play it from
// the keys here, or a MIDI keyboard (its knobs set levels and ratios).

import { h, s, clear, segmented, toast } from './dom.js';
import { Piano } from './piano.js';
import {
  ALGORITHMS, PRESETS, COARSE, MAX_INDEX, FmSynth, algorithm, clonePatch, opRole,
  predictedPartials, harmonicity, previewWave,
} from './fm.js';

const ROLES = ['root', 'third', 'fifth', 'seventh']; // op 1–4 wear these colours
const SPAN = 16; // the spectrum shows up to the 16th harmonic of the note
const TIMES = { a: 2, d: 4, r: 4 }; // slider maxima, seconds
const KNOB_RATIOS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

const fmtTime = (t) => (t < 1 ? `${Math.round(t * 1000)} ms` : `${t.toFixed(1)} s`);
const fmtRatio = (r) => `×${r.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}`;
const fmtX = (x) => String(Math.round(x * 100) / 100);
const splitRatio = (r) => {
  const coarse = r < 1 ? 0.5 : Math.min(16, Math.floor(r + 1e-6));
  return { coarse, fine: Math.round((r - coarse) * 100) / 100 };
};

export function mountFmLab(el, app, lesson = {}) {
  const { engine } = app;
  let presetId = PRESETS[lesson.patch] ? lesson.patch : 'organ';
  let patch = clonePatch(PRESETS[presetId]);
  let synth = null;
  let out = null;
  let analyser = null;
  let raf = 0;
  let hold = false;
  let played = 0;
  let lastNote = 57;
  let dirty = true;
  let idleSince = 0;
  const pointers = new Map(); // pointerId -> { midi, up, started }
  const narrow = matchMedia('(max-width: 640px)').matches;

  // ---------------------------------------------------------------- audio
  async function ensureAudio() {
    await engine.init();
    if (synth) return;
    const ctx = engine.ctx;
    out = ctx.createGain();
    out.connect(engine.bus('_lab', 0.8));
    analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.5;
    out.connect(analyser);
    synth = new FmSynth(ctx, out);
    synth.setPatch(patch);
  }

  function play(midi, vel = 0.8) {
    synth.noteOn(midi, vel);
    lastNote = midi;
    played++;
    root.dataset.played = String(played);
    root.dataset.lastNote = String(midi);
    piano.ping(midi, 'root');
  }

  // ---------------------------------------------------------------- layout
  const root = h('div.fml', { dataset: { played: '0' } });
  const head = h('div.fml-head');
  const algos = h('div.fml-algos', { role: 'radiogroup', 'aria-label': 'Algorithm' });
  const diagram = h('figure.fml-diagram');
  const waveCanvas = h('canvas.fml-canvas', { 'aria-hidden': 'true' });
  const specCanvas = h('canvas.fml-canvas', { 'aria-hidden': 'true' });
  const specMarks = s('svg', { class: 'fml-marks', viewBox: `0 0 ${SPAN} 1`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  const specBox = h('div.fml-spec-box', specCanvas, specMarks,
    h('div.fml-axis', { 'aria-hidden': 'true' }, Array.from({ length: SPAN / 2 + 1 }, (_, i) => h('span', { style: { left: `${(i * 2 / SPAN) * 100}%` } }, i ? `×${i * 2}` : '0'))));
  const explain = h('p.fml-explain', { 'aria-live': 'polite' });
  const ops = h('div.fml-ops');
  const pianoHolder = h('div.fml-keys');
  const play_ = h('div.fml-play');

  root.append(
    head,
    algos,
    h('div.fml-main',
      diagram,
      h('div.fml-scopes',
        h('figure.fml-wave', h('div.fml-wave-box', waveCanvas), h('figcaption', 'Waveform: one stretch of the sound')),
        h('figure.fml-spec', specBox, h('figcaption', h('span.fml-key-dot'), 'Predicted partials, as multiples of the note. ', h('span.muted', 'Bars: what you hear.'))))),
    explain,
    ops,
    play_,
  );
  clear(el).append(root);

  function renderHead() {
    const canSend = !!app.controller?.canSendPatch?.();
    put(clear(head),
      h('div.fml-title',
        h('h2', 'FM lab'),
        h('p.muted', 'Four sine-wave operators. Carriers are what you hear; modulators only change a carrier’s tone. Play a key, then turn things.')),
      h('div.fml-pick',
        h('div.field', h('span', 'Start from'),
          segmented('Sound', Object.entries(PRESETS).map(([id, p]) => ({ value: id, label: p.name })), presetId, (id) => {
            presetId = id;
            patch = clonePatch(PRESETS[id]);
            synth?.setPatch(patch);
            renderAll();
          }, { small: true })),
        canSend ? h('button.btn.btn-quiet.fml-send', {
          type: 'button',
          title: 'Load this sound into the keyboard’s own FM engine',
          onclick: () => Promise.resolve(app.controller.sendFmPatch(patch)).then(
            () => toast(`Sent “${patch.name}” to the keyboard`),
            (e) => toast(e?.message ?? String(e))),
        }, 'Send to keyboard') : null));
  }

  function put(node, ...kids) {
    node.append(...kids.filter(Boolean));
    return node;
  }

  // ---------------------------------------------------------------- algorithms
  function algoIcon(alg) {
    const W = 44;
    const H = 34;
    const cols = Math.max(...Object.values(alg.at).map(([c]) => c)) + 1;
    const rows = Math.max(...Object.values(alg.at).map(([, r]) => r)) + 1;
    const pos = (n) => {
      const [c, r] = alg.at[n];
      return [((c + 0.5) / cols) * W, 4 + ((r + 0.5) / rows) * (H - 10)];
    };
    return s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fml-algo-icon', 'aria-hidden': 'true' },
      alg.edges.map(([a, b]) => {
        const [x1, y1] = pos(a);
        const [x2, y2] = pos(b);
        return s('line', { x1, y1, x2, y2, class: 'fml-ai-edge' });
      }),
      s('line', { x1: 3, x2: W - 3, y1: H - 2, y2: H - 2, class: 'fml-ai-out' }),
      alg.carriers.map((n) => {
        const [x, y] = pos(n);
        return s('line', { x1: x, x2: x, y1: y, y2: H - 2, class: 'fml-ai-edge' });
      }),
      alg.ops.map((n) => {
        const [x, y] = pos(n);
        return s('circle', { cx: x, cy: y, r: 3.6, class: `fml-ai-op role-${ROLES[n - 1]}` });
      }));
  }

  function renderAlgos() {
    clear(algos).append(...ALGORITHMS.map((alg) => h('button.fml-algo', {
      type: 'button', role: 'radio', 'aria-checked': String(alg.id === patch.algorithm), class: alg.id === patch.algorithm ? 'on' : '',
      title: alg.about,
      onclick: () => {
        patch.algorithm = alg.id;
        synth?.allOff(); // held notes keep the old wiring; let them go
        synth?.setPatch(patch);
        renderAll();
      },
    }, algoIcon(alg), h('span', alg.name))));
  }

  // ---------------------------------------------------------------- diagram
  const opEls = new Map(); // n -> { glow, ratio, level }
  function renderDiagram() {
    const alg = algorithm(patch.algorithm);
    const BW = 96;
    const BH = 52;
    const GX = 22;
    const GY = 34;
    const cols = Math.max(...Object.values(alg.at).map(([c]) => c)) + 1;
    const rows = Math.max(...Object.values(alg.at).map(([, r]) => r)) + 1;
    const W = Math.max(cols * BW + (cols - 1) * GX + 60, 220);
    const outY = 14 + rows * BH + (rows - 1) * GY + 34;
    const H = outY + 34;
    const x0 = (W - (cols * BW + (cols - 1) * GX)) / 2;
    const box = (n) => {
      const [c, r] = alg.at[n];
      return { x: x0 + c * (BW + GX), y: 14 + r * (BH + GY) };
    };
    opEls.clear();
    const svg = s('svg', {
      viewBox: `0 0 ${W} ${H}`, class: 'fml-diagram-svg', role: 'img',
      dataset: { ops: String(alg.ops.length), carriers: String(alg.carriers.length), algorithm: alg.id },
      'aria-label': `${alg.name}: ${alg.about}`,
    },
    s('defs', s('marker', { id: 'fml-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
      s('path', { d: 'M0 0 L10 5 L0 10 z', class: 'fml-arrowhead' }))));
    // the output bar and the carriers' lines down to it
    const cs = alg.carriers.map((n) => box(n));
    const ox1 = Math.min(...cs.map((b) => b.x)) - 8;
    const ox2 = Math.max(...cs.map((b) => b.x + BW)) + 8;
    svg.append(s('rect', { x: ox1, y: outY, width: ox2 - ox1, height: 8, rx: 4, class: 'fml-out' }),
      s('text', { x: (ox1 + ox2) / 2, y: outY + 24, 'text-anchor': 'middle', class: 'fml-out-label' }, 'Out: what you hear'));
    for (const n of alg.carriers) {
      const b = box(n);
      svg.append(s('line', { x1: b.x + BW / 2, x2: b.x + BW / 2, y1: b.y + BH, y2: outY, class: 'fml-wire carrier-wire' }));
    }
    // modulation: from the modulator's bottom into the target's top
    for (const [from, to] of alg.edges) {
      const a = box(from);
      const b = box(to);
      svg.append(s('line', {
        x1: a.x + BW / 2, y1: a.y + BH, x2: b.x + BW / 2 + (a.x - b.x) * 0.18, y2: b.y - 2,
        class: `fml-wire mod-wire role-${ROLES[from - 1]}`, 'marker-end': 'url(#fml-arrow)',
      }));
    }
    // feedback: a loop on the right of its operator
    if (patch.feedback > 0 && alg.ops.includes(alg.feedback)) {
      const b = box(alg.feedback);
      svg.append(s('path', {
        d: `M ${b.x + BW} ${b.y + BH * 0.7} h 12 v ${-BH * 0.7 - 10} h ${-BW * 0.28 - 12} v 7`,
        class: `fml-wire fb-wire role-${ROLES[alg.feedback - 1]}`, 'marker-end': 'url(#fml-arrow)',
      }), s('text', { x: b.x + BW + 15, y: b.y + BH * 0.35, class: 'fml-fb-label' }, 'fb'));
    }
    for (const n of alg.ops) {
      const b = box(n);
      const o = patch.ops[n - 1];
      const role = opRole(alg, n);
      const glow = s('rect', { x: b.x - 3, y: b.y - 3, width: BW + 6, height: BH + 6, rx: 12, class: 'fml-glow' });
      const ratio = s('text', { x: b.x + BW - 9, y: b.y + 22, 'text-anchor': 'end', class: 'fml-dop-ratio' }, fmtRatio(o.ratio));
      const level = s('text', { x: b.x + BW - 9, y: b.y + 41, 'text-anchor': 'end', class: 'fml-dop-level' }, levelShort(n));
      svg.append(s('g', { class: `fml-dop role-${ROLES[n - 1]} ${role}`, dataset: { op: n } },
        glow,
        s('rect', { x: b.x, y: b.y, width: BW, height: BH, rx: 9, class: 'fml-dop-box' }),
        s('text', { x: b.x + 12, y: b.y + 35, class: 'fml-dop-n' }, String(n)),
        ratio, level));
      opEls.set(n, { glow, ratio, level });
    }
    clear(diagram).append(svg, h('figcaption', h('strong', alg.name), ' ', alg.about));
  }

  function levelShort(n) {
    const alg = algorithm(patch.algorithm);
    const o = patch.ops[n - 1];
    return opRole(alg, n) === 'modulator' ? `idx ${(o.level * MAX_INDEX).toFixed(1)}` : `lvl ${o.level.toFixed(2)}`;
  }

  function syncDiagram() {
    for (const [n, e] of opEls) {
      e.ratio.textContent = fmtRatio(patch.ops[n - 1].ratio);
      e.level.textContent = levelShort(n);
    }
  }

  // ---------------------------------------------------------------- operators
  const cards = new Map(); // n -> { sync() }
  function slider(label, { min = 0, max = 1, step = 0.01, value, text, onInput, name }) {
    const outEl = h('output.fml-val', text());
    const input = h('input', {
      type: 'range', min, max, step, value, 'aria-label': name ?? label,
      oninput: (e) => { onInput(Number(e.target.value)); outEl.textContent = text(); },
    });
    return {
      el: h('label.fml-slider', h('span', label), input, outEl),
      set(v) { input.value = v; outEl.textContent = text(); },
    };
  }

  function envPoints(env) {
    // attack, decay, a held stretch, then the release, on a 0..100 × 0..40 box
    const total = env.a + env.d + 0.6 + env.r || 1;
    const k = 100 / total;
    const x1 = env.a * k;
    const x2 = x1 + env.d * k;
    const x3 = x2 + 0.6 * k;
    const y = (v) => 38 - v * 34;
    return `0,${y(0)} ${x1},${y(1)} ${x2},${y(env.s)} ${x3},${y(env.s)} 100,${y(0)}`;
  }

  function renderOps() {
    const alg = algorithm(patch.algorithm);
    cards.clear();
    clear(ops);
    for (let n = 1; n <= 4; n++) {
      const o = patch.ops[n - 1];
      const role = opRole(alg, n);
      const targets = alg.edges.filter(([from]) => from === n).map(([, to]) => to);
      const roleText = role === 'carrier' ? 'carrier: heard' : role === 'modulator' ? `modulates ${targets.join(' and ')}` : 'not used in this wiring';
      const poly = s('polyline', { points: envPoints(o.env), class: 'fml-env-line' });
      const { coarse } = splitRatio(o.ratio);
      const setRatio = (c, f) => { o.ratio = Math.round((c + f) * 100) / 100; changed(n); };
      const ratio = slider('Ratio', {
        min: 0, max: COARSE.length - 1, step: 1, value: COARSE.indexOf(coarse), name: `Operator ${n} ratio`,
        text: () => fmtRatio(o.ratio),
        onInput: (i) => setRatio(COARSE[i], splitRatio(o.ratio).fine),
      });
      const fine = slider('Fine', {
        min: 0, max: 0.99, step: 0.01, value: splitRatio(o.ratio).fine, name: `Operator ${n} fine ratio`,
        text: () => `+${splitRatio(o.ratio).fine.toFixed(2)}`,
        onInput: (f) => setRatio(splitRatio(o.ratio).coarse, f),
      });
      const level = slider(role === 'modulator' ? 'Index' : 'Level', {
        value: o.level, name: `Operator ${n} ${role === 'modulator' ? 'index' : 'level'}`,
        text: () => (role === 'modulator' ? (o.level * MAX_INDEX).toFixed(1) : o.level.toFixed(2)),
        onInput: (v) => { o.level = v; changed(n); },
      });
      const time = (key, label) => slider(label, {
        value: Math.sqrt(o.env[key] / TIMES[key]), step: 0.005, name: `Operator ${n} ${label.toLowerCase()}`,
        text: () => fmtTime(o.env[key]),
        onInput: (v) => { o.env[key] = Math.round(v * v * TIMES[key] * 1000) / 1000; changed(n); },
      });
      const att = time('a', 'Attack');
      const dec = time('d', 'Decay');
      const sus = slider('Sustain', {
        value: o.env.s, name: `Operator ${n} sustain`, text: () => `${Math.round(o.env.s * 100)}%`,
        onInput: (v) => { o.env.s = v; changed(n); },
      });
      const rel = time('r', 'Release');
      const fbOp = alg.feedback === n && role !== 'unused';
      const fb = fbOp ? slider('Feedback', {
        value: patch.feedback, name: `Operator ${n} feedback`, text: () => patch.feedback.toFixed(2),
        onInput: (v) => { const was = patch.feedback > 0; patch.feedback = v; changed(n); if (was !== v > 0) renderDiagram(); },
      }) : null;
      const unused = role === 'unused';
      const card = h('article.fml-op', { class: `role-${ROLES[n - 1]} ${role}`, dataset: { op: n } },
        h('header.fml-op-head', h('span.fml-op-n', String(n)), h('h3', `Operator ${n}`), h('span.fml-op-role', roleText)),
        unused ? h('p.fml-op-idle', 'Pick a four-operator wiring above to bring it in.') : [
          s('svg', { viewBox: '0 0 100 40', preserveAspectRatio: 'none', class: 'fml-env', 'aria-hidden': 'true' }, poly),
          ratio.el, fine.el, level.el, att.el, dec.el, sus.el, rel.el, fb?.el,
        ]);
      cards.set(n, {
        sync() {
          const c = splitRatio(o.ratio);
          ratio.set(COARSE.indexOf(c.coarse));
          fine.set(c.fine);
          level.set(o.level);
          att.set(Math.sqrt(o.env.a / TIMES.a));
          dec.set(Math.sqrt(o.env.d / TIMES.d));
          sus.set(o.env.s);
          rel.set(Math.sqrt(o.env.r / TIMES.r));
          fb?.set(patch.feedback);
        },
        env() { poly.setAttribute('points', envPoints(o.env)); },
      });
      ops.append(card);
    }
  }

  // ---------------------------------------------------------------- predictions
  function renderPredictions() {
    const pred = predictedPartials(patch);
    clear(specMarks);
    const shown = pred.partials.filter((p) => p.x > 0.01 && p.x <= SPAN);
    for (const p of shown) {
      specMarks.append(s('line', {
        x1: p.x, x2: p.x, y1: 1, y2: 1 - Math.min(1, p.amp) * 0.92,
        class: `fml-side${p.k === 0 ? ' centre' : ''}`, 'vector-effect': 'non-scaling-stroke',
      }));
    }
    specBox.dataset.partials = [...new Set(shown.filter((p) => p.amp >= 0.05).map((p) => fmtX(p.x)))].sort((a, b) => a - b).join(',');
    const alg = algorithm(patch.algorithm);
    const { pair } = pred;
    let text;
    if (!pair) {
      const sines = pred.partials;
      text = alg.edges.length
        ? 'Every modulator is at zero, so you hear the carriers as plain sines: one line each. Raise a modulator’s index to bend a carrier’s tone.'
        : `No operator modulates another: ${sines.length} sine${sines.length === 1 ? '' : 's'} mixed at ${sines.map((p) => fmtRatio(p.x)).join(', ')}, like an organ’s drawbars.`;
      if (!sines.length) text = 'Every carrier is at zero: nothing to hear. Raise a carrier’s level.';
    } else {
      const strong = pair.partials.filter((p) => p.amp >= 0.05);
      const kinds = {
        harmonic: 'They land on the note’s own harmonics, so it sounds pitched, like an organ, a reed or brass.',
        'octave-down': 'They land on half-steps of the harmonics: still pitched, but an octave lower than you played.',
        inharmonic: 'They fall between the note’s harmonics, so it rings like a bell or metal instead of a pitched note.',
      };
      const m = patch.ops[pair.modulator - 1];
      const c = patch.ops[pair.carrier - 1];
      const swells = m.env.a > c.env.a * 1.5 && m.env.a > 0.03;
      const fades = !swells && (m.env.s < c.env.s || (m.env.s === c.env.s && m.env.d < c.env.d * 0.8));
      const others = alg.carriers.filter((n) => n !== pair.carrier && patch.ops[n - 1].level > 0);
      text = `Operator ${pair.modulator} (${fmtRatio(pair.modRatio)}) modulates operator ${pair.carrier} (${fmtRatio(pair.carrierRatio)}) at index ${pair.index.toFixed(1)}: `
        + `partials at ${fmtX(pair.carrierRatio)} ± k × ${fmtX(pair.modRatio)}, ${strong.length} of them strong enough to hear. ${kinds[harmonicity(pair.partials)]}`
        + `${pair.index > 0 ? ' More index, more partials, brighter.' : ''}`
        + `${fades ? ` Operator ${pair.modulator}’s envelope dies away before operator ${pair.carrier}’s, so the brightness fades before the note does.` : ''}`
        + `${swells ? ` Operator ${pair.modulator} swells in slower than operator ${pair.carrier}, so the tone brightens after the attack, like brass.` : ''}`
        + `${others.length ? ` Carrier${others.length > 1 ? 's' : ''} ${others.join(' and ')} ${others.length > 1 ? 'are' : 'is'} another layer mixed in, with ${others.length > 1 ? 'their' : 'its'} own partials on the spectrum.` : ''}`;
    }
    explain.textContent = text;
  }

  // ---------------------------------------------------------------- scopes
  const colour = (name) => getComputedStyle(root).getPropertyValue(name).trim() || '#efe6d6';
  const timeData = new Float32Array(4096);
  let freqData = null;

  function sizeCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const hh = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== hh) { c.width = w; c.height = hh; }
    return { w, h: hh, dpr };
  }

  function drawWave(live) {
    const { w, h: H } = sizeCanvas(waveCanvas);
    const g = waveCanvas.getContext('2d');
    g.clearRect(0, 0, w, H);
    g.strokeStyle = colour('--line');
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, H / 2);
    g.lineTo(w, H / 2);
    g.stroke();
    let ys;
    let n;
    if (live) {
      analyser.getFloatTimeDomainData(timeData);
      // start on a rising zero crossing so the trace stands still
      let start = 0;
      for (let i = 1; i < 2048; i++) if (timeData[i - 1] < 0 && timeData[i] >= 0) { start = i; break; }
      const period = engine.ctx.sampleRate / (440 * 2 ** ((lastNote - 69) / 12));
      n = Math.min(2048, Math.max(64, Math.round(period * 3)));
      ys = timeData.subarray(start, start + n);
      let peak = 0;
      for (const v of ys) peak = Math.max(peak, Math.abs(v));
      const k = peak > 0.001 ? 0.9 / peak : 1;
      ys = Array.from(ys, (v) => v * k);
    } else {
      ys = previewWave(patch, 600, 3);
      n = ys.length;
    }
    g.strokeStyle = live ? colour('--text') : colour('--muted');
    g.lineWidth = 2 * Math.min(2, devicePixelRatio || 1);
    g.setLineDash(live ? [] : [6, 5]);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const y = H / 2 - ys[i] * (H / 2) * 0.9;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.stroke();
    g.setLineDash([]);
  }

  function drawSpectrum(live) {
    const { w, h: H } = sizeCanvas(specCanvas);
    const g = specCanvas.getContext('2d');
    g.clearRect(0, 0, w, H);
    g.strokeStyle = colour('--line-soft');
    g.lineWidth = 1;
    for (let k = 1; k <= SPAN; k++) {
      const x = (k / SPAN) * w;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    if (!live) return 0;
    freqData ??= new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(freqData);
    const f0 = 440 * 2 ** ((lastNote - 69) / 12);
    const binHz = engine.ctx.sampleRate / analyser.fftSize;
    const cols = Math.round(w / 2);
    g.fillStyle = colour('--fifth');
    g.globalAlpha = 0.6;
    let loudest = -Infinity;
    for (let i = 0; i < cols; i++) {
      const lo = Math.floor(((i / cols) * SPAN * f0) / binHz);
      const hi = Math.max(lo + 1, Math.floor((((i + 1) / cols) * SPAN * f0) / binHz));
      let db = -Infinity;
      for (let b = lo; b < hi && b < freqData.length; b++) db = Math.max(db, freqData[b]);
      loudest = Math.max(loudest, db);
      const v = Math.max(0, Math.min(1, (db + 90) / 80));
      if (v <= 0) continue;
      g.fillRect((i / cols) * w, H - v * H, Math.max(1, w / cols - 0.5), v * H);
    }
    g.globalAlpha = 1;
    return loudest;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const now = performance.now();
    const sounding = synth?.sounding ?? 0;
    if (sounding) idleSince = 0;
    else if (!idleSince) idleSince = now;
    const live = !!analyser && (sounding > 0 || now - idleSince < 400);
    root.dataset.sounding = String(sounding);
    if (live) {
      drawWave(true);
      const loudest = drawSpectrum(true);
      if (loudest > -80) root.dataset.heard = 'yes';
      const lv = synth?.levels() ?? [0, 0, 0, 0];
      for (const [n, e] of opEls) e.glow.style.opacity = String(lv[n - 1] * 0.9);
      dirty = true;
    } else if (dirty) {
      dirty = false;
      drawWave(false);
      drawSpectrum(false);
      for (const e of opEls.values()) e.glow.style.opacity = '0';
    }
  }

  // ---------------------------------------------------------------- keyboard
  const lo = narrow ? 55 : 48;
  const piano = new Piano(pianoHolder, { lo, hi: 72, label: 'FM lab keyboard' });
  piano.svg.addEventListener('pointerdown', async (e) => {
    const midi = Number(e.target?.dataset?.midi);
    if (!midi) return;
    e.preventDefault();
    const press = { midi, up: false, started: false };
    pointers.set(e.pointerId, press);
    await ensureAudio();
    if (hold && synth.voices.some((v) => v.midi === midi && !v.released)) {
      synth.noteOff(midi);
      pointers.delete(e.pointerId);
      return;
    }
    if (hold) synth.allOff();
    play(midi, 0.8);
    press.started = true;
    if (press.up && !hold) synth.noteOff(midi);
  });
  const lift = (e) => {
    const press = pointers.get(e.pointerId);
    if (!press) return;
    press.up = true;
    if (press.started) {
      pointers.delete(e.pointerId);
      if (!hold) synth?.noteOff(press.midi);
    }
  };
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, lift);

  function renderPlay() {
    const knobs = !!claimRelease;
    put(clear(play_),
      h('div.fml-play-head',
        h('h3', 'Play it'),
        h('button.toggle', {
          type: 'button', 'aria-pressed': String(hold), class: hold ? 'on' : '',
          title: 'Keep a note sounding after you let go, so you can turn things while it rings',
          onclick: (e) => { hold = !hold; if (!hold) synth?.allOff(); e.currentTarget.classList.toggle('on', hold); e.currentTarget.setAttribute('aria-pressed', String(hold)); },
        }, 'Hold notes'),
        h('p.muted', knobs
          ? 'Or play your MIDI keyboard. Its knobs: K1–K4 the four levels, K5–K8 the four ratios; the mod wheel adds brightness.'
          : 'Or play a MIDI keyboard once it’s connected.')),
      pianoHolder);
  }

  // ---------------------------------------------------------------- changes
  function changed(n) {
    synth?.refresh();
    cards.get(n)?.env();
    syncDiagram();
    renderPredictions();
    dirty = true;
  }

  function renderAll() {
    renderHead();
    renderAlgos();
    renderDiagram();
    renderOps();
    renderPredictions();
    dirty = true;
  }

  // ---------------------------------------------------------------- hardware
  const knobFor = (n, kind) => (kind === 'level'
    ? {
      label: `Op ${n} ${opRole(algorithm(patch.algorithm), n) === 'modulator' ? 'index' : 'level'}`,
      value: () => patch.ops[n - 1].level,
      set: (v) => { patch.ops[n - 1].level = Math.round(v * 100) / 100; cards.get(n)?.sync(); changed(n); },
      text: () => levelShort(n),
    }
    : {
      label: `Op ${n} ratio`,
      value: () => {
        const r = patch.ops[n - 1].ratio;
        const i = KNOB_RATIOS.reduce((best, x, j) => (Math.abs(x - r) < Math.abs(KNOB_RATIOS[best] - r) ? j : best), 0);
        return i / (KNOB_RATIOS.length - 1);
      },
      set: (v) => { patch.ops[n - 1].ratio = KNOB_RATIOS[Math.round(v * (KNOB_RATIOS.length - 1))]; cards.get(n)?.sync(); changed(n); },
      text: () => fmtRatio(patch.ops[n - 1].ratio),
    });
  const claimRelease = app.controller?.claim?.({
    owner: 'FM lab',
    knobs: [1, 2, 3, 4].map((n) => knobFor(n, 'level')).concat([1, 2, 3, 4].map((n) => knobFor(n, 'ratio'))),
    notes: {
      on: (midi, vel) => { ensureAudio().then(() => play(midi, vel)); },
      off: (midi) => synth?.noteOff(midi),
    },
    bend: (semis) => synth?.bend(semis),
    mod: (v) => synth?.mod(v),
  }) ?? null;

  // "Send to keyboard" shows only while a keyboard that takes patches is there
  const offMidiChange = app.midiIn?.onChange?.(() => renderHead());

  renderAll();
  renderPlay();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      for (const type of ['pointerup', 'pointercancel']) window.removeEventListener(type, lift);
      if (typeof claimRelease === 'function') claimRelease();
      offMidiChange?.();
      if (synth) {
        synth.allOff();
        const o = out;
        setTimeout(() => o?.disconnect(), 200);
      }
      analyser?.disconnect();
      clear(el);
    },
  };
}
