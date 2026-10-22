// J4.3 Record one pass from a MIDI keyboard: Connect finds it, Record
// counts in, records a pass of the loop and stops on its own, and the
// notes come back on the 8th grid where they were played. A fake keyboard
// (harness fakeMidi) plays beats 2 and 4 of bars 1 and 2 on cue from the
// band's own clock, notes that sit in the 5th position. docs/flows.md#j43
const recBtn = () => document.querySelector('.cap-setup button.rec')?.textContent ?? '';

export default {
  id: 'J4.3',
  title: 'Record a pass from a MIDI keyboard',
  midi: true,
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open in Capture, on the Vamp’s lead guitar', () => t.open('fire-on-the-mountain/capture'));
    await t.given('a keyboard plays B, A, F#, D# on beats 2 and 4 of the first two bars while it records', () => page.evaluate(async () => {
      const { app } = await import(new URL('js/main.js', document.baseURI).href);
      const cue = { 4: 71, 12: 69, 20: 66, 28: 63 };
      const off = { 6: 71, 14: 69, 22: 66, 30: 63 };
      app.player.addEventListener('step', (e) => {
        if (document.querySelector('.cap-setup button.rec')?.textContent !== 'Recording…') return;
        const { step } = e.detail;
        if (cue[step]) window.__midi.send([0x90, cue[step], 100]);
        if (off[step]) window.__midi.send([0x80, off[step], 0]);
      });
    }));

    await t.step('tap Connect MIDI keyboard', () => t.tap(page.locator('.cap-setup button', { hasText: 'Connect MIDI keyboard' })));
    t.expect('it finds the keyboard', /MIDI connected: Flow Keys/.test(await t.toast()), await t.toast());
    t.expect('and lists it as an input', (await page.locator('.cap-midi select option').allTextContents()).includes('Flow Keys'));

    await t.step('tap Record one pass', () => t.tap(page.locator('.cap-setup button.rec')));
    t.expect('it counts in', await t.poll(() => /Count-in/.test(document.querySelector('.cap-setup button.rec')?.textContent ?? ''), null, 2000), await page.evaluate(recBtn));
    t.expect('then records', await t.poll(() => document.querySelector('.cap-setup button.rec')?.textContent === 'Recording…', null, 5000), await page.evaluate(recBtn));
    t.expect('it stops by itself after one pass of the loop', await t.poll(() => /Captured/.test(document.querySelector('.toast.show')?.textContent ?? ''), null, 14_000), await t.toast());
    t.expect('it caught all four notes', /Captured 4 notes/.test(await t.toast()), await t.toast());
    t.expect('the band has stopped', !(await t.state()).playing);
    t.expect('the take shows them', /^4 notes/.test(await page.locator('.cap-take .panel-head p').textContent()) && await page.locator('.cap-take .cap-notation svg').count() > 0);

    await t.step('name it “Flow take” and tap Save to song', async () => {
      await page.locator('.cap-save input[type=text]').fill('Flow take');
      await t.tap(page.locator('.cap-save button', { hasText: 'Save to song' }));
    });
    const notes = await page.evaluate(async () => {
      const { app } = await import(new URL('js/main.js', document.baseURI).href);
      const list = app.raw.sections.find((s) => s.id === 'vamp').parts.lead;
      return list.find((v) => v.id === 'flow-take')?.notes;
    });
    t.expect('the notes are where I played them: beats 2 and 4, an eighth long', JSON.stringify(notes?.map((n) => [n.t, n.d])) === '[[4,2],[12,2],[20,2],[28,2]]', notes);
    t.expect('placed on the neck in the hand position (5th–8th fret)', notes?.every((n) => n.s && n.f >= 5 && n.f <= 8), notes);
    t.expect('it’s the lead’s chosen variation', (await t.state()).variations.lead === 'flow-take');
  },
};
