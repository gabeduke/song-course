// U1 On the tablet, a song's first screen has the whole neck above the
// transport: the thing you practise on, and Play, without scrolling. Today
// the transport wraps to two rows at this width and sits over the low
// strings. A proposal, not agreed yet: todo. docs/flows.md#u1
export default {
  id: 'U1',
  title: 'The whole neck and Play on the first screen',
  status: 'todo',
  profiles: ['tablet'],
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    const g = await page.evaluate(() => {
      const fb = document.querySelector('.neck .fretboard-svg').getBoundingClientRect();
      const tr = document.getElementById('transport').getBoundingClientRect();
      return { neckBottom: Math.round(fb.bottom), transportTop: Math.round(tr.top), transportH: Math.round(tr.height) };
    });
    t.expect('the neck’s low E string and fret numbers are above the transport', g.neckBottom <= g.transportTop, g);
  },
};
