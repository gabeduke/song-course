# M-VAVE SMK-37 Elite (on SMK-37+VA)

Gabe's 37-key controller, and what Woodshed does with it. Read off the unit
over USB on 2026-10-23, plus the manuals listed at the end. Anything not
checked on the unit itself is marked **unverified**.

## What it is

- **Hardware:** M-VAVE SMK-37 Elite. 37 velocity keys, pitch and mod wheels,
  1.54" screen, 8 endless knobs (K1–K8), 16 RGB velocity pads, 4 faders, 18
  buttons, a 3.5 mm audio out, 3.5 mm TRS MIDI out, a sustain jack, USB-C and
  a battery. It has its own synth engine and sounds from the audio jack.
- **Firmware:** Baud Girl's **SMK-37+VA** (third party, versions 101/102,
  October 2026), not M-VAVE's own. It adds Virtual Analog and 8-Bit engines
  next to the DX7-style FM, and a new sequencer. That is why the unit calls
  itself "SMK-37+VA". The +VA installer backed up the stock presets first:
  `~/Downloads/M-VAVE SMK-37 Elite presets and patterns 2026-10-22 12-49.bin`.
  It holds two flash regions, USRFLASH at 0xc2000 (164 KB) and USR at 0xf4000
  (40 KB), read from stock firmware version 16.
- **Stock firmware** (`~/Downloads/SMK-37 Elite_016.fwsc`, V016, 2026-08-12):
  Jieli's usual container. The first 48 bytes decrypt with Jieli's CRC16
  keystream (key 0xFFFF) and name the chip, a **Jieli AC791N**. The body uses
  a different key per block and isn't decrypted here. Going back to stock is
  presumably M-UPGRADE with that file (**unverified**).

### On USB

| | |
|---|---|
| Vendor / product | 0x4c4a (Jieli) / 0xc755, bcdDevice 1.00, full speed |
| Name | `SMK-37+VA` (stock: `SMK-37 Elite`, three MIDI ports `-Private`, `-Master`, `-MCP`) |
| Interfaces | USB Audio: 2 ch out, 2 ch in, 44.1 kHz. USB MIDI: one port each way |
| SysEx identity request | no reply |

macOS's MIDI setup also remembers it as `SMK-37 Elite` and as two Jieli
"USB Composite Device" entries (its update mode).

## The MIDI it speaks under +VA

**It sends** (manual §11.10, §2.1.3, §1.5, §11.7):

