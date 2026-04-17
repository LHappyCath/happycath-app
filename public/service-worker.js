const CACHE_NAME = 'happycath-v1'
const DATA_CACHE = 'happycath-data-v1'

// Fichiers de l'app à mettre en cache au démarrage
const APP_SHELL = [
  '/happycath-app/',
  '/happycath-app/index.html',
  '/happycath-app/static/js/main.chunk.js',
  '/happycath-app/static/js/bundle.js',
  '/happycath-app/static/js/vendors~main.chunk.js',
  '/happycath-app/manifest.json',
]

// Installation : mise en cache de l'app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Ignore les erreurs si certains fichiers n'existent pas encore
      })
    })
  )
  self.skipWaiting()
})

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== DATA_CACHE).map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch : stratégie Network First pour Supabase, Cache First pour l'app
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Requêtes Supabase : Network First avec fallback cache
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(DATA_CACHE).then(cache => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Fichiers de l'app : Cache First avec fallback network
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        }).catch(() => caches.match('/happycath-app/index.html'))
      })
    )
  }
})

// Message de mise à jour
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting()
})
