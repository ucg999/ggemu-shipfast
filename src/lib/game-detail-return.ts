import type { Locale } from './ggemu'

const RETURN_MAX_AGE_MS = 24 * 60 * 60 * 1000

function storageKey(locale: Locale) {
  return `ucg999-game-detail-return:${locale}`
}

export function rememberGameDetailSource(locale: Locale, destinationHref: string) {
  if (typeof window === 'undefined') return

  try {
    const destination = new URL(destinationHref, window.location.origin)
    const detailPattern = new RegExp(`^/${escapeRegExp(locale)}/games/[^/]+/?$`)
    if (destination.origin !== window.location.origin || !detailPattern.test(destination.pathname)) return

    const source = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (detailPattern.test(window.location.pathname) || window.location.pathname.includes('/games/') && window.location.pathname.endsWith('/play')) return

    rememberGameDetailReturnPath(locale, source)
  } catch {
    // Fall back to the localized homepage when browser storage is unavailable.
  }
}

export function rememberGameDetailReturnPath(locale: Locale, source: string) {
  if (typeof window === 'undefined' || !source.startsWith(`/${locale}`)) return
  try {
    window.sessionStorage.setItem(storageKey(locale), JSON.stringify({ source, savedAt: Date.now() }))
  } catch {
    // Use the localized homepage fallback when storage is unavailable.
  }
}

export function getGameDetailReturnUrl(locale: Locale) {
  if (typeof window === 'undefined') return `/${locale}`

  try {
    const raw = window.sessionStorage.getItem(storageKey(locale))
    const saved = raw ? JSON.parse(raw) as { source?: string; savedAt?: number } : null
    const source = saved?.source
    const savedAt = Number(saved?.savedAt) || 0
    if (
      source?.startsWith(`/${locale}`) &&
      !source.includes('/games/') &&
      Date.now() - savedAt <= RETURN_MAX_AGE_MS
    ) return source
  } catch {
    // Use the stable fallback below.
  }

  return `/${locale}`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
