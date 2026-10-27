# User flows

How Gabe uses Woodshed, written as stories, and the checks that prove each
one still works. This is the shared goal every change is validated against:
a change that passes `npm test` and breaks a flow is not done.

```sh
npm run flows                          # all flows on their profiles
node scripts/flows.mjs J4 J1.6         # by id prefix
node scripts/flows.mjs --profile=phone # only the phone runs
node scripts/flows.mjs --profile=tablet --storyboard=/tmp/sb   # and a page of every screen
```

Setup once: `npm install --no-save playwright@1.49.0 axe-core@4.11.4 && npx playwright install chromium`.
It needs Node 22 and nothing else: it serves the repo itself on a free port,
as GitHub Pages would (`WOODSHED_URL=…` runs it against a site that's
already up). A run prints a table; paste it into your report.

## Who and where

- **Main device: an Android tablet in Chrome, by touch**, often with a MIDI
  keyboard on a USB-C OTG adapter (1024×768 profile). The laptop
  (1440×900) is where songs get written, downloaded and committed. A phone
  (390×844) is for reading the sheet and a quick loop.
- The **practice book** (Book in the top bar) is the daily routine: warm-ups,
  technique, triads, pentatonic boxes, scales, the neck and ear training,
  drills that build themselves in any key and at any spot on the neck; a
  session that strings them (and songs) together on a clock; and short
  lessons on the ideas behind them. A drill plays through the same
  transport and band as a song.
- One song is open at a time, in one of three views: **Practice** (the neck
  or keyboard, the arrangement, the parts and the lessons), **Sheet**
  (chart, notation and tab) and **Capture** (tap or record a part, program
  drums, start a song). The transport along the bottom is the same in all
  three and keeps playing between them.
- A song is a file in `songs/`. What Gabe captures or creates lives in this
  browser (localStorage) until he downloads the file and commits it.

## Status

`core`: built; a failure is a regression. `todo`: proposed or agreed but
not built; it reports TODO and never fails the run, and when it starts
passing, make it core. `rig`: needs the hardware or ears; checked by hand,
not here.

## The flows

