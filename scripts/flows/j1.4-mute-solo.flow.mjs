// J1.4 Mute the part I'm going to play, and the band plays on without it
// while the neck keeps showing it; solo a part to hear it alone; undo
// both; turn a part down. Checked against what the engine was asked to
// play. docs/flows.md#j14
const partBtn = (page, part, name) => page.locator(`.parts .part[data-part="${part}"] .part-btns button`, { hasText: name });

export default {
  id: 'J1.4',
  title: 'Mute my part, or solo one, while it loops',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is playing', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('#transport button.play'));
      await t.poll(() => /bar 1\//.test(document.getElementById('t-count')?.textContent ?? ''), null, 5000);
    });

    await t.step('tap Mute on Rhythm guitar', () => t.tap(partBtn(page, 'rhythm', 'Mute')));
    let s = await t.until((x) => x.mutes.rhythm);
    t.expect('rhythm guitar is muted', s.mutes.rhythm === true, s.mutes);
    t.expect('its Mute button shows it’s on', await partBtn(page, 'rhythm', 'Mute').getAttribute('aria-pressed') === 'true');
    await t.listen();
    await t.wait(2600);
    let h = await t.heard();
    t.expect('the band plays on without it', s.playing && !h.parts.rhythm && h.parts.drums > 0 && h.parts.bass > 0, h.parts);
    t.expect('the neck still shows what it plays (it pings the strums)', await t.poll(() => document.querySelectorAll('.fretboard-svg .fb-pings circle').length > 0, null, 3000));

    await t.step('tap Solo on Drums', () => t.tap(partBtn(page, 'drums', 'Solo')));
    s = await t.until((x) => x.solo === 'drums');
    await t.listen();
    await t.wait(2600);
    h = await t.heard();
    t.expect('only the drums play', Object.keys(h.parts).join() === 'drums', h.parts);
    t.expect('the other parts are dimmed', await page.locator('.parts .part.dimmed').count() === 4, await page.locator('.parts .part.dimmed').count());

    await t.step('tap Solo on Drums again, and unmute Rhythm guitar', async () => {
      await t.tap(partBtn(page, 'drums', 'Solo'));
      await t.tap(partBtn(page, 'rhythm', 'Mute'));
    });
    s = await t.until((x) => !x.solo && !x.mutes.rhythm);
    await t.listen();
    await t.wait(2600);
    h = await t.heard();
    t.expect('the whole band is back', ['drums', 'bass', 'rhythm', 'keys'].every((p) => h.parts[p] > 0), h.parts);
    t.expect('and it never stopped', s.playing, s);

    await t.step('drag the keys’ volume most of the way down', () => t.drag(page.locator('.parts .part[data-part="keys"] input.vol'), 0.15));
    const gain = await page.evaluate(async () => {
      const { app } = await import(new URL('js/main.js', document.baseURI).href);
      return app.engine.buses.get('keys').gain.gain.value;
    });
    t.expect('the keys are turned down in the mix, still playing', gain > 0.05 && gain < 0.25, gain);
  },
};
