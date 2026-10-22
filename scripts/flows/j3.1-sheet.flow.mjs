// J3.1 Read the sheet: the chart, notation and tab of the variations I've
// chosen, or every variation; one section or all; drums if I ask. On a
// phone it fits the width: nothing cut off at the sheet's edge.
// docs/flows.md#j31
import { readFileSync } from 'node:fs';
import { compileSong } from '../../js/song.js';

// What the sheet should hold, from the song file: every variation of every
// part but the drums, and the drums' in a section.
const song = compileSong(JSON.parse(readFileSync(new URL('../../songs/fire-on-the-mountain.json', import.meta.url))));
const variations = (sid, keep) => song.parts.filter(keep).reduce((n, p) => n + (song.sections[sid].parts[p.id]?.length ?? 0), 0);
const every = song.order.reduce((n, sid) => n + variations(sid, (p) => p.instrument !== 'drums'), 0);
const jamDrums = variations('jam', (p) => p.instrument === 'drums');

const sheet = () => ({
  head: document.querySelector('.sheet-head .byline')?.textContent,
  sections: [...document.querySelectorAll('.sheet .sheet-section:not(.sheet-lessons) h2')].map((h) => h.textContent),
  charts: [...document.querySelectorAll('.sheet .chart')].map((c) => c.querySelectorAll('.chart-bar').length),
  figs: [...document.querySelectorAll('.sheet figure.sheet-part figcaption')].map((f) => f.textContent),
  staves: document.querySelectorAll('.sheet figure.sheet-part svg').length,
  plan: document.querySelectorAll('.sheet-lessons li').length,
  wide: document.documentElement.scrollWidth > innerWidth + 1,
  // what's written out but runs past the sheet's right edge, cut off
  over: (() => {
    const edge = document.querySelector('.sheet').getBoundingClientRect().right;
    const out = new Set();
    for (const el of document.querySelectorAll('.sheet figure.sheet-part .pad, .sheet figure.sheet-part .tok, .sheet figure.sheet-part svg, .sheet .chart')) {
      if (el.getBoundingClientRect().right > edge + 1) out.add(el.closest('figure')?.querySelector('figcaption')?.textContent ?? 'the chart');
    }
    return [...out];
  })(),
});

export default {
  id: 'J3.1',
  title: 'Read the chart, notation and tab',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open on the Sheet', () => t.open('fire-on-the-mountain/sheet'));
    await page.locator('.sheet figure.sheet-part svg').first().waitFor();
    let v = await page.evaluate(sheet);
    t.expect('it heads with the key, meter and tempo', /B mixolydian \/ 4\/4 \/ 100 bpm/.test(v.head), v.head);
    t.expect('Vamp and Jam each have their four-bar chart', JSON.stringify(v.sections) === '["Vamp","Jam"]' && v.charts.every((n) => n === 4), v);
    t.expect('the chosen parts are written out: bass, rhythm guitar and keys (lead is off, drums left out)',
      v.figs.length === 6 && !v.figs.some((f) => /^Drums|^Lead/.test(f)), v.figs);
    t.expect('in notation and tab', v.staves >= 4, v.staves);
    t.expect('the practice plan lists the lessons', v.plan === song.lessons.length, v.plan);
    t.expect('nothing runs off the side of the page', !v.wide, await page.evaluate(() => document.documentElement.scrollWidth));
    t.expect('everything written out fits inside the sheet', !v.over.length, v.over);

    await t.step('show Every variation', () => t.tap(page.locator('.sheet-controls [role=radio]', { hasText: 'Every variation' })));
    await t.poll((n) => document.querySelectorAll('.sheet figure.sheet-part').length >= n, every, 8000);
    v = await page.evaluate(sheet);
    t.expect(`every variation of every part but the drums is written out (${every})`, v.figs.length === every, v.figs.length);

    await t.step('pick the Jam section and Include drums', async () => {
      await page.locator('.sheet-controls select[aria-label=Section]').selectOption('jam');
      await t.tap(page.locator('.sheet-controls label.check'));
    });
    await t.poll(() => [...document.querySelectorAll('.sheet figure.sheet-part figcaption')].some((f) => /^Drums/.test(f.textContent)), null, 8000);
    v = await page.evaluate(sheet);
    t.expect('only Jam is on the sheet', JSON.stringify(v.sections) === '["Jam"]', v.sections);
    t.expect(`with its ${jamDrums} drum grooves`, v.figs.filter((f) => /^Drums/.test(f)).length === jamDrums, v.figs);
    t.expect('the drum grids fit inside the sheet too', !v.over.length && !v.wide, v.over);
  },
};