| Id | Story — as Gabe I want to… | Flow | Status |
|---|---|---|---|
| J1.1 | pick a song and see what it drills: title, key, tempo, the first chord on the readout and its tones on the neck | `j1.1-open-song` | core |
| J1.2 | press Play and get a bar of count-in, then the band looping the section; the readout counts the bars, the neck follows the chords, Stop stops | `j1.2-play-loop` | core |
| J1.3 | tap a section to loop it; in Whole song the band walks the arrangement, a tap jumps, and the page follows the section playing | `j1.3-sections` | core |
| J1.4 | mute the part I'm going to play (the neck keeps showing it), or solo one to hear it alone, without the band stopping; turn a part down | `j1.4-mute-solo` | core |
| J1.5 | swap a part's variation while it loops, without a stop or a new count-in; Off drops the part; each section keeps its own choices | `j1.5-variations` | core |
| J1.6 | slow it down or speed it up: − and +, drag the slider, Record for the record's tempo, and have it take effect while it plays | `j1.6-tempo` | core |
| J1.7 | change what the neck shows: chord tones, triads on a string set, a scale position, the part's shape; notes or intervals, remembered | `j1.7-neck-layers` | core |
| J1.8 | tap a fret or a key to hear it and see its role; switch the neck to a keyboard for the keys parts, and see the two hands | `j1.8-keys-audition` | core |
| J1.9 | flip to the Sheet to read the part and back, with the band playing all the while | `j1.9-views-persist` | core |
| J1.10 | turn the count-in off to start on bar 1, or the click on to hear the beats, and have both remembered | `j1.10-count-click` | core |
| J2.1 | open a lesson and let it set up the exercise (loop, tempo, variations, neck), or set it up and start playing | `j2.1-lesson-setup` | core |
| J2.2 | follow the Keys, Drums and Synth tracks: the keyboard for keys, the drums soloed, the keys muted for the synth | `j2.2-lesson-tracks` | core |
| J2.3 | trust that every lesson in every starter song sets up what it says, from its own button | `j2.3-every-lesson` | core (desktop) |
| J2.4 | see the exercise I just set up: the neck it changed is on screen after Set up, not scrolled away above the lessons | `j2.4-setup-in-view` | todo (tablet) |
| J2.5 | open the Synth track's "How FM operators work" and get the FM lab under the neck: play a held note, raise operator 2's index and see sidebands appear on the harmonics, move its ratio to 3.5 and see them leave the grid (a bell), switch the wiring and see the diagram redraw; closing the lesson puts the lab away | `j2.5-fm-lab` | core (tablet, desktop, phone) |
| J2.6 | open "Hold a pedal tone" and see the drill on the neck: the pedal ringed under the little finger, finger numbers on the other notes, the hand's frets banded; hear the band play the pedal under them, and the ring move when the chord does | `j2.6-pedal-tones` | core (tablet, desktop) |
| J3.1 | read the chart, notation and tab of the variations I chose, or every variation, one section, with drums; it fits a phone | `j3.1-sheet` | core |
| J3.2 | print the sheet without the app's bars and controls on the paper | `j3.2-print` | core |
| J3.3 | have the sheet show what I chose in Practice, at the tempo I'm practising at, and keep up when I change it | `j3.3-sheet-follows` | core |
| J4.1 | tap a riff in on the fretboard, see it as notation and tab, fix it with Rest and Undo, and save it to the song as the chosen variation | `j4.1-tap-in` | core |
| J4.2 | program a drum groove on the pads, hear it in the loop as I change it, and save it | `j4.2-drums` | core |
| J4.3 | record one pass from a MIDI keyboard over the loop and get the notes back on the grid, where I played them | `j4.3-midi-record` | core |
| J4.4 | take it back: Discard changes asks, then puts the song back as the repo has it, there and then | `j4.4-discard` | core |
| J4.5 | download the song file with my take in it, ready to drop into `songs/` and commit | `j4.5-download-song` | core |
| J5.1 | start a song of my own from a title, key and chord chart and play over it straight away; it survives a reload; Delete draft removes it | `j5.1-new-song` | core |
| J5.2 | be told which chord I mistyped in a new song's chart, and have nothing made | `j5.2-bad-chart` | core |
| J6.1 | export the loop or the whole song as a MIDI file for the MPC, at my tempo | `j6.1-export-midi` | core |
| J6.2 | open a link to a song and view; the tabs change the address and Back goes back; a link to a song that isn't here opens a starter song | `j6.2-links` | core |
| J6.3 | press Space to play and stop, whatever I last clicked, except while typing in a box (a button I Tab to takes Space itself) | `j6.3-space` | core (desktop) |
| J7.1 | plug in the SMK-37 and see what its controls do here: the sheet names it and its firmware, draws its panel with what reaches Woodshed lit and labelled, and says how to set the keyboard up; the top bar shows it connected | `j7.1-keyboard-connect` | core (tablet, desktop, phone) |
| J7.2 | turn K5 for the tempo, K6 for the section, K7 for what the neck shows, a fader for a part's level (its slider follows), and be told what each did | `j7.2-knobs-faders` | core |
| J7.3 | start and stop the band from SEQ PLAY on the keyboard; a stray Start while it plays doesn't restart it | `j7.3-seq-play` | core |
| J7.4 | hear my keys: from the keyboard's own sound, or through Woodshed as an e-piano on the keyboard view; in the FM lab they play the lab's patch, once, and the knobs move its operators | `j7.4-keys-sound` | core |
| J7.5 | teach Woodshed my pads with Learn, then mute parts with the bottom row and loop sections with the top; it remembers them | `j7.5-learn-pads` | core |
| J7.6 | have the keyboard's own engine play a band part, in time, while Woodshed's voice for it goes quiet; send it the clock so its arpeggiator follows | `j7.6-part-to-keyboard` | core |
| J7.7 | finger-drum on the pads: in Capture on the drums they play the kit, and while the groove loops each hit lands in the grid where I struck it | `j7.7-pad-drums` | core |
| J8.1 | open the practice book from any song: my session, the lessons, every drill by category, the songs; open a drill on its own page with the neck, how to practise it and its tab; the tabs take me back to the song | `j8.1-book` | core (tablet, desktop, phone) |
| J8.2 | play a drill in any key and any box: the neck, the readout and the band follow, and while it plays they change without a stop or a new count-in; mute the demo guitar to play it myself | `j8.2-drill-key` | core |
| J8.3 | let a drill move on by itself every so many loops, to the next box up the neck or the next key round the cycle of fourths, on the one, the band never stopping; it remembers the key, settings, tempo and how it moves on | `j8.3-move-on` | core |
| J8.4 | add a drill to my session in the key I want, start the session, and let the clock walk me through it: each item opens with its own settings, Pause stops the clock, Next goes on (to a song too), Finish ends it | `j8.4-session` | core (tablet, desktop, phone) |
| J8.5 | read a lesson on its own page and open the drills that practise it; a drill links back to its lesson; soloing over changes shows the chord's triad lit and the key's other notes faint around it, moving with the chords | `j8.5-lessons` | core |
| J8.6 | train my ear: call and response plays a phrase and leaves me a bar to answer; the neck and the tab keep the answer back until I ask for it; Round gives new phrases | `j8.6-ear` | core |
| U1 | see the whole neck and Play on a song's first screen on the tablet, without scrolling | `u1-first-screen` | todo (tablet) |

