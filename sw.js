const CACHE_NAME = 'nav-rfi-cache-v2';
const urlsToCache = [
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.json',
  'https://unpkg.com/leaflet/dist/leaflet.css',
  'https://unpkg.com/leaflet.fullscreen@3.0.2/Control.FullScreen.css',
  'https://unpkg.com/leaflet/dist/leaflet.js',
  'https://unpkg.com/leaflet.fullscreen@3.0.2/Control.FullScreen.js'
];

// Installa il Service Worker e salva in cache i file strutturali
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  // Forza l'attivazione immediata del nuovo SW
  self.skipWaiting();
});

// Pulisce le vecchie cache quando si attiva una nuova versione
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Cancellazione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Prende il controllo di tutte le tab aperte
  self.clients.claim();
});

// Intercetta le richieste: Network First per i file core per garantire aggiornamenti, con fallback su cache
self.addEventListener('fetch', event => {
    // Non intercetta le chiamate al server RFI (ArcGIS) o altre risorse API
    if (!event.request.url.startsWith('http') || event.request.url.includes('arcgis')) {
        return;
    }
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
            // Se la richiesta va a buon fine, clona e aggiorna la cache asincronamente
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
            });
            return response;
        })
        .catch(() => {
            // Se non c'è rete, cerca nella cache
            return caches.match(event.request);
        })
    );
});