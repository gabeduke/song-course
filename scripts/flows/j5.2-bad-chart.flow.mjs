// J5.2 A chord chart with a typo says which chord it can't read, and makes
// no song. docs/flows.md#j52
export default {
  id: 'J5.2',
  title: 'A mistyped chart says what’s wrong',
  async run(t) {
    const { page } = t;
    await t.given('Capture is open, with Start a new song open', async () => {
      await t.open('fire-on-the-mountain/capture');
      await t.tap(page.locator('.cap-new summary'));
    });
    await t.step('title it “Typo”, write “Verse: G | H7 | C”, and tap Create song', async () => {
      await page.locator('.new-song label.field', { hasText: 'Title' }).locator('input').fill('Typo');
      await page.locator('.new-song textarea').fill('Verse: G | H7 | C');
      await t.tap(page.locator('.new-song button[type=submit]'));
    });
    const said = await t.toast();
    t.expect('it says the chart has a problem, and names H7', /Check the chords/.test(said) && /H7/.test(said), said);
    const s = await t.state();
    t.expect('no song was made', s.library.length === 4 && s.view === 'capture', s.library.map((l) => l.id));
    t.expect('what I typed is still there to fix', await page.locator('.new-song textarea').inputValue() === 'Verse: G | H7 | C');
  },
};