J2.4 and U1 are proposals from the first review, not stories Gabe has
agreed: drop them or make them core.

### Not written yet

| Id | Story | Status |
|---|---|---|
| R1 | a real keyboard on the tablet over USB-C OTG: Connect finds it, a recorded pass lands on the grid, no stuck notes | rig |
| R4 | the real SMK-37 (+VA) on the tablet: knobs and faders on their MIDI CC banks drive Woodshed, the pads' notes learned, a band part plays on its engine in time with the tablet's band, and a patch sent from the FM lab sounds like the lab ([hardware notes](hardware/smk-37-elite.md)) | rig |
| R5 | the SMK-37 over Bluetooth MIDI on Android, and its sound through its USB audio | rig |
| R2 | the band sounds right: the mix, the swing, the plucked guitar's attack, the count-in's level | rig |
| R3 | the site on GitHub Pages, under its `/song-course/` path, loads its songs | rig |
| I1 | pull MIDI captured on the jam-space Pi (Hindsight) in as a take | idea (README) |
| I2 | send MIDI clock out so the Bento follows the tempo (the keyboard gets it now: Keyboard › Send clock; the Bento would need its own output) | idea (README) |
| I3 | record guitar through an audio interface with pitch detection | idea (README) |

## What a run says

Each run prints as a scenario, Given (setup) / When (what Gabe does) /
Then (what should follow), every line marked:

```
Scenario: J1.6 Change the tempo, while it plays too [tablet]
      Given Fire on the Mountain is open at 100 bpm
       When drag the tempo slider most of the way right
  ✗    Then the tempo follows the drag up past 190  -- {"tempo":122}
```

**What the band played is checked, not just the screen.** The harness
wraps the audio engine's voices (`t.listen()`, `t.heard()`): which parts'
buses were asked to play, the clicks, the notes a tap auditioned, and the
steps with their audio-clock times. A muted part that still plays, or a
tempo that changes on screen but not in the band, fails.

**Layout checks** run on every screen a flow leaves (before each When, and
at the end), with no LLM (`scripts/flows/layout.mjs`):

- **covered:** a control whose middle is under something else, so a tap
  lands there instead. Content scrolled under the transport or the top bar
  doesn't count, as long as a scroll brings it out.
- **unreachable:** a control under the transport or the top bar that no
  scroll brings out (the checker tries, a little at a time, so sticky
  panels like the lessons count right).
- **offscreen:** a control cut off by the side of the screen.
- **target-size:** axe-core's WCAG 2.2 rule, under 24 px with too little
  room around it (not counting a target that's only part way under the
  transport at that scroll).
