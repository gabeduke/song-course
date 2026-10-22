// J4.5 Download the song file with my take in it, to drop into songs/ and
// commit: it's the song's own file name, it compiles, and the take is in
// the section I saved it to. docs/flows.md#j45
import { compileSong } from '../../js/song.js';

export default {
  id: 'J4.5',
  title: 'Download the song file to commit',
  async run(t) {
    const { page } = t;
    await t.given('I’ve saved a riff, “Flow riff”, to Fire on the Mountain’s Vamp', async () => {
      await t.open('fire-on-the-mountain/capture');
      await t.tapFret(1, 7, '.cap-neck');
      await t.tapFret(2, 8, '.cap-neck');
      await page.locator('.cap-save input[type=text]').fill('Flow riff');
      await t.tap(page.locator('.cap-save button', { hasText: 'Save to song' }));
      await t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' }));
    });

    let file;
    await t.step('tap Download song file', async () => {
      file = await t.download(() => t.tap(page.locator('.song-hero .draft-actions button', { hasText: 'Download song file' })));
    });
    t.expect('it’s the song’s own file, fire-on-the-mountain.json', file.name === 'fire-on-the-mountain.json', file.name);
    let compiled = null;
    let err = '';
    try { compiled = compileSong(JSON.parse(file.text)); } catch (e) { err = e.message; }
    t.expect('it compiles', !!compiled, err);
    const riff = compiled?.sections.vamp.parts.lead.find((v) => v.id === 'flow-riff');
    t.expect('with the riff in the Vamp’s lead guitar, both notes', riff?.events.length === 2, riff?.events);
    t.expect('it says where the file goes', /Downloaded fire-on-the-mountain\.json/.test(await t.toast()), await t.toast());
  },
};
