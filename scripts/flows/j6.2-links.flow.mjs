// J6.2 A link to a song and a view opens it there; the tabs change the
// address, Back goes back, and a link to a song that isn't here (a draft
// from another browser) opens a starter song rather than nothing.
// docs/flows.md#j62
export default {
  id: 'J6.2',
  title: 'Links open a song and view; Back works',
  async run(t) {
    const { page } = t;
    await t.step('open a link to House of the Rising Sun’s sheet', () => t.open('house-of-the-rising-sun/sheet'));
    let s = await t.state();
    t.expect('it opens that song on the Sheet', s.songId === 'house-of-the-rising-sun' && s.view === 'sheet' && await page.locator('.sheet-head h1').textContent() === 'House of the Rising Sun', s);
    t.expect('the Sheet tab is the current one', await page.locator('#top nav.tabs a[aria-current=page]').textContent() === 'Sheet');

    await t.step('tap the Capture tab', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Capture' })));
    s = await t.until((x) => x.view === 'capture');
    t.expect('Capture opens, and the address says so', s.view === 'capture' && page.url().endsWith('#/house-of-the-rising-sun/capture'), page.url());

    await t.step('press Back', () => page.goBack());
    s = await t.until((x) => x.view === 'sheet');
    t.expect('it’s the Sheet again', s.view === 'sheet' && s.songId === 'house-of-the-rising-sun', s);

    await t.step('open a link to a song that isn’t here', () => t.open('no-such-song/practice'));
    s = await t.state();
    t.expect('a starter song opens instead', s.songId === 'fire-on-the-mountain' && s.view === 'practice' && !s.error, s);
  },
};
