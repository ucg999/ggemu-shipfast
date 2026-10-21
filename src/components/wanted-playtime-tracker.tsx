import { WantedActivityClock } from '#/lib/wanted-activity'
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

const GUEST_KEY_STORAGE = 'ucg999-wanted-guest-key'
const FEATURED_GAME_STORAGE = 'ucg999-wanted-featured-game'
const PENDING_SUBMISSIONS_STORAGE = 'ucg999-wanted-pending-submissions'
const ACTIVE_GAME_TAB_STORAGE = 'ucg999-wanted-active-game-tab'
const ACTIVE_ONLINE_TAB_STORAGE = 'ucg999-wanted-active-online-tab'
const IDLE_TIMEOUT_MS = 3 * 60_000
let activeFeaturedGame: { path: string; multiplier: number } | null = null

function readPendingSubmissions() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_SUBMISSIONS_STORAGE) || '[]')
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(-24) : []
  } catch {
    return []
  }
}

function writePendingSubmissions(items: string[]) {
  try {
    if (items.length) window.localStorage.setItem(PENDING_SUBMISSIONS_STORAGE, JSON.stringify(items.slice(-24)))
    else window.localStorage.removeItem(PENDING_SUBMISSIONS_STORAGE)
  } catch {
    // A live request is still attempted when storage is unavailable.
  }
}

function queuePendingSubmission(payload: string) {
  const items = readPendingSubmissions()
  if (!items.includes(payload)) writePendingSubmissions([...items, payload])
}

function removePendingSubmission(payload: string) {
  writePendingSubmissions(readPendingSubmissions().filter(item => item !== payload))
}

async function flushPendingSubmissions() {
  const items = readPendingSubmissions()
  for (const payload of items) {
    try {
      const response = await fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
      if (response.ok) removePendingSubmission(payload)
    } catch {
      break
    }
  }
}

