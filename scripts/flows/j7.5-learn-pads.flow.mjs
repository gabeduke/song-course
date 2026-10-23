// J7.5 Teach Woodshed my pads: Learn walks the sixteen pads (the SMK's
// Notes bank sends notes the manual doesn't list), then the top row loops
// the sections and the bottom row mutes the parts. Learned pads survive a
// reload. docs/flows.md#j75
const PADS = [40, 41, 42, 43, 48, 49, 50, 51, 36, 37, 38, 39, 44, 45, 46, 47];

export default {
  id: 'J7.5',
  title: 'Learn the pads, then mute parts and pick sections with them',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open with the SMK-37 connected, its pads on the Notes bank', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
    });

    await t.step('tap Learn controls', () => t.tap(page.locator('.kb-sheet button', { hasText: 'Learn controls' })));
    t.expect('it asks for Pad 1', /Move Pad 1/.test(await page.locator('.kb-learn').textContent()), await page.locator('.kb-learn').textContent());

    await t.step('strike each pad in turn, top row then bottom', async () => {
      for (const n of PADS) {
        await t.midi.send([0x90, n, 100]);
        await t.midi.send([0x80, n, 0]);
        await t.wait(320);
      }
    });
    t.expect('it has learned all sixteen and stops asking', await page.locator('.kb-learn').count() === 0);
    const rows = await page.locator('.kb-table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].slice(0, 3).map((c) => c.textContent)));
    t.expect('Pad 9 sends note 36 and mutes the drums', rows.some(([c, d, b]) => c === 'Pad 9' && d === 'Drums' && b === 'Note 36 ch 1'), rows.filter(([c]) => c.startsWith('Pad')).slice(8, 10));
    const want = await page.evaluate(async () => {
      const { song } = (await import(new URL('js/main.js', document.baseURI).href)).app;
      return Math.min(8, song.order.length) + Math.min(8, song.parts.length);
    });
    t.expect('the map lights a pad for each section and part', await page.locator('.kb-map .kb-pad.acts').count() === want, want);

    await t.step('close the sheet and strike Pad 9', async () => {
      await t.tap(page.locator('.kb-close'));
      await t.midi.send([0x90, 36, 100]);
      await t.midi.send([0x80, 36, 0]);
    });
    let s = await t.state();
    t.expect('the drums are muted, for me to play', s.mutes.drums === true, s.mutes);
    t.expect('the part shows it', await page.locator('.part[data-part="drums"].muted').count() === 1);

    const order = await page.evaluate(async () => (await import(new URL('js/main.js', document.baseURI).href)).app.song.order);
    await t.step('strike Pad 2', async () => { await t.midi.send([0x90, 41, 100]); await t.midi.send([0x80, 41, 0]); });
    s = await t.state();
    t.expect('it loops the second section', s.sectionId === order[1], { sectionId: s.sectionId, order });

    await t.step('reload the page and connect again', async () => {
      await page.reload();
      await page.waitForSelector('.kb-open');
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
      await t.tap(page.locator('.kb-close'));
      await t.midi.send([0x90, 36, 100]);
    });
    s = await t.state();
    t.expect('Pad 9 still mutes the drums', s.mutes.drums === true, s.mutes);
  },
};
