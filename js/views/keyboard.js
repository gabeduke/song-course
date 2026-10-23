// The Keyboard sheet: the MIDI keyboard's panel drawn with what each
// control does in Woodshed right now, lit as you touch it; where your
// notes sound; what Woodshed sends the keyboard; Learn; and how to connect
// on a tablet. Opened from the top bar.

import { h, s, clear, put, segmented, toast } from '../dom.js';
import { midiIn } from '../midi-in.js';
import { PANEL, LEARNABLE, describeBinding } from '../devices.js';

const KEYS_LO = 48; // the SMK's 37 keys at octave 0: C3–C6
const KEYS_HI = 84;
const WHITE = [0, 2, 4, 5, 7, 9, 11];

const NAMES = {
  seqplay: 'SEQ PLAY', seqrec: 'SEQ REC',
  ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`k${i + 1}`, `K${i + 1}`])),
  ...Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`f${i + 1}`, `Fader ${i + 1}`])),
  ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`p${i + 1}`, `Pad ${i + 1}`])),
};
export const controlName = (id) => NAMES[id] ?? PANEL.find((c) => c.id === id)?.label ?? id;

export function mountKeyboardSheet(app) {
  const { controller: ctl, engine } = app;
  const dialog = h('dialog.kb-sheet', { 'aria-labelledby': 'kb-title' });
  document.body.append(dialog);
  const offs = [];
  let monitor = [];

  // ---------------------------------------------------------------- panel map
  const map = s('svg', { viewBox: '0 0 1000 300', class: 'kb-map', role: 'img', 'aria-label': 'Keyboard controls' });
  const hit = (id) => map.querySelector(`[data-control="${id}"]`);

  function drawMap() {
    clear(map);
    const binds = ctl.bindings();
    map.append(s('rect', { x: 4, y: 4, width: 992, height: 292, rx: 18, class: 'kb-body' }));
    map.append(s('rect', { x: 128, y: 20, width: 92, height: 88, rx: 8, class: 'kb-screen' }));
    map.append(s('text', { x: 174, y: 60, 'text-anchor': 'middle', class: 'kb-screen-t' }, ctl.profile.name));
    map.append(s('text', { x: 174, y: 78, 'text-anchor': 'middle', class: 'kb-screen-s' }, ctl.connected ? 'connected' : 'not connected'));
    for (const c of PANEL) {
      const bound = !!binds[c.id] || (c.id === 'seqplay' && !!binds.seqplay);
      const a = bound ? ctl.actionFor(c.id) : null;
      const live = c.id === 'bend' || c.id === 'mod';
      const cls = `kb-c kb-${c.kind}${bound || live ? ' bound' : ''}${a ? ' acts' : ''}`;
      const learnable = LEARNABLE.includes(c.id);
      const g = s('g', {
        class: cls, dataset: { control: c.id },
        ...(learnable ? { tabindex: -1, onclick: () => learnOne(c.id) } : {}),
      });
      const tip = a ? `${controlName(c.id)}: ${a.label}` : bound ? `${controlName(c.id)}: not used in this view` : `${controlName(c.id)}: ${c.does} (on the keyboard)`;
      g.append(s('title', tip));
      if (c.kind === 'knob') {
        g.append(s('circle', { cx: c.cx, cy: c.cy, r: c.r, class: 'kb-shape' }), s('line', { x1: c.cx, y1: c.cy, x2: c.cx, y2: c.cy - c.r + 4, class: 'kb-tick' }));
        g.append(s('text', { x: c.cx, y: c.cy + c.r + 13, 'text-anchor': 'middle', class: 'kb-cap' }, short(a?.short ?? a?.label ?? (bound ? c.label : c.does), 9)));
      } else if (c.kind === 'fader') {
        g.append(s('rect', { x: c.cx - 3, y: c.y, width: 6, height: c.h, rx: 3, class: 'kb-track' }), s('rect', { x: c.cx - 15, y: c.y + c.h / 2 - 7, width: 30, height: 14, rx: 3, class: 'kb-shape kb-cap-thumb' }));
        g.append(s('text', { x: c.cx, y: c.y + c.h + 14, 'text-anchor': 'middle', class: 'kb-cap' }, short(a?.short ?? a?.label ?? c.does, 9)));
      } else if (c.kind === 'pad') {
        g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 6, class: 'kb-shape' }));
        g.append(s('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + 4, 'text-anchor': 'middle', class: 'kb-pad-t' }, short(a?.short ?? a?.label ?? '', 8)));
      } else if (c.kind === 'wheel') {
        g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 12, class: 'kb-shape' }));
        g.append(s('text', { x: c.x + c.w / 2, y: c.y + c.h + 14, 'text-anchor': 'middle', class: 'kb-cap' }, c.label));
      } else {
        g.append(s('rect', { x: c.x, y: c.y, width: c.w, height: c.h, rx: 4, class: 'kb-shape' }));
        g.append(s('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + 3, 'text-anchor': 'middle', class: 'kb-btn-t' }, c.label));
      }
      map.append(g);
    }
    // the keys
    const keys = s('g', { class: 'kb-keys' });
    const whites = [];
    for (let m = KEYS_LO; m <= KEYS_HI; m++) if (WHITE.includes(m % 12)) whites.push(m);
    const ww = 960 / whites.length;
    whites.forEach((m, i) => keys.append(s('rect', { x: 20 + i * ww, y: 196, width: ww - 1.5, height: 92, rx: 3, class: 'kb-white', dataset: { note: m } })));
    for (let m = KEYS_LO; m <= KEYS_HI; m++) {
      if (WHITE.includes(m % 12)) continue;
      const i = whites.indexOf(m - 1);
      keys.append(s('rect', { x: 20 + i * ww + ww * 0.66, y: 196, width: ww * 0.64, height: 56, rx: 2, class: 'kb-black', dataset: { note: m } }));
    }
    map.append(keys);
  }

  const short = (t, n = 12) => (t && t.length > n ? `${t.slice(0, n - 1)}…` : t ?? '');

  function flash(control) {
    const el = hit(control);
    if (!el) return;
    el.classList.remove('hit');
    void el.getBBox?.();
    el.classList.add('hit');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('hit'), 350);
  }

  function keyLight(note, on) {
    const k = map.querySelector(`[data-note="${((note - KEYS_LO) % 37 + 37) % 37 + KEYS_LO}"]`);
    k?.classList.toggle('down', on);
  }

  // ---------------------------------------------------------------- body
  const body = h('div.kb-body-wrap');
  const dev = h('span.kb-dev.muted');
  const learnSlot = h('div.kb-learn-slot');

  function learnOne(control) {
    ctl.learn([control]);
    toast(`Move ${controlName(control)} on the keyboard`);
  }

  async function connect() {
    try {
      await midiIn.enable();
      await engine.init();
      toast(ctl.connected ? `Connected: ${ctl.deviceName}` : 'MIDI is on. Plug the keyboard in, or pair it, and it shows up here.');
    } catch (e) {
      toast(e.message);
    }
    render();
  }

  function rowsFor(ids) {
    return ids.map((id) => {
      const b = ctl.bindings()[id];
      const a = b ? ctl.actionFor(id) : null;
      return h('tr', { class: b ? '' : 'off' },
        h('th', { scope: 'row' }, controlName(id)),
        h('td', a ? a.label : b ? 'Not used here' : PANEL.find((c) => c.id === id) ? `${PANEL.find((c) => c.id === id).does}, on the keyboard` : '—'),
        h('td.kb-sig', describeBinding(b)),
        h('td', h('button.link-btn', { type: 'button', onclick: () => learnOne(id), 'aria-label': `Learn ${controlName(id)}` }, 'Learn')));
    });
  }

  function render() {
    const prof = ctl.profile;
    const learn = ctl.learning;
    dev.textContent = ctl.connected ? `${ctl.deviceName} · ${prof.about}` : '';
    put(clear(learnSlot), learn ? h('div.kb-learn', { role: 'status' },
      h('strong', `Move ${controlName(learn.control)} on the keyboard`),
      h('span.muted', `${learn.left} to go`),
      h('button.btn.btn-quiet', { type: 'button', onclick: () => ctl.skipLearn() }, 'Skip'),
      h('button.btn.btn-quiet', { type: 'button', onclick: () => ctl.stopLearn() }, 'Done')) : null);
    const parts = app.song?.parts.filter((p) => p.instrument !== 'drums') ?? [];
    put(clear(body),
      !midiIn.supported ? h('p.kb-warn', 'This browser has no Web MIDI. On a tablet use Chrome on Android; Safari and every browser on an iPad can’t reach MIDI devices.')
        : !midiIn.enabled ? h('div.kb-connect', h('p', 'Plug the keyboard in over USB (a USB-C OTG adapter on a tablet), or pair it over Bluetooth, then:'),
          h('button.btn', { type: 'button', onclick: connect }, 'Connect keyboard'))
          : !ctl.connected ? h('p.kb-warn', 'MIDI is on, but no keyboard is connected. Plug it in or pair it; it shows up here by itself.') : null,

      h('div.kb-map-wrap', map),
      h('p.kb-legend.muted', h('span.kb-sw.bound'), 'Sends to Woodshed', h('span.kb-sw'), 'Works on the keyboard only. Tap a control to learn it.'),

      h('div.kb-grid',
        h('section.kb-card',
          h('h3', 'Your notes'),
          h('div.field', h('span', 'Sound from'),
            segmented('Sound from', [
              { value: 'auto', label: `Auto (${ctl.profile.engine?.notes ? 'keyboard' : 'Woodshed'})` },
              { value: 'keyboard', label: 'The keyboard' },
              { value: 'woodshed', label: 'Woodshed' },
            ], ctl.prefs.sound, (v) => { ctl.set({ sound: v }); render(); }, { small: true })),
          h('div.field', h('span', 'Woodshed plays them as'),
            segmented('Voice', [
              { value: 'auto', label: 'Follow the lesson' }, { value: 'keys', label: 'E-piano' }, { value: 'synth', label: 'FM synth' },
              { value: 'guitar', label: 'Guitar' }, { value: 'bass', label: 'Bass' },
            ], ctl.prefs.voice, (v) => { ctl.set({ voice: v }); render(); }, { small: true })),
          h('label.field', h('span', 'Level'), h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: ctl.prefs.liveVol, 'aria-label': 'My sound level', oninput: (e) => ctl.set({ liveVol: Number(e.target.value) }) })),
          h('p.muted.kb-note', ctl.soundFrom() === 'keyboard'
            ? 'The keyboard plays itself from its headphone jack. To hear everything in one place, set the tablet’s sound to the keyboard (below), or switch the keyboard’s Local Control off (GLOBE › MIDI) and pick Woodshed here.'
            : 'Woodshed plays your keys through this device, with the pitch bend, mod wheel and sustain pedal.'),
          outputPicker()),

        h('section.kb-card',
          h('h3', 'Pads'),
          segmented('Pads do', [
            { value: 'auto', label: 'Auto' }, { value: 'mix', label: 'Sections and parts' }, { value: 'drums', label: 'Drums' },
          ], ctl.prefs.padMode, (v) => { ctl.set({ padMode: v }); render(); }, { small: true }),
          h('p.muted.kb-note', ctl.padMode() === 'drums'
            ? 'Bottom row: kick, snare, hat, open hat, clap, rim, tom, crash. Top row: ride and shaker. Velocity counts.'
            : 'Top row: loop a section (in song order). Bottom row: mute or unmute a part, so you can take it over.'),
          prof.engine ? h('h3', 'The keyboard’s sound engine') : null,
          prof.engine ? h('label.field', h('span', 'Play a band part on it'),
            h('select', { onchange: (e) => ctl.set({ sendPart: e.target.value || null }) },
              h('option', { value: '' }, 'None: Woodshed plays the whole band'),
              parts.map((p) => h('option', { value: p.id, selected: ctl.prefs.sendPart === p.id }, p.name)))) : null,
          prof.engine ? h('div.kb-row',
            h('button.toggle', { type: 'button', 'aria-pressed': String(ctl.prefs.clockOut), class: ctl.prefs.clockOut ? 'on' : '', onclick: () => { ctl.set({ clockOut: !ctl.prefs.clockOut }); render(); }, title: 'MIDI clock, Start and Stop, so its arpeggiator and patterns follow the band' }, 'Send clock'),
            h('button.btn.btn-quiet', { type: 'button', disabled: !ctl.output(), onclick: () => ctl.ping() }, 'Test its sound')) : null,
          prof.engine ? h('p.muted.kb-note', 'The part you pick goes to the keyboard on channel 1 and its own voice in Woodshed goes quiet. With Sync On (GLOBE) the keyboard follows the clock.') : null),
      ),

      h('section.kb-card.kb-wide',
        h('div.kb-head', h('h3', 'What each control does'),
          h('div.kb-row',
            h('button.btn', { type: 'button', disabled: !ctl.connected, onclick: () => { ctl.learn(); render(); } }, 'Learn controls'),
            h('button.btn.btn-quiet', { type: 'button', onclick: () => { ctl.resetLearned(); render(); toast(`Back to the ${prof.name} defaults`); } }, 'Reset'))),
        ctl.claimedBy ? h('p.kb-note', `${ctl.claimedBy} has the knobs and keys while it’s open.`) : null,
        h('div.kb-table-wrap', h('table.kb-table',
          h('thead', h('tr', h('th', 'Control'), h('th', 'In Woodshed'), h('th', 'Sends'), h('th', h('span.sr', 'Learn')))),
          h('tbody', rowsFor(['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8', 'f1', 'f2', 'f3', 'f4']), rowsFor(Array.from({ length: 16 }, (_, i) => `p${i + 1}`)), rowsFor(['seqplay', 'seqrec']))))),

      prof.setup?.length ? h('section.kb-card.kb-wide',
        h('h3', `Set up the ${prof.name}`),
        h('ol.kb-steps', prof.setup.map(([what, how]) => h('li', h('strong', `${what}. `), how)))) : null,

      h('details.kb-card.kb-wide',
        h('summary', 'Connecting on a tablet, over Bluetooth, and where the sound goes'),
        h('ul.kb-help',
          h('li', h('strong', 'USB on Android: '), 'a USB-C OTG adapter, then Connect. Android sends the tablet’s sound to the keyboard by itself while it’s plugged in, so the band and your keys both come out of its headphone jack.'),
          h('li', h('strong', 'Bluetooth MIDI on Android: '), 'Chrome only sees a Bluetooth keyboard another app has connected. Pair it in an app such as MIDI BLE Connect, leave that running, then Connect here. USB has less lag.'),
          h('li', h('strong', 'Bluetooth sound: '), 'M-VAVE’s firmware shows up as a Bluetooth speaker (“SMK-37 Elite”) as well as MIDI (“…_BLE”). Under SMK-37+VA that isn’t documented: try it, or use USB.'),
          h('li', h('strong', 'iPad: '), 'no iPad browser can reach MIDI, so the keyboard can’t talk to Woodshed there. Practice on the iPad with the keyboard making its own sound, or use an Android tablet or a computer.'),
          h('li', h('strong', 'On a computer: '), 'Chrome can send Woodshed’s sound to the keyboard’s USB audio: pick it under Output.'))),

      h('section.kb-card.kb-wide',
        h('h3', 'Monitor'),
        h('pre.kb-monitor', { 'aria-live': 'off' }, monitor.length ? monitor.join('\n') : 'Touch something on the keyboard: what it sends shows up here.')),
    );
    drawMap();
  }

  function outputPicker() {
    if (!engine.canPickOutput) return h('p.muted.kb-note', 'This browser picks the output itself: on Android, the keyboard when it’s plugged in.');
    const sel = h('select', {
      'aria-label': 'Output',
      onchange: async (e) => { await engine.setOutput(e.target.value); toast(e.target.value ? 'Sound goes to the keyboard' : 'Sound goes to this device'); },
    }, h('option', { value: '' }, 'This device’s speakers or headphones'));
    navigator.mediaDevices?.enumerateDevices?.().then((devs) => {
      devs.filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'default').forEach((d, i) => {
        sel.append(h('option', { value: d.deviceId, selected: engine.sinkId === d.deviceId }, d.label || `Output ${i + 1}`));
      });
    }).catch(() => {});
    return h('label.field', h('span', 'Output'), sel);
  }

  // ---------------------------------------------------------------- live
  offs.push(midiIn.onAny((ev) => {
    if (ev.type === 'clock') return;
    const line = fmt(ev);
    monitor = [line, ...monitor].slice(0, 8);
    if (!dialog.open) return;
    const pre = dialog.querySelector('.kb-monitor');
    if (pre) pre.textContent = monitor.join('\n');
    if (ev.type === 'on' || ev.type === 'off') keyLight(ev.note, ev.type === 'on');
  }));
  offs.push(ctl.on('touch', ({ control }) => dialog.open && flash(control)));
  offs.push(ctl.on('learn', () => dialog.open && render()));
  offs.push(ctl.on('change', () => dialog.open && render()));
  offs.push(midiIn.onChange(() => dialog.open && render()));

  dialog.append(
    h('header.kb-top',
      h('h2#kb-title', 'Keyboard'),
      dev,
      h('button.icon-btn.kb-close', { type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, '×')),
    learnSlot,
    body);
  dialog.addEventListener('close', () => { if (ctl.learning) ctl.stopLearn(); });

  return {
    open() {
      render();
      if (!dialog.open) dialog.showModal();
    },
    get isOpen() { return dialog.open; },
    destroy() { offs.forEach((f) => f()); dialog.remove(); },
  };
}

function fmt(ev) {
  const ch = ev.ch !== undefined ? ` ch${ev.ch + 1}` : '';
  switch (ev.type) {
    case 'on': return `note on  ${ev.note}  vel ${Math.round(ev.vel * 127)}${ch}`;
    case 'off': return `note off ${ev.note}${ch}`;
    case 'cc': return `CC ${ev.cc} = ${ev.value}${ch}`;
    case 'bend': return `pitch bend ${ev.value.toFixed(2)}${ch}`;
    case 'pc': return `program ${ev.program}${ch}`;
    case 'pressure': return `pressure ${ev.value.toFixed(2)}${ch}`;
    case 'sysex': return `sysex ${ev.data.length} bytes`;
    default: return ev.type;
  }
}
