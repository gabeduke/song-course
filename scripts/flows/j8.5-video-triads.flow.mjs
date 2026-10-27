// J8.5 Follow the video's triad method: the book lists its chapters with a
// link into the video at each, and the drill that practises it; soloing
// over changes shows the chord's triad lit and the key's other notes faint
// around it, and moves with the chords. docs/flows.md#j85
const lit = () => [...new Set([...document.querySelectorAll('.neck .fb-dot:not(.faint) text')].map((x) => x.textContent))].sort();
const faint = () => [...new Set([...document.querySelectorAll('.neck .fb-dot.faint text')].map((x) => x.textContent))].sort();

export default {
  id: 'J8.5',
  title: 'The video’s chapters, and soloing over changes with triads',
  async run(t) {
    const { page } = t;
    await t.given('the practice book is open', () => t.open('book'));
    const links = await page.locator('.book-video .chapters a.ch-t').evaluateAll((as) => as.map((a) => a.href));
    t.expect('each chapter links into the video at its time', links.length === 7 && links.every((x) => /youtube\.com\/watch\?v=9fzcXpGRloU&t=\d+s$/.test(x)) && links[3].endsWith('t=501s'), links);

    await t.step('tap the drill for “Mapping scales to triads”', () => t.tap(page.locator('.book-video .chapters li', { hasText: 'Mapping scales to triads' }).locator('a.ch-drill')));
    let s = await t.until((x) => x.drillId === 'triad-solo');
    t.expect('Solo over changes with triads opens, I–IV–V–I in G', s.drillId === 'triad-solo' && s.drill.key === 'G' && s.drill.progression === 'I-IV-V-I', s.drill);
    t.expect('the G triad is lit: G B D', JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['B', 'D', 'G']), await page.evaluate(lit));
    const f = await page.evaluate(faint);
    t.expect('the key’s other notes sit faint around it', f.length >= 2 && f.every((n) => ['A', 'C', 'E', 'F#'].includes(n)), f);
    const here = await page.locator('.drill-video a.ch-t').evaluateAll((as) => as.map((a) => a.textContent));
    t.expect('the page links the chapters it practises', JSON.stringify(here) === JSON.stringify(['8:21', '12:12', '15:11']), here);

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    t.expect('on bar 2 the neck changes to C’s triad: C E G', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'C', null, 9000)
      && JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['C', 'E', 'G']), await page.evaluate(lit));
    const h = await t.heard();
    t.expect('the demo plays its phrases over the band', h.parts.demo > 4 && h.parts.drums > 0, h.parts);
    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    s = await t.until((x) => !x.playing);
    t.expect('it stops', !s.playing);
  },
};
