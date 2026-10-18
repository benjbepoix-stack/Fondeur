/*
 * Démarrage rapide et mode hors ligne :
 * - code, styles et icônes : servis tout de suite depuis le cache, puis
 *   actualisés en arrière-plan (la nouvelle version sert au lancement suivant ;
 *   changer CACHE force une mise à jour complète) ;
 * - données (data/*.json) : réseau d'abord, mais jamais plus de 4 s avant de
 *   retomber sur la dernière copie (réseau faible en montagne) ;
 * - météo/trajet/tuiles (Open-Meteo, OSRM…) : réseau normal, hors service worker.
 */
const CACHE = 'glisse-fondeur-v13';
const DATA_TIMEOUT = 4000;

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
  'js/core/summary.js',
  'js/core/utils.js',
  'js/core/wax.js',
  'js/services/routes.js',
  'js/services/allure-sync.js',
  'js/services/geocode.js',
  'js/data/races.js',
  'js/services/storage.js',
  'js/services/weather.js',
  'js/ui/dialog.js',
  'js/ui/haptics.js',
  'js/ui/icons.js',
  'js/ui/motion.js',
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
  await Promise.all(PRECACHE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
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

/** Copie en cache, sous l'adresse sans paramètres (data/bulletins.json?t=… -> une seule entrée). */
function store(key, res) {
  if (res.ok) {
    const copy = res.clone();
    caches.open(CACHE).then(cache => cache.put(key, copy));
  }
  return res;
}

function staleWhileRevalidate(event, request) {
  const network = fetch(request).then(res => store(request, res));
  event.waitUntil(network.catch(() => {}));
  return caches.match(request).then(cached => cached || network.catch(() => caches.match('index.html')));
}

function networkFirst(request, key) {
  const network = fetch(request).then(res => store(key, res));
  const timeout = new Promise(resolve => setTimeout(resolve, DATA_TIMEOUT));
  const cached = () => caches.match(key);
  return Promise.race([network.catch(() => null), timeout.then(cached)])
    .then(res => res || cached())
    .then(res => res || network);
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // météo/trajet/tuiles : réseau normal

  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    event.respondWith(networkFirst(request, url.origin + url.pathname));
    return;
  }
  event.respondWith(staleWhileRevalidate(event, request));
});
