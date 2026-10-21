// One small app-wide state object with change notification.

export function createStore(initial) {
  const listeners = new Set();
  const store = {
    state: initial,
    set(patch) {
      const next = typeof patch === 'function' ? patch(store.state) : patch;
      store.state = { ...store.state, ...next };
      for (const fn of listeners) fn(store.state, next);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
  return store;
}

const DRAFTS_KEY = 'woodshed.drafts.v1';
const PREFS_KEY = 'woodshed.prefs.v1';

export function loadDrafts() {
  try {
    return JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveDraft(song) {
  try {
    const all = loadDrafts();
    all[song.id] = song;
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

export function deleteDraft(id) {
  try {
    const all = loadDrafts();
    delete all[id];
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(all));
  } catch { /* storage unavailable */ }
}

export function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch { /* storage unavailable */ }
}
