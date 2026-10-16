const CACHEABLE_IMAGE_HOSTS = new Set([
  'storage.ggemu.com',
  'img.gamemonetize.com',
])

export function getCachedImageUrl(source: string | undefined, width = 640) {
  const value = source?.trim()
  if (!value) return ''
  try {
    const url = new URL(value)
    if (!CACHEABLE_IMAGE_HOSTS.has(url.hostname)) return value
    const safeWidth = Math.max(160, Math.min(1600, Math.round(width)))
    return `/api/image?src=${encodeURIComponent(url.toString())}&w=${safeWidth}`
  } catch {
    return value
  }
}

export function isCacheableImageHost(hostname: string) {
  return CACHEABLE_IMAGE_HOSTS.has(hostname)
}
