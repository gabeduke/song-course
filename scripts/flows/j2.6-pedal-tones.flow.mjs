// J2.6 Hold a pedal tone: Fire on the Mountain's lesson sets the lead to
// the little-finger pedal and the neck to Fingers. Over B the neck shows
// that chord's notes only, the pedal ringed on the D string's 9th fret under
// finger 4 and the hand's four frets banded; the band plays the pedal under
// the other notes; when the chord changes to A the ring moves to the 7th
// fret. docs/flows.md#j26
const neck = () => ({
  dots: [...document.querySelectorAll('.neck .fretboard-svg .fb-dot')].map((g) => ({
    string: Number(g.dataset.string), fret: Number(g.dataset.fret), label: g.querySelector('text')?.textContent, ring: g.classList.contains('ring'),
  })),
  band: document.querySelector('.neck .fb-band.on') !== null,
  chord: document.querySelector('.readout .now-chord')?.textContent,
  labels: document.querySelector('.neck [role=radiogroup][aria-label=Labels] [aria-checked=true]')?.textContent,
});

export default {
  id: 'J2.6',
  title: 'Hold a pedal tone',
  profiles: ['tablet', 'desktop'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));

    await t.step('open “Hold a pedal tone” and tap Set up this exercise', async () => {
      await t.tap(page.locator('.lessons .lesson-title', { hasText: 'Hold a pedal tone' }));
      await t.tap(page.locator('.lessons .lesson.open button', { hasText: 'Set up this exercise' }));
    });
    const s = await t.state();
    t.expect('the lead plays the little-finger pedal, the neck follows it', s.variations.lead === 'pedal-pinky' && s.fb.layer === 'shape' && s.fb.part === 'lead', s);
    let n = await page.evaluate(neck);
    t.expect('the labels are on Fingers', n.labels === 'Fingers', n.labels);
    const ring = n.dots.filter((d) => d.ring);
    t.expect('one ringed dot, the pedal: the D string’s 9th fret, little finger', ring.length === 1 && ring[0].string === 4 && ring[0].fret === 9 && ring[0].label === '4', n.dots);
    t.expect('the other notes are higher strings under fingers 1–3', n.dots.filter((d) => !d.ring).every((d) => d.string < 4 && ['1', '2', '3'].includes(d.label)), n.dots);
    t.expect('a band marks the hand’s four frets', n.band);

    await t.step('tap Play and listen into the A bar', async () => {
      await t.listen();
      await t.tap(page.locator('#transport button.play'));
    });
    t.expect('the neck moves to A', await t.poll(() => document.querySelector('.readout .now-chord')?.textContent === 'A', null, 12_000));
    n = await page.evaluate(neck);
    const ringA = n.dots.filter((d) => d.ring);
    t.expect('the pedal ring moves two frets down, to the 7th', ringA.length === 1 && ringA[0].string === 4 && ringA[0].fret === 7, n.dots);
    const lead = (await page.evaluate(() => window.__heard.calls)).filter((c) => c.bus === 'lead' && c.m === 'pluck').map((c) => c.arg);
    t.expect('the lead played the pedal, B, under C#, D# and F#', [59, 61, 63, 66].every((m) => lead.includes(m)), lead);
    await t.step('tap Stop', () => t.tap(page.locator('#transport button.play')));
    t.expect('the band stops', !(await t.until((x) => !x.playing)).playing);
  },
};
