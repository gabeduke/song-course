// J1.1 Woodshed opens on the practice book. Pick a song from the picker:
// it opens in Practice with its title,
// key, meter and tempo, the readout on its first chord and the neck lit
// with that chord's tones. The address names it. docs/flows.md#j11
const page = () => ({
  h1: document.querySelector('.song-hero h1')?.textContent,
  facts: document.querySelector('.song-hero .facts')?.textContent,
  chord: document.querySelector('.readout .now-chord')?.textContent,
  labels: [...new Set([...document.querySelectorAll('.fretboard-svg .fb-dot text')].map((t) => t.textContent))].sort(),
  bpm: document.querySelector('#transport .t-bpm strong')?.textContent,
  title: document.title,
  options: [...document.querySelectorAll('#top select.song-select option')].map((o) => o.textContent),
});

export default {
  id: 'J1.1',
  title: 'Pick a song and see what it drills',
  profiles: ['tablet', 'desktop', 'phone'],
  async run(t) {
    const { page: p } = t;
    await t.given('Woodshed is open', () => t.open());
    let s = await t.state();
    t.expect('it opens on the practice book, and the address says so', s.view === 'book' && !s.drillId && p.url().endsWith('#/book'), { view: s.view, url: p.url() });
    const first = await p.evaluate(page);
    t.expect('the picker lists the four starter songs', first.options.length === 4, first.options);

    await t.step('pick Just Like Heaven in the song picker', () => p.locator('#top select.song-select').selectOption('just-like-heaven'));
    s = await t.until((x) => x.songId === 'just-like-heaven');
    t.expect('the song opens in Practice', s.songId === 'just-like-heaven' && s.view === 'practice', s);
    t.expect('the address names it, so it can be bookmarked', p.url().endsWith('#/just-like-heaven/practice'), p.url());
    const v = await p.evaluate(page);
    t.expect('its title heads the page', v.h1 === 'Just Like Heaven', v);
    t.expect('with its key, meter and tempo', /Key of A major/.test(v.facts) && /4\/4/.test(v.facts) && /112 bpm/.test(v.facts), v.facts);
    t.expect('the readout shows the first chord, A', v.chord === 'A', v.chord);
    t.expect('the neck lights up A’s tones, A C# E', JSON.stringify(v.labels) === JSON.stringify(['A', 'C#', 'E']), v.labels);
    t.expect('the transport is at the song’s tempo', v.bpm === '112', v.bpm);
    t.expect('the browser tab names the song', v.title.startsWith('Just Like Heaven'), v.title);
  },
};
