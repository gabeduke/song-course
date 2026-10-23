// J2.5 Hear what an FM operator does: the Synth track's first lesson opens
// the FM lab under the neck. A held note sounds; raising operator 2's index
// puts sidebands either side of the note, a 3.5 ratio moves them off the
// harmonics (a bell), a four-operator wiring redraws the diagram, and
// closing the lesson puts the lab away. docs/flows.md#j25
const lab = () => {
  const el = document.querySelector('.lab-slot .fml');
  const svg = el?.querySelector('.fml-diagram-svg');
  return {
    open: !!el && !document.querySelector('.lab-slot').hidden,
    underNeck: document.querySelector('.neck')?.nextElementSibling?.matches('.lab-slot') ?? false,
    ops: svg?.dataset.ops, carriers: svg?.dataset.carriers,
    partials: el?.querySelector('.fml-spec-box')?.dataset.partials ?? '',
    explain: el?.querySelector('.fml-explain')?.textContent ?? '',
    played: el?.dataset.played, lastNote: el?.dataset.lastNote, heard: el?.dataset.heard,
    unused: [...(el?.querySelectorAll('.fml-op.unused') ?? [])].map((c) => c.dataset.op),
  };
};
const xs = (p) => p.partials.split(',').filter(Boolean).map(Number);

export default {
  id: 'J2.5',
  title: 'Hear what an FM operator does',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page } = t;
    await t.given('Just Like Heaven is open', () => t.open('just-like-heaven/practice'));

    await t.step('choose the Synth track and open “How FM operators work”', async () => {
      await t.tap(page.locator('.lessons [role=radiogroup][aria-label="Lesson track"] [role=radio]', { hasText: 'Synth' }));
      await t.tap(page.locator('.lessons .lesson-title', { hasText: 'How FM operators work' }));
    });
    t.expect('the FM lab opens, right under the neck', await t.poll(() => !!document.querySelector('.lab-slot .fml-diagram-svg')), await page.evaluate(lab));
    let p = await page.evaluate(lab);
    t.expect('it sits right under the neck', p.open && p.underNeck, p);
    t.expect('it starts from a lone sine: two operators wired as a pair, one carrier', p.ops === '2' && p.carriers === '1', p);
    t.expect('it predicts a single partial, at the note', p.partials === '1', p.partials);

    await t.step('turn on Hold notes and tap middle C on the lab’s keys', async () => {
      await t.tap(page.locator('.fml-play button', { hasText: 'Hold notes' }));
      await t.tap(page.locator('.fml-keys rect[data-midi="60"]'));
    });
    p = await page.evaluate(lab);
    t.expect('it plays C4', p.played === '1' && p.lastNote === '60', p);
    t.expect('the spectrum hears it', await t.poll(() => document.querySelector('.fml')?.dataset.heard === 'yes'), await page.evaluate(lab));

    await t.step('raise operator 2’s index to about 4', () => t.drag(page.locator('.fml-op[data-op="2"] input[aria-label="Operator 2 index"]'), 0.4));
    p = await page.evaluate(lab);
    t.expect('sidebands appear either side of the note, on its harmonics', xs(p).length >= 4 && xs(p).every((x) => Number.isInteger(x)), p.partials);
    t.expect('the lab says why it still sounds pitched', /sounds pitched/.test(p.explain), p.explain);

    await t.step('set operator 2’s ratio to 3, then add a fine of about .50', async () => {
      await t.drag(page.locator('input[aria-label="Operator 2 ratio"]'), 3 / 16);
      await t.drag(page.locator('input[aria-label="Operator 2 fine ratio"]'), 0.5 / 0.99);
    });
    p = await page.evaluate(lab);
    const ratio = await page.locator('.fml-diagram-svg .fml-dop[data-op="2"] .fml-dop-ratio').textContent();
    t.expect('operator 2 reads about ×3.5', /^×3\.(4[6-9]|5|5\d)$/.test(ratio), ratio);
    t.expect('the predicted partials leave the harmonic grid', xs(p).some((x) => Math.abs(x - Math.round(x)) > 0.3), p.partials);
    t.expect('the lab calls it a bell', /bell/.test(p.explain), p.explain);

    await t.step('pick the Two pairs wiring', () => t.tap(page.locator('.fml-algos [role=radio]', { hasText: 'Two pairs' })));
    p = await page.evaluate(lab);
    t.expect('the diagram shows four operators feeding two carriers', p.ops === '4' && p.carriers === '2', p);
    t.expect('operators 3 and 4 come into play', p.unused.length === 0, p.unused);

    await t.step('close the lesson', () => t.tap(page.locator('.lessons .lesson-title', { hasText: 'How FM operators work' })));
    p = await page.evaluate(lab);
    t.expect('the lab goes away with it', !p.open && !(await page.locator('.fml').count()), p);
    t.expect('no lesson is open', (await t.state()).lessonId === null);
  },
};
