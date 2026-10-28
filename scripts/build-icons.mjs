// Renders the app icons (icons/*.png) from the two SVG masters:
// icons/icon.svg (rounded, for "any") and icons/icon-maskable.svg (full
// bleed, for "maskable" and the iOS home screen, which rounds its own).
// Run it after changing either SVG:
//   node scripts/build-icons.mjs
// Needs the same Playwright the flows use (docs/flows.md).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-192.png', 192],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
for (const [src, out, size] of OUT) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const svg = readFileSync(join(root, 'icons', src), 'utf8').replace('<svg ', `<svg width="${size}" height="${size}" `);
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
  await page.screenshot({ path: join(root, 'icons', out), omitBackground: true });
  await page.close();
  console.log(`icons/${out} (${size}×${size})`);
}
await browser.close();
