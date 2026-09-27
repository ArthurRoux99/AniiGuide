// Service worker d'AniiGuide (généré au build) : le site fonctionne hors ligne une fois ouvert.
// - Fichiers du site : mis en cache à l'installation (liste ci-dessous), servis depuis le cache.
// - Page d'accueil : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
// - Images du wiki officiel : cache au fil des visites.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const APP = `aniiguide-${VERSION}`;
const IMG = 'aniiguide-images';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(['./', ...FILES])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aniiguide-') && k !== APP && k !== IMG).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(APP).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }
  if (req.destination === 'image') {
    e.respondWith(
      caches.open(IMG).then((c) =>
        c.match(req).then(
          (hit) =>
            hit ||
            fetch(req).then((res) => {
              c.put(req, res.clone());
              return res;
            }),
        ),
      ),
    );
  }
});
