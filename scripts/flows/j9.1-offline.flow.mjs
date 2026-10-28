// J9.1 Install Woodshed and practise with no connection: the page offers
// a manifest with real icons, the service worker downloads the whole app
// once, and with the network gone the book, a drill and a song still open
// and play. docs/flows.md#j91
export default {
  id: 'J9.1',
  title: 'Install it, then practise offline',
  async run(t) {
    const { page } = t;
    // The worker stays off on localhost so the cache never hides an edit;
    // this flow switches it on, as the real site has it.
    await page.addInitScript(() => localStorage.setItem('woodshed.sw', 'on'));
    await t.given('Woodshed is open', () => t.open());

    const m = await page.evaluate(async () => {
      const href = document.querySelector('link[rel=manifest]')?.href;
      const man = await (await fetch(href)).json();
      const icons = await Promise.all(man.icons.map(async (i) => (await fetch(new URL(i.src, href))).ok));
      return { name: man.name, display: man.display, start: new URL(man.start_url, href).href, icons };
    });
    t.expect('it has a manifest: Woodshed, standalone, opening on the book', m.name === 'Woodshed' && m.display === 'standalone' && m.start.endsWith('/#/book'), m);
    t.expect('every icon it names is there', m.icons.length >= 4 && m.icons.every(Boolean), m.icons);

    t.expect('the service worker takes over the page', await t.poll(() => !!navigator.serviceWorker?.controller, null, 15000));
    const cached = await page.evaluate(async () => {
      const key = (await caches.keys()).find((k) => /^woodshed-[0-9a-f]{12}$/.test(k));
      const urls = key ? (await (await caches.open(key)).keys()).map((r) => new URL(r.url).pathname) : [];
      return { key, n: urls.length, hasSong: urls.some((u) => u.endsWith('/songs/just-like-heaven.json')), hasFm: urls.some((u) => u.endsWith('/js/fm.js')) };
    });
    t.expect('it has saved the whole app: songs, and modules loaded only later', cached.n >= 40 && cached.hasSong && cached.hasFm, cached);

    await t.step('lose the connection and reload', async () => {
      await page.context().setOffline(true);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#view')?.children.length > 0, null, { timeout: 15000 });
    });
    let s = await t.state();
    t.expect('the practice book still opens', s.view === 'book' && await page.locator('.lessons-index li').count() === 9, s.view);

    await t.step('open CAGED and tap Play', async () => {
      await t.tap(page.locator('a.drill-card[data-drill="caged"]'));
      await t.until((x) => x.drillId === 'caged');
      await t.listen();
      await t.tap(page.locator('#transport button.play'));
    });
    t.expect('it plays, with the band', await t.poll(() => (window.__heard?.calls ?? []).some((c) => c.bus === 'demo'), null, 9000)
      && (await t.heard()).parts.drums > 0, (await t.heard()).parts);
    await t.step('tap Stop, and pick Just Like Heaven', async () => {
      await t.tap(page.locator('#transport button.play'));
      await page.locator('#top select.song-select').selectOption('just-like-heaven');
    });
    s = await t.until((x) => x.songId === 'just-like-heaven');
    t.expect('the song opens too', s.songId === 'just-like-heaven' && s.view === 'practice', s.songId);
    await page.context().setOffline(false);
  },
};
