// J1.2 Play: a bar of count-in, then the band loops the section; the
// readout counts bars and wraps, the neck follows the chord changes, and
// Stop stops the band. docs/flows.md#j12
const count = () => document.getElementById('t-count')?.textContent ?? '';
const neck = () => ({
  chord: document.querySelector('.readout .now-chord')?.textContent,
  labels: [...new Set([...document.querySelectorAll('.fretboard-svg .fb-dot text')].map((t) => t.textContent))].sort(),
});

export default {
  id: 'J1.2',
  title: 'Play the loop: count-in, band, readout and neck follow',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open (Vamp: B | A | B | A, 100 bpm)', () => t.open('fire-on-the-mountain/practice'));
    await t.listen();

    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    t.expect('the readout counts me in', await t.poll(() => /Count-in/.test(document.getElementById('t-count')?.textContent ?? ''), null, 3000), await page.evaluate(count));
    t.expect('the Play button turns into Stop', await page.locator('#transport button.play').getAttribute('aria-label') === 'Stop');
    t.expect('then bar 1 starts', await t.poll(() => /bar 1\/4/.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000), await page.evaluate(count));
    let h = await t.heard();
    t.expect('the count-in was one bar of clicks, accent first', h.clicks.length === 4 && h.clicks[0].accent && !h.clicks[1].accent, h.clicks);
    await t.wait(1200);
    h = await t.heard();
    t.expect('drums, bass, rhythm guitar and keys play; the lead is off to start', ['drums', 'bass', 'rhythm', 'keys'].every((p) => h.parts[p] > 0) && !h.parts.lead, h.parts);

    t.expect('the neck moves to A when bar 2 comes', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'A', null, 4000), await page.evaluate(neck));
    const a = await page.evaluate(neck);
    t.expect('it lights A’s tones, A C# E', JSON.stringify(a.labels) === JSON.stringify(['A', 'C#', 'E']), a);
    t.expect('after bar 4 the loop goes round to bar 1', await t.poll(() => /bar 4\/4/.test(document.getElementById('t-count')?.textContent ?? ''), null, 8000)
      && await t.poll(() => /bar 1\/4/.test(document.getElementById('t-count')?.textContent ?? ''), null, 4000), await page.evaluate(count));
    h = await t.heard();
    t.expect('without another count-in', h.clicks.length === 4, h.clicks.length);

    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    const s = await t.until((x) => !x.playing);
    t.expect('the band stops', !s.playing, s);
    await t.listen();
    await t.wait(600);
    t.expect('it stays quiet', (await t.heard()).calls === 0, await t.heard());
    t.expect('the readout goes back to the section’s length', await t.poll(() => document.getElementById('t-count')?.textContent === '4 bars'), await page.evaluate(count));
    t.expect('the neck goes back to the first chord', (await page.evaluate(neck)).chord === 'B', await page.evaluate(neck));
  },
};
