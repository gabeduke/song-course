// The user-flow harness: serves the site itself (or attaches to one), opens
// each flow in a fresh browser context per device profile, and records what
// passed. A flow fails on a failed expectation, a thrown step, or any page
// error or console error along the way: a journey that "works" while the
// page throws is how a static site ships broken with green unit tests.
//
// Flows are in scripts/flows/*.flow.mjs; the stories they check are in
// docs/flows.md. Run them with scripts/flows.mjs.

import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { checkLayout, findingKey } from './layout.mjs';

// The Android tablet with a keyboard on USB-C is the main device; the
// laptop is where songs get written and committed; the phone is for a
// glance at the sheet.
export const PROFILES = {
  tablet: { viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: false },
  desktop: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.md': 'text/markdown', '.ico': 'image/x-icon',
};

// serve answers the repo root over HTTP on a free port, as GitHub Pages
// would: no build step, songs fetched as files.
export function serve(root) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = normalize(join(root, path));
    if (!file.startsWith(root + sep) && file !== root) { res.writeHead(403).end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ base: `http://127.0.0.1:${port}`, stop: () => server.close() });
    });
  });
}

// The app's own module, imported again in the page: the same URL is the
// same instance, so a flow reads the store and the player the UI uses.
const APP = "(await import(new URL('js/main.js', document.baseURI).href)).app";

// STATE_FN is what the app holds, read in the page: the store, the player,
// and which variation each part is on in the shown section.
const STATE_FN = `async () => {
  const app = ${APP};
  const st = app.store.state;
  const song = app.song;
  const sec = song?.sections[st.sectionId];
  const variations = {};
  for (const p of song?.parts ?? []) variations[p.id] = app.player.variationFor(st.sectionId, p.id)?.id ?? 'off';
  return {
    songId: st.songId, view: st.view, sectionId: st.sectionId, loopMode: st.loopMode, tempo: st.tempo,
    mutes: st.mutes, solo: st.solo, selection: st.selection, fb: st.fb, lessonId: st.lessonId,
    lessonFilter: st.lessonFilter, playing: app.player.playing, countIn: st.countIn, click: st.click,
    error: st.error, library: st.library, variations,
    sectionVariations: sec ? Object.fromEntries(Object.entries(sec.parts).map(([k, l]) => [k, l.map((v) => v.id)])) : {},
    draft: app.isDraft(), edited: app.isEdited(), rawId: app.raw?.id ?? null,
  };
}`;

// LISTEN_FN wraps the engine's voices once, then starts a fresh log of
// what the band played: each voice call with the part's bus, and the
// clicks. The log is window.__heard; HEARD_FN sums it by part.
const LISTEN_FN = `async () => {
  const app = ${APP};
  const eng = app.engine;
  window.__heard = { calls: [], clicks: [], auditions: [], steps: [], live: [] };
  if (!eng.__flowSpied) {
    eng.__flowSpied = true;
    const busOf = (out) => { for (const [id, b] of eng.buses) if (b.gain === out) return id; return '?'; };
    const voices = { drum: [1, 3], deadNote: [0, 2], strum: [1, 3], bass: [1, 4], epiano: [1, 4], pluck: [1, 3] };
    for (const [m, [ti, oi]] of Object.entries(voices)) {
      const orig = eng[m].bind(eng);
      eng[m] = (...a) => { window.__heard?.calls.push({ m, bus: busOf(a[oi]), t: a[ti], arg: a[0] }); return orig(...a); };
    }
    const click = eng.click.bind(eng);
    eng.click = (time, accent) => { window.__heard?.clicks.push({ t: time, accent }); return click(time, accent); };
    const audition = eng.audition.bind(eng);
    eng.audition = (notes, inst) => { window.__heard?.auditions.push({ notes: notes.map((n) => n.midi), inst: inst ?? 'guitar' }); return audition(notes, inst); };
    const liveOn = eng.liveOn.bind(eng);
    eng.liveOn = (midi, vel, voice) => { window.__heard?.live.push({ midi, voice: voice ?? 'keys' }); return liveOn(midi, vel, voice); };
    app.player.addEventListener('step', (e) => window.__heard?.steps.push({ sid: e.detail.sectionId, step: e.detail.step, arr: e.detail.arrIndex, time: e.detail.time }));
  }
}`;

