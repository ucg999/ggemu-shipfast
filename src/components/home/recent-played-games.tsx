import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { Locale, PublicGame } from '#/lib/ggemu'
import { GAME_COLLECTIONS } from '#/lib/game-collections'
import { getI18n } from '#/lib/i18n'

const RECENT_PLAYED_GAMES_KEY = 'ggemu-recent-played-games'
const RECENT_PLAYED_GAMES_LIMIT = 102
const RECENT_PLAYED_STRIP_LIMIT = 4

export type RecentPlayedGame = {
  cover?: string
  id: string
  name: string
}

export function saveRecentPlayedGame(game: PublicGame, fallbackId: string) {
  const nextGame = getRecentPlayedGame(game, fallbackId)

  if (!nextGame) {
    return
  }

  const currentGames = readRecentPlayedGames()
  const nextGames = [
    nextGame,
    ...currentGames.filter((currentGame) => currentGame.id !== nextGame.id),
  ].slice(0, RECENT_PLAYED_GAMES_LIMIT)

  writeRecentPlayedGames(nextGames)
}

export function RecentPlayedGamesSection({
  lang,
}: {
  lang: Locale
}) {
  const games = useRecentPlayedGames()
  const t = getI18n(lang).home

  return (
    <section className="bg-base-100">
      <div className="grid w-full gap-5 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)] lg:px-8">
        <div>
          <h2 className="text-xl font-semibold text-base-content">
            {t.recentlyPlayed}
          </h2>
          {games.length > 0 ? (
            <div className="mt-3 grid max-w-[50%] grid-cols-4 gap-2">
              {games.slice(0, RECENT_PLAYED_STRIP_LIMIT).map((game) => (
                <RecentPlayedGameCard game={game} key={game.id} lang={lang} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-base-content/55">{t.recentEmpty}</p>
          )}
        </div>
        <PopularGameCollections lang={lang} />
      </div>
    </section>
  )
}

export function RecentPlayedHeaderPanel({
  games,
  lang,
}: {
  games: Array<RecentPlayedGame>
  lang: Locale
}) {
  const t = getI18n(lang).home
  const latestGame = games[0]
  const previousGames = games.slice(1, 5)

  if (!latestGame) {
    return (
      <div className="ml-auto hidden min-w-64 lg:block">
        <h2 className="text-sm font-semibold text-base-content">{t.continueGame}</h2>
        <p className="mt-2 text-sm text-base-content/50">{t.recentEmpty}</p>
      </div>
    )
  }

  return (
    <div className="ml-auto hidden shrink-0 items-start gap-5 lg:flex">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-base-content">{t.continueGame}</h2>
        <div className="h-24 w-24">
          <RecentPlayedGameCard directPlay game={latestGame} lang={lang} />
        </div>
      </div>
      <div className="min-w-0">
        <h2 className="mb-2 text-sm font-semibold text-base-content">{t.recentlyPlayed}</h2>
        {previousGames.length > 0 ? (
          <div className="grid h-24 w-24 grid-cols-2 gap-2">
            {previousGames.map((game) => (
              <div className="h-11 w-11" key={game.id}>
                <RecentPlayedGameCard compact game={game} lang={lang} />
              </div>
            ))}
          </div>
        ) : (
          <p className="w-48 text-sm text-base-content/50">{t.recentEmpty}</p>
        )}
      </div>
    </div>
  )
}

export function useRecentPlayedGames() {
  const [games, setGames] = useState<Array<RecentPlayedGame>>([])

  useEffect(() => {
    setGames(readRecentPlayedGames())
  }, [])

  return games
}

export function PopularGameCollections({ lang }: { lang: Locale }) {
  const t = getI18n(lang).home

  return (
    <div className="w-full max-w-3xl">
      <h2 className="text-xl font-semibold text-base-content">{t.popularCollections}</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {GAME_COLLECTIONS.map((collection) => (
          <Link
            className="group relative aspect-[16/9] overflow-hidden rounded-lg bg-base-200"
            key={collection.id}
            params={{ collectionId: collection.id, locale: lang }}
            to="/$locale/collections/$collectionId"
          >
              <img
                alt={getCollectionTitle(collection.id, t)}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                src={collection.cover}
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-3 pb-2 pt-8 text-sm font-bold text-white">
                {getCollectionTitle(collection.id, t)}
              </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function getCollectionTitle(
  collectionId: string,
  t: ReturnType<typeof getI18n>['home'],
) {
  if (collectionId === 'king-of-fighters') return t.kofCollection
  if (collectionId === 'street-fighter') return t.streetFighterCollection
  return t.retro8090Collection
}

export function RecentPlayedGameCard({
  compact = false,
  directPlay = false,
  game,
  lang,
}: {
  compact?: boolean
  directPlay?: boolean
  game: RecentPlayedGame
  lang: Locale
}) {
  return (
    <Link
      aria-label={game.name}
      className="group block h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      params={{ gameId: game.id, locale: lang }}
      search={directPlay ? { autoplay: '1' as const } : {}}
      to={directPlay ? '/$locale/games/$gameId/play' : '/$locale/games/$gameId'}
    >
      <figure className="relative isolate aspect-square overflow-hidden rounded-md bg-base-200">
        {game.cover ? (
          <img
            alt={game.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
            src={game.cover}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral via-black to-primary/30 text-sm font-bold uppercase tracking-[0.25em] text-white/45">
            Retro
          </div>
        )}

        {!compact ? (
          <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-base-300 bg-base-100/90 text-xs text-base-content opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-3 sm:top-3">
            ▶
          </span>
        ) : null}

      </figure>
    </Link>
  )
}

function getRecentPlayedGame(game: PublicGame, fallbackId: string) {
  const id = game.url_slug?.trim() || game._id?.trim() || fallbackId.trim()
  const name = game.name?.trim()

  if (!id || !name) {
    return null
  }

  return {
    cover: game.game_cover?.trim() || undefined,
    id,
    name,
  } satisfies RecentPlayedGame
}

function readRecentPlayedGames() {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const value = window.localStorage.getItem(RECENT_PLAYED_GAMES_KEY)
    const parsed = value ? JSON.parse(value) : []

    return Array.isArray(parsed)
      ? parsed.filter(isRecentPlayedGame).slice(0, RECENT_PLAYED_GAMES_LIMIT)
      : []
  } catch {
    return []
  }
}

function writeRecentPlayedGames(games: Array<RecentPlayedGame>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(RECENT_PLAYED_GAMES_KEY, JSON.stringify(games))
}

function isRecentPlayedGame(value: unknown): value is RecentPlayedGame {
  if (!value || typeof value !== 'object') {
    return false
  }

  const game = value as Partial<RecentPlayedGame>

  return typeof game.id === 'string' && typeof game.name === 'string'
}
