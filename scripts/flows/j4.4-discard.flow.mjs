// J4.4 Take it back: on a song I've changed, Discard changes asks first;
// No keeps my take, Yes puts the song back as the repo has it, there and
// then, with nothing left in the browser. docs/flows.md#j44
const leadPills = () => [...document.querySelectorAll('.parts .part[data-part="lead"] [role=radio]')].map((b) => b.textContent);

export default {
  id: 'J4.4',
  title: 'Discard my changes to a song',
  async run(t) {
    const { page } = t;
    await t.given('I’ve saved a riff, “Flow riff”, to Fire on the Mountain’s Vamp', async () => {
      await t.open('fire-on-the-mountain/capture');
      await t.tapFret(1, 7, '.cap-neck');
      await t.tapFret(1, 9, '.cap-neck');
      await page.locator('.cap-save input[type=text]').fill('Flow riff');
      await t.tap(page.locator('.cap-save button', { hasText: 'Save to song' }));
      await t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' }));
    });
    t.expect('Practice shows it, and says the song is changed', (await page.evaluate(leadPills)).includes('Flow riff') && await page.locator('.song-hero .draft-actions').isVisible());

    await t.step('tap Discard changes, and answer No', async () => {
      t.answer(false);
      await t.tap(page.locator('.song-hero .draft-actions button', { hasText: 'Discard changes' }));
    });
    t.expect('it asks first', t.dialogs.at(-1) === 'Discard your changes to this song?', t.dialogs);
    t.expect('No keeps the riff', (await t.state()).edited && (await page.evaluate(leadPills)).includes('Flow riff'));

    await t.step('tap Discard changes, and answer Yes', async () => {
      t.answer(true);
      await t.tap(page.locator('.song-hero .draft-actions button', { hasText: 'Discard changes' }));
    });
    await t.wait(300);
    const s = await t.state();
    t.expect('the picker no longer says edited', await page.locator('#top select.song-select option[value="fire-on-the-mountain"]').textContent() === 'Fire on the Mountain');
    t.expect('nothing is left in the browser', await page.evaluate(() => !JSON.parse(localStorage.getItem('woodshed.drafts.v1') ?? '{}')['fire-on-the-mountain']));
    t.expect('the song the band plays is the repo’s again', !s.sectionVariations.lead?.includes('flow-riff') && s.variations.lead === 'off', s.sectionVariations.lead);
    t.expect('the riff is gone from the lead’s pills', !(await page.evaluate(leadPills)).includes('Flow riff'), await page.evaluate(leadPills));
    t.expect('the page no longer says the song is changed', !(await page.locator('.song-hero .draft-actions').count()));
  },
};
