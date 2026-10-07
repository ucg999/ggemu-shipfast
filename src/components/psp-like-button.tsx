import { useEffect, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { fetchWithTimeoutRetry } from '#/lib/fetch-with-timeout-retry'

let cachedLikes: Record<string, number> | null = null
let cachedLiked = new Set<string>()
let likesRequest: Promise<Record<string, number>> | null = null
const listeners = new Set<(likes: Record<string, number>) => void>()

function publish(likes: Record<string, number>) {
  cachedLikes = likes
  listeners.forEach(listener => listener(likes))
}

function loadLikes() {
  if (cachedLikes) return Promise.resolve(cachedLikes)
  if (!likesRequest) likesRequest = fetchWithTimeoutRetry('/api/psp-likes').then(async response => {
    if (!response.ok) throw new Error('psp_likes_unavailable')
    const data = await response.json() as { likes?: Record<string, number>; liked?: string[] }
    const likes = data.likes ?? {}
    cachedLiked = new Set(data.liked ?? [])
    publish(likes)
    return likes
  }).finally(() => { likesRequest = null })
  return likesRequest
}

export function useGameLikeCounts() {
  const [likes, setLikes] = useState<Record<string, number>>(() => cachedLikes ?? {})
  useEffect(() => {
    listeners.add(setLikes)
    void loadLikes().then(setLikes).catch(() => {})
    return () => { listeners.delete(setLikes) }
  }, [])
  return likes
}

export async function addPspGameLike(gameId: string) {
  const response = await fetchWithTimeoutRetry('/api/psp-likes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) })
  const data = await response.json() as { error?: string; likeCount?: number; liked?: boolean; incremented?: boolean }
  if (!response.ok || typeof data.likeCount !== 'number') throw new Error(data.error || 'like_failed')
  cachedLiked.add(gameId)
  publish({ ...(cachedLikes ?? {}), [gameId]: data.likeCount })
  return data
}

export function useAutomaticGameLike(gameId: string) {
  const recordedGameId = useRef('')
  useEffect(() => {
    if (recordedGameId.current === gameId) return
    recordedGameId.current = gameId
    void addPspGameLike(gameId).catch(() => {})
  }, [gameId])
}

export function PspLikeButton({ gameId, locale, className = '' }: { gameId: string; locale: Locale; className?: string }) {
  const [count, setCount] = useState(() => cachedLikes?.[gameId] ?? 0)
  const [liked, setLiked] = useState(() => cachedLiked.has(gameId))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const sync = (likes: Record<string, number>) => { setCount(likes[gameId] ?? 0); setLiked(cachedLiked.has(gameId)) }
    listeners.add(sync)
    void loadLikes().then(sync).catch(() => {})
    return () => { listeners.delete(sync) }
  }, [gameId])

  const label = locale === 'en' ? `Like this game, ${count} likes` : `给这款游戏点赞，当前 ${count} 个赞`

  async function like(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation()
    if (busy) return
    setBusy(true); setCount(value => value + 1)
    try {
      const data = await addPspGameLike(gameId)
      cachedLiked.add(gameId); setLiked(true)
      setCount(data.likeCount ?? 0)
    } catch (cause) {
      setNotice(cause instanceof Error && cause.message !== 'like_failed' ? cause.message : (locale === 'en' ? 'Like failed. Please try again.' : '点赞失败，请稍后重试'))
      window.setTimeout(() => setNotice(''), 2400)
      cachedLikes = null
      void loadLikes().then(likes => setCount(likes[gameId] ?? 0)).catch(() => setCount(value => Math.max(0, value - 1)))
    } finally { setBusy(false) }
  }

  return <span className={`psp-like-wrap ${className}`}>
    {notice ? <span className="psp-like-notice" role="status">{notice}</span> : null}
    <button aria-label={label} className={`psp-like-button ${liked ? 'is-liked' : ''}`} disabled={busy} onClick={like} title={label} type="button"><i aria-hidden="true" className={liked ? 'ri-heart-fill' : 'ri-heart-line'} /><span>{count.toLocaleString()}</span></button>
  </span>
}
