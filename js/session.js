// A practice session: an ordered list of drills (with their settings) and
// songs, a few minutes each, and a clock that walks through it. The list
// and a running session both live in this browser (localStorage).

import { DEFAULT_ROUTINE } from './drills.js';

const ROUTINE_KEY = 'woodshed.routine.v1';
const RUN_KEY = 'woodshed.session.v1';

const read = (k, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(k) ?? 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch { /* storage unavailable */ }
};

export function createSession() {
  const listeners = new Set();
  const s = {
    routine: read(ROUTINE_KEY, null) ?? structuredClone(DEFAULT_ROUTINE),
    // { index, banked: ms already spent on this item, since: ms timestamp or null when paused }
    run: read(RUN_KEY, null),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    get active() { return !!s.run; },
    get current() { return s.run ? s.routine[s.run.index] ?? null : null; },
    /** Milliseconds spent on the current item. */
    elapsed(now = Date.now()) {
      if (!s.run) return 0;
      return s.run.banked + (s.run.since ? now - s.run.since : 0);
    },
    remaining(now = Date.now()) {
      const item = s.current;
      return item ? item.minutes * 60_000 - s.elapsed(now) : 0;
    },
    get total() { return s.routine.reduce((n, it) => n + it.minutes, 0); },
    setRoutine(routine) {
      s.routine = routine;
      if (s.run && s.run.index >= routine.length) s.run = null;
      persist();
    },
    add(item) { s.setRoutine([...s.routine, item]); },
    reset() { s.setRoutine(structuredClone(DEFAULT_ROUTINE)); },
    start(index = 0) {
      if (!s.routine.length) return;
      s.run = { index, banked: 0, since: Date.now() };
      persist();
    },
    go(index) {
      if (index < 0) return;
      if (index >= s.routine.length) { s.end(); return; }
      s.run = { index, banked: 0, since: Date.now() };
      persist();
    },
    next() { if (s.run) s.go(s.run.index + 1); },
    prev() { if (s.run) s.go(Math.max(0, s.run.index - 1)); },
    pause() {
      if (!s.run?.since) return;
      s.run = { ...s.run, banked: s.elapsed(), since: null };
      persist();
    },
    resume() {
      if (!s.run || s.run.since) return;
      s.run = { ...s.run, since: Date.now() };
      persist();
    },
    end() { s.run = null; persist(); },
  };
  function persist() {
    write(ROUTINE_KEY, s.routine);
    write(RUN_KEY, s.run);
    for (const fn of listeners) fn(s);
  }
  return s;
}

/** 192000 -> "3:12"; negative times count up as overtime. */
export function mmss(ms) {
  const sec = Math.round(Math.abs(ms) / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