| From | Message | When |
|---|---|---|
| Keys, arpeggiator, sequencer | notes on the Out Channel (1) | always |
| PITCH, MOD, pedal | pitch bend, CC 1, CC 64 | always |
| K5–K8 | CC 74, 71, 73, 72 (absolute, each starts at 64) | knob bank **MIDI CC** |
| Faders 1–4 | CC 7, 10, 91, 93 | fader bank **MIDI CC** |
| Pads | notes ("sixteen low notes"; which notes isn't documented) | pads on the **Notes** bank |
| SEQ PLAY | Start, Stop, Continue, and clock | Clock Out = Always or Playing |
| Everything else | nothing (K1–K4 and the buttons only work the keyboard itself) | |

**It receives:**

- Notes on its MIDI Channel (default **All**), and it plays them on its own
  engine. That's how Woodshed plays a band part on it.
- Program Change selects a preset (0 is preset 001).
- CC 74 brightness or cutoff, 71 feedback or resonance, 73/75/70/72 ADSR,
  58 FM algorithm, 76–78 LFO. CC 85–88 set K5–K8; CC 102–119 press its
  buttons (≥ 64 is pressed).
- **Channel 2 is its FX channel:** CC 0–23 there set effects, and CC 1 and
  CC 64 are lost. Woodshed keeps everything on channel 1.
- DX7 single-voice and 32-voice SysEx over USB. A single voice replaces the
  selected preset until you press PATCH. Woodshed's FM lab sends one.
- MIDI clock and Start, Stop and Continue. With GLOBE › Sync On, its patterns
  and arpeggiator follow the clock.

Pad LEDs are the firmware's own, and incoming MIDI can't light them. Pad
aftertouch does nothing.

## What Woodshed does with it

Open **Keyboard** in the top bar. The sheet draws this panel, lights what
reaches Woodshed and labels it, flashes a control as you touch it, and has a
table of every control. A pill at the top of the screen says what a knob or
pad just did.

| Control | In Woodshed |
|---|---|
| Keys | light the neck or keyboard; Capture records them. They sound from the keyboard itself by default; set **Sound from: Woodshed** to hear them in the app (e-piano, FM, guitar or bass, with bend, mod and sustain) |
| K5 / K6 / K7 / K8 | tempo / section / what the neck shows / scale position |
| Faders 1–4 | the levels of the song's first four parts (the sliders follow) |
| Pads, top row | loop section 1–8 |
| Pads, bottom row | mute or unmute part 1–8 |
| Pads in Drums | the kit, by velocity. In Capture on the drums, with the groove looping, hits land in the grid |
| SEQ PLAY | start and stop the band |
| In the FM lab | the keys play the lab's patch; the knobs set operator levels, then ratios |

Knobs are given jobs by rank: the first knob that sends anything gets the
tempo. A keyboard with all eight knobs learned gets triad strings, your level,
the band level and labels on the next four.

Woodshed sends the keyboard:
- **Play a band part on it:** that part's notes on channel 1, scheduled
  ahead so they land with the band. Woodshed's own voice for the part goes
  quiet.
- **Send clock:** Start, 24 clocks a beat, and Stop.
- **Send to keyboard** (FM lab): the lab's patch as a DX7 voice. The
  mapping to the DX7's 6 operators and 32 algorithms is a close match, not
  exact.
- **Test its sound:** one note.

## Setting the keyboard up

1. **Faders:** press FADER BANK, turn K1 to MIDI CC, press >.
2. **Knobs (when you want them):** press KNOB BANK, choose Knobs: MIDI CC,
   press >. Choose Knobs: Preset again to shape the sound.
3. **Pads:** press KNOB BANK and FADER BANK together until the screen says
   Pads Notes. Then use **Keyboard › Learn controls** in Woodshed, which walks
   the 16 pads.
4. **Play and stop:** set GLOBE › MIDI › Clock Out to Playing, and hold SEQ
   PLAY to switch the Sequencer on.
5. **Follow the band:** set GLOBE › Sync to On, and switch on Send clock in
   Woodshed.
6. Press PATCH to keep these settings.

## Tablets, Bluetooth and where the sound goes

- **Android over USB (best):** a USB-C OTG adapter, then Connect. While the
  keyboard is plugged in, Android sends the tablet's sound to its USB audio,
  so the band and the keyboard come out of one headphone jack. Its USB audio
  enumerates under +VA, but playback through it is **unverified**.
- **Android over Bluetooth MIDI:** Chrome only lists a BLE MIDI device that
  another app has connected (Chromium's Android MIDI code never opens
  Bluetooth itself). Pair it in an app such as MIDI BLE Connect, leave that
  running, then Connect in Woodshed.
- **Bluetooth audio:** stock firmware shows up as a Bluetooth speaker ("SMK-37
  Elite") as well as MIDI ("SMK-37 Elite_BLE"). Under +VA this is
  **unverified**.
- **iPad:** no iPad browser has Web MIDI, so Woodshed can't hear the keyboard
  there.
- **Computer:** Chrome can send Woodshed's sound to the keyboard
  (Keyboard › Output).

## Unverified, to check on the unit

- Which notes the pads send in the Notes bank. Learn records them. If they
  overlap the keys' notes (both are on channel 1), a key in that range acts
  as a pad.
- Whether the USB audio output and input carry sound under +VA. The input
  would let the tablet hear the keyboard's engine; the probe here needs
  macOS microphone permission.
- Bluetooth audio under +VA.
- How a DX7 voice from the lab sounds on +VA next to the lab.

## Sources

- Baud Girl, SMK-37+VA: [overview](https://baudgirl.com/work/SMK-37+VA),
  [manual](https://baudgirl.com/work/SMK-37+VA/manual) (§1.5 pads, §2.1.3 the
  MIDI CC bank, §10.2.2 Local Control and MIDI Out, §11 MIDI, §11.9 CC
  tables, §11.10 what it sends).
- M-VAVE, [SMK-37 Elite manual](https://manualf.oss-cn-hongkong.aliyuncs.com/manual/MIDI-KEYBOARD/SMK-37Elite-manual.pdf)
  (panel, USB and Bluetooth audio) and the Midi Suite 1.15 app's panel image.
- [Elite V016 release notes](https://yms-file-store.oss-cn-hongkong.aliyuncs.com/software/firmware/SMK-37Elite/SMK-37%20Elite.txt).
- Chip: the firmware header; also [altstrument](https://github.com/philmillman/altstrument)
  and [skiff](https://github.com/illuminus5/skiff/blob/main/SMK37.md).
- Stock MIDI port names: [m-flasher](https://github.com/jvitkauskas/m-flasher).
