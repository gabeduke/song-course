// J8.3 Let the drill move on by itself: every so many loops it takes the
// next box up the neck, or the next key round the cycle of fourths, on the
// one, without the band stopping. The drill remembers it all next time.
// docs/flows.md#j83
const where = () => document.querySelector('.neck .where')?.textContent ?? '';
const seg = (page, group, name) => page.locator(`[role=radiogroup][aria-label="${group}"] [role=radio]`, { hasText: new RegExp(`^${name}`) });

export default {
  id: 'J8.3',
  title: 'Move on every loop: next box, next key',
  async run(t) {
    const { page } = t;
    await t.given('the pentatonic boxes are open in A, in 16ths, at the top tempo', async () => {
      await t.open('book/pentatonic-boxes');
      await t.tap(seg(page, 'Notes', '16ths'));
      await t.drag(page.locator('#transport input[aria-label=Tempo]'), 1);
    });

    await t.step('choose Move on: Next box, every loop', async () => {
      await t.tap(seg(page, 'Move on', 'Next box'));
      await t.tap(seg(page, 'Every', 'loop'));
    });
    let s = await t.state();
    t.expect('it’s set to move on every loop', s.move.how === 'stop' && s.move.every === 1, s.move);

    await t.listen();
    await t.step('tap Play and let it loop', () => t.tap(page.locator('#transport button.play')));
    s = await t.until((x) => x.drill.stop === 2, 12000);
    t.expect('after a loop it’s in box 2', s.drill.stop === 2 && s.playing, s.drill);
    t.expect('the neck has moved there', await t.poll(() => /box 2/.test(document.querySelector('.neck .where')?.textContent ?? '')), await page.evaluate(where));
    s = await t.until((x) => x.drill.stop === 3, 12000);
    t.expect('then box 3', s.drill.stop === 3 && s.playing, s.drill);
    let h = await t.heard();
    t.expect('one count-in at the start, none between boxes', h.clicks.length === 4, h.clicks.length);
    t.expect('the demo kept playing', h.parts.demo > 20, h.parts);

    await t.step('switch Move on to Next key (4ths)', () => t.tap(seg(page, 'Move on', 'Next key')));
    s = await t.until((x) => x.drill.key === 'D', 12000);
    t.expect('A moves on to D', s.drill.key === 'D' && s.playing, s.drill);
    t.expect('the readout says Dm7', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'Dm7'));
    s = await t.until((x) => x.drill.key === 'G', 12000);
    t.expect('then G, round the cycle of fourths', s.drill.key === 'G', s.drill);

    const tempo = (await t.state()).tempo;
    await t.step('tap Stop and reload the page', async () => {
      await t.tap(page.locator('#transport button.play'));
      await t.until((x) => !x.playing);
      await t.open('book/pentatonic-boxes');
    });
    s = await t.state();
    t.expect('the drill opens where I left it, in 16ths, moving on by key', s.drill.rhythm === 1 && s.move.how === 'fourth' && s.drill.key !== 'A', { drill: s.drill, move: s.move });
    t.expect('at my tempo', s.tempo === tempo && tempo > 200, { now: s.tempo, before: tempo });
  },
};
