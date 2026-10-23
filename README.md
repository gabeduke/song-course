# Woodshed

Song-based practice for guitar, keys, drums and synth. Pick a song, loop a section with a synthesized backing band, mute the part you want to play, and follow along on a live fretboard or keyboard. Each song carries its own lesson tracks, and you can capture your own riffs, melodies and drum grooves back into the song.

Static site, no build step. Songs are flat JSON files in [`songs/`](songs/).

## What's in it

- **Practice**: a big interactive fretboard (or keyboard) that follows the music. Layers for chord tones, three-string triads by string set, scale positions 1–5, or exactly what the chosen part is playing. Colours mean the same thing everywhere: amber root, teal third, periwinkle fifth, rose seventh.
- **Backing band**: drums, bass, plucked guitar and electric piano, all synthesized in the browser. Every part has variations (strum patterns, triad voicings, bass lines, fills) you swap while it loops. Mute, solo, tempo, count-in, click, swing.
- **Lessons**: an ordered set per song, split into tracks (Guitar, Keys, Drums, Synth). "Set up this exercise" loads the loop, tempo, variations and fretboard layer for you.
- **Sheet**: chord charts, standard notation and tab (grand staff for keys), strum patterns and chord boxes. Prints cleanly.
- **Capture**: record a pass from a MIDI keyboard, tap notes in on the fretboard, or program drums on a pad grid. Save it to the song as a new variation, then download the song file and commit it.
- **New songs**: type a title, key and chord chart and you get a playable band to write over.
- **Export MIDI**: the current loop or the whole song as a `.mid` for the MPC or a DAW.
- **Keyboard**: plug in a MIDI keyboard (the M-VAVE SMK-37 has a profile) and its knobs, faders, pads and SEQ PLAY drive the practice: tempo, section, the neck, part levels, mutes, finger drums. Its keys sound from the keyboard or through Woodshed. Woodshed can hand the keyboard's own engine a band part and a clock. The Keyboard sheet draws the panel with what each control does, and Learn records any controller. See [docs/hardware/smk-37-elite.md](docs/hardware/smk-37-elite.md).
- **FM lab**: in the Synth lessons, a four-operator FM synth you can see: the wiring, each operator's envelope, the waveform and the spectrum with the sidebands it predicts. Play it from the keys, turn it from the knobs, and send the patch to the SMK-37.

## Starter songs

| Song | What it drills |
| --- | --- |
| Fire on the Mountain | Barre changes, triads at three neck positions, sixteenth strumming, B mixolydian, melodies from inside the chord shape |
| Just Like Heaven | Open-chord changes at speed, voice-led triads on two string sets, guide-tone melodies, FM bell design |
| House of the Rising Sun | 6/8 arpeggios, the F barre, seventh-chord colours, harmonic minor, A minor pentatonic |
| 12-Bar Shuffle in A | Shuffle feel, the form, boogie riff, connecting pentatonic boxes, major vs minor pentatonic |

Song files hold chord progressions and original practice parts, not transcriptions of the recordings.

## Running it

```sh
npm run serve        # or: python3 -m http.server 8000
# open http://localhost:8000
```

It needs to be served over HTTP (not opened as a file) so it can fetch the songs. Web MIDI works in Chrome, including Chrome on Android; plug a keyboard into the tablet with a USB-C OTG adapter.

GitHub Pages: Settings → Pages → deploy from the `main` branch, root folder.

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
| `js/views/` | Practice, Sheet and Capture pages |
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
