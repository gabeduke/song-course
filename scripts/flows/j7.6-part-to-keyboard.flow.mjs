// J7.6 Hear a band part on the keyboard's own engine: pick the keys part
// in the sheet and it goes out to the SMK on channel 1, timed ahead to
// land with the band, while Woodshed's own keys go quiet; Send clock sends
// Start, 24 clocks a beat and Stop, so the SMK's arpeggiator and patterns
// follow. docs/flows.md#j76
export default {
  id: 'J7.6',
  title: 'Play a band part and the clock on the keyboard',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Just Like Heaven is open with the SMK-37 connected', async () => {
      await t.open('just-like-heaven/practice');
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
    });
    const keysName = await page.evaluate(async () => (await import(new URL('js/main.js', document.baseURI).href)).app.song.parts.find((p) => p.id === 'keys').name);

    await t.step(`pick ${keysName} under Play a band part on it, and switch on Send clock`, async () => {
      await page.locator('.kb-sheet select').filter({ has: page.locator('option', { hasText: 'None: Woodshed plays the whole band' }) }).selectOption('keys');
      await t.tap(page.locator('.kb-sheet button.toggle', { hasText: 'Send clock' }));
      await t.tap(page.locator('.kb-close'));
    });
    await t.listen();
    await t.step('press Play', () => t.tap(page.locator('#transport button.play')));
    await t.until((s) => s.playing);
    await t.wait(4200);
    const sent = await t.midi.sent();
    const h = await t.heard();
    const notes = sent.filter((m) => (m.data[0] & 0xf0) === 0x90);
    t.expect('the keys part goes to the keyboard as notes on channel 1', notes.length > 0 && notes.every((m) => m.data[0] === 0x90), notes.slice(0, 4));
    t.expect('Woodshed’s own keys stay quiet', !h.parts.keys, h.parts);
    t.expect('the rest of the band plays here', h.parts.drums > 0 && h.parts.bass > 0, h.parts);
    const starts = sent.filter((m) => m.data[0] === 0xfa);
    const clocks = sent.filter((m) => m.data[0] === 0xf8);
    t.expect('a Start goes out, once', starts.length === 1, starts.length);
    t.expect('then clock, six to each sixteenth', clocks.length >= 24 && clocks[0].at >= starts[0].at - 2, { clocks: clocks.length });
    const gap = (clocks.at(-1).at - clocks[0].at) / (clocks.length - 1);
    const tempo = (await t.state()).tempo;
    t.expect(`at the band’s tempo (${tempo} bpm)`, Math.abs(gap - 60000 / tempo / 24) < 1.5, { gapMs: gap, want: 60000 / tempo / 24 });

    await t.step('press Stop', () => t.tap(page.locator('#transport button.play')));
    const after = await t.midi.sent();
    t.expect('a Stop goes out, and the keyboard’s notes are let go', after.some((m) => m.data[0] === 0xfc) && after.some((m) => m.data[0] === 0xb0 && m.data[1] === 123), after.slice(-3));
  },
};
