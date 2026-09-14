import { useEffect, useState } from 'react'
import type { Locale, PublicGame } from '#/lib/ggemu'

const FAVORITES_KEY = 'ggemu-theme-favorite-games'
const FAVORITES_EVENT = 'ggemu-theme-favorites-changed'

export function GameFavoriteButton({
  className = '',
  cover,
  gameId,
  locale,
  name,
  platform,
}: {
  className?: string
  cover?: string
  gameId: string
  locale: Locale
  name: string
  platform?: string
}) {
  const [favorite, setFavorite] = useState(false)

  useEffect(() => {
    setFavorite(readFavorites().some(game => (game.url_slug || game._id) === gameId))
  }, [gameId])

  function toggleFavorite() {
    const current = readFavorites()
    const exists = current.some(game => (game.url_slug || game._id) === gameId)
    const next = exists
      ? current.filter(game => (game.url_slug || game._id) !== gameId)
      : [{ _id: gameId, url_slug: gameId, name, game_cover: cover, platform }, ...current]
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event(FAVORITES_EVENT))
    setFavorite(!exists)
  }

  const label = getFavoriteCopy(locale, favorite)
  return <button aria-label={label} aria-pressed={favorite} className={`btn btn-outline gap-2 ${className}`} onClick={toggleFavorite} type="button"><span aria-hidden="true" className="text-xl">{favorite ? '♥' : '♡'}</span>{label}</button>
}

function readFavorites() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed as Array<PublicGame> : []
  } catch {
    return []
  }
}

function getFavoriteCopy(locale: Locale, favorite: boolean) {
  if (locale === 'zh-TW') return favorite ? '已收藏' : '收藏遊戲'
  if (locale === 'en') return favorite ? 'Saved' : 'Add to favorites'
  if (locale === 'ja') return favorite ? 'お気に入り済み' : 'お気に入りに追加'
  return favorite ? '已收藏' : '收藏游戏'
}