const HEARD_FN = `() => {
  const h = window.__heard ?? { calls: [], clicks: [], auditions: [], steps: [], live: [] };
  const parts = {};
  for (const c of h.calls) parts[c.bus] = (parts[c.bus] ?? 0) + 1;
  return { parts, calls: h.calls.length, clicks: h.clicks, auditions: h.auditions, steps: h.steps, live: h.live ?? [] };
}`;

// A Web MIDI keyboard the flow plays: navigator.requestMIDIAccess answers
// one input and its output, named "Flow Keys" (or the flow's midi.name, as
// "SMK-37+VA" to be that keyboard). window.__midi.send([status, d1, d2])
// plays it; window.__midi.sent is what the app sent it, with timestamps.
function fakeMidi(name) {
  const input = {
    id: 'flow-keys', name, manufacturer: 'flows', state: 'connected', type: 'input', onmidimessage: null,
  };
  const sent = [];
  const output = {
    id: 'flow-keys-out', name, manufacturer: 'flows', state: 'connected', type: 'output',
    send(data, timestamp) { sent.push({ data: [...data], at: timestamp ?? performance.now() }); },
  };
  const access = { inputs: new Map([[input.id, input]]), outputs: new Map([[output.id, output]]), onstatechange: null, sysexEnabled: false };
  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: async (opts) => { access.sysexEnabled = !!opts?.sysex; return access; },
  });
  window.__midi = {
    sent,
    send(data) {
      input.onmidimessage?.({ data: new Uint8Array(data), timeStamp: performance.now() });
    },
  };
}

