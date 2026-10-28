// Writes sw.js's precache list: every file the app needs, and a VERSION
// that changes whenever any of them does, so an installed Woodshed picks
// up a deploy. Run after changing anything the app serves:
//   npm run pwa
// `npm test` runs check() and fails if sw.js is out of date.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SW = join(root, 'sw.js');

// What the site serves: the page, its manifest, and these folders. Tests,
// scripts and docs never reach a browser.
const TOP = ['index.html', 'manifest.webmanifest'];
const DIRS = ['css', 'js', 'vendor', 'songs', 'icons'];
const SKIP = /(^|\/)\.|LICENSE$|\.md$/;

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

/** The files to precache, sorted, as paths relative to the site root. */
export function precacheFiles() {
  return [...TOP, ...DIRS.flatMap(walk)].filter((f) => !SKIP.test(f)).map((f) => f.split(sep).join('/')).sort();
}

/** sw.js as it should be: the current list and a hash of every file in it. */
export function buildSw() {
  const files = precacheFiles();
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update('\0').update(readFileSync(join(root, f))).update('\0');
  const block = [
    '// <precache> written by scripts/build-sw.mjs: don\'t edit by hand',
    `const VERSION = '${hash.digest('hex').slice(0, 12)}';`,
    `const FILES = [\n${files.map((f) => `  './${f}',`).join('\n')}\n];`,
    '// </precache>',
  ].join('\n');
  const src = readFileSync(SW, 'utf8');
  return src.replace(/\/\/ <precache>[\s\S]*?\/\/ <\/precache>/, block);
}

export function check() {
  return readFileSync(SW, 'utf8') === buildSw();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const next = buildSw();
  writeFileSync(SW, next);
  console.log(`sw.js: ${precacheFiles().length} files, version ${/VERSION = '(\w+)'/.exec(next)[1]} (${relative(process.cwd(), SW) || 'sw.js'})`);
}
