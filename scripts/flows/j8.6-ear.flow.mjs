// J8.6 Train my ear: call and response plays a phrase, then leaves a bar
// for me to answer; the neck keeps the answer to itself (no notes lighting
// up, no tab) until I ask for it, and Round gives me new phrases.
// docs/flows.md#j86
const tabText = () => document.querySelector('.drill-tab')?.textContent ?? '';

export default {
  id: 'J8.6',
  title: 'Call and response: hear a phrase, play it back',
  async run(t) {
    const { page } = t;
    await t.given('the practice book is open', () => t.open('book'));

    await t.step('tap Call and response under Ear training', () => t.tap(page.locator('a.drill-card[data-drill="call-response"]')));
    let s = await t.until((x) => x.drillId === 'call-response');
    t.expect('it opens in A minor pentatonic, box 1, easy', s.drill.key === 'A' && s.drill.stop === 1 && s.drill.level === 'easy' && s.drill.round === 1, s.drill);
    t.expect('the neck shows the box faint, only the roots lit', await page.evaluate(() => {
      const lit = [...document.querySelectorAll('.neck .fb-dot:not(.faint) text')].map((x) => x.textContent);
      return lit.length >= 2 && lit.every((n) => n === 'A') && document.querySelectorAll('.neck .fb-dot.faint').length >= 8;
    }));
    t.expect('the tab is kept back', /gives the answers away/.test(await page.evaluate(tabText)) && await page.locator('.drill-sheet').count() === 0, await page.evaluate(tabText));

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    t.expect('the phrase plays', await t.poll(() => (window.__heard?.calls ?? []).filter((c) => c.bus === 'demo').length >= 3, null, 9000));
    t.expect('nothing lights up on the neck', await page.locator('.neck .fb-ping').count() === 0);
    t.expect('then a bar left for me: nothing from the guitar in bar 2', await t.poll(() => (window.__heard?.steps ?? []).some((x) => x.step === 32), null, 12000) && await page.evaluate(() => {
      const h = window.__heard;
      const at = (n) => h.steps.find((x) => x.step === n)?.time;
      const demo = h.calls.filter((c) => c.bus === 'demo');
      return demo.some((c) => c.t < at(16)) && !demo.some((c) => c.t >= at(16) - 0.01 && c.t < at(32) - 0.01);
    }));

    await t.step('tap Show the notes', () => t.tap(page.locator('.drill-run button', { hasText: 'Show the notes' })));
    t.expect('the notes light up as they play', await t.poll(() => document.querySelectorAll('.neck .fb-ping').length > 0, null, 9000));
    t.expect('the tab is drawn', await t.poll(() => !!document.querySelector('.drill-sheet svg'), null, 8000));
    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    await t.until((x) => !x.playing);

    await t.step('pick Round 2', () => t.tap(page.locator('.seg[aria-label="Round"] button', { hasText: /^2$/ })));
    s = await t.until((x) => x.drill.round === 2);
    t.expect('new phrases for the same box', s.drill.round === 2 && s.drill.stop === 1, s.drill);
  },
};
