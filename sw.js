// Woodshed's service worker: the whole app, offline.
//
// Woodshed is static files and nothing else (no server, no accounts), so
// every file it needs is precached when the worker installs and served
// from that cache after, network or not. The list and VERSION below are
// written by `npm run pwa` (scripts/build-sw.mjs); `npm test` fails when
// they're out of date, so a deploy can't ship a stale cache.
//
// - A new version installs into its own cache, all at once, and waits. The
//   page offers a Reload (js/pwa.js) rather than swapping files under a
//   band that's playing, or under modules that are still being imported.
// - Google Fonts are cached as they're used, and refreshed in the
//   background.
// - Anything else (other origins, non-GET) goes to the network untouched.

// <precache> written by scripts/build-sw.mjs: don't edit by hand
const VERSION = '0a6e131e4817';
const FILES = [
  './css/app.css',
  './css/fm-lab.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/icon-maskable.svg',
  './icons/icon.svg',
  './index.html',
  './js/audio.js',
  './js/chord-diagram.js',
  './js/controller.js',
  './js/devices.js',
  './js/dom.js',
  './js/drills.js',
  './js/dx7.js',
  './js/fm-lab.js',
  './js/fm.js',
  './js/fretboard.js',
  './js/labs.js',
  './js/lessons.js',
  './js/main.js',
  './js/metronome.js',
  './js/midi-file.js',
  './js/midi-in.js',
  './js/notation.js',
  './js/parts-ui.js',
  './js/piano.js',
  './js/player.js',
  './js/pwa.js',
  './js/session.js',
  './js/song.js',
  './js/store.js',
  './js/theory.js',
  './js/views/book.js',
  './js/views/capture.js',
  './js/views/keyboard.js',
  './js/views/practice.js',
  './js/views/sheet.js',
  './manifest.webmanifest',
  './songs/fire-on-the-mountain.json',
  './songs/house-of-the-rising-sun.json',
  './songs/index.json',
  './songs/just-like-heaven.json',
  './songs/twelve-bar-blues-a.json',
  './vendor/vexflow-bravura.js',
];
// </precache>

const CACHE = `woodshed-${VERSION}`;
const FONTS = 'woodshed-fonts';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('woodshed-') && key !== CACHE && key !== FONTS) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// The page's Reload button: start using the waiting version now.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

const scope = new URL(self.registration.scope);

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    // Every page is index.html: the app routes on the #hash.
    const key = req.mode === 'navigate' ? new URL('index.html', scope).href : url.origin + url.pathname;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(key)) ?? fetch(req);
    })());
    return;
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        // The stylesheet is fetched without CORS, so it comes back opaque.
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      });
      if (hit) {
        fresh.catch(() => {});
        return hit;
      }
      return fresh;
    })());
  }
});
