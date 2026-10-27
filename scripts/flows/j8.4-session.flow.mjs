// J8.4 A practice session: add a drill in the key I want, start the
// session, and the clock walks me through it: each item opens with its own
// settings, Pause stops the clock, Next goes on (to a song too), Finish
// ends it. docs/flows.md#j84
const clock = () => document.getElementById('ss-clock')?.textContent ?? '';
const next = (page) => page.locator('.session-bar .ss-btns button', { hasText: /^(Next|Finish)$/ });

export default {
  id: 'J8.4',
  title: 'Build a session and let the clock walk me through it',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('triad inversions are open', () => t.open('book/triad-inversions'));

    await t.step('pick D, then tap Add to session', async () => {
      await page.locator('.neck select[aria-label=Key]').selectOption('D');
      await t.until((x) => x.drill.key === 'D');
      await t.tap(page.locator('.drill-hero button', { hasText: 'Add to session' }));
    });
    t.expect('it says it’s added', /Added to your session/.test(await t.toast()), await t.toast());

    await t.step('go back to the book', () => t.tap(page.locator('a.back')));
    await t.until((x) => x.view === 'book' && !x.drillId);
    const items = await page.locator('.session-list .si').allTextContents();
    t.expect('the session has it at the end, in D', items.length === 9 && /Triad inversions/.test(items[8]) && /D · Strings 1–3/.test(items[8]), items.at(-1));

    await t.step('tap Start session', () => t.tap(page.locator('.book-session .btn', { hasText: 'Start session' })));
    let s = await t.until((x) => x.drillId === 'chromatic');
    t.expect('the first drill opens, the chromatic spider', s.drillId === 'chromatic' && s.session.active && s.session.index === 0, s.session);
    t.expect('the session bar says 1 of 9 with three minutes on the clock', await page.locator('.session-bar .ss-kicker').textContent() === 'Session 1/9' && /^(3:00|2:5\d) left$/.test(await page.evaluate(clock)), await page.evaluate(clock));
    await t.wait(2200);
    t.expect('the clock runs', /^2:5\d left$/.test(await page.evaluate(clock)), await page.evaluate(clock));

    await t.step('tap Pause', () => t.tap(page.locator('.session-bar button', { hasText: 'Pause' })));
    const a = await page.evaluate(clock);
    await t.wait(1600);
    t.expect('the clock stops', await page.evaluate(clock) === a, { before: a, after: await page.evaluate(clock) });

    await t.step('tap Next', () => t.tap(next(page)));
    s = await t.until((x) => x.drillId === 'find-notes');
    t.expect('Find every note opens, on C', s.drill.key === 'C' && s.session.index === 1, s.drill);

    await t.step('tap Next until the song', async () => {
      for (let i = 0; i < 6; i++) {
        const at = (await t.state()).session.index;
        await t.tap(next(page));
        await t.until((x) => x.session.index === at + 1);
      }
    });
    s = await t.until((x) => x.view === 'practice');
    t.expect('Fire on the Mountain opens on Practice', s.songId === 'fire-on-the-mountain' && s.view === 'practice' && s.session.index === 7, s);
    t.expect('the session bar is still there', await page.locator('.session-bar').isVisible());

    await t.step('tap Next', () => t.tap(next(page)));
    s = await t.until((x) => x.drillId === 'triad-inversions');
    t.expect('my triad inversions open, in D', s.drill.key === 'D' && s.session.index === 8, s.drill);

    await t.step('tap Finish', () => t.tap(next(page)));
    s = await t.until((x) => !x.session.active);
    t.expect('the session ends and its bar goes', !s.session.active && await page.locator('.session-bar').count() === 0, s.session);
  },
};
