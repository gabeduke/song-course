// J9.2 A metronome without starting a song: on the book and the lessons
// the transport is a click with its own tempo, beats in a bar, 2 and 4,
// and tap tempo; it keeps going from page to page, stops for a drill, and
// the drill keeps its own tempo with one tap to borrow the metronome's.
// docs/flows.md#j92
const gaps = (clicks) => clicks.slice(1).map((c, i) => c.t - clicks[i].t);

export default {
  id: 'J9.2',
  title: 'A metronome everywhere, with its own tempo',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('the practice book is open', () => t.open('book'));
    const bpm = () => page.locator('#transport .t-bpm strong').textContent();
    t.expect('the transport is a metronome at 80', await page.locator('#transport .t-sec').textContent() === 'Metronome' && await bpm() === '80');

    await t.step('tap + five times', async () => { for (let i = 0; i < 5; i++) await t.tap(page.locator('#transport button[aria-label=Faster]')); });
    t.expect('it reads 100 bpm', await bpm() === '100', await bpm());

    await t.listen();
    await t.step('tap Start the metronome', () => t.tap(page.locator('#transport button.play')));
    t.expect('it clicks, a beat every 0.6 s with the 1 accented', await t.poll(() => window.__heard.clicks.length >= 6, null, 8000) && await (async () => {
      const { clicks } = await t.heard();
      const g = gaps(clicks);
      const first = clicks.findIndex((c) => c.accent);
      return g.every((x) => Math.abs(x - 0.6) < 0.01) && first >= 0 && clicks.filter((c) => c.accent).length >= 1 && (clicks[first + 4]?.accent ?? true);
    })(), (await t.heard()).clicks.slice(0, 6));
    t.expect('and the beat lights up', await t.poll(() => !!document.querySelector('#t-beats i.now'), null, 3000));

    await t.listen();
    await t.step('switch on 2 and 4', () => t.tap(page.locator('#transport button.toggle', { hasText: '2 and 4' })));
    t.expect('it clicks on 2 and 4 only: every other beat, none accented', await t.poll(() => window.__heard.clicks.length >= 5, null, 9000) && await (async () => {
      // the first may have been scheduled, a beat ahead, before the switch
      const clicks = (await t.heard()).clicks.slice(1);
      return gaps(clicks).every((x) => Math.abs(x - 1.2) < 0.01) && !clicks.some((c) => c.accent);
    })(), (await t.heard()).clicks.slice(0, 4));

    await t.step('open the first lesson', () => t.tap(page.locator('.lessons-index a').first()));
    await t.until((x) => !!x.bookLesson);
    t.expect('the metronome is still going', await page.locator('#transport button.play[aria-label="Stop the metronome"]').isVisible());

    await t.step('open Solo over changes with triads', () => t.tap(page.locator('.lesson-page a.drill-card[data-drill="triad-solo"]')));
    const s = await t.until((x) => x.drillId === 'triad-solo');
    await t.listen();
    await t.wait(800);
    t.expect('the metronome stops for the drill', (await t.heard()).clicks.length === 0 && !s.playing);
    t.expect('the drill keeps its own tempo, 76', s.tempo === 76, s.tempo);
    await t.step('tap Metronome: 100', () => t.tap(page.locator('#transport button.t-met')));
    const after = await t.until((x) => x.tempo === 100);
    t.expect('the drill takes the metronome’s tempo', after.tempo === 100, after.tempo);
    t.expect('and the button goes, they match', await page.locator('#transport button.t-met').isHidden());
  },
};
