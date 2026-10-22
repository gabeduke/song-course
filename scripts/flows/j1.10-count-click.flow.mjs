// J1.10 Count-in and click are mine to set: with the count-in off the band
// starts on bar 1 straight away, the click ticks every beat when it's on,
// and both are remembered next time. docs/flows.md#j110
const toggle = (page, name) => page.locator('#transport button.toggle', { hasText: name });

export default {
  id: 'J1.10',
  title: 'Count-in off, click on, remembered',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open, count-in on and click off as it starts', () => t.open('fire-on-the-mountain/practice'));
    let s = await t.state();
    t.expect('the count-in is on and the click off to start', s.countIn && !s.click, s);

    await t.step('turn Count-in off and Click on', async () => {
      await t.tap(toggle(page, 'Count-in'));
      await t.tap(toggle(page, 'Click'));
    });
    t.expect('the toggles say so', await toggle(page, 'Count-in').getAttribute('aria-pressed') === 'false' && await toggle(page, 'Click').getAttribute('aria-pressed') === 'true');

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    await t.wait(1300);
    let h = await t.heard();
    t.expect('the band starts on bar 1 straight away', h.steps[0]?.step === 0 && !(await page.locator('#t-count').textContent()).includes('Count-in'), h.steps.slice(0, 2));
    t.expect('the click ticks the beats with the band', h.clicks.length >= 2 && h.clicks[0].accent, h.clicks);
    await t.tap(page.locator('#transport button.play'));

    await t.step('reload the page', () => t.open('fire-on-the-mountain/practice'));
    s = await t.state();
    t.expect('count-in off and click on are remembered', !s.countIn && s.click, { countIn: s.countIn, click: s.click });
  },
};
