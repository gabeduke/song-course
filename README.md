# Woodshed

Song-based practice for guitar, keys, drums and synth. Pick a song, loop a section with a synthesized backing band, mute the part you want to play, and follow along on a live fretboard or keyboard. Each song carries its own lesson tracks, and you can capture your own riffs, melodies and drum grooves back into the song.

Static site, no build step. Songs are flat JSON files in [`songs/`](songs/).

## What's in it

- **Practice book** (the front page, and Book in the top bar): the warm-ups and reference drills you'd otherwise flip through books for, each one playable in any key and anywhere on the neck over a small band. A demo guitar plays it; mute it and play it yourself. **Move on** takes the drill to the next box, string set or fret, or the next key round the cycle of fourths, every few loops, without stopping. Each drill remembers its key, settings and tempo.
  - Warm-ups: chromatic spider (finger permutations), hammer-on/pull-off trills, one-minute chord changes, a subdivision ladder.
  - Technique: six strumming patterns over a progression, string skipping through a pentatonic box, octaves with the middle string muted, double stops in 3rds and 6ths.
  - Triads: inversions on each string set, the seven triads through a key, voice-led triads over a progression, and soloing over changes with triads.
  - Pentatonic: the five boxes (minor, major, blues), straight or in threes, fours and thirds; connecting neighbouring boxes.
  - Scales: major, minor, the modes and harmonic minor in five positions, with the same patterns.
  - The neck: one note on every string (through the cycle of fourths), and CAGED, a chord's five shapes up the neck.
  - Ear training: the root, then a note of the key to name by ear; call and response, a phrase to play back in the bar after. The answers (notes lighting up, the tab) stay hidden until you ask for them.
- **Session**: an ordered list of drills (each with its own key and settings) and songs, minutes apiece. Start it and a bar under the top bar runs the clock and steps you through, Next by Next.
- **Lessons**: nine short reads in the book (soloing over changes with triads, triads and inversions, the pentatonic map, CAGED, the notes on the neck, timing, clean technique, ear training, how to practise), each linking the drills that practise it.
- **Practice**: a big interactive fretboard (or keyboard) that follows the music. Layers for chord tones, three-string triads by string set, scale positions 1–5, or exactly what the chosen part is playing. Colours mean the same thing everywhere: amber root, teal third, periwinkle fifth, rose seventh.
- **Backing band**: drums, bass, plucked guitar and electric piano, all synthesized in the browser. Every part has variations (strum patterns, triad voicings, bass lines, fills) you swap while it loops. Mute, solo, tempo, count-in, click, swing.
- **Lessons**: an ordered set per song, split into tracks (Guitar, Keys, Drums, Synth). "Set up this exercise" loads the loop, tempo, variations and fretboard layer for you.
- **Pedal tones**: every song has a guitar lesson where one finger holds a note while the others move around it, a drill David Chubirka calls the best practice there is. A `pedal` part follows the chords, works out a fingering for the finger you choose, and the neck shows that chord's notes with the pedal ringed, the hand's four frets banded, and the Fingers labels saying which finger plays what.
- **Sheet**: chord charts, standard notation and tab (grand staff for keys), strum patterns and chord boxes. Prints cleanly.
- **Capture**: record a pass from a MIDI keyboard, tap notes in on the fretboard, or program drums on a pad grid. Save it to the song as a new variation, then download the song file and commit it.
- **New songs**: type a title, key and chord chart and you get a playable band to write over.
- **Export MIDI**: the current loop or the whole song as a `.mid` for the MPC or a DAW.
- **Keyboard**: plug in a MIDI keyboard (the M-VAVE SMK-37 has a profile) and its knobs, faders, pads and SEQ PLAY drive the practice: tempo, section, the neck, part levels, mutes, finger drums. Its keys sound from the keyboard or through Woodshed. Woodshed can hand the keyboard's own engine a band part and a clock. The Keyboard sheet draws the panel with what each control does, and Learn records any controller. See [docs/hardware/smk-37-elite.md](docs/hardware/smk-37-elite.md).
- **FM lab**: in the Synth lessons, a four-operator FM synth you can see: the wiring, each operator's envelope, the waveform and the spectrum with the sidebands it predicts. Play it from the keys, turn it from the knobs, and send the patch to the SMK-37.

## Starter songs

| Song | What it drills |
| --- | --- |
| Fire on the Mountain | Barre changes, triads at three neck positions, sixteenth strumming, B mixolydian, melodies from inside the chord shape, a pedal tone held by the little finger and then the index |
| Just Like Heaven | Open-chord changes at speed, voice-led triads on two string sets, guide-tone melodies, pinched pedal tones with hybrid picking, FM bell design |
| House of the Rising Sun | 6/8 arpeggios, the F barre, seventh-chord colours, harmonic minor, A minor pentatonic, arpeggios over a root held by the little finger |
| 12-Bar Shuffle in A | Shuffle feel, the form, boogie riff, connecting pentatonic boxes, major vs minor pentatonic, the boogie as a pedal tone with a stretch |

