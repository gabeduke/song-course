// J5.1 Start a song of my own from a title, key and chord chart: it opens
// in Practice with a band to play over, lives in this browser (still
// there after a reload) until I download it, and Delete draft removes it.
// docs/flows.md#j51
const field = (page, name) => page.locator('.new-song label.field', { hasText: name });

export default {
  id: 'J5.1',
  title: 'Start a new song and play over it',
  async run(t) {
    const { page } = t;
    await t.given('Capture is open', () => t.open('fire-on-the-mountain/capture'));

    await t.step('open Start a new song', () => t.tap(page.locator('.cap-new summary')));
    t.expect('the form opens with an example chart to edit', await page.locator('.new-song textarea').isVisible() && /Verse:/.test(await page.locator('.new-song textarea').inputValue()));

    await t.step('fill in “Flow Jam”, A natural minor, 120 bpm, a verse and a chorus, and tap Create song', async () => {
      await field(page, 'Title').locator('input').fill('Flow Jam');
      await field(page, 'Key').locator('select').selectOption('A');
      await field(page, 'Scale').locator('select').selectOption('minor');
      await field(page, 'Tempo').locator('input').fill('120');
      await page.locator('.new-song textarea').fill('Verse: Am | F | C | G\nChorus: F | G | Am | Am');
      await t.tap(page.locator('.new-song button[type=submit]'));
    });
    let s = await t.until((x) => x.songId === 'flow-jam');
    t.expect('it opens in Practice', s.songId === 'flow-jam' && s.view === 'practice' && page.url().endsWith('#/flow-jam/practice'), { songId: s.songId, url: page.url() });
    t.expect('titled Flow Jam, in A minor at 120', await page.locator('.song-hero h1').textContent() === 'Flow Jam'
      && /Key of A natural minor/.test(await page.locator('.song-hero .facts').textContent()) && s.tempo === 120, await page.locator('.song-hero .facts').textContent());
    t.expect('with my two sections', JSON.stringify(await page.locator('.arrangement .arr-name').allTextContents()) === '["Verse","Chorus"]');
    t.expect('the picker marks it a draft', await page.locator('#top select.song-select option[value="flow-jam"]').textContent() === 'Flow Jam (draft)');
    t.expect('the page says it lives in this browser only', /in this browser only/.test(await page.locator('.song-hero .draft-actions').textContent()));

    await t.listen();
    await t.step('tap Play', () => t.tap(page.locator('#transport button.play')));
    await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    await t.wait(1500);
    const h = await t.heard();
    t.expect('there’s a band to play over: drums, bass, rhythm guitar, keys', ['drums', 'bass', 'rhythm', 'keys'].every((p) => h.parts[p] > 0), h.parts);
    await t.tap(page.locator('#transport button.play'));

    await t.step('reload the page', () => t.open('flow-jam/practice'));
    s = await t.state();
    t.expect('Flow Jam is still there, and opens', s.songId === 'flow-jam' && s.draft, s.songId);

    await t.step('tap Delete draft, and answer Yes', async () => {
      t.answer(true);
      await t.tap(page.locator('.song-hero .draft-actions button', { hasText: 'Delete draft' }));
    });
    s = await t.until((x) => x.songId !== 'flow-jam');
    t.expect('it’s gone from the picker', !s.library.some((l) => l.id === 'flow-jam'), s.library.map((l) => l.id));
    t.expect('and from the browser', await page.evaluate(() => !JSON.parse(localStorage.getItem('woodshed.drafts.v1') ?? '{}')['flow-jam']));
    t.expect('I’m on a starter song instead', s.songId === 'fire-on-the-mountain', s.songId);
  },
};
