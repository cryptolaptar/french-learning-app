/* Mot à Mot — service worker: lets the app open and work with no internet.
   Strategy: online → always fetch the newest files (and refresh the offline copy);
   offline → serve the saved copy. Progress is stored on the device, not here. */
const CACHE = 'motamot-offline-v1';
const PRECACHE = ['./', './mot-a-mot.html', './index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // add each file separately so a missing one (e.g. no index.html) doesn't break install
      Promise.all(PRECACHE.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(req, { ignoreSearch: true }).then(hit =>
        hit ||
        (req.mode === 'navigate'
          ? caches.match('./mot-a-mot.html').then(r => r || caches.match('./index.html')).then(r => r || caches.match('./'))
          : undefined) ||
        new Response('', { status: 504, statusText: 'Offline' })
      )
    )
  );
});
