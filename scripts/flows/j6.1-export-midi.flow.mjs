// J6.1 Export MIDI for the MPC or a DAW: the loop, named for the song and
// section, or the whole song; a real Standard MIDI File at the tempo I'm
// practising at. docs/flows.md#j61
const smf = (bytes) => {
  const b = [...bytes];
  const head = String.fromCharCode(...b.slice(0, 4));
  const tracks = (bytes.toString('latin1').match(/MTrk/g) ?? []).length;
  const i = b.findIndex((x, k) => x === 0xff && b[k + 1] === 0x51 && b[k + 2] === 0x03);
  const usPerBeat = i >= 0 ? (b[i + 3] << 16) | (b[i + 4] << 8) | b[i + 5] : null;
  return { head, format: (b[8] << 8) | b[9], tracks, bpm: usPerBeat ? Math.round(60e6 / usPerBeat) : null, size: b.length };
};

export default {
  id: 'J6.1',
  title: 'Export the loop or the song as MIDI',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open, slowed to 96', async () => {
      await t.open('fire-on-the-mountain/practice');
      await t.tap(page.locator('#transport button[aria-label=Slower]'));
    });
    let loop;
    await t.step('tap Export MIDI', async () => { loop = await t.download(() => t.tap(page.locator('#transport button', { hasText: 'Export MIDI' }))); });
    const a = smf(loop.bytes);
    t.expect('it downloads the loop as fire-on-the-mountain-vamp.mid', loop.name === 'fire-on-the-mountain-vamp.mid', loop.name);
    t.expect('a type 1 MIDI file with a track per part', a.head === 'MThd' && a.format === 1 && a.tracks >= 5, a);
    t.expect('at 96 bpm', a.bpm === 96, a.bpm);
    t.expect('it says so', /Downloaded fire-on-the-mountain-vamp\.mid/.test(await t.toast()), await t.toast());

    let song;
    await t.step('switch to Whole song and tap Export MIDI', async () => {
      await t.tap(page.locator('#transport [role=radiogroup][aria-label=Loop] [role=radio]', { hasText: 'Whole song' }));
      song = await t.download(() => t.tap(page.locator('#transport button', { hasText: 'Export MIDI' })));
    });
    const b = smf(song.bytes);
    t.expect('it downloads fire-on-the-mountain.mid', song.name === 'fire-on-the-mountain.mid', song.name);
    t.expect('longer than the loop', b.head === 'MThd' && b.size > a.size, { loop: a.size, song: b.size });
  },
};
