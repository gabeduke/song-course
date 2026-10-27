// J8.2 Play a drill in any key and at any spot on the neck: the key and the
// box change the neck, the readout and the band, and while it plays they
// change without a stop or a new count-in. Mute the demo to play it myself.
// docs/flows.md#j82
const lit = () => [...new Set([...document.querySelectorAll('.neck .fb-dot:not(.faint) text')].map((x) => x.textContent))].sort();
const where = () => document.querySelector('.neck .where')?.textContent ?? '';

export default {
  id: 'J8.2',
  title: 'A drill in another key, another box, while it plays',
  async run(t) {
    const { page } = t;
    await t.given('the pentatonic boxes are open, A minor, box 1', () => t.open('book/pentatonic-boxes'));
    t.expect('the readout says Am7', await page.locator('.readout .now-chord').textContent() === 'Am7');
    t.expect('box 1 is frets 5–8', /box 1 · frets 5–8/.test(await page.evaluate(where)), await page.evaluate(where));
    t.expect('the box lights A C D E G', JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['A', 'C', 'D', 'E', 'G']), await page.evaluate(lit));

    await t.step('pick the key of C', () => page.locator('.neck select[aria-label=Key]').selectOption('C'));
    t.expect('the readout says Cm7', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'Cm7'));
    t.expect('box 1 moves up to frets 8–11', /frets 8–11/.test(await page.evaluate(where)), await page.evaluate(where));
    t.expect('it lights C Eb F G Bb', JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['Bb', 'C', 'Eb', 'F', 'G']), await page.evaluate(lit));

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 6000);
    await t.wait(1500);
    let h = await t.heard();
    t.expect('the demo guitar plays the box over drums, bass and keys', ['demo', 'drums', 'bass', 'keys'].every((p) => h.parts[p] > 0), h.parts);

    await t.listen();
    await t.step('tap box 2 while it plays', () => t.tap(page.locator('.neck [role=radiogroup][aria-label=Box] [role=radio]', { hasText: '2' })));
    await t.wait(1500);
    let s = await t.state();
    h = await t.heard();
    t.expect('it keeps playing, in box 2, with no new count-in', s.playing && s.drill.stop === 2 && h.clicks.length === 0 && h.parts.demo > 0, { playing: s.playing, drill: s.drill, clicks: h.clicks.length });
    t.expect('the neck shows box 2', /box 2/.test(await page.evaluate(where)), await page.evaluate(where));

    await t.step('tap Demo guitar to mute it', () => t.tap(page.locator('.drill-run button.toggle', { hasText: 'Demo guitar' })));
    await t.listen();
    await t.wait(1500);
    h = await t.heard();
    t.expect('the band plays on without the demo', !h.parts.demo && h.parts.drums > 0, h.parts);

    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    s = await t.until((x) => !x.playing);
    t.expect('the band stops', !s.playing);
  },
};
