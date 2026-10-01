import { useEffect, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { getMemberSession, useMemberSession } from '#/lib/member-client'

let cachedLikes: Record<string, number> | null = null
let cachedLiked = new Set<string>()
let likesRequest: Promise<Record<string, number>> | null = null
const listeners = new Set<(likes: Record<string, number>) => void>()
let memberSessionRequest: ReturnType<typeof getMemberSession> | null = null

function publish(likes: Record<string, number>) {
  cachedLikes = likes
  listeners.forEach(listener => listener(likes))
}

function loadLikes() {
  if (cachedLikes) return Promise.resolve(cachedLikes)
  if (!likesRequest) likesRequest = fetch('/api/psp-likes').then(async response => {
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
  const response = await fetch('/api/psp-likes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId }) })
  const data = await response.json() as { error?: string; likeCount?: number; liked?: boolean; incremented?: boolean }
  if (!response.ok || typeof data.likeCount !== 'number') throw new Error(data.error || 'like_failed')
  cachedLiked.add(gameId)
  publish({ ...(cachedLikes ?? {}), [gameId]: data.likeCount })
  return data
}

export function PspLikeButton({ gameId, locale, className = '' }: { gameId: string; locale: Locale; className?: string }) {
  const member = useMemberSession()
  const [count, setCount] = useState(() => cachedLikes?.[gameId] ?? 0)
  const [liked, setLiked] = useState(() => cachedLiked.has(gameId))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!memberSessionRequest) memberSessionRequest = getMemberSession().catch(() => ({ member: null, remainingToday: 999 }))
    const sync = (likes: Record<string, number>) => { setCount(likes[gameId] ?? 0); setLiked(cachedLiked.has(gameId)) }
    listeners.add(sync)
    void loadLikes().then(sync).catch(() => {})
    return () => { listeners.delete(sync) }
  }, [gameId])

  const loginRequired = locale === 'en' ? 'Sign in to like' : '登录玩家账号后即可点赞'
  const label = locale === 'en' ? `Like this game, ${count} likes` : `给这款游戏点赞，当前 ${count} 个赞`

  async function like(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault(); event.stopPropagation()
    if (!member) {
      setNotice(loginRequired)
      window.setTimeout(() => setNotice(''), 1800)
      return
    }
    if (busy) return
    setBusy(true); setCount(value => value + 1)
    try {
      const data = await addPspGameLike(gameId)
      cachedLiked.add(gameId); setLiked(true)
      setCount(data.likeCount ?? 0)
    } catch {
      cachedLikes = null
      void loadLikes().then(likes => setCount(likes[gameId] ?? 0)).catch(() => setCount(value => Math.max(0, value - 1)))
    } finally { setBusy(false) }
  }

  return <span className={`psp-like-wrap ${className}`}>
    {notice ? <span className="psp-like-notice" role="status">{notice}</span> : null}
    <button aria-label={label} className={`psp-like-button ${liked ? 'is-liked' : ''}`} disabled={busy} onClick={like} title={member ? label : loginRequired} type="button"><i aria-hidden="true" className={liked ? 'ri-heart-fill' : 'ri-heart-line'} /><span>{count.toLocaleString()}</span></button>
  </span>
}
