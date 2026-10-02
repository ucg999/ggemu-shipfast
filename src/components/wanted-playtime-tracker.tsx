import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

const GUEST_KEY_STORAGE = 'ucg999-wanted-guest-key'

export function WantedPlaytimeTracker() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const playing = isPlayableRoute(pathname)
  const elapsedRef = useRef(0)
  const previousTickRef = useRef(0)
  const sessionRef = useRef('')
  const sentRef = useRef(false)

  useEffect(() => {
    if (!playing) return
    elapsedRef.current = 0
    previousTickRef.current = Date.now()
    sessionRef.current = crypto.randomUUID()
    sentRef.current = false
    const guestKey = getWantedGuestKey()
    const guestName = `游客${guestKey.slice(-5).toUpperCase()}`

    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') elapsedRef.current += Math.min(5_000, now - previousTickRef.current)
      previousTickRef.current = now
    }
    const submitSession = () => {
      if (sentRef.current) return
      tick()
      const minutes = Math.floor(elapsedRef.current / 60_000)
      if (minutes < 1) return
      sentRef.current = true
      const payload = JSON.stringify({ action: 'session', guestKey, guestName, minutes, submissionKey: `wanted:${sessionRef.current}` })
      if (!navigator.sendBeacon('/api/wanted', new Blob([payload], { type: 'application/json' }))) {
        void fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
      }
    }
    const timer = window.setInterval(tick, 1_000)
    window.addEventListener('pagehide', submitSession)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('pagehide', submitSession)
      submitSession()
    }
  }, [playing, pathname])

  return null
}

export function getWantedGuestKey() {
  try {
    const stored = window.localStorage.getItem(GUEST_KEY_STORAGE)
    if (/^guest:[a-zA-Z0-9_-]{12,72}$/.test(stored ?? '')) return stored!
    const next = `guest:${crypto.randomUUID().replaceAll('-', '')}`
    window.localStorage.setItem(GUEST_KEY_STORAGE, next)
    return next
  } catch {
    return `guest:${crypto.randomUUID().replaceAll('-', '')}`
  }
}

function isPlayableRoute(pathname: string) {
  return /\/games\/[^/]+\/play(?:\/|$)/.test(pathname)
    || /\/(coin-challenge|lucky-grand-slam|ghost-hunter|red-blue-arena)(?:\/|$)/.test(pathname)
}
