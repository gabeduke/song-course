// J2.3 Every lesson in every starter song sets up cleanly from its page:
// open it on its track, tap Set up, and the app holds what the song file
// says. The unit tests check the data compiles; this checks the buttons.
// docs/flows.md#j23
import { readFileSync } from 'node:fs';

const index = JSON.parse(readFileSync(new URL('../../songs/index.json', import.meta.url)));
const songs = index.songs.map((f) => JSON.parse(readFileSync(new URL(`../../songs/${f}`, import.meta.url))));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default {
  id: 'J2.3',
  title: 'Every lesson in every song sets up',
  profiles: ['desktop'],
  async run(t) {
    const { page } = t;
    for (const song of songs) {
      await t.step(`set up each of ${song.title}’s ${song.lessons.length} lessons`, async () => {
        await t.open(`${song.id}/practice`);
        const wrong = [];
        for (const l of song.lessons) {
          const inst = l.instrument ?? 'guitar';
          const tracks = page.locator('.lessons [role=radiogroup][aria-label="Lesson track"] [role=radio]', { hasText: cap(inst) });
          if (await tracks.count()) await t.tap(tracks);
          const title = page.locator('.lessons .lesson-title', { has: page.locator('.lesson-t', { hasText: l.title }) });
          if ((await title.getAttribute('aria-expanded')) !== 'true') await t.tap(title);
          await t.tap(page.locator('.lessons .lesson.open button', { hasText: 'Set up this exercise' }));
          const s = await t.state();
          const u = l.setup ?? {};
          const bad = [];
          if (u.section && s.sectionId !== u.section) bad.push(`section ${s.sectionId}`);
          if (u.tempo && s.tempo !== u.tempo) bad.push(`tempo ${s.tempo}`);
          for (const [p, v] of Object.entries(u.select ?? {})) if (s.variations[p] !== v) bad.push(`${p} ${s.variations[p]}≠${v}`);
          if ((u.solo ?? null) !== s.solo) bad.push(`solo ${s.solo}`);
          for (const p of u.mute ?? []) if (!s.mutes[p]) bad.push(`${p} not muted`);
          for (const [k, v] of Object.entries(u.fretboard ?? {})) if (s.fb[k] !== v) bad.push(`neck ${k} ${s.fb[k]}≠${v}`);
          if (bad.length) wrong.push(`${l.id}: ${bad.join(', ')}`);
        }
        t.expect(`${song.title}: every lesson set up what it says`, !wrong.length, wrong);
      });
    }
  },
};
