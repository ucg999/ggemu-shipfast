import { useEffect, useState } from 'react'

const localWishlistStorageKey = 'ucg999-local-wishlist-preview-v1'
let cachedCount: number | null = null
let pendingCount: Promise<number> | null = null

export function WishlistCountBadge({ className = '' }: { className?: string }) {
  const [count, setCount] = useState(cachedCount)

  useEffect(() => {
    void loadWishlistCount().then(setCount).catch(() => {})
  }, [])

  if (count === null) return null
  return <span className={`ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-violet-100 px-1 text-[10px] font-bold leading-4 text-violet-700 ${className}`}>{count}</span>
}

function loadWishlistCount() {
  if (cachedCount !== null) return Promise.resolve(cachedCount)
  if (pendingCount) return pendingCount
  pendingCount = (async () => {
    if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
      try {
        const wishes = JSON.parse(window.localStorage.getItem(localWishlistStorageKey) || '[]')
        cachedCount = Array.isArray(wishes) ? wishes.length : 0
      } catch {
        cachedCount = 0
      }
      return cachedCount
    }
    const response = await fetch('/api/game-wishes?view=count', { credentials: 'same-origin' })
    if (!response.ok) throw new Error('wishlist count unavailable')
    const data = await response.json() as { count?: number }
    cachedCount = Math.max(0, Number(data.count) || 0)
    return cachedCount
  })().finally(() => { pendingCount = null })
  return pendingCount
}
