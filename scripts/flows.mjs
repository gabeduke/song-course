// Runs the user flows (docs/flows.md) in a real browser against the site.
//
//   npm install --no-save playwright@1.49.0 axe-core@4.11.4 && npx playwright install chromium
//   node scripts/flows.mjs                     # every flow on its profiles (tablet + desktop unless it says)
//   node scripts/flows.mjs J4 J1.2             # just these, by id prefix
//   node scripts/flows.mjs --profile=phone     # only that device's runs (tablet,desktop,phone)
//   node scripts/flows.mjs --json=out.json     # results for a machine to read
//   node scripts/flows.mjs --storyboard=dir    # a picture per screen, and dir/index.html
//   node scripts/flows.mjs --storyboard=dir --review   # and Claude's notes on each (opt-in)
//   node scripts/flows.mjs --update-layout-known       # rewrite the layout baseline from this run
//
// With no WOODSHED_URL it serves the repo itself on a free port, as GitHub
// Pages would. Every run gets a fresh browser context, so localStorage
// (drafts, prefs) starts empty. Exits 1 when any core flow fails; a `todo`
// flow (a story not built yet) is reported but never fails the run.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { report, runFlow, scenario, serve, writeJSON } from './flows/harness.mjs';
import { findingKey } from './flows/layout.mjs';
import { writeStoryboard } from './flows/storyboard.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const wanted = args.filter((a) => !a.startsWith('--'));
const picked = opt('profile')?.split(',');
const shots = opt('shots') ?? join(tmpdir(), 'woodshed-flows-shots');
mkdirSync(shots, { recursive: true });
const storyboard = opt('storyboard');
if (storyboard) mkdirSync(storyboard, { recursive: true });
if (args.includes('--review') && !storyboard) {
  console.error('--review reviews the storyboard: give --storyboard=dir too');
  process.exit(2);
}

// The layout baseline: findings the checks met when they came in, each
// for a fix or an allowance (flows/layout-allow.mjs). A new one fails.
const knownFile = join(here, 'flows', 'layout-known.json');
const known = new Set(existsSync(knownFile) ? JSON.parse(readFileSync(knownFile, 'utf8')) : []);

const flows = [];
for (const f of readdirSync(join(here, 'flows')).filter((n) => n.endsWith('.flow.mjs')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))) {
  const mod = await import(pathToFileURL(join(here, 'flows', f)));
  const flow = { ...mod.default, file: f };
  if (!wanted.length || wanted.some((w) => flow.id.toLowerCase().startsWith(w.toLowerCase()))) flows.push(flow);
}
if (!flows.length) {
  console.error(`no flow matches ${wanted.join(' ')}`);
  process.exit(2);
}

let site = null;
let base = process.env.WOODSHED_URL?.replace(/\/$/, '');
if (!base) {
  site = await serve(join(here, '..'));
  base = site.base;
  console.log(`serving the site at ${base}`);
}
// The autoplay flag lets the band start without a real gesture; the flows
// still press Play like a person, it's the headless browser that's strict.
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const results = [];
try {
  for (const flow of flows) {
    const own = flow.profiles ?? ['tablet', 'desktop'];
    for (const p of picked ? own.filter((q) => picked.includes(q)) : own) {
      const r = { ...await runFlow(browser, flow, p, { base, shots, storyboard, known }), file: flow.file };
      console.log(`${scenario(r)}\n  => ${r.ok ? 'pass' : r.status === 'todo' ? 'todo' : 'FAIL'}\n`);
      results.push(r);
    }
  }
} finally {
  await browser.close();
  site?.stop();
}

console.log(`\n${report(results)}`);
const met = new Set(results.flatMap((r) => (r.log ?? []).flatMap((l) => (l.layout ?? [])
  .filter((f) => f.severity === 'fail' || f.severity === 'known').map((f) => `${r.profile}|${findingKey(f)}`))));
if (args.includes('--update-layout-known')) {
  if (wanted.length || picked) {
    console.error('--update-layout-known needs the whole run (no ids, no --profile), or it would drop the rest');
    process.exit(2);
  }
  writeFileSync(knownFile, `${JSON.stringify([...met].sort(), null, 1)}\n`);
  console.log(`layout baseline: ${met.size} findings in ${knownFile}`);
} else if (!wanted.length && !picked) {
  const gone = [...known].filter((k) => !met.has(k));
  if (gone.length) console.log(`layout baseline: ${gone.length} known findings are fixed; drop them with --update-layout-known:\n  ${gone.join('\n  ')}`);
}
const json = opt('json');
if (json) writeJSON(json, results);
if (storyboard) {
  const page = await writeStoryboard(storyboard, results, { review: args.includes('--review'), log: console.log });
  console.log(`storyboard: ${page}`);
}
process.exit(results.some((r) => !r.ok && r.status !== 'todo') ? 1 : 0);
