// Labs: interactive panels a lesson opens under the neck while it's open
// ("lab": "fm" in the lesson). Each is loaded only when first needed.

const LABS = {
  fm: () => import('./fm-lab.js').then((m) => m.mountFmLab),
};

export const hasLab = (id) => id in LABS;

/** Mount lab `id` into `el`; returns a handle whose destroy() is safe to call early. */
export function mountLab(id, el, app, lesson) {
  let inner = null;
  let gone = false;
  LABS[id]?.().then((mount) => {
    if (!gone) inner = mount(el, app, lesson);
  }).catch((e) => console.warn(`Lab ${id} failed to load`, e));
  return {
    destroy() {
      gone = true;
      inner?.destroy?.();
    },
  };
}
