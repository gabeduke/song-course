// J7.2 Turn the keyboard's knobs and faders to drive the practice: K5 is
// the tempo, K6 the section, K7 what the neck shows, a fader a part's
// level (its slider follows); each says what it did for a moment. The SMK
// sends these on its MIDI CC banks (CC 74, 71, 73 and 7). docs/flows.md#j72
const connect = async (t) => {
  await t.tap(t.page.locator('.kb-open'));
  await t.tap(t.page.locator('.kb-connect button'));
  await t.tap(t.page.locator('.kb-close'));
};
const hud = () => document.querySelector('.hud.show')?.textContent ?? '';

export default {
  id: 'J7.2',
  title: 'Drive the practice from the knobs and faders',
  midi: { name: 'SMK-37+VA' },
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open with the SMK-37 connected', async () => {
      await t.open('fire-on-the-mountain/practice');
      await connect(t);
    });

    await t.step('turn K5 all the way up, then to the middle', async () => {
      await t.midi.send([0xb0, 74, 127]);
      await t.midi.send([0xb0, 74, 64]);
    });
    let s = await t.state();
    t.expect('the tempo follows: 131 bpm at the middle', s.tempo === 131, s.tempo);
    t.expect('the transport shows it', (await page.locator('.t-bpm strong').textContent()) === '131');
    t.expect('it says K5 set the tempo', await t.poll(() => /K5.*Tempo.*131 bpm/.test(document.querySelector('.hud.show')?.textContent ?? '')), await page.evaluate(hud));

    const order = await page.evaluate(async () => (await import(new URL('js/main.js', document.baseURI).href)).app.song.order);
    await t.step('turn K6 to the far end', () => t.midi.send([0xb0, 71, 127]));
    s = await t.state();
    t.expect('it loops the last section', s.sectionId === order.at(-1), { sectionId: s.sectionId, order });
    t.expect('and the arrangement shows it chosen', await page.locator(`.arr-block.active[data-sid="${order.at(-1)}"]`).count() > 0);

    await t.step('turn K7 to the third step', () => t.midi.send([0xb0, 73, 70]));
    s = await t.state();
    t.expect('the neck shows the scale', s.fb.layer === 'scale', s.fb.layer);

    await t.step('pull fader 1 down to a quarter', () => t.midi.send([0xb0, 7, 32]));
    const vol = await page.locator('.part[data-part="drums"] input.vol').inputValue();
    t.expect('the drums’ slider follows', Math.abs(Number(vol) - 32 / 127) < 0.01, vol);
    t.expect('it says the drums level changed', await t.poll(() => /Fader 1.*Drums level/.test(document.querySelector('.hud.show')?.textContent ?? '')), await page.evaluate(hud));
    const bus = await page.evaluate(async () => {
      const { app } = await import(new URL('js/main.js', document.baseURI).href);
      return app.store.state.volumes.drums;
    });
    t.expect('the band’s drums are set to it', Math.abs(bus - 32 / 127) < 0.01, bus);
  },
};
