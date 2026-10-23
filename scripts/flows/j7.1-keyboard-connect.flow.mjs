// J7.1 Connect the SMK-37 and see what its controls do here: the sheet
// names the keyboard and its firmware, draws its panel with the controls
// that reach Woodshed lit and labelled (K5–K8, the faders, SEQ PLAY), says
// how to set the keyboard up, and the top bar shows it connected.
// docs/flows.md#j71
export default {
  id: 'J7.1',
  title: 'Connect the keyboard and see what its controls do',
  midi: { name: 'SMK-37+VA' },
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open, with the SMK-37 plugged in', () => t.open('fire-on-the-mountain/practice'));
    t.expect('the top bar offers the keyboard', await page.locator('.kb-open').isVisible());

    await t.step('tap Keyboard', () => t.tap(page.locator('.kb-open')));
    t.expect('a sheet opens asking to connect', await page.locator('.kb-sheet[open] .kb-connect button').isVisible());

    await t.step('tap Connect keyboard', () => t.tap(page.locator('.kb-connect button')));
    t.expect('it names the keyboard and its firmware', /SMK-37\+VA · .*SMK-37\+VA firmware/.test(await page.locator('.kb-dev').textContent()), await page.locator('.kb-dev').textContent());
    const caps = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.kb-map [data-control]')]
      .map((g) => [g.dataset.control, { lit: g.classList.contains('acts'), cap: g.querySelector('.kb-cap, .kb-pad-t')?.textContent ?? '' }])));
    t.expect('K5–K8 are lit as tempo, section, neck and position', ['k5', 'k6', 'k7', 'k8'].every((k) => caps[k]?.lit)
      && caps.k5.cap === 'Tempo' && caps.k6.cap === 'Section' && caps.k7.cap === 'Neck' && caps.k8.cap === 'Position', caps);
    t.expect('K1–K4 are the keyboard’s own (select, adjust, preset, volume)', ['k1', 'k2', 'k3', 'k4'].every((k) => !caps[k]?.lit) && caps.k1.cap === 'Select', caps.k1);
    t.expect('the faders are the band’s parts, drums first', caps.f1?.lit && caps.f1.cap === 'Drums' && caps.f2.cap === 'Bass', [caps.f1, caps.f2]);
    t.expect('SEQ PLAY reaches Woodshed', caps.seqplay?.lit, caps.seqplay);
    const rows = await page.locator('.kb-table tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.children].slice(0, 3).map((c) => c.textContent)));
    t.expect('the table says what K5 sends and does', rows.some(([c, d, b]) => c === 'K5' && d === 'Tempo' && b === 'CC 74'), rows.slice(0, 8));
    t.expect('it says how to set the keyboard up', (await page.locator('.kb-steps li').count()) >= 4);

    await t.step('close the sheet', () => t.tap(page.locator('.kb-close')));
    t.expect('the top bar shows the keyboard connected', /SMK-37\+VA/.test(await page.locator('.kb-open').getAttribute('aria-label')) && await page.locator('.kb-open.on').count() === 1);
  },
};
