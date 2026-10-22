// J3.3 The sheet is the song as I've set it up: the variation I picked in
// Practice, at the tempo I'm practising at, and it keeps up when I change
// the tempo on the sheet. docs/flows.md#j33
const head = () => document.querySelector('.sheet-head .byline')?.textContent ?? '';

export default {
  id: 'J3.3',
  title: 'The sheet follows what I chose in Practice',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open in Practice', () => t.open('fire-on-the-mountain/practice'));
    await t.step('pick Triads, 7th fret for rhythm guitar, and slow it to 96', async () => {
      await t.tap(page.locator('.parts .part[data-part="rhythm"] .pills [role=radio]', { hasText: 'Triads, 7th fret' }));
      await t.tap(page.locator('#transport button[aria-label=Slower]'));
    });
    await t.step('tap the Sheet tab', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Sheet' })));
    await page.locator('.sheet figure.sheet-part').first().waitFor();
    const vamp = await page.locator('.sheet .sheet-section').first().locator('figcaption').allTextContents();
    t.expect('Vamp’s rhythm guitar is Triads, 7th fret', vamp.some((c) => /^Rhythm guitar Triads, 7th fret/.test(c)), vamp);
    t.expect('the sheet says 96 bpm', /96 bpm/.test(await page.evaluate(head)), await page.evaluate(head));

    await t.step('tap + twice on the sheet', async () => {
      await t.tap(page.locator('#transport button[aria-label=Faster]'));
      await t.tap(page.locator('#transport button[aria-label=Faster]'));
    });
    t.expect('the sheet says 104 bpm, as the transport does', await t.poll(() => /104 bpm/.test(document.querySelector('.sheet-head .byline')?.textContent ?? ''), null, 2000),
      { sheet: await page.evaluate(head), transport: await page.locator('#transport .t-bpm strong').textContent() });
  },
};
