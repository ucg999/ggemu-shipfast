import { createFileRoute } from '@tanstack/react-router'

import { isCacheableImageHost } from '#/lib/image-url'

const ONE_DAY = 86_400
const ONE_WEEK = 604_800

export const Route = createFileRoute('/api/image')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const source = requestUrl.searchParams.get('src')?.trim() || ''
        const width = Math.max(160, Math.min(1600, Math.round(Number(requestUrl.searchParams.get('w')) || 640)))
        let sourceUrl: URL
        try {
          sourceUrl = new URL(source)
        } catch {
          return new Response('Invalid image URL', { status: 400 })
        }
        if (sourceUrl.protocol !== 'https:' || !isCacheableImageHost(sourceUrl.hostname)) {
          return new Response('Image host is not allowed', { status: 403 })
        }

        const cacheKey = new Request(`${requestUrl.origin}/api/image?src=${encodeURIComponent(sourceUrl.toString())}&w=${width}`, { method: 'GET' })
        const edgeCache = (globalThis.caches as (CacheStorage & { default?: Cache }) | undefined)?.default
        const cached = edgeCache ? await edgeCache.match(cacheKey) : undefined
        if (cached) return cached

        const optimizedInit = {
          headers: { Accept: 'image/avif,image/webp,image/*,*/*;q=0.8' },
          cf: { cacheEverything: true, cacheTtl: ONE_WEEK, image: { fit: 'scale-down', format: 'webp', quality: 76, width } },
        } as RequestInit & { cf: Record<string, unknown> }
        let upstream = await fetch(sourceUrl.toString(), optimizedInit)
        if (!upstream.ok) upstream = await fetch(sourceUrl.toString(), { headers: optimizedInit.headers })
        if (!upstream.ok || !upstream.headers.get('content-type')?.startsWith('image/')) {
          return new Response('Image unavailable', { status: 502 })
        }

        const body = await upstream.arrayBuffer()
        const response = new Response(body, {
          headers: {
            'Cache-Control': `public, max-age=${ONE_DAY}, s-maxage=${ONE_WEEK}, stale-while-revalidate=${ONE_WEEK}`,
            'Content-Length': String(body.byteLength),
            'Content-Type': upstream.headers.get('content-type') || 'image/webp',
            'X-Content-Type-Options': 'nosniff',
          },
        })
        if (edgeCache) await edgeCache.put(cacheKey, response.clone())
        return response
      },
    },
  },
})
