// J2.2 The lessons come in tracks, one per instrument: a keys lesson puts
// the keyboard where the neck was, a drums lesson solos the drums, a synth
// lesson mutes the keys so I play them on the synth. docs/flows.md#j22
const track = (page, name) => page.locator('.lessons [role=radiogroup][aria-label="Lesson track"] [role=radio]', { hasText: name });
const setUp = async (t, title) => {
  await t.tap(t.page.locator('.lessons .lesson-title', { hasText: title }));
  await t.tap(t.page.locator('.lessons .lesson.open button', { hasText: 'Set up this exercise' }));
};

export default {
  id: 'J2.2',
  title: 'Keys, drums and synth lesson tracks',
  async run(t) {
    const { page } = t;
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    const tracks = await page.locator('.lessons [role=radiogroup][aria-label="Lesson track"] [role=radio]').allTextContents();
    t.expect('there are Guitar, Keys, Drums and Synth tracks', JSON.stringify(tracks) === '["Guitar","Keys","Drums","Synth"]', tracks);

    await t.step('choose the Keys track, open “Two hands, two jobs” and set it up', async () => {
      await t.tap(track(page, 'Keys'));
      await setUp(t, 'Two hands, two jobs');
    });
    let s = await t.state();
    t.expect('the keyboard replaces the neck', s.fb.instrument === 'keys' && await page.locator('.neck .piano-svg').isVisible(), s.fb);
    t.expect('keys play Two hands, at 70 bpm', s.variations.keys === 'two-hand' && s.tempo === 70, s);

    await t.step('choose the Drums track, open “Anatomy of the groove” and set it up', async () => {
      await t.tap(track(page, 'Drums'));
      await setUp(t, 'Anatomy of the groove');
    });
    s = await t.state();
    t.expect('the drums are soloed', s.solo === 'drums' && await page.locator('.parts .part[data-part="drums"] button', { hasText: 'Solo' }).getAttribute('aria-pressed') === 'true', s.solo);
    t.expect('on the Groove, at 100 bpm', s.variations.drums === 'groove' && s.tempo === 100, s);

    await t.step('choose the Synth track, open “A warm organ comp on the FM-1” and set it up', async () => {
      await t.tap(track(page, 'Synth'));
      await setUp(t, 'A warm organ comp');
    });
    s = await t.state();
    t.expect('the keys are muted for me to play, the solo is off', s.mutes.keys === true && !s.solo, { mutes: s.mutes, solo: s.solo });
    t.expect('the keyboard shows the stabs', s.fb.instrument === 'keys' && s.variations.keys === 'stabs', s);
    t.expect('the Synth track stays chosen', s.lessonFilter === 'synth', s.lessonFilter);
  },
};