- **Warnings only:** a label cut off; a control under 44 px on a touch
  profile; a toast over a control.

A layout fail fails the flow, except one in the baseline
(`scripts/flows/layout-known.json`), shown as "known". The baseline starts
empty: every finding so far was looked at and fixed or explained. A meant
overlap goes in `layout-allow.mjs`, with why. Neither file is for quieting
a finding nobody looked at.

**The storyboard** (`--storyboard=dir`) writes `dir/index.html`:
- a card per run: the story, each step with a picture of the screen it
  left, and its findings;
- the **coverage map**: controls the run's screens showed that no flow's
  input reached, by where they sit (a group of choices, like the Layer
  buttons, counts as one), and the stories with no flow.

**Claude's review** (`--review`, with `--storyboard`) is opt-in. It reads
each card (story, steps, screens, and the layout findings as facts) and
writes notes on whether the flow makes sense to a person, on the storyboard.
- **It never passes or fails anything.**
- **Cost:** a review is cached (`.cache/flows-review`) by the flow's
  source, the site's files, the steps and the findings, so a card is paid
  for again only when one of those changed. The run prints what it spent.
- **Setup:** it needs `ANTHROPIC_API_KEY`; `FLOWS_REVIEW_MODEL` picks the
  model.
- **In CI:** `ux-review.yml` runs it on the tablet profile for a PR labelled
  `ux-review`, or by hand (Actions → UX review → Run workflow).

## Writing a flow

One file per story in `scripts/flows/<id>-<slug>.flow.mjs`:

```js
export default {
  id: 'J1.4', title: 'Mute my part while it loops',
  // status: 'todo', profiles: ['phone'] (default tablet + desktop), midi: true
  async run(t) {
    await t.given('Fire on the Mountain is open', () => t.open('fire-on-the-mountain/practice'));
    await t.step('tap Mute on Rhythm guitar', () => t.tap(t.page.locator('.part[data-part="rhythm"] button', { hasText: 'Mute' })));
    await t.listen();
    await t.wait(2600);
    t.expect('the band plays on without it', !(await t.heard()).parts.rhythm, await t.heard());
  },
};
```

- **Act like the user, check like the band.** Gestures go through `t.tap`,
  `t.tapFret(string, fret, scope)` (scrolls the neck into view, and throws
  if the spot is under something, as a finger would hit that instead),
  `t.drag(slider, 0..1)` (real touch moves on the tablet) and real clicks,
  never `el.click()` inside the page. Outcomes are checked against the app
  (`t.state()`: the store, the player, the variation each part is on) and
  the engine (`t.heard()`) as well as the screen.
- **Say it as Gabe would.** `t.given` for setup, `t.step` for each thing
  he does, `t.expect` for what he'd see or hear. The names are the report
  and the storyboard's captions, so write them as sentences, not code.
- **Seed what you need; assume nothing.** Each run is a fresh browser:
  no drafts, no prefs. Seed a take through the UI (Capture, tap, Save).
- The rest of `t`: `t.open(hash)` loads `#/<song>/<view>` and waits for it;
  `t.until(fn)` polls the state; `t.poll(fn)` polls the page;
  `t.download(fn)` answers the file a click handed over; `t.answer(yes)`
  replies to the next `confirm()`; `t.toast()` reads the toast;
  `t.midi.send([0x90, 60, 100])` plays the fake keyboard a `midi: true`
  flow gets (`midi: { name: 'SMK-37+VA' }` makes it that keyboard), and
  `t.midi.sent()` is what the app sent it, with timestamps. `t.heard().live`
  is the notes Woodshed played for the keys.
- Wait on the band, not the clock, where it matters: listen for the
  player's `step` events in the page (J4.3 plays its keyboard on cue that
  way). `FLOWS_CPU=4 node scripts/flows.mjs` runs the pages four times
  slower, as a CI runner can.
- Any page error or `console.error` fails the flow (Google Fonts failing to
  load doesn't). A failure saves a screenshot (its path is in the report):
  look at it.
- A new story goes in the table above first, with Gabe's words if he gave
  them.
