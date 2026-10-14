import { createMiddleware, createStart } from '@tanstack/react-start'
import { setResponseHeaders } from '@tanstack/react-start/server'

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self' https: data: blob:",
    "base-uri 'self'",
    "connect-src 'self' https: wss:",
    "font-src 'self' https: data:",
    "form-action 'self' https:",
    "frame-ancestors 'self'",
    "frame-src 'self' https:",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: data: blob:",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "worker-src 'self' blob:",
  ].join('; '),
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
} as const

type EdgeCacheStorage = CacheStorage & { default?: Cache }

function isCacheableGamePage(request: Request) {
  if (request.method !== 'GET' || !request.headers.get('accept')?.includes('text/html')) return false
  const pathname = new URL(request.url).pathname
  return /^\/(?:zh-CN|en)\/games\/[^/]+(?:\/play)?\/?$/.test(pathname)
}

const responsePolicy = createMiddleware().server(async ({ next, request }) => {
  const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
  const cacheableGamePage = isCacheableGamePage(request)
  const edgeCache = (globalThis.caches as EdgeCacheStorage | undefined)?.default
  if (cacheableGamePage && edgeCache) {
    try {
      const cached = await edgeCache.match(request)
      if (cached) return cached
    } catch {
      // A cache outage must never prevent the game page from rendering.
    }
  }
  const cacheControl = request.method === 'GET' && acceptsHtml
    ? cacheableGamePage
      ? 'public, max-age=60, s-maxage=1800, stale-while-revalidate=86400'
      : 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
    : undefined

  setResponseHeaders(new Headers({
    ...securityHeaders,
    ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
  }))

  const response = await next()
  if (cacheableGamePage && edgeCache && response instanceof Response && response.ok && !response.headers.has('Set-Cookie')) {
    try {
      await edgeCache.put(request, response.clone())
    } catch {
      // Serve the freshly rendered page even when an edge cache write fails.
    }
  }
  return response
})

export const startInstance = createStart(() => ({
  requestMiddleware: [responsePolicy],
}))
