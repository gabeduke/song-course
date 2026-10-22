// J1.9 Keep the band playing while I flip to the Sheet to read the part,
// and back to the neck: no stop, no reload, and Practice picks the
// playhead back up. docs/flows.md#j19
export default {
  id: 'J1.9',
  title: 'Flip to the Sheet and back while it plays',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is playing in Practice', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('#transport button.play'));
      await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    });
    await page.evaluate(() => { window.__flowMarker = true; });
    await t.listen();

    await t.step('tap the Sheet tab', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Sheet' })));
    let s = await t.until((x) => x.view === 'sheet');
    t.expect('the Sheet opens', s.view === 'sheet' && await page.locator('.sheet .sheet-section').count() > 0, s.view);
    await t.wait(1500);
    let h = await t.heard();
    t.expect('the band keeps playing', s.playing && h.calls > 0, { playing: s.playing, calls: h.calls });
    t.expect('the transport keeps counting', /bar \d\/4/.test(await page.locator('#t-count').textContent()), await page.locator('#t-count').textContent());

    await t.step('tap the Practice tab', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' })));
    s = await t.until((x) => x.view === 'practice');
    t.expect('Practice is back, without a page load', s.view === 'practice' && await page.evaluate(() => window.__flowMarker === true));
    t.expect('still playing', s.playing);
    t.expect('the strip picks up the playhead', await t.poll(() => !!document.querySelector('.arrangement .arr-bar.now'), null, 3000));
    t.expect('the neck picks up the chord changes', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'A', null, 6000));
    await t.tap(page.locator('#transport button.play'));
  },
};