// controlKey names a control by where it sits and what it says, without
// the song's own words where they repeat (variation names, pads, lesson
// titles): the coverage map's unit. It runs in the page.
function controlKeyFn() {
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [role=radio], [role=tab], svg.fretboard-svg, svg.piano-svg';
  const view = () => (/^#\/[^/]+\/(\w+)/.exec(location.hash)?.[1] ?? 'practice');
  window.__controlKey = (target) => {
    const el = target?.closest?.(CONTROL);
    if (!el) return null;
    let area;
    if (el.closest('#top')) area = 'header';
    else if (el.closest('#transport')) area = 'transport';
    else if (el.closest('.toast')) return null;
    else {
      const sub = el.closest('.part') ? 'Parts › a part'
        : el.closest('.lesson') ? 'Lessons › lesson'
          : el.closest('.draft-actions') ? 'Draft'
            : (el.closest('section[aria-label]')?.getAttribute('aria-label')
              ?? el.closest('section, .sheet-controls')?.classList[0] ?? '');
      area = `${view()}${sub ? ` › ${sub}` : ''}`;
    }
    const group = el.closest('[role=radiogroup][aria-label]');
    let label;
    if (group) label = `${group.getAttribute('aria-label').replace(/^.* variation$/, 'variation')} (choice)`;
    else if (el.matches('.arr-block')) label = 'section block';
    else if (el.matches('.lesson-title')) label = 'lesson title';
    else if (el.matches('.de-pad')) label = 'drum pads';
    else {
      label = (el.getAttribute('aria-label') || (el.tagName === 'SELECT' ? el.closest('label')?.querySelector('span')?.textContent : '')
        || el.textContent || el.getAttribute('placeholder') || el.title || el.tagName.toLowerCase()).trim().replace(/\s+/g, ' ').slice(0, 32);
      if (el.tagName === 'INPUT' && el.closest('label')) label = el.closest('label').querySelector('span')?.textContent?.trim() || label;
      if (el.matches('input.vol')) label = 'volume';
      label = label.replace(/^Record: \d+$/, 'Record tempo').replace(/^Hearing it in the loop$/, 'Hear it in the loop');
    }
    return `${area}|${label}`;
  };
  window.__visibleControls = () => {
    const out = new Set();
    for (const el of document.querySelectorAll(CONTROL)) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || el.closest('[hidden]')) continue;
      if (el.closest('details:not([open])') && !el.closest('details:not([open]) > summary')) continue;
      const k = window.__controlKey(el);
      if (k) out.add(k);
    }
    return [...out];
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// runFlow runs one flow on one profile and answers its result. `t`, the
// flow's handle, is: page, base, profile, given(name, fn) for setup,
// step(name, fn) for what the person does, expect(name, ok, detail) for
// what should follow, wait(ms), tap, poll, and the app's side of things:
// open(hash), state(), listen()/heard() for what the band played,
// download(fn) for a file the app hands over, midi.send() for a keyboard.
//
// Each screen the flow leaves (before every When, and at the end) gets the
// layout checks (layout.mjs); a "fail" among them fails the flow. With
// storyboard, a directory, each of those screens is also saved there as a
// picture, for scripts/flows/storyboard.mjs.
export async function runFlow(browser, flow, profileName, { base, shots, storyboard = null, known = new Set() }) {
  const profile = PROFILES[profileName];
  const context = await browser.newContext({ ...profile, acceptDownloads: true });
  const page = await context.newPage();
  const cpu = Number(process.env.FLOWS_CPU);
  if (cpu > 1) await (await context.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  const checks = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} ${(e.stack || '').split('\n')[1]?.trim() ?? ''}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/fonts\.(googleapis|gstatic)\.com/.test(m.location()?.url ?? '')) return;
    errors.push(`console.error: ${m.text().slice(0, 300)}`);
  });
  page.on('dialog', (d) => {
    // confirm() is how the app asks before it throws a song away: a flow
    // answers it with t.answer(true|false) beforehand; unasked, it's a no.
    t.dialogs.push(d.message());
    d[t.nextAnswer ? 'accept' : 'dismiss']().catch(() => {});
    t.nextAnswer = false;
  });
  if (flow.midi) await context.addInitScript(fakeMidi, flow.midi.name ?? 'Flow Keys');
  await context.addInitScript(controlKeyFn);
  // Which controls a person's input reached, for the coverage map: the
  // page reports its own pointer and key events, however they came.
  const touched = new Set();
  const seen = new Set();
  await page.exposeBinding('__flowTouched', (_, k) => { if (k) touched.add(k); });
  await context.addInitScript(() => {
    for (const type of ['pointerdown', 'keydown', 'input', 'change']) {
      addEventListener(type, (e) => { window.__flowTouched?.(window.__controlKey?.(e.target)); }, true);
    }
  });
  let stage = 'start';
  const log = [];
  let frame = 0;
  const seenLayout = new Set();
  const screen = async () => {
    const at = log.at(-1);
    if (!at || at.layout || page.isClosed() || page.url() === 'about:blank') return;
    at.layout = (await checkLayout(page, { touch: profile.hasTouch })).map((f) => {
      const k = findingKey(f);
      if (f.severity === 'fail' && known.has(`${profileName}|${k}`)) f = { ...f, severity: 'known' };
      if (seenLayout.has(k)) return { ...f, again: true };
      seenLayout.add(k);
      return f;
    });
    for (const k of await page.evaluate(() => window.__visibleControls?.() ?? []).catch(() => [])) seen.add(k);
    if (storyboard) {
      const file = `${flow.id}-${profileName}-${String(++frame).padStart(2, '0')}.jpg`;
      await page.screenshot({ path: join(storyboard, file), type: 'jpeg', quality: 60 }).then(() => { at.shot = file; }, () => {});
    }
  };
  const t = {
    page, base, profile: profileName, touch: profile.hasTouch,
    dialogs: [], nextAnswer: false,
    wait: (ms) => page.waitForTimeout(ms),
    expect(name, ok, detail = '') {
      const c = { name, ok: !!ok, detail: ok ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)) };
      checks.push(c);
      log.push({ kind: 'then', ...c });
      return !!ok;
    },
    async given(name, fn) {
      stage = name;
      log.push({ kind: 'given', name, ok: true });
      return fn();
    },
    async step(name, fn) {
      await screen();
      stage = name;
      log.push({ kind: 'when', name, ok: true });
      return fn();
    },
    // tap is a finger's tap on a touch profile, a click otherwise.
    tap: (locator) => (profile.hasTouch ? locator.tap() : locator.click()),
    // tapAt taps a point on the screen: a finger, or the mouse.
    tapAt: (x, y) => (profile.hasTouch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)),
    // tapFret taps string s (1 = high e), fret f on the first fretboard
    // inside `scope`, as a person would: the neck scrolled to the middle of
    // the screen, then a tap on the spot. A spot under something else (the
    // transport) throws, since a finger would land on that instead.
    async tapFret(string, fret, scope = '') {
      const svg = page.locator(`${scope} svg.fretboard-svg`.trim()).first();
      const pt = await svg.evaluate((el, [s, f]) => {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
        const NUT = 54, W = 1000, TOP = 26, BOTTOM = 180, FRETS = 15;
        const k = 1 - 2 ** (-FRETS / 12);
        const fx = (n) => NUT + (W - NUT - 14) * ((1 - 2 ** (-n / 12)) / k);
        const p = el.createSVGPoint();
        p.x = f === 0 ? NUT - 26 : (fx(f - 1) + fx(f)) / 2;
        p.y = TOP + ((s - 1) * (BOTTOM - TOP)) / 5;
        let q = p.matrixTransform(el.getScreenCTM());
        const scroller = el.closest('.fb-scroll');
        if (scroller && (q.x < 8 || q.x > innerWidth - 8)) {
          scroller.scrollLeft += q.x - innerWidth / 2;
          q = p.matrixTransform(el.getScreenCTM());
        }
        const hit = document.elementFromPoint(q.x, q.y);
        return { x: q.x, y: q.y, on: !!hit && el.contains(hit), hit: hit ? `${hit.tagName.toLowerCase()}${hit.className?.baseVal ?? hit.className ? `.${String(hit.className?.baseVal ?? hit.className).split(' ')[0]}` : ''}` : 'nothing' };
      }, [string, fret]);
      if (!pt.on) throw new Error(`string ${string} fret ${fret} is under ${pt.hit}`);
      await t.tapAt(pt.x, pt.y);
    },
    // drag slides a range input's thumb to `to` (0..1 of its track), by
    // finger on a touch profile (real touch events) or by mouse.
    async drag(locator, to) {
      const { box, from } = await locator.evaluate((el) => {
        if (!el.closest('#transport')) el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { box: { x: r.x, y: r.y, w: r.width, h: r.height }, from: (el.value - el.min) / (el.max - el.min) };
      });
      const at = (f) => ({ x: box.x + 8 + f * (box.w - 16), y: box.y + box.h / 2 });
      const a = at(from);
      const b = at(to);
      const hit = await locator.evaluate((el, p) => {
        const h = document.elementFromPoint(p.x, p.y);
        return h === el || el.contains(h) ? '' : (h?.tagName.toLowerCase() ?? 'nothing');
      }, a);
      if (hit) throw new Error(`the slider's thumb is under ${hit}`);
      const n = 12;
      if (profile.hasTouch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
        for (let i = 1; i <= n; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * i) / n, y: a.y }] });
          await page.waitForTimeout(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(b.x, b.y, { steps: n });
        await page.mouse.up();
      }
    },
    // poll re-evaluates fn in the page until it is truthy or the time runs out.
    async poll(fn, arg, timeout = 5000) {
      const end = Date.now() + timeout;
      let v;
      for (;;) {
        v = await page.evaluate(fn, arg);
        if (v || Date.now() > end) return v;
        await page.waitForTimeout(100);
      }
    },
    // open loads the site at #/<hash> and waits for the view to be drawn.
    async open(hash = '') {
      await page.goto(`${base}/${hash ? `#/${hash}` : ''}`);
      await page.waitForFunction(() => document.querySelector('#view')?.children.length > 0 && document.querySelector('#transport')?.children.length > 0, null, { timeout: 15_000 });
    },
    state: () => page.evaluate(`(${STATE_FN})()`),
    // until polls the app's state until fn(state) is truthy.
    async until(fn, timeout = 5000) {
      const end = Date.now() + timeout;
      for (;;) {
        const s = await t.state();
        if (fn(s) || Date.now() > end) return s;
        await sleep(100);
      }
    },
    listen: () => page.evaluate(`(${LISTEN_FN})()`),
    heard: () => page.evaluate(`(${HEARD_FN})()`),
    // answer sets the reply to the next confirm() the app asks.
    answer(yes) { t.nextAnswer = yes; },
    // download runs fn and answers the file it made the app hand over.
    async download(fn) {
      const [d] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), fn()]);
      const bytes = readFileSync(await d.path());
      return { name: d.suggestedFilename(), bytes, text: bytes.toString('utf8') };
    },
    midi: {
      send: (data) => page.evaluate((d) => window.__midi.send(d), data),
      sent: () => page.evaluate(() => window.__midi.sent.map((m) => ({ data: m.data, at: m.at }))),
    },
    toast: () => page.evaluate(() => {
      const el = document.querySelector('.toast.show');
      return el ? el.textContent : '';
    }),
  };
  const started = Date.now();
  let thrown = null;
  try {
    await flow.run(t);
  } catch (e) {
    thrown = `threw at "${stage}": ${e.message.split('\n')[0]}`;
    const at = log.findLast((l) => l.name === stage);
    if (at) Object.assign(at, { ok: false, detail: e.message.split('\n')[0] });
  }
  await screen().catch(() => {});
  const failed = checks.filter((c) => !c.ok);
  const layout = log.flatMap((l) => (l.layout ?? []).filter((f) => f.severity === 'fail'));
  const ok = !thrown && failed.length === 0 && errors.length === 0 && layout.length === 0;
  let shot = '';
  if (!ok && shots) {
    shot = join(shots, `${flow.id}-${profileName}.png`);
    await page.screenshot({ path: shot, fullPage: false }).catch(() => { shot = ''; });
  }
  await context.close();
  return {
    flow: flow.id, title: flow.title, status: flow.status ?? 'core', profile: profileName,
    ok, ms: Date.now() - started, checks, thrown, errors, shot, log,
    touched: [...touched].sort(), seen: [...seen].sort(),
  };
}

