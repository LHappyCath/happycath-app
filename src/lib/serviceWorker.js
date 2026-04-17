// Enregistrement du Service Worker
export function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/happycath-app/service-worker.js')
        .then(reg => {
          console.log('SW enregistré:', reg.scope)

          // Vérifier les mises à jour
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            newWorker?.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nouvelle version disponible — on met à jour silencieusement
                newWorker.postMessage('skipWaiting')
              }
            })
          })
        })
        .catch(err => console.log('SW échec:', err))
    })
  }
}

// Hook React pour l'état de connexion avec cache local
export function setupOfflineCache(supabase) {
  const STORAGE_KEY = 'happycath_cache'

  // Sauvegarder les données dans localStorage
  async function saveToCache(key, data) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      cache[key] = { data, timestamp: Date.now() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    } catch (e) {
      console.warn('Cache save error:', e)
    }
  }

  // Lire depuis le cache
  function readFromCache(key) {
    try {
      const cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      return cache[key]?.data || null
    } catch (e) {
      return null
    }
  }

  return { saveToCache, readFromCache }
}
