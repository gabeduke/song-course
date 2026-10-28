// Woodshed as an installed app: the service worker (sw.js) that keeps it
// working offline, a Reload offer when a new version has arrived, and the
// browser's install prompt, for the book's Install button.

const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const listeners = new Set();
let installEvent = null;

const emit = () => { for (const fn of listeners) fn(); };

export const pwa = {
  /** The browser has offered to install it (Chrome, Edge, Android). */
  get canInstall() { return !!installEvent; },
  /** Running as the installed app, not in a browser tab. */
  get installed() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  /** iPhone and iPad install from Safari's Share menu; there's no prompt to show. */
  get ios() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async install() {
    const e = installEvent;
    if (!e) return;
    installEvent = null;
    emit();
    e.prompt();
    await e.userChoice;
  },
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  emit();
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  emit();
});

/**
 * Register sw.js. onUpdate(apply) is called when a new version is waiting;
 * apply() switches to it and reloads the page.
 */
export function registerServiceWorker({ onUpdate }) {
  if (!('serviceWorker' in navigator)) return;
  // On a dev server the cache would hide your edits. The flows switch it on.
  let forced = false;
  try { forced = localStorage.getItem('woodshed.sw') === 'on'; } catch { /* storage unavailable */ }
  if (LOCAL.test(location.hostname) && !forced) return;

  let wanted = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only for the Reload we offered: the first install takes over the page
    // too, and that needs no reload.
    if (wanted) location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    const offer = (worker) => {
      if (!worker || !navigator.serviceWorker.controller) return;
      onUpdate(() => {
        wanted = true;
        worker.postMessage('skip-waiting');
      });
    };
    offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
    // An installed app can stay open for days: look for a new version when
    // it comes back to the front.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((e) => console.warn('Woodshed works online only here:', e.message));
}
