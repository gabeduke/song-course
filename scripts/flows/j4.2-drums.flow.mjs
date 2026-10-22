// J4.2 Program a groove: pick Drums and the pads replace the neck, start
// from a groove or empty, a tap cycles hit, accent, ghost, off, "Hear it
// in the loop" plays the pads as I change them, and Save to song keeps
// it. docs/flows.md#j42
const pad = (page, lane, n) => page.locator(`.drum-editor .de-pad[aria-label="${lane} step ${n}"]`);
const draft = async () => {
  const { app } = await import(new URL('js/main.js', document.baseURI).href);
  const v = app.player.song.sections.vamp.parts.drums.find((x) => x.id === '_draft');
  return v ? v.events.map((e) => `${e.drum}@${e.t}`) : null;
};

export default {
  id: 'J4.2',
  title: 'Program a drum groove and save it',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open in Capture', () => t.open('fire-on-the-mountain/capture'));

    await t.step('pick Drums as the part', () => page.locator('.cap-setup label.field', { hasText: 'Part' }).locator('select').selectOption('drums'));
    t.expect('the pads replace the neck', await page.locator('.drum-editor').isVisible() && !(await page.locator('.cap-neck').isVisible()));
    t.expect('a row of 16 pads for each drum', await page.locator('.drum-editor .de-row').count() === 10 && await page.locator('.drum-editor .de-row').first().locator('.de-pad').count() === 16);
    t.expect('starting from the groove that’s playing', await page.locator('.cap-take label.field', { hasText: 'Start from' }).locator('select').inputValue() === 'groove'
      && await page.locator('.drum-editor .de-pad.hit').count() > 0);

    await t.step('start from Empty', () => page.locator('.cap-take label.field', { hasText: 'Start from' }).locator('select').selectOption(''));
    t.expect('every pad is off', await page.locator('.drum-editor .de-pad.hit').count() === 0);

    await t.step('tap kick on 1 and 9, snare twice on 5 and 13, hats on the eighths', async () => {
      for (const n of [1, 9]) await t.tap(pad(page, 'kick', n));
      for (const n of [5, 13]) { await t.tap(pad(page, 'snare', n)); await t.tap(pad(page, 'snare', n)); }
      for (const n of [1, 3, 5, 7, 9, 11, 13, 15]) await t.tap(pad(page, 'hat', n));
    });
    const cls = async (lane, n) => pad(page, lane, n).getAttribute('class');
    t.expect('one tap is a hit, two an accent', /\bhit\b/.test(await cls('kick', 1)) && !/\bacc\b/.test(await cls('kick', 1)) && /\bacc\b/.test(await cls('snare', 5)), { kick: await cls('kick', 1), snare: await cls('snare', 5) });
    t.expect('12 pads are on', await page.locator('.drum-editor .de-pad.hit').count() === 12);

    await t.listen();
    await t.step('tap Hear it in the loop', () => t.tap(page.locator('.cap-take button', { hasText: 'Hear it in the loop' })));
    t.expect('the band starts', (await t.until((x) => x.playing)).playing);
    await t.poll(() => (window.__heard?.calls ?? []).some((c) => c.m === 'drum'), null, 6000);
    await t.wait(1500);
    const lanes = [...new Set((await page.evaluate(() => window.__heard.calls.filter((c) => c.m === 'drum').map((c) => c.arg))))].sort();
    t.expect('the drums play my pads: kick, snare and hat, nothing else', JSON.stringify(lanes) === '["hat","kick","snare"]', lanes);

    await t.step('tap kick on 15 while it plays', () => t.tap(pad(page, 'kick', 15)));
    const ev = await page.evaluate(draft);
    t.expect('the loop picks it up', ev?.includes('kick@14'), ev);

    await t.step('name it “Flow groove” and tap Save to song', async () => {
      await page.locator('.cap-save input[type=text]').fill('Flow groove');
      await t.tap(page.locator('.cap-save button', { hasText: 'Save to song' }));
    });
    t.expect('it says it’s saved and chosen', /Saved "Flow groove"/.test(await t.toast()), await t.toast());
    const s = await t.state();
    t.expect('the Vamp’s drums have it, chosen, and no draft left over', s.variations.drums === 'flow-groove' && !s.sectionVariations.drums.includes('_draft') && s.sectionVariations.drums.at(-1) === 'flow-groove', s.sectionVariations.drums);

    await t.step('go to Practice', () => t.tap(page.locator('#top nav.tabs a', { hasText: 'Practice' })));
    t.expect('Flow groove is the drums’ chosen pill', await page.locator('.parts .part[data-part="drums"] [role=radio]', { hasText: 'Flow groove' }).getAttribute('aria-checked') === 'true');
  },
};
