// J6.3 Space plays and stops from anywhere on the page, whatever I last
// clicked, except while I'm typing in a box. docs/flows.md#j63
export default {
  id: 'J6.3',
  title: 'Space plays and stops',
  profiles: ['desktop'],
  async run(t) {
    const { page } = t;
    let downloads = 0;
    page.on('download', () => { downloads++; });
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));

    await t.step('press Space', () => page.keyboard.press('Space'));
    t.expect('it plays', (await t.until((x) => x.playing)).playing);
    await t.step('press Space again', () => page.keyboard.press('Space'));
    t.expect('it stops', !(await t.until((x) => !x.playing)).playing);

    await t.step('click Mute on the drums, then press Space', async () => {
      await page.locator('.parts .part[data-part="drums"] button', { hasText: 'Mute' }).click();
      await page.keyboard.press('Space');
    });
    let s = await t.until((x) => x.playing);
    t.expect('it plays, and the drums stay muted', s.playing && s.mutes.drums === true, { playing: s.playing, mutes: s.mutes });
    await page.keyboard.press('Space');
    await t.until((x) => !x.playing);

    // From the keyboard, Space is the focused button's, as it should be.
    await t.step('press Tab to reach the drums’ Mute, and press Space', async () => {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Space');
      await t.wait(300);
    });
    s = await t.state();
    t.expect('Space presses it, as a keyboard should: the drums come back and the band stays stopped', !s.playing && !s.mutes.drums, { playing: s.playing, mutes: s.mutes });

    await t.step('click Export MIDI, then press Space', async () => {
      await t.download(() => page.locator('#transport button', { hasText: 'Export MIDI' }).click());
      downloads = 0;
      await page.keyboard.press('Space');
      await t.wait(500);
    });
    s = await t.state();
    t.expect('it plays, rather than exporting again', s.playing && downloads === 0, { playing: s.playing, downloadsAfterSpace: downloads });
    if (s.playing) await page.keyboard.press('Space');

    await t.step('type “my fill” in Capture’s Name box', async () => {
      await page.locator('#top nav.tabs a', { hasText: 'Capture' }).click();
      await page.locator('.cap-save input[type=text]').click();
      await page.keyboard.type('my fill');
    });
    s = await t.state();
    t.expect('the space is typed, and the band stays stopped', !s.playing && await page.locator('.cap-save input[type=text]').inputValue() === 'my fill', { playing: s.playing });
  },
};
