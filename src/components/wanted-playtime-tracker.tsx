import { WantedActivityClock } from '#/lib/wanted-activity'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

const GUEST_KEY_STORAGE = 'ucg999-wanted-guest-key'
const FEATURED_GAME_STORAGE = 'ucg999-wanted-featured-game'
let activeFeaturedGame: { path: string; multiplier: number } | null = null

export function WantedPlaytimeTracker() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const hash = useRouterState({ select: state => state.location.hash })
  const playing = isPlayableRoute(pathname)
  const proMode = isProRoute(pathname, hash)
  const featuredMultiplier = getFeaturedGameMultiplier(pathname)
  const featuredGame = featuredMultiplier !== null
  const elapsedRef = useRef(0)
  const previousTickRef = useRef(0)
  const sessionRef = useRef('')
  const submittedMinutesRef = useRef(0)
  const submissionIndexRef = useRef(0)
  const submittingRef = useRef(false)
  const finalizedRef = useRef(false)
  const pendingFinalRef = useRef(false)


  useEffect(() => {
    elapsedRef.current = 0
    previousTickRef.current = Date.now()
    sessionRef.current = crypto.randomUUID()
    submittedMinutesRef.current = 0
    submissionIndexRef.current = 0
    submittingRef.current = false
    finalizedRef.current = false
    pendingFinalRef.current = false
    const activity = new WantedActivityClock()
    const guestKey = getWantedGuestKey()
    const guestName = `游客${guestKey.slice(-5).toUpperCase()}`

    const tick = () => {
      const now = Date.now()
      if (document.visibilityState === 'visible') activity.tick(now - previousTickRef.current)
      elapsedRef.current = activity.elapsed
      previousTickRef.current = now
    }
    const submitSession = (final = false) => {
      if (final && finalizedRef.current) return
      if (submittingRef.current) {
        if (final) pendingFinalRef.current = true
        return
      }
      tick()
      const totalMinutes = Math.min(featuredGame ? 30 : 720, Math.floor(elapsedRef.current / 60_000))
      const previousSubmittedMinutes = submittedMinutesRef.current
      const minutes = totalMinutes - previousSubmittedMinutes
      if (minutes < (final ? 1 : 5)) return
      if (final) finalizedRef.current = true
      submittingRef.current = true
      submittedMinutesRef.current = totalMinutes
      submissionIndexRef.current += 1
      const sessionType = featuredGame ? 'featured' : proMode ? 'pro' : playing ? 'game' : 'online'
      const activeMinutes = Math.max(0, activity.activeMinutes(totalMinutes) - activity.activeMinutes(previousSubmittedMinutes))
      const payload = JSON.stringify({ action: 'session', sessionType, featuredMultiplier, guestKey, guestName, minutes, activeMinutes, submissionKey: `wanted:${sessionType}:${sessionRef.current}:${submissionIndexRef.current}` })
      if (final && navigator.sendBeacon('/api/wanted', new Blob([payload], { type: 'application/json' }))) {
        submittingRef.current = false
        return
      }
      void fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
        .then(response => {
          if (!response.ok) throw new Error(`wanted_session_failed:${response.status}`)
        })
        .catch(() => {
          // Restore the unsubmitted range so the next five-minute checkpoint or
          // page exit can retry it without losing the player's game time.
          submittedMinutesRef.current = Math.min(submittedMinutesRef.current, previousSubmittedMinutes)
          if (final) finalizedRef.current = false
        })
        .finally(() => {
          submittingRef.current = false
          if (pendingFinalRef.current) {
            pendingFinalRef.current = false
            submitSession(true)
          }
        })
    }
    const registerInteraction = (event: Event) => {
      if (document.visibilityState !== 'visible') return
      tick()
      activity.interact(event.isTrusted)
    }
    const registerFocusedGameFrame = () => {
      if (document.visibilityState === 'visible' && document.activeElement instanceof HTMLIFrameElement) {
        tick()
        activity.interact(true)
      }
    }
    // Wheel/touch/key events capture user scrolling without rewarding scripted scrolling.
    const events = ['click', 'wheel', 'keydown', 'touchstart', 'touchmove', 'pointerdown', 'pointermove']
    const documents = new Set<Document>()
    const attach = (doc: Document) => {
      if (!documents.has(doc)) {
        documents.add(doc)
        events.forEach(name => doc.addEventListener(name, registerInteraction, { capture: true, passive: true }))
      }
      doc.querySelectorAll('iframe').forEach(frame => {
        try { if (frame.contentDocument) attach(frame.contentDocument) } catch { /* Cross-origin frames require their own activity integration. */ }
      })
    }
    attach(document)
    const timer = window.setInterval(() => {
      tick()
      attach(document)
      registerFocusedGameFrame()
      submitSession(false)
    }, 1_000)
    window.addEventListener('blur', registerFocusedGameFrame)
    const submitFinalSession = () => submitSession(true)
    window.addEventListener('pagehide', submitFinalSession)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('blur', registerFocusedGameFrame)
      window.removeEventListener('pagehide', submitFinalSession)
      documents.forEach(doc => events.forEach(name => doc.removeEventListener(name, registerInteraction, true)))
      submitSession(true)
    }
  }, [pathname, featuredGame, featuredMultiplier, playing, proMode])

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

export function markWantedFeaturedGame(gameId: string, multiplier: number) {
  try {
    if (gameId.trim()) window.sessionStorage.setItem(FEATURED_GAME_STORAGE, JSON.stringify({ gameId: gameId.trim(), multiplier }))
  } catch {
    // The game still opens normally when browser storage is unavailable.
  }
}

function isPlayableRoute(pathname: string) {
  return /\/games\/[^/]+\/play(?:\/|$)/.test(pathname)
    || /\/(coin-challenge|lucky-grand-slam|ghost-hunter|red-blue-arena)(?:\/|$)/.test(pathname)
}

function isProRoute(pathname: string, hash: string) {
  return /\/PRO(?:\/|$)/i.test(pathname) || hash.replace(/^#/, '').toUpperCase() === 'PRO'
}

function getFeaturedGameMultiplier(pathname: string) {
  const match = pathname.match(/\/games\/([^/]+)\/play(?:\/|$)/)
  if (!match) {
    activeFeaturedGame = null
    return null
  }
  if (activeFeaturedGame?.path === pathname) return activeFeaturedGame.multiplier
  try {
    const stored = window.sessionStorage.getItem(FEATURED_GAME_STORAGE)
    if (!stored) return null
    const parsed = JSON.parse(stored) as { gameId?: unknown; multiplier?: unknown }
    if (decodeURIComponent(match[1]) !== parsed.gameId) return null
    const multiplier = [10, 20, 50, 100, 150, 200].includes(Number(parsed.multiplier)) ? Number(parsed.multiplier) : 10
    activeFeaturedGame = { path: pathname, multiplier }
    window.sessionStorage.removeItem(FEATURED_GAME_STORAGE)
    return multiplier
  } catch {
    return null
  }
}