// scenario is one run in Gherkin form: Given/When/Then, a repeat as And,
// each line marked, a layout fail under the line whose screen it was on.
export function scenario(r) {
  const word = { given: 'Given', when: 'When', then: 'Then' };
  const out = [`Scenario: ${r.flow} ${r.title} [${r.profile}]`];
  let last = '';
  for (const l of r.log ?? []) {
    const mark = l.ok ? (l.kind === 'then' ? '✓' : ' ') : '✗';
    out.push(`  ${mark} ${(l.kind === last ? 'And' : word[l.kind]).padStart(5)} ${l.name}${l.ok ? '' : `  -- ${l.detail}`}`);
    last = l.kind;
    for (const f of (l.layout ?? []).filter((x) => x.severity === 'fail' && !x.again)) {
      out.push(`  ✗       layout ${f.rule}: ${f.el} ${f.msg}`);
    }
  }
  for (const e of r.errors ?? []) out.push(`  ✗ ${e}`);
  return out.join('\n');
}

export function report(results) {
  const rows = results.map((r) => {
    let result = r.ok ? 'PASS' : 'FAIL';
    if (r.status === 'todo') result = r.ok ? 'PASS (todo: promote it)' : 'TODO';
    return [`${r.flow} ${r.title}`, r.profile, result, `${(r.ms / 1000).toFixed(1)}s`];
  });
  const head = ['Flow', 'Profile', 'Result', 'Time'];
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells) => `| ${cells.map((c, i) => c.padEnd(w[i])).join(' | ')} |`;
  const out = [line(head), `|${w.map((n) => '-'.repeat(n + 2)).join('|')}|`, ...rows.map(line)];
  const detail = [];
  for (const r of results.filter((x) => !x.ok && x.status !== 'todo')) {
    detail.push(`\n${r.flow} [${r.profile}]`);
    if (r.thrown) detail.push(`  ${r.thrown}`);
    for (const c of r.checks.filter((c) => !c.ok)) detail.push(`  FAIL ${c.name}${c.detail ? ` -- ${c.detail}` : ''}`);
    for (const e of r.errors) detail.push(`  ${e}`);
    for (const l of r.log ?? []) {
      for (const f of (l.layout ?? []).filter((x) => x.severity === 'fail' && !x.again)) detail.push(`  LAYOUT ${f.rule} at "${l.name}": ${f.el} ${f.msg}`);
    }
    if (r.shot) detail.push(`  screenshot: ${r.shot}`);
  }
  const core = results.filter((r) => r.status !== 'todo');
  const todo = results.filter((r) => r.status === 'todo');
  const summary = `${core.filter((r) => r.ok).length}/${core.length} core runs passed` +
    (todo.length ? `; ${todo.filter((r) => r.ok).length}/${todo.length} todo runs pass` : '');
  return `${out.join('\n')}\n${detail.join('\n')}\n\n${summary}`;
}

export function writeJSON(path, results) {
  writeFileSync(path, JSON.stringify(results, null, 2));
}
