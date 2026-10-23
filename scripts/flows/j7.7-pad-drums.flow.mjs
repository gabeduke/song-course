// J7.7 Finger-drum a groove: in Capture, on the drums, the learned pads
// play the kit (kick, snare, hat on the bottom row) and, while the groove
// loops, land in the grid at the step they're struck. docs/flows.md#j77
const PADS = [40, 41, 42, 43, 48, 49, 50, 51, 36, 37, 38, 39, 44, 45, 46, 47];

export default {
  id: 'J7.7',
  title: 'Play the drum pads into a groove',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Capture is open on the drums with the SMK-37’s pads learned', async () => {
      await t.open('fire-on-the-mountain/capture');
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
      await t.tap(page.locator('.kb-sheet button', { hasText: 'Learn controls' }));
      for (const n of PADS) { await t.midi.send([0x90, n, 100]); await t.midi.send([0x80, n, 0]); await t.wait(320); }
      await t.tap(page.locator('.kb-close'));
      await page.locator('.cap-setup select').nth(1).selectOption('drums');
    });
    t.expect('the pads are on drums here', await page.evaluate(async () => (await import(new URL('js/main.js', document.baseURI).href)).app.controller.padMode()) === 'drums');
    await t.listen();

    await t.step('strike Pad 9, bottom left', () => t.midi.send([0x90, 36, 110]));
    t.expect('it plays a kick on the drums', await t.poll(() => window.__heard.calls.some((c) => c.m === 'drum' && c.arg === 'kick' && c.bus === 'drums')), await page.evaluate(() => window.__heard.calls.slice(-2)));

    await t.step('start from Empty and tap Hear it in the loop', async () => {
      await page.locator('.drum-tools select').selectOption('');
      await t.tap(page.locator('.drum-tools button.toggle'));
    });
    await t.until((s) => s.playing);
    const before = await page.locator('.de-row:has(.lane:text-is("snare")) .de-pad.hit').count();
    await t.step('strike Pad 10 (snare) twice while it loops', async () => {
      await t.wait(2600);
      await t.midi.send([0x90, 37, 100]);
      await t.wait(500);
      await t.midi.send([0x90, 37, 60]);
    });
    const after = await page.locator('.de-row:has(.lane:text-is("snare")) .de-pad.hit').count();
    t.expect('two snare hits land in the grid', after - before === 2, { before, after });
    await t.tap(page.locator('#transport button.play'));
  },
};
