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

const responsePolicy = createMiddleware().server(async ({ next, request }) => {
  const acceptsHtml = request.headers.get('accept')?.includes('text/html') ?? false
  const cacheControl = request.method === 'GET' && acceptsHtml
    ? 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
    : undefined

  setResponseHeaders(new Headers({
    ...securityHeaders,
    ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
  }))

  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [responsePolicy],
}))
