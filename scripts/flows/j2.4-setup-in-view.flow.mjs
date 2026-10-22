// J2.4 After Set up this exercise, the neck it just changed is on the
// screen: on the tablet the lessons sit below the parts and the neck is
// scrolled away, so the tap seems to do nothing. A proposal, not agreed
// yet: todo. docs/flows.md#j24
export default {
  id: 'J2.4',
  title: 'See the exercise I just set up',
  status: 'todo',
  profiles: ['tablet'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    await t.step('open lesson 2 and tap Set up this exercise', async () => {
      await t.tap(page.locator('.lessons .lesson-title').nth(1));
      await t.tap(page.locator('.lessons .lesson.open button', { hasText: 'Set up this exercise' }));
    });
    await t.wait(800);
    const seen = await page.evaluate(() => {
      const r = document.querySelector('.neck .fretboard-svg').getBoundingClientRect();
      const bottom = document.getElementById('transport').getBoundingClientRect().top;
      return Math.max(0, Math.min(r.bottom, bottom) - Math.max(r.top, 0)) / r.height;
    });
    t.expect('most of the neck is on screen, above the transport', seen > 0.6, `${Math.round(seen * 100)}% of it`);
  },
};
