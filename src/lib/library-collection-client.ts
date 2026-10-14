const GUEST_COLLECTOR_KEY = 'ucg999-library-guest-collector'

export function getGuestCollectorId() {
  if (typeof window === 'undefined') return ''
  try {
    const current = window.localStorage.getItem(GUEST_COLLECTOR_KEY)?.trim() ?? ''
    if (/^[a-z0-9-]{16,80}$/i.test(current)) return current
    const created = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(GUEST_COLLECTOR_KEY, created)
    return created
  } catch {
    return ''
  }
}

export function collectionApiUrl(path: string) {
  const guestId = getGuestCollectorId()
  if (!guestId) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}guestId=${encodeURIComponent(guestId)}`
}
