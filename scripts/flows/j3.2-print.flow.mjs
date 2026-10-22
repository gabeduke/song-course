// J3.2 Print the sheet: Print opens the browser's print, and the page
// prints as the sheet alone, without the app's bars and controls.
// docs/flows.md#j32
export default {
  id: 'J3.2',
  title: 'Print the sheet',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open on the Sheet', async () => {
      await t.open('fire-on-the-mountain/sheet');
      await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    });
    await t.step('tap Print', () => t.tap(page.locator('.sheet-controls button', { hasText: 'Print' })));
    t.expect('the browser’s print opens', await page.evaluate(() => window.__printed) === 1);
    await page.emulateMedia({ media: 'print' });
    const shown = await page.evaluate(() => Object.fromEntries(['#top', '#transport', '.sheet-controls', '.sheet'].map((s) => [s, getComputedStyle(document.querySelector(s)).display !== 'none'])));
    t.expect('on paper: the sheet, without the top bar, the transport or the controls',
      shown['.sheet'] && !shown['#top'] && !shown['#transport'] && !shown['.sheet-controls'], shown);
    await page.emulateMedia({ media: 'screen' });
  },
};