export function WantedPlaytimeTracker() {
  useSiteVisitorPresence()
  useWantedOnlineTime()
  const pathname = useRouterState({ select: state => state.location.pathname })
  const hash = useRouterState({ select: state => state.location.hash })
  const playing = isPlayableRoute(pathname)
  const proMode = isProRoute(pathname, hash)
  const featuredMultiplier = getFeaturedGameMultiplier(pathname)
  const featuredGame = featuredMultiplier !== null
  const eligibleGame = playing || proMode
  const elapsedRef = useRef(0)
  const previousTickRef = useRef(0)
  const sessionRef = useRef('')
  const submittedSecondsRef = useRef(0)
  const submissionIndexRef = useRef(0)
  const submittingRef = useRef(false)
  const finalizedRef = useRef(false)
  const pendingFinalRef = useRef(false)


  useEffect(() => {
    elapsedRef.current = 0
    previousTickRef.current = Date.now()
    sessionRef.current = crypto.randomUUID()
    submittedSecondsRef.current = 0
    submissionIndexRef.current = 0
    submittingRef.current = false
    finalizedRef.current = false
    pendingFinalRef.current = false
    const activity = new WantedActivityClock()
    const tabId = crypto.randomUUID()
    let lastInteractionAt = 0
    const guestKey = getWantedGuestKey()
    const guestName = `游客${guestKey.slice(-5).toUpperCase()}`
    void flushPendingSubmissions()

    const tick = () => {
      const now = Date.now()
      const activeTab = readActiveGameTab()
      const isActiveGame = eligibleGame
        && document.visibilityState === 'visible'
        && now - lastInteractionAt <= IDLE_TIMEOUT_MS
        && activeTab?.tabId === tabId
        && now - activeTab.at <= 5_000
      if (isActiveGame) {
        activity.tick(now - previousTickRef.current)
        writeActiveGameTab(tabId, now)
      }
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
      const totalSeconds = Math.min(12 * 60 * 60, Math.floor(elapsedRef.current / 1_000))
      const previousSubmittedSeconds = submittedSecondsRef.current
      const seconds = totalSeconds - previousSubmittedSeconds
      if (seconds < (final ? 1 : 60)) return
      if (final) finalizedRef.current = true
      submittingRef.current = true
      submittedSecondsRef.current = totalSeconds
      submissionIndexRef.current += 1
      const sessionType = featuredGame ? 'featured' : proMode ? 'pro' : 'game'
      const payload = JSON.stringify({ action: 'session', sessionType, guestKey, guestName, seconds, submissionKey: `wanted-v2:${sessionType}:${sessionRef.current}:${submissionIndexRef.current}` })
      queuePendingSubmission(payload)
      if (final && navigator.sendBeacon('/api/wanted', new Blob([payload], { type: 'application/json' }))) {
        submittingRef.current = false
        return
      }
      void fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
        .then(response => {
          if (!response.ok) throw new Error(`wanted_session_failed:${response.status}`)
          removePendingSubmission(payload)
        })
        .catch(() => { if (final) finalizedRef.current = false })
        .finally(() => {
          submittingRef.current = false
          if (pendingFinalRef.current) {
            pendingFinalRef.current = false
            submitSession(true)
          }
        })
    }
    const registerInteraction = (event: Event) => {
      if (!eligibleGame || document.visibilityState !== 'visible' || !event.isTrusted) return
      tick()
      lastInteractionAt = Date.now()
      writeActiveGameTab(tabId, lastInteractionAt)
      activity.interact(true)
    }
    const registerFocusedGameFrame = () => {
      if (eligibleGame && document.visibilityState === 'visible' && document.activeElement instanceof HTMLIFrameElement) {
        tick()
        lastInteractionAt = Date.now()
        writeActiveGameTab(tabId, lastInteractionAt)
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
    let retryTicks = 0
    const timer = window.setInterval(() => {
      tick()
      attach(document)
      submitSession(false)
      retryTicks += 1
      if (retryTicks >= 30) {
        retryTicks = 0
        void flushPendingSubmissions()
      }
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
  }, [pathname, featuredGame, featuredMultiplier, playing, proMode, eligibleGame])

  return null
}

function useWantedOnlineTime() {
  useEffect(() => {
    const tabId = crypto.randomUUID()
    const sessionId = crypto.randomUUID()
    const guestKey = getWantedGuestKey()
    const guestName = `游客${guestKey.slice(-5).toUpperCase()}`
    let elapsedMs = 0
    let submittedSeconds = 0
    let submissionIndex = 0
    let previousTick = Date.now()
    let submitting = false
    let finalized = false

    const claim = () => {
      if (document.visibilityState === 'visible') writeTabLock(ACTIVE_ONLINE_TAB_STORAGE, tabId, Date.now())
    }
    const tick = () => {
      const now = Date.now()
      const lock = readTabLock(ACTIVE_ONLINE_TAB_STORAGE)
      if (document.visibilityState === 'visible' && (!lock || lock.tabId === tabId || now - lock.at > 5_000)) {
        elapsedMs += Math.max(0, Math.min(5_000, now - previousTick))
        writeTabLock(ACTIVE_ONLINE_TAB_STORAGE, tabId, now)
      }
      previousTick = now
    }
    const submit = (final = false) => {
      if (final && finalized) return
      if (submitting) return
      tick()
      const totalSeconds = Math.floor(elapsedMs / 1_000)
      const seconds = totalSeconds - submittedSeconds
      if (seconds < (final ? 1 : 300)) return
      if (final) finalized = true
      submitting = true
      submittedSeconds = totalSeconds
      submissionIndex += 1
      const payload = JSON.stringify({ action: 'session', sessionType: 'online', guestKey, guestName, seconds, submissionKey: `wanted-online-v1:${sessionId}:${submissionIndex}` })
      queuePendingSubmission(payload)
      if (final && navigator.sendBeacon('/api/wanted', new Blob([payload], { type: 'application/json' }))) {
        submitting = false
        return
      }
      void fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true })
        .then(response => { if (response.ok) removePendingSubmission(payload) })
        .finally(() => { submitting = false })
    }

    claim()
    const timer = window.setInterval(() => { tick(); submit(false) }, 1_000)
    const onVisibility = () => { if (document.visibilityState === 'visible') claim() }
    const onPageHide = () => submit(true)
    window.addEventListener('focus', claim)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', claim)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      submit(true)
    }
  }, [])
}

function useSiteVisitorPresence() {
  useEffect(() => {
    let lastSentAt = 0
    const sendPresence = () => {
      if (document.visibilityState !== 'visible' || Date.now() - lastSentAt < 240_000) return
      lastSentAt = Date.now()
      void fetch('/api/owner-site-stats', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestKey: getWantedGuestKey() }),
        keepalive: true,
      }).catch(() => { lastSentAt = 0 })
    }
    sendPresence()
    const timer = window.setInterval(sendPresence, 240_000)
    document.addEventListener('visibilitychange', sendPresence)
    window.addEventListener('focus', sendPresence)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', sendPresence)
      window.removeEventListener('focus', sendPresence)
    }
  }, [])
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

function readActiveGameTab() {
  return readTabLock(ACTIVE_GAME_TAB_STORAGE)
}

function writeActiveGameTab(tabId: string, at: number) {
  writeTabLock(ACTIVE_GAME_TAB_STORAGE, tabId, at)
}

function readTabLock(storageKey: string) {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as { tabId?: unknown; at?: unknown } | null
    if (value && typeof value.tabId === 'string' && Number.isFinite(Number(value.at))) return { tabId: value.tabId, at: Number(value.at) }
  } catch {
    // Without shared storage, duplicate time across tabs cannot be safely prevented.
  }
  return null
}

function writeTabLock(storageKey: string, tabId: string, at: number) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify({ tabId, at }))
  } catch {
    // Storage-disabled browsers simply cannot claim a cross-tab timer lock.
  }
}
