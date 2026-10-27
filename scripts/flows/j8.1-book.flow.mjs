// J8.1 The practice book: from any song, Book opens the contents (the
// session, the video's chapters, every drill by category, the songs); a
// drill opens on its own page with the neck, how to practise it and its
// tab; the tabs take me back to the song. docs/flows.md#j81
export default {
  id: 'J8.1',
  title: 'Open the practice book and a drill in it',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));

    await t.step('tap Book in the top bar', () => t.tap(page.locator('#top a.book-tab')));
    let s = await t.until((x) => x.view === 'book');
    t.expect('the practice book opens, and the address says so', s.view === 'book' && !s.drillId && page.url().endsWith('#/book'), { s: s.view, url: page.url() });
    const contents = await page.evaluate(() => ({
      session: document.querySelectorAll('.session-list .si').length,
      chapters: document.querySelectorAll('.book-video .chapters li').length,
      cats: [...document.querySelectorAll('.book-cat h2')].map((x) => x.textContent),
      drills: document.querySelectorAll('a.drill-card[data-drill]').length,
      idle: document.querySelector('#transport .t-idle')?.textContent ?? '',
    }));
    t.expect('my session is there, the starter list of seven', contents.session === 7, contents);
    t.expect('the video’s seven chapters are listed', contents.chapters === 7, contents);
    t.expect('warm-ups, triads, pentatonic, scales and the songs', JSON.stringify(contents.cats) === JSON.stringify(['Warm-ups', 'Triads', 'Pentatonic', 'Scales', 'Songs']), contents.cats);
    t.expect('eleven drills to pick from', contents.drills === 11, contents);
    t.expect('the transport says to pick one', /Pick a drill/.test(contents.idle), contents.idle);

    await t.step('tap The five pentatonic boxes', () => t.tap(page.locator('a.drill-card[data-drill="pentatonic-boxes"]')));
    s = await t.until((x) => x.drillId === 'pentatonic-boxes');
    t.expect('the drill opens on its own page', s.drillId === 'pentatonic-boxes' && page.url().endsWith('#/book/pentatonic-boxes'), page.url());
    t.expect('in A minor pentatonic, box 1', s.drill.key === 'A' && s.drill.scale === 'minorPentatonic' && s.drill.stop === 1, s.drill);
    t.expect('the neck lights the box', await t.poll(() => document.querySelectorAll('.neck .fb-dot:not(.faint)').length >= 10));
    t.expect('the tab is drawn', await t.poll(() => !!document.querySelector('.drill-sheet svg'), null, 8000));
    t.expect('with the steps to practise it', await page.locator('.drill-how .lesson-steps li').count() >= 3);
    t.expect('Play is in the transport', await page.locator('#transport button.play').isVisible());

    await t.step('tap the Practice tab', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' })));
    s = await t.until((x) => x.view === 'practice');
    t.expect('it’s Fire on the Mountain again', s.songId === 'fire-on-the-mountain' && s.view === 'practice' && !s.drillId, s);
  },
};
