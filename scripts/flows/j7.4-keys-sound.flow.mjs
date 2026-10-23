// J7.4 Hear my keys: the SMK plays its own sound by default, so Woodshed
// stays quiet; switch Sound from to Woodshed and a key sounds here, as an
// electric piano on the keyboard view or as the FM synth in a synth
// lesson, and still lights the neck. docs/flows.md#j74
export default {
  id: 'J7.4',
  title: 'Hear my keys through Woodshed or the keyboard',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open on the keyboard view, with the SMK-37 connected', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('.neck [role=radiogroup][aria-label=Instrument] [role=radio]', { hasText: 'Keys' }));
      await t.tap(page.locator('.kb-open'));
      await t.tap(page.locator('.kb-connect button'));
    });
    await t.listen();

    await t.step('play middle C', async () => { await t.midi.send([0x90, 60, 100]); await t.midi.send([0x80, 60, 0]); });
    t.expect('Woodshed leaves it to the keyboard’s own sound', (await t.heard()).live.length === 0, (await t.heard()).live);

    await t.step('choose Sound from: Woodshed, and close the sheet', async () => {
      await t.tap(page.locator('.kb-sheet [aria-label="Sound from"] [role=radio]', { hasText: 'Woodshed' }));
      await t.tap(page.locator('.kb-close'));
    });
    await t.step('play middle C again', () => t.midi.send([0x90, 60, 100]));
    let live = (await t.heard()).live;
    t.expect('it sounds here, as an electric piano', live.some((n) => n.midi === 60 && n.voice === 'keys'), live);
    t.expect('and lights the key on the neck', await t.poll(() => !!document.querySelector('.neck .pn-ping')));
    await t.midi.send([0x80, 60, 0]);
    t.expect('the choice is remembered', await page.evaluate(() => JSON.parse(localStorage.getItem('woodshed.prefs.v1')).controller.sound) === 'woodshed');

    await t.given('the Synth track’s organ lesson is open, with its FM lab', async () => {
      await t.tap(page.locator('.lesson-filter [role=radio]', { hasText: 'Synth' }));
      await t.tap(page.locator('.lesson-title').first());
      await page.waitForSelector('.lab-slot .fml');
    });
    await t.listen();
    await t.step('play the E above', () => t.midi.send([0x90, 64, 90]));
    t.expect('the lab plays it, with the lesson’s patch', await t.poll(() => document.querySelector('.fml')?.dataset.lastNote === '64'), await page.evaluate(() => ({ ...document.querySelector('.fml')?.dataset })));
    t.expect('and Woodshed doesn’t play it twice', (await t.heard()).live.length === 0, (await t.heard()).live);
    t.expect('the lab has the knobs while it’s open', await page.evaluate(async () => (await import(new URL('js/main.js', document.baseURI).href)).app.controller.claimedBy) === 'FM lab');
    await t.midi.send([0x80, 64, 0]);
    await t.step('turn K5', () => t.midi.send([0xb0, 74, 100]));
    t.expect('it moves one of the lab’s operators, and says which', await t.poll(() => /K5/.test(document.querySelector('.hud.show')?.textContent ?? '') && !/Tempo/.test(document.querySelector('.hud.show')?.textContent ?? '')), await page.evaluate(() => document.querySelector('.hud')?.textContent));
  },
};
