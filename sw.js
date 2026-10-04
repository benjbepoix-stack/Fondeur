/*
 * Mode hors ligne : app-shell pré-mise en cache, puis réseau d'abord avec
 * repli sur le cache pour les requêtes same-origin. Les appels météo/trajet
 * (Open-Meteo, OSRM) et les données qui doivent rester fraîches passent par
 * le réseau normalement ; seul un éventuel repli cache les dépanne hors ligne.
 */
const CACHE = 'trace-fondeur-v6';

const PRECACHE_URLS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'apple-touch-icon.png',
  'css/tokens.css',
  'css/theme.css',
  'css/base.css',
  'css/components.css',
  'css/layout.css',
  'css/fondeur.css',
  'js/main.js',
  'js/core/dates.js',
  'js/core/favorites.js',
  'js/core/score.js',
  'js/core/utils.js',
  'js/core/wax.js',
  'js/services/routes.js',
  'js/services/carnet-sync.js',
  'js/services/geocode.js',
  'js/data/races.js',
  'js/services/storage.js',
  'js/services/weather.js',
  'js/ui/dialog.js',
  'js/ui/icons.js',
  'js/ui/theme.js',
  'js/ui/toast.js',
  'js/views/common.js',
  'js/views/list.js',
  'js/views/races.js',
  'js/views/map.js',
  'js/views/station.js',
  'data/stations.json',
  'data/bulletins.json'
];

async function precache() {
  const cache = await caches.open(CACHE);
  await Promise.all(PRECACHE_URLS.map(url => cache.add(url).catch(() => {})));
}

self.addEventListener('install', event => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // météo/trajet/tuiles : réseau normal

  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(cache => cache.put(request, res.clone()));
        return res;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('index.html')))
  );
});
