# Song file format

Each song is one JSON file in `songs/`, listed in `songs/index.json`. Drop a new file in, add its name to the index, and it shows up in the song picker. The tests (`npm test`) compile every song, so a typo fails loudly instead of silently.

## Top level

```json
{
  "format": 1,
  "id": "fire-on-the-mountain",
  "title": "Fire on the Mountain",
  "artist": "Grateful Dead",
  "key": "B",
  "scale": "mixolydian",
  "meter": "4/4",
  "tempo": 100,
  "originalTempo": 116,
  "swing": 0,
  "summary": "One or two sentences shown under the title.",
  "skills": ["Barre chord changes", "Triads on the top strings"],
  "notes": "Small print, e.g. what's original material.",
  "parts": [ ... ],
  "voicings": { "B": "x24442", "A": "577655" },
  "sections": [ ... ],
  "defaults": { ... },
  "arrangement": [ ... ],
  "lessons": [ ... ]
}
```

| Field | Meaning |
| --- | --- |
| `key` | Tonic, e.g. `B`, `F#`, `Bb`. |
| `scale` | `major`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `minor`, `harmonicMinor`, `majorPentatonic`, `minorPentatonic`, `blues`. Drives the Scale layer, key signature and `2`/`4`/`6` degrees. |
| `meter` | `4/4`, `3/4`, `6/8`, `12/8`… |
| `tempo` | Default practice tempo. In 6/8 it counts eighth notes; add `"tempoNote": "eighth notes"` so the display says so. |
| `originalTempo` | Optional; shows a "Record" shortcut on the tempo control. |
| `swing` | `0` straight, `0.33` triplet shuffle. Delays offbeat eighths. |
| `voicings` | Default guitar chord shapes, written low E to high e. Use `x` for muted strings. For frets above 9 separate with dots: `x.x.x.11.12.11`. |

## Parts

```json
"parts": [
  { "id": "drums", "instrument": "drums" },
  { "id": "bass", "instrument": "bass" },
  { "id": "rhythm", "name": "Rhythm guitar", "instrument": "guitar" },
  { "id": "lead", "name": "Lead guitar", "instrument": "guitar", "start": "off" },
  { "id": "keys", "instrument": "keys", "volume": 0.6 }
]
```

`instrument` is one of `drums`, `bass`, `guitar`, `keys`. `"start": "off"` means the part is silent until you pick a variation, handy for lead lines you want to try yourself first.

## Sections and chord charts

```json
{ "id": "vamp", "name": "Vamp", "chords": "B | A | B | A", "parts": { ... } }
```

Bars are split with `|`. Several chords in one bar share it evenly (`Am C` is two beats each in 4/4). `.` holds the previous chord for that slot, `%` repeats the previous bar. Chord qualities: `m`, `7`, `maj7`, `m7`, `6`, `m6`, `9`, `add9`, `sus2`, `sus4`, `7sus4`, `dim`, `dim7`, `m7b5`, `aug`, `5`, plus slash bass (`D/F#`).

`parts` maps a part id to a list of **variations**. The first one plays by default. You can also:

- write a section id instead of a list (`"bass": "vamp"`) to reuse another section's variations,
- put a section id inside a list (`["verse"]` or `[{...}, "verse"]`) to add another section's variations,
- leave a part out and it falls back to `defaults[partId]`, or is silent if there's none.

## Variation types

Every variation has an `id`, a `name` and a `type`. Patterns repeat to fill the section. `grid` sets the length of each pattern character or token: `16` (sixteenth), `8` (eighth), `8d`, `4` (quarter), `4d`, `2`, `1`. Spaces and `|` in patterns are just for readability.

### `drums` (default for drums parts, grid `16`)

```json
{ "id": "groove", "name": "Groove", "pattern": {
  "hat":   "x.x.x.x.x.x.x.x.",
  "kick":  "x.....x...x.....",
  "snare": "....X..o....X..o" } }
```

Lanes: `kick`, `snare`, `rim`, `hat`, `open`, `ride`, `crash`, `tom`, `clap`, `shaker`. `x` hit, `X` accent, `o` ghost, `.` rest. A lane can be longer than one bar (`"x... | x.x."`) for two-bar phrases and fills.

