// J1.5 Swap a part's variation while the loop plays: it changes without
// a stop or a new count-in, Off silences the part, and the choice is the
// section's own. docs/flows.md#j15
const pill = (page, part, name) => page.locator(`.parts .part[data-part="${part}"] .pills [role=radio]`, { hasText: name });

export default {
  id: 'J1.5',
  title: 'Swap a variation while it loops',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is playing the Vamp', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('#transport button.play'));
      await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    });
    let s = await t.state();
    t.expect('rhythm guitar starts on Barre chords', s.variations.rhythm === 'barre', s.variations);

    await t.listen();
    await t.step('tap Sixteenth funk on Rhythm guitar', () => t.tap(pill(page, 'rhythm', 'Sixteenth funk')));
    s = await t.until((x) => x.variations.rhythm === 'funk-16');
    t.expect('rhythm guitar plays Sixteenth funk', s.variations.rhythm === 'funk-16', s.variations);
    t.expect('its pill is the chosen one', await pill(page, 'rhythm', 'Sixteenth funk').getAttribute('aria-checked') === 'true');
    await t.wait(1500);
    const h = await t.heard();
    t.expect('without stopping or counting in again', s.playing && h.clicks.length === 0 && h.parts.rhythm > 0, { playing: s.playing, clicks: h.clicks.length, parts: h.parts });

    await t.step('tap Off on Bass', () => t.tap(pill(page, 'bass', 'Off')));
    await t.until((x) => x.variations.bass === 'off');
    await t.listen();
    await t.wait(2600);
    t.expect('the bass drops out', !(await t.heard()).parts.bass, (await t.heard()).parts);
    t.expect('the bass row says it’s off', await pill(page, 'bass', 'Off').getAttribute('aria-checked') === 'true');

    await t.step('tap the Jam block, then the first Vamp block', async () => {
      await t.tap(page.locator('.arrangement .arr-block').nth(2));
      await t.until((x) => x.sectionId === 'jam');
    });
    s = await t.state();
    t.expect('Jam has its own choices (its first strum, its bass)', s.variations.rhythm === 'funk-16' && s.variations.bass === 'roots', s.variations);
    await t.tap(page.locator('.arrangement .arr-block').nth(0));
    s = await t.until((x) => x.sectionId === 'vamp');
    t.expect('Vamp kept mine', s.variations.rhythm === 'funk-16' && s.variations.bass === 'off', s.variations);
    await t.tap(page.locator('#transport button.play'));
  },
};
