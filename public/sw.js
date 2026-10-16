const STATIC_CACHE = 'ucg999-static-v3'
const IMAGE_CACHE = 'ucg999-images-v3'
const STATIC_PATTERN = /\.(?:css|js|mjs|woff2?|ttf|wasm)$/i
const MEDIA_PATTERN = /\.(?:webp|avif|png|jpe?g|gif|svg)$/i

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(keys => Promise.all(keys
      .filter(key => key.startsWith('ucg999-') && key !== STATIC_CACHE && key !== IMAGE_CACHE)
      .map(key => caches.delete(key)))),
  ]))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname === '/api/image') {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
    return
  }
  if (url.pathname.startsWith('/assets/') && STATIC_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }
  if (MEDIA_PATTERN.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE))
  }
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const fresh = fetch(request).then(async response => {
    if (response.ok) await cache.put(request, response.clone())
    return response
  }).catch(() => cached)
  return cached || fresh
}
