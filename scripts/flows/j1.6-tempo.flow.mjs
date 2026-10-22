// J1.6 Slow it down or speed it up: − and + nudge by 4, the slider drags
// anywhere from 40 to 220, Record jumps to the record's tempo, and a
// change while it plays takes effect on the next step. docs/flows.md#j16
const bpm = () => document.querySelector('#transport .t-bpm strong')?.textContent;

export default {
  id: 'J1.6',
  title: 'Change the tempo, while it plays too',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open at 100 bpm', () => t.open('fire-on-the-mountain/practice'));

    await t.step('tap − twice', async () => {
      await t.tap(page.locator('#transport button[aria-label=Slower]'));
      await t.tap(page.locator('#transport button[aria-label=Slower]'));
    });
    let s = await t.state();
    t.expect('it’s 92 bpm', s.tempo === 92 && await page.evaluate(bpm) === '92', { tempo: s.tempo, shown: await page.evaluate(bpm) });

    await t.step('tap +', () => t.tap(page.locator('#transport button[aria-label=Faster]')));
    t.expect('it’s 96 bpm', (await t.state()).tempo === 96);

    await t.step('drag the tempo slider most of the way right', () => t.drag(page.locator('#transport input[aria-label=Tempo]'), 0.9));
    s = await t.state();
    t.expect('the tempo follows the drag up past 190 (40 + 90% of 180 = 202)', s.tempo > 190, { tempo: s.tempo, shown: await page.evaluate(bpm) });

    await t.step('tap Record: 116', () => t.tap(page.locator('#transport button.link-btn', { hasText: 'Record' })));
    t.expect('it’s at the record’s tempo, 116', (await t.state()).tempo === 116);

    await t.given('the band is playing', async () => {
      await t.tap(page.locator('#transport button.play'));
      await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    });
    await t.listen();
    await t.step('tap + while it plays', () => t.tap(page.locator('#transport button[aria-label=Faster]')));
    await t.wait(1500);
    const h = await t.heard();
    const gaps = h.steps.slice(-8).map((x, i, a) => (i ? x.time - a[i - 1].time : null)).slice(1);
    const want = 60 / 120 / 4;
    s = await t.state();
    t.expect('it plays on at 120 bpm: each sixteenth is an eighth of a second', s.playing && s.tempo === 120 && gaps.length > 3 && gaps.every((g) => Math.abs(g - want) < 0.002), { tempo: s.tempo, gaps });
    await t.tap(page.locator('#transport button.play'));
  },
};
