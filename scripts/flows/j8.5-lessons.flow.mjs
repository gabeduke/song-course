// J8.5 Read a lesson, then practise it: the book lists its lessons; a
// lesson reads on its own page and links the drills that practise it; a
// drill links back to its lesson. Soloing over changes shows the chord's
// triad lit and the key's other notes faint around it, and moves with the
// chords. docs/flows.md#j85
const lit = () => [...new Set([...document.querySelectorAll('.neck .fb-dot:not(.faint) text')].map((x) => x.textContent))].sort();
const faint = () => [...new Set([...document.querySelectorAll('.neck .fb-dot.faint text')].map((x) => x.textContent))].sort();

export default {
  id: 'J8.5',
  title: 'Read a lesson, then practise it: soloing over changes with triads',
  async run(t) {
    const { page } = t;
    await t.given('the practice book is open', () => t.open('book'));

    await t.step('tap the lesson Soloing over chord changes', () => t.tap(page.locator('.lessons-index a[data-lesson="soloing-over-changes"]')));
    let s = await t.until((x) => x.bookLesson === 'soloing-over-changes');
    const lesson = await page.evaluate(() => ({
      title: document.querySelector('.lesson-page h1')?.textContent,
      heads: [...document.querySelectorAll('.lesson-text h2')].map((x) => x.textContent),
      drills: [...document.querySelectorAll('.lesson-page a.drill-card')].map((a) => a.dataset.drill),
      next: document.querySelector('.lesson-next a')?.textContent,
    }));
    t.expect('it reads on its own page, the address says so', s.view === 'book' && !s.drillId && page.url().endsWith('#/book/learn/soloing-over-changes') && lesson.title === 'Soloing over chord changes', { url: page.url(), lesson });
    t.expect('the method in steps, triads first', lesson.heads.length >= 5 && lesson.heads[1] === '1. See each chord as a triad', lesson.heads);
    t.expect('with the drills that practise it, and the next lesson', lesson.drills.includes('triad-solo') && lesson.drills.includes('rhythm-ladder') && lesson.next === 'Next: Triads and inversions →', lesson);
    t.expect('the transport is the metronome', await page.locator('#transport button.play[aria-label="Start the metronome"]').isVisible());

    await t.step('tap Solo over changes with triads', () => t.tap(page.locator('.lesson-page a.drill-card[data-drill="triad-solo"]')));
    s = await t.until((x) => x.drillId === 'triad-solo');
    t.expect('the drill opens, I–IV–V–I in G', s.drillId === 'triad-solo' && s.drill.key === 'G' && s.drill.progression === 'I-IV-V-I' && !s.bookLesson, s.drill);
    t.expect('the G triad is lit: G B D', JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['B', 'D', 'G']), await page.evaluate(lit));
    const f = await page.evaluate(faint);
    t.expect('the key’s other notes sit faint around it', f.length >= 2 && f.every((n) => ['A', 'C', 'E', 'F#'].includes(n)), f);
    const back = await page.locator('.drill-lessons a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    t.expect('the drill links back to its lesson', back.includes('#/book/learn/soloing-over-changes'), back);

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    t.expect('on bar 2 the neck changes to C’s triad: C E G', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'C', null, 9000)
      && JSON.stringify(await page.evaluate(lit)) === JSON.stringify(['C', 'E', 'G']), await page.evaluate(lit));
    const h = await t.heard();
    t.expect('the demo plays its phrases over the band', h.parts.demo > 4 && h.parts.drums > 0, h.parts);
    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    s = await t.until((x) => !x.playing);
    t.expect('it stops', !s.playing);

    await t.step('go back to the lesson', () => t.tap(page.locator('.drill-lessons a[href="#/book/learn/soloing-over-changes"]')));
    s = await t.until((x) => x.bookLesson === 'soloing-over-changes');
    t.expect('the lesson is there again', s.bookLesson === 'soloing-over-changes' && !s.drillId, s);
  },
};
