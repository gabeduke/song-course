// Standard MIDI File (type 1) writer, so backing parts can be dropped into
// an MPC, a DAW, or anything else that reads .mid files.

const PPQ = 96;
const GM_DRUMS = { kick: 36, snare: 38, rim: 37, clap: 39, hat: 42, open: 46, ride: 51, crash: 49, tom: 45, shaker: 70 };

function vlq(n) {
  const bytes = [n & 0x7f];
  while ((n >>= 7)) bytes.unshift((n & 0x7f) | 0x80);
  return bytes;
}

function str(s) {
  return [...s].map((c) => c.charCodeAt(0) & 0x7f);
}

function u32(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

function track(events, name) {
  // events: [{tick, bytes}] (absolute ticks)
  const sorted = [...events].sort((a, b) => a.tick - b.tick || a.order - b.order);
  const data = [0, 0xff, 0x03, ...vlq(name.length), ...str(name)];
  let last = 0;
  for (const e of sorted) {
    data.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  data.push(0, 0xff, 0x2f, 0);
  return [...str('MTrk'), ...u32(data.length), ...data];
}

/**
 * Build a .mid for a list of section ids (already expanded), using the
 * player's current variation choices. Returns a Uint8Array.
 */
export function buildMidi(compiled, sectionIds, chooseVariation, tempo) {
  const stepTicks = (PPQ * 4) / 16; // a 16th note
  const [num, den] = compiled.time.meter.split('/').map(Number);
  const tempoTrack = [
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, ...u32(Math.round(60000000 / (tempo * (den === 8 ? 0.5 : 1))) ).slice(1)] },
    { tick: 0, order: 1, bytes: [0xff, 0x58, 0x04, num, Math.log2(den), 24, 8] },
  ];
  const tracks = [track(tempoTrack, compiled.title)];
  let channel = 0;
  for (const part of compiled.parts) {
    const ch = part.instrument === 'drums' ? 9 : channel++;
    if (ch === 9 && channel === 9) channel++;
    const evs = [];
    let offset = 0;
    for (const sid of sectionIds) {
      const sec = compiled.sections[sid];
      const v = chooseVariation(sid, part.id);
      if (v) {
        for (const ev of v.events) {
          const tick = (offset + ev.t) * stepTicks;
          const vel = Math.max(1, Math.min(127, Math.round(ev.vel * 110)));
          let notes = [];
          let len = ev.d * stepTicks;
          if (ev.kind === 'drum') { notes = [GM_DRUMS[ev.drum] ?? 38]; len = stepTicks / 2; }
          else if (ev.kind === 'strum') { notes = ev.notes.map((n) => n.midi); len = Math.max(len, stepTicks * 2); }
          else if (ev.kind === 'note') notes = [ev.midi];
          notes.forEach((n, i) => {
            const nt = tick + (ev.kind === 'strum' ? i * 2 : 0);
            evs.push({ tick: nt, order: 1, bytes: [0x90 | ch, n, vel] });
            evs.push({ tick: nt + Math.max(1, Math.round(len) - 1), order: 0, bytes: [0x80 | ch, n, 0] });
          });
        }
      }
      offset += sec.length;
    }
    if (part.instrument !== 'drums') {
      const program = { bass: 33, guitar: 25, keys: 4 }[part.instrument] ?? 0;
      evs.push({ tick: 0, order: -1, bytes: [0xc0 | ch, program] });
    }
    tracks.push(track(evs, part.name));
  }
  const header = [...str('MThd'), ...u32(6), 0, 1, 0, tracks.length, (PPQ >> 8) & 255, PPQ & 255];
  return new Uint8Array([...header, ...tracks.flat()]);
}