### `bassline` (default for bass, grid `8`) and `degrees`

```json
{ "id": "walk", "name": "Walk into the change", "steps": "R . 5 . 8 . 7 A | R . 5 . 8 . 3 A" }
```

Tokens follow the current chord: `R` root, `3` `5` `7` the chord's own third/fifth/seventh, `8` octave, `2` `4` `6` the key's scale tone, `b3` `b7` `#4` exact intervals, `A` a chromatic approach into the next chord's root, `B2` an exact note. `'` raises an octave, `,` lowers one. `.` rests, `-` holds the previous note, `x` is a dead note. Join with `+` to stack notes: `R+5`.

`degrees` is the same thing for guitar or keys; guitar riffs sit around the low strings (`R+5 R+6` is the boogie shuffle). Add `"range": [60, 71]` to place it elsewhere.

### `strum` (default for guitar, grid `8`)

```json
{ "id": "barre", "name": "Barre chords", "type": "strum", "pattern": "D.DU.UDU",
  "voicings": { "B": "xxx877", "A": "xxx655" } }
```

`D` down, `U` up, lowercase for lighter strokes, `x` a muted chuck, `.` a miss. `voicings` override the song's shapes for this variation.

### `arpeggio`

```json
{ "type": "arpeggio", "pattern": "B 3 2 1 2 3" }
```

String numbers, 1 = high e. `B` is the chord's lowest string. Join with `+` to pinch two strings.

### `comp` (default for keys)

```json
{ "type": "comp", "pattern": ".x.x.x.x", "leftHand": false, "range": [55, 66] }
```

`x` plays the chord, `-` holds it. The left hand adds the root unless `leftHand` is `false`.

### `hands` — two-handed keys

```json
{ "type": "hands", "left": "R . R .", "leftGrid": "4", "right": ".x.x.x.x", "rightGrid": "8" }
```

`left` uses bass-line tokens around C2–B2, `right` uses comp patterns. Add `melody` (a notes list, see below) and `length` for a right-hand tune.

### `notes` — riffs and melodies

```json
{ "type": "notes", "length": 32, "notes": [
  { "t": 0, "s": 2, "f": 7, "d": 2 },
  { "t": 2, "n": "B4", "d": 4, "h": "L" }
] }
```

`t` is the start in sixteenths from the start of the section, `d` the length in sixteenths. Guitar notes use `s` (string, 1 = high e) and `f` (fret) so tab is exact; keys use `n`. `h` marks the hand (`L`/`R`) for keys. `length` loops the phrase inside the section.

## Arrangement

```json
"arrangement": [{ "section": "vamp", "repeat": 2 }, "jam"]
```

Optional; defaults to each section once in order.

## Lessons

```json
{
  "id": "triads",
  "instrument": "guitar",
  "title": "Same two chords, three places on the neck",
  "goal": "One line under the title.",
  "body": ["Paragraphs of explanation."],
  "steps": ["Numbered things to do."],
  "setup": {
    "section": "vamp",
    "tempo": 90,
    "select": { "rhythm": "triads-7", "lead": "off" },
    "mute": ["rhythm"],
    "solo": "drums",
    "fretboard": { "layer": "triads", "triadSet": "123", "scale": "mixolydian", "position": 1, "labels": "intervals", "part": "lead" }
  }
}
```

`instrument` groups lessons into tracks (Guitar, Keys, Drums, Synth, or anything else). "Set up this exercise" applies `setup`: it loops the section, sets the tempo, picks variations everywhere they exist, mutes or solos parts, and points the fretboard (or keyboard, for keys and synth lessons) at the right layer. Fretboard layers: `chord`, `triads`, `scale`, `shape` (the selected part). Triad string sets: `all`, `123`, `234`, `345`, `456`.

## A note on copyright

Chord progressions are fair game. Melodies, riffs and lyrics of recorded songs aren't, so keep transcriptions of those in your own private copies and fill shared songs with original practice parts.
