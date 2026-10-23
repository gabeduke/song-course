// J7.3 Start and stop the band from the keyboard: with Clock Out on, SEQ
// PLAY sends MIDI Start and Stop, and the band follows. An echo of a Start
// while it plays doesn't restart it. docs/flows.md#j73
export default {
  id: 'J7.3',
  title: 'Start and stop the band from SEQ PLAY',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open with the SMK-37 connected', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
      await t.tap(page.locator('.kb-close'));
    });
    await t.listen();

    await t.step('press SEQ PLAY on the keyboard', () => t.midi.send([0xfa]));
    t.expect('the band starts', await t.until((s) => s.playing), (await t.state()).playing);
    await t.wait(2600);
    const h = await t.heard();
    t.expect('and plays after the count-in', h.calls > 0 && h.steps.length > 0, { calls: h.calls, steps: h.steps.length });

    await t.step('a second Start arrives while it plays', () => t.midi.send([0xfa]));
    const first = (await t.heard()).steps.at(-1);
    await t.wait(400);
    const later = (await t.heard()).steps.at(-1);
    t.expect('it keeps going without a new count-in', later.step !== 0 || later.time > first.time, { first, later });

    await t.step('press SEQ PLAY again', () => t.midi.send([0xfc]));
    t.expect('the band stops', await t.until((s) => !s.playing), (await t.state()).playing);
  },
};
