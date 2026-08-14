import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import {
  GameCardPreviewVideo,
  gameCardPreviewHandlers,
} from '#/components/game-card-preview'
import type { GameFilterOptions, GameSearchResult, Locale, PublicGame } from '#/lib/ggemu'
import { searchGames } from '#/lib/ggemu'

import { FilterSelects, getSearchPlaceholder } from './shared'
import type { Filters, HomeCopy } from './types'

export function HomeSearchOverlay({
  filterOptions,
  gameTotal,
  isOpen,
  initialQuery = '',
  lang,
  onClose,
  t,
}: {
  filterOptions: GameFilterOptions
  gameTotal: number
  isOpen: boolean
  initialQuery?: string
  lang: Locale
  onClose: () => void
  t: HomeCopy
}) {
  const runSearch = useServerFn(searchGames)
  const [filters, setFilters] = useState<Filters>({
    query: '',
    platform: '',
    category: '',
    sort: 'newest',
  })
  const [result, setResult] = useState<GameSearchResult | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchGamesList = result?.games ?? []
  const searchPlaceholder = getSearchPlaceholder(t, gameTotal)

  useEffect(() => {
    if (!isOpen || !initialQuery.trim()) return

    const nextFilters: Filters = {
      category: '',
      platform: '',
      query: initialQuery,
      sort: 'newest',
    }

    setFilters(nextFilters)
    searchOverlayGames(nextFilters)
  }, [initialQuery, isOpen])

  async function searchOverlayGames(nextFilters: Filters) {
    setIsSearching(true)

    try {
      const nextResult = await runSearch({
        data: {
          query: nextFilters.query,
          limit: 24,
          locale: lang,
          page: 1,
          platform: nextFilters.platform,
          category: nextFilters.category,
          sort: nextFilters.sort,
        },
      })

      setResult(nextResult)
    } finally {
      setIsSearching(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    searchOverlayGames(filters)
  }

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function resetSearch() {
    setFilters({
      query: '',
      platform: '',
      category: '',
      sort: 'newest',
    })
    setResult(null)
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-[110] bg-black/20 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        aria-modal="true"
        className={`fixed inset-x-3 bottom-3 top-3 z-[120] mx-auto flex w-auto max-w-6xl flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-2xl transition duration-200 sm:inset-x-6 sm:bottom-8 sm:top-8 ${isOpen ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'}`}
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <h2 className="text-base font-semibold">{t.search}</h2>
          <button className="btn btn-ghost btn-sm btn-square" onClick={onClose} type="button">
            <i className="ri-close-line text-xl" />
          </button>
        </header>

        <form className="grid gap-3 border-b border-base-300 p-4" onSubmit={handleSearch}>
          <input
            autoFocus={isOpen}
            className="input input-bordered w-full"
            onChange={(event) => updateFilter('query', event.currentTarget.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={filters.query}
          />

          <FilterSelects
            filterOptions={filterOptions}
            filters={filters}
            isLoading={isSearching}
            onFilterChange={updateFilter}
            onReset={resetSearch}
            t={t}
          />

          <button className="btn btn-primary w-full" disabled={isSearching} type="submit">
            <i className="ri-search-line" />
            {t.search}
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {result ? (
            searchGamesList.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {searchGamesList.map((game) => (
                  <SearchResultCard
                    game={game}
                    key={game._id ?? game.url_slug ?? game.name}
                    lang={lang}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-box border border-base-300 p-8 text-center text-sm text-base-content/60">
                {t.empty}
              </div>
            )
          ) : (
            <div className="rounded-box border border-dashed border-base-300 p-8 text-center text-sm text-base-content/60">
              {t.search}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

function SearchResultCard({
  game,
  lang,
}: {
  game: PublicGame
  lang: Locale
}) {
  const gameId = game.url_slug || game._id || ''

  return (
    <Link
      className="group overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm transition hover:border-primary/40 hover:shadow-md"
      {...gameCardPreviewHandlers}
      params={{ gameId, locale: lang }}
      search={{}}
      to="/$locale/games/$gameId"
    >
      <div className="relative aspect-square overflow-hidden bg-base-200">
        {game.game_cover ? (
          <img
            alt={game.name ?? 'Game cover'}
            className="h-full w-full object-cover"
            loading="lazy"
            src={game.game_cover}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-base-content/50">
            Retro
          </div>
        )}
        <GameCardPreviewVideo src={game.game_video} />
      </div>
      <div className="p-2 text-[12px] font-medium leading-tight">
        <span className="line-clamp-2">{game.name}</span>
      </div>
    </Link>
  )
}
