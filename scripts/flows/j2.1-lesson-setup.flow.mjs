// J2.1 Open a lesson and let it set up the exercise: the loop, tempo,
// variations and neck are what the lesson says; "Set up and play" also
// starts the band. Checked against the lesson in the song file.
// docs/flows.md#j21
import { readFileSync } from 'node:fs';

const song = JSON.parse(readFileSync(new URL('../../songs/fire-on-the-mountain.json', import.meta.url)));
const lesson = (id) => song.lessons.find((l) => l.id === id);

export default {
  id: 'J2.1',
  title: 'Open a lesson and let it set up the exercise',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    const titles = page.locator('.lessons .lesson-title');
    t.expect('the Guitar lessons are listed in order', (await titles.count()) === song.lessons.filter((l) => (l.instrument ?? 'guitar') === 'guitar').length, await titles.count());

    const triads = lesson('triads');
    await t.step(`open lesson 2, “${triads.title}”`, () => t.tap(titles.nth(1)));
    t.expect('it opens with its steps', await titles.nth(1).getAttribute('aria-expanded') === 'true' && await page.locator('.lessons .lesson.open .lesson-steps li').count() === triads.steps.length);

    await t.step('tap Set up this exercise', () => t.tap(page.locator('.lessons .lesson.open button', { hasText: 'Set up this exercise' })));
    let s = await t.state();
    const want = triads.setup;
    t.expect(`the loop is ${want.section} at ${want.tempo} bpm`, s.sectionId === want.section && s.loopMode === 'section' && s.tempo === want.tempo, s);
    t.expect(`rhythm guitar plays ${want.select.rhythm}, the lead is off`, s.variations.rhythm === want.select.rhythm && s.variations.lead === 'off', s.variations);
    t.expect('the neck shows triads on strings 1–3', s.fb.layer === 'triads' && s.fb.triadSet === '123', s.fb);
    t.expect('the transport shows the lesson’s tempo', (await page.locator('#transport .t-bpm strong').textContent()) === String(want.tempo));
    t.expect('it doesn’t start playing by itself', !s.playing);

    const funk = lesson('funk-strum');
    await t.listen();
    await t.step(`open lesson 3, “${funk.title}”, and tap Set up and play`, async () => {
      await t.tap(titles.nth(2));
      await t.tap(page.locator('.lessons .lesson.open button', { hasText: 'Set up and play' }));
    });
    s = await t.until((x) => x.playing);
    t.expect('the band starts', s.playing, s);
    t.expect(`on ${funk.setup.section} at ${funk.setup.tempo} with ${funk.setup.select.rhythm}`, s.sectionId === funk.setup.section && s.tempo === funk.setup.tempo && s.variations.rhythm === funk.setup.select.rhythm, s);
    t.expect('after a count-in', await t.poll(() => (window.__heard?.clicks.length ?? 0) >= 4, null, 4000));
    await t.tap(page.locator('#transport button.play'));
  },
};
