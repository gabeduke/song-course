// J1.3 Tap a section to loop it; Whole song walks the arrangement, a tap
// on a block jumps there, and the page follows the section that's
// playing. docs/flows.md#j13
const bar = () => ({
  where: document.querySelector('#transport .t-sec')?.textContent,
  count: document.getElementById('t-count')?.textContent,
  parts: document.querySelector('.parts .panel-head p')?.textContent,
  now: [...document.querySelectorAll('.arr-block')].findIndex((b) => b.querySelector('.arr-bar.now')),
  playing: [...document.querySelectorAll('.arr-block')].findIndex((b) => b.classList.contains('playing')),
});

export default {
  id: 'J1.3',
  title: 'Loop a section, or walk the whole song',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open (Vamp ×2, Jam ×2)', () => t.open('fire-on-the-mountain/practice'));
    const blocks = page.locator('.arrangement .arr-block');
    t.expect('the strip shows the arrangement, four blocks', await blocks.count() === 4, await blocks.count());

    await t.step('tap the first Jam block', () => t.tap(blocks.nth(2)));
    let s = await t.until((x) => x.sectionId === 'jam');
    t.expect('Jam is the loop', s.sectionId === 'jam' && s.loopMode === 'section', s);
    let b = await page.evaluate(bar);
    t.expect('the transport says Jam', b.where === 'Jam', b);
    t.expect('the parts are Jam’s', /^Jam:/.test(b.parts), b);

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    await t.wait(800);
    let h = await t.heard();
    t.expect('the band plays Jam', h.steps.length > 0 && h.steps.every((x) => x.sid === 'jam'), [...new Set(h.steps.map((x) => x.sid))]);
    b = await page.evaluate(bar);
    t.expect('the strip marks the bar that’s playing, in a Jam block', b.now === 2 || b.now === 3, b);

    await t.step('switch the loop to Whole song', () => t.tap(page.locator('#transport [role=radiogroup][aria-label=Loop] [role=radio]', { hasText: 'Whole song' })));
    s = await t.until((x) => x.loopMode === 'song');
    t.expect('it walks the whole song now', s.loopMode === 'song' && s.playing, s);
    t.expect('the transport says Whole song', (await page.evaluate(bar)).where === 'Whole song', await page.evaluate(bar));

    await t.listen();
    await t.step('tap the last block, the second Jam', () => t.tap(blocks.nth(3)));
    h = await t.heard();
    const jumped = await t.poll(() => (window.__heard?.steps ?? []).some((x) => x.arr === 3), null, 2000);
    t.expect('the band jumps there without stopping', jumped && (await t.state()).playing, (await t.heard()).steps.slice(-3));
    t.expect('the strip marks that block as playing', await t.poll(() => document.querySelectorAll('.arr-block')[3]?.classList.contains('playing'), null, 2000), await page.evaluate(bar));

    const wrapped = await t.poll(() => (window.__heard?.steps ?? []).some((x) => x.arr === 0 && x.sid === 'vamp'), null, 14_000);
    t.expect('after the last block the song goes round to the first Vamp', wrapped, (await t.heard()).steps.slice(-3));
    s = await t.until((x) => x.sectionId === 'vamp', 2000);
    b = await page.evaluate(bar);
    t.expect('the page follows: Vamp’s parts and the first block marked', s.sectionId === 'vamp' && /^Vamp:/.test(b.parts) && b.playing === 0, { sectionId: s.sectionId, ...b });

    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    t.expect('it stops', !(await t.until((x) => !x.playing)).playing);
  },
};
