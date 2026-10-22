// J1.7 Change what the neck shows: chord tones, three-string triads on a
// string set, a scale and one of its five positions, the part's own shape;
// notes or intervals on the dots, and the labels remembered next time.
// docs/flows.md#j17
const layer = (page, name) => page.locator('.neck [role=radiogroup][aria-label=Layer] [role=radio]', { hasText: name });
const choice = (page, group, name) => page.locator(`.neck [role=radiogroup][aria-label="${group}"] [role=radio]`, { hasText: name });
// The dots: string from the y the fretboard puts it at, its label, faint or not.
const dots = () => [...document.querySelectorAll('.neck .fretboard-svg .fb-dot')].map((g) => {
  const [, , y] = /translate\(([\d.]+) ([\d.]+)\)/.exec(g.getAttribute('transform'));
  return { string: Math.round((Number(y) - 26) / 30.8) + 1, label: g.querySelector('text')?.textContent, faint: g.classList.contains('faint') };
});

export default {
  id: 'J1.7',
  title: 'Chord tones, triads, scale positions or the part on the neck',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open on B (B D# F#)', () => t.open('fire-on-the-mountain/practice'));

    await t.step('choose Triads', () => t.tap(layer(page, 'Triads')));
    t.expect('the neck draws triad shapes', await t.poll(() => document.querySelectorAll('.neck .fb-shape').length > 0));
    t.expect('a string-set choice appears', await page.locator('.neck [role=radiogroup][aria-label=Strings]').isVisible());

    await t.step('choose strings 1–3', () => t.tap(choice(page, 'Strings', '1–3')));
    let d = await page.evaluate(dots);
    t.expect('every dot is on the top three strings', d.length > 0 && d.every((x) => x.string <= 3), d.map((x) => x.string));
    t.expect('and spells B, D#, F#', d.every((x) => ['B', 'D#', 'F#'].includes(x.label)), [...new Set(d.map((x) => x.label))]);

    await t.step('choose Scale, then position 1', async () => {
      await t.tap(layer(page, 'Scale'));
      await t.tap(choice(page, 'Position', '1'));
    });
    const scale = await page.locator('.neck select[aria-label=Scale]').evaluate((el) => el.selectedOptions[0]?.textContent);
    t.expect('the song’s own scale is picked, B mixolydian', scale === 'B mixolydian', scale);
    t.expect('a band marks the position on the neck', await page.locator('.neck .fb-band.on').count() === 1);
    d = await page.evaluate(dots);
    const lit = d.filter((x) => !x.faint);
    t.expect('the notes in the position are lit, the rest faint', lit.length >= 12 && lit.length < d.length, { lit: lit.length, all: d.length });

    await t.step('choose Part', () => t.tap(layer(page, 'Part')));
    d = await page.evaluate(dots);
    t.expect('the neck shows the chord shape rhythm guitar plays: one dot a string at most', d.length >= 4 && d.length <= 6 && new Set(d.map((x) => x.string)).size === d.length, d);

    await t.step('choose Intervals for the labels', () => t.tap(choice(page, 'Labels', 'Intervals')));
    d = await page.evaluate(dots);
    t.expect('the dots say R, 3, 5 instead of note names', d.every((x) => ['R', '3', '5'].includes(x.label)), d.map((x) => x.label));

    await t.step('reload the page', () => t.open('fire-on-the-mountain/practice'));
    const s = await t.state();
    t.expect('the labels are still intervals', s.fb.labels === 'intervals', s.fb);
    t.expect('the dots say so', (await page.evaluate(dots)).every((x) => ['R', '3', '5'].includes(x.label)));
  },
};
