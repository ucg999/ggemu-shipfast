import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import type { Locale, PublicGame } from '#/lib/ggemu'
import { getI18n } from '#/lib/i18n'

const RECENT_PLAYED_GAMES_KEY = 'ggemu-recent-played-games'
const RECENT_PLAYED_GAMES_LIMIT = 7

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

  if (games.length === 0) {
    return null
  }

  return (
    <section className="bg-base-100">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-base-content">
          {getI18n(lang).home.recentlyPlayed}
        </h2>
        <div className="mt-3 grid auto-cols-[calc((100%-2.5rem)/6)] grid-flow-col grid-rows-1 gap-2 overflow-x-auto pb-1 sm:auto-cols-[calc((100%-5rem)/6)] sm:gap-4 lg:auto-cols-[calc((100%-13rem)/14)]">
          {games.map((game) => (
            <RecentPlayedGameCard game={game} key={game.id} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  )
}

export function useRecentPlayedGames() {
  const [games, setGames] = useState<Array<RecentPlayedGame>>([])

  useEffect(() => {
    setGames(readRecentPlayedGames())
  }, [])

  return games
}

function RecentPlayedGameCard({
  game,
  lang,
}: {
  game: RecentPlayedGame
  lang: Locale
}) {
  return (
    <Link
      aria-label={game.name}
      className="group block h-full rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      params={{ gameId: game.id, locale: lang }}
      search={{}}
      to="/$locale/games/$gameId"
    >
      <figure className="relative isolate aspect-square overflow-hidden rounded-xl bg-base-200">
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

        <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-base-300 bg-base-100/90 text-xs text-base-content opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-3 sm:top-3">
          ▶
        </span>

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
