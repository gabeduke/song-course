// J4.1 Tap a riff in on the fretboard: each tap is heard and goes in at
// the cursor, notation and tab draw it, Rest and Undo fix it, and Save to
// song makes it a variation that's chosen, played, and kept after a
// reload. docs/flows.md#j41
const takeHead = () => document.querySelector('.cap-take .panel-head p')?.textContent ?? '';

export default {
  id: 'J4.1',
  title: 'Tap a riff in and save it to the song',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open in Capture, on the Vamp’s lead guitar', () => t.open('fire-on-the-mountain/capture'));
    await t.listen();

    await t.step('choose Quarter notes', () => t.tap(page.locator('.cap-setup [role=radiogroup][aria-label="Note length"] [role=radio]', { hasText: 'Quarter' })));
    await t.step('tap B, F#, C# and B on the top two strings around the 7th fret', async () => {
      for (const [s, f] of [[1, 7], [2, 7], [1, 9], [1, 7]]) await t.tapFret(s, f, '.cap-neck');
    });
    t.expect('each note is heard as it goes in', await t.poll(() => window.__heard.auditions.length === 4), (await t.heard()).auditions);
    t.expect('the take has 4 notes and the cursor has moved to bar 2', /^4 notes · cursor at bar 2, beat 1/.test(await page.evaluate(takeHead)), await page.evaluate(takeHead));
    t.expect('it’s written out as notation and tab', await t.poll(() => !!document.querySelector('.cap-take .cap-notation svg'), null, 4000));

    await t.step('tap Rest, then Undo', async () => {
      await t.tap(page.locator('.cap-setup button', { hasText: 'Rest' }));
      await t.tap(page.locator('.cap-setup button', { hasText: 'Undo' }));
    });
    t.expect('the last note is gone and the cursor is back where it was', /^3 notes · cursor at bar 1, beat 4/.test(await page.evaluate(takeHead)), await page.evaluate(takeHead));

    await t.step('name it “Flow riff” and tap Save to song', async () => {
      await page.locator('.cap-save input[type=text]').fill('Flow riff');
      await t.tap(page.locator('.cap-save button', { hasText: 'Save to song' }));
    });
    t.expect('it says it’s saved', /Saved "Flow riff"/.test(await t.toast()), await t.toast());
    let s = await t.state();
    t.expect('the Vamp’s lead guitar has it, chosen', s.sectionVariations.lead?.includes('flow-riff') && s.variations.lead === 'flow-riff', s.variations);
    t.expect('the picker marks the song edited', await page.locator('#top select.song-select option[value="fire-on-the-mountain"]').textContent() === 'Fire on the Mountain (edited)');

    await t.step('go to Practice and play', async () => {
      await t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' }));
      await t.listen();
      await t.tap(page.locator('#transport button.play'));
    });
    t.expect('Flow riff is the lead’s chosen pill', await page.locator('.parts .part[data-part="lead"] [role=radio]', { hasText: 'Flow riff' }).getAttribute('aria-checked') === 'true');
    t.expect('the page says I’ve changed the song', /changed this song/.test(await page.locator('.song-hero .draft-actions').textContent()));
    t.expect('the band plays my riff on the lead', await t.poll(() => (window.__heard?.calls ?? []).some((c) => c.bus === 'lead'), null, 7000), (await t.heard()).parts);
    await t.tap(page.locator('#transport button.play'));

    await t.step('reload the page', () => t.open('fire-on-the-mountain/practice'));
    s = await t.state();
    t.expect('the riff is still in the song', s.edited && s.sectionVariations.lead?.includes('flow-riff'), s.sectionVariations.lead);
  },
};
