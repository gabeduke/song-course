// J1.8 Tap a fret to hear the note and see its role; switch the neck to a
// keyboard for the keys parts (the lessons follow), tap a key to hear it,
// and see the keys part's two hands. docs/flows.md#j18
export default {
  id: 'J1.8',
  title: 'Tap a fret or a key to hear it; switch to the keyboard',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    await t.listen();

    await t.step('tap the 7th fret of the low E string', () => t.tapFret(6, 7, '.neck'));
    let h = await t.heard();
    t.expect('it plays B2 on the guitar', await t.poll(() => window.__heard.auditions.some((a) => a.notes[0] === 47 && a.inst === 'guitar')), h.auditions);
    t.expect('the spot flashes the root’s colour', await t.poll(() => !!document.querySelector('.neck .fb-pings .fb-ping.role-root')));

    await t.step('switch the instrument to Keys', () => t.tap(page.locator('.neck [role=radiogroup][aria-label=Instrument] [role=radio]', { hasText: 'Keys' })));
    t.expect('a keyboard takes the neck’s place', await page.locator('.neck .piano-svg').isVisible() && !(await page.locator('.neck .fretboard-svg').isVisible()));
    const layers = await page.locator('.neck [role=radiogroup][aria-label=Layer] [role=radio]').allTextContents();
    t.expect('its layers leave out Triads, a guitar thing', !layers.includes('Triads') && layers.includes('Chord tones'), layers);
    t.expect('the keys show B’s chord tones', await page.locator('.neck .piano-svg .pn-mark').count() >= 6);
    const s = await t.state();
    t.expect('the lessons switch to the Keys track', s.lessonFilter === 'keys', s.lessonFilter);

    await t.step('tap middle C', () => t.tap(page.locator('.neck .piano-svg rect[data-midi="60"]')));
    h = await t.heard();
    t.expect('it plays C4 on the electric piano', await t.poll(() => window.__heard.auditions.some((a) => a.notes[0] === 60 && a.inst === 'keys')), h.auditions);

    await t.step('choose Part and the two-hand keys variation', async () => {
      await t.tap(page.locator('.neck [role=radiogroup][aria-label=Layer] [role=radio]', { hasText: 'Part' }));
      await t.tap(page.locator('.parts .part[data-part="keys"] .pills [role=radio]', { hasText: 'Two hands' }));
    });
    const hands = await page.evaluate(() => [...new Set([...document.querySelectorAll('.neck .pn-mark .pn-hand')].map((x) => x.textContent))].sort());
    t.expect('the keys it plays are marked by hand, L and R', JSON.stringify(hands) === '["L","R"]', hands);
  },
};