Song files hold chord progressions and original practice parts, not transcriptions of the recordings.

## Running it

```sh
npm run serve        # or: python3 -m http.server 8000
# open http://localhost:8000
```

It needs to be served over HTTP (not opened as a file) so it can fetch the songs. Web MIDI works in Chrome, including Chrome on Android; plug a keyboard into the tablet with a USB-C OTG adapter.

GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder.

### As an installed app (PWA)

Woodshed installs like an app: **Install Woodshed** on the book's front page (or the install icon in Chrome's address bar), or on iPhone and iPad, Safari's Share → Add to Home Screen. Installed, it opens on the book in its own window and works with no connection: the service worker ([`sw.js`](sw.js)) saves every file the first time, songs and all. When a new version has been deployed it downloads in the background and offers a Reload, so it never swaps files under a band that's playing.

- **After changing anything the site serves, run `npm run pwa`** and commit `sw.js` with the change. It rewrites the precache list and its version (a hash of every file), which is how an installed copy knows to update. `npm test` fails until you do.
- The icons are rendered from `icons/icon.svg` and `icons/icon-maskable.svg` by `node scripts/build-icons.mjs` (it uses the flows' Playwright). Re-run it if you change either SVG.
- On localhost the service worker stays off, so a reload always shows your edits. To try it locally, run `localStorage.setItem('woodshed.sw', 'on')` in the console and reload; flow J9.1 does the same.

## Adding a drill

A drill is an entry in `DRILLS` in [`js/drills.js`](js/drills.js): its words (`title`, `goal`, `body`, `steps`), whether it's `keyed`, its `stops` (the places on the neck Move on walks through) and `options`, and `build(params)`, which answers the song file (a `demo` guitar part and a band; any variation type in [docs/song-format.md](docs/song-format.md) works), a `where` line for the readout, and `neck(chord, bar)`, the dots and shapes to draw. Set `ear: true` to keep the answers hidden until Show the notes. Add the drill's id to a lesson's `drills` in [`js/lessons.js`](js/lessons.js) so a lesson sends you to it. `npm test` builds every drill in every key and position and checks the notes stay on the neck and in the scale, and that every drill has a lesson.

## Adding a song

1. Write `songs/my-song.json` (see [docs/song-format.md](docs/song-format.md)), or build it in Capture → Start a new song and download the file.
2. Add `"my-song.json"` to `songs/index.json`.
3. `npm test` to check it compiles, then commit.

## User flows

[docs/flows.md](docs/flows.md) is how the site is meant to be used, as stories, each with a flow that drives it in a real browser on a tablet, desktop and phone profile and checks what the band played as well as what's on screen. `npm run flows` runs them (setup is in that doc); a change that passes `npm test` and breaks a flow isn't done.

Edits made in the app live in your browser until you download the song file. The song picker marks them "(edited)" or "(draft)".

## Code map

| File | Job |
| --- | --- |
| `js/theory.js` | Notes, scales, chords, scale positions, triad shapes, voicings |
| `js/song.js` | Validates a song and compiles every variation into timed events |
| `js/audio.js` | Synth rack: drums, bass, Karplus–Strong guitar, FM electric piano |
| `js/player.js` | Lookahead scheduler, looping, UI events on the audio clock |
| `js/fretboard.js`, `js/piano.js` | Interactive SVG instruments |
| `js/notation.js` | Notation and tab via VexFlow (vendored in `vendor/`) |
| `js/views/` | Practice, Sheet and Capture pages; `book.js` is the practice book, a lesson's page and a drill's page |
| `js/drills.js` | The drills: each turns a key, a spot on the neck and its options into a song file the band plays; Move on; the starter session |
| `js/lessons.js` | The book's lessons: the ideas behind the drills, and which drills practise each |
| `js/session.js` | The practice session: the list, the clock, Next |
| `js/pwa.js`, `sw.js`, `manifest.webmanifest` | Installing it as an app: the service worker that keeps it working offline, the Reload offer for a new version, the Install button |
| `js/midi-in.js`, `js/midi-file.js` | Web MIDI in and out, and `.mid` export |
| `js/controller.js`, `js/devices.js` | What a keyboard's controls do in Woodshed; device profiles and Learn |
| `js/views/keyboard.js` | The Keyboard sheet: the panel map, sound routing, Learn |
| `js/fm.js`, `js/fm-lab.js`, `js/labs.js` | Four-operator FM, the FM lab, and how a lesson opens a lab |
| `js/dx7.js` | A lab patch as a DX7 voice (SysEx) for the keyboard |

## Next ideas

- Hindsight integration: pull MIDI captured on the jam-space Pi in as a take.
- MIDI clock out to the Bento too (the keyboard gets it already).
- Hear the SMK's own engine through its USB audio input, mixed with the band.
- Pitch detection for recording guitar through an audio interface.
