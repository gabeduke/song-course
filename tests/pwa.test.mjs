import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { check, precacheFiles } from '../scripts/build-sw.mjs';

const manifest = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
const index = readFileSync('index.html', 'utf8');

/** A PNG's width and height, from its header. */
function pngSize(file) {
  const b = readFileSync(file);
  assert.equal(b.toString('ascii', 1, 4), 'PNG', `${file} isn't a PNG`);
  return `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
}

test('sw.js precaches the current files (run `npm run pwa` if this fails)', () => {
  assert.ok(check(), 'sw.js is out of date: run `npm run pwa` and commit it');
});

test('the manifest has what browsers need to offer Install', () => {
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(manifest[k], k);
  assert.equal(manifest.display, 'standalone');
  assert.ok(new URL(manifest.start_url, 'https://x/a/').href.startsWith(new URL(manifest.scope, 'https://x/a/').href), 'start_url is outside the scope');
  const has = (size, purpose) => manifest.icons.some((i) => i.sizes === size && i.type === 'image/png' && i.purpose === purpose);
  assert.ok(has('192x192', 'any') && has('512x512', 'any'), 'needs 192 and 512 PNG icons');
  assert.ok(has('512x512', 'maskable'), 'needs a maskable icon for Android');
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap((s) => s.icons ?? [])]) {
    assert.ok(existsSync(icon.src), `${icon.src} is missing`);
    if (icon.type === 'image/png' || icon.src.endsWith('.png')) assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  }
  for (const s of manifest.shortcuts) assert.ok(s.url.startsWith('./'), `${s.name}: keep shortcut urls relative, for the /song-course/ path`);
});

test('the page links the manifest and icons, and everything it loads is precached', () => {
  assert.match(index, /<link rel="manifest" href="manifest\.webmanifest">/);
  assert.match(index, /<link rel="apple-touch-icon" href="icons\/apple-touch-icon\.png">/);
  assert.equal(pngSize('icons/apple-touch-icon.png'), '180x180');
  const files = new Set(precacheFiles());
  const local = [...index.matchAll(/(?:href|src)="([^"#:]+)"/g)].map((m) => m[1]);
  assert.ok(local.length >= 6, local);
  for (const f of local) assert.ok(files.has(f), `${f} isn't precached`);
  assert.ok(!precacheFiles().some((f) => /^(tests|scripts|docs|node_modules)\//.test(f)));
});
