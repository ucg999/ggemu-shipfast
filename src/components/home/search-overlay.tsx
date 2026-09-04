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

import { getSearchPlaceholder } from './shared'
import { getPlatformLabel } from '#/lib/platform-label'
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
    } catch {
      setResult({ games: [], pagination: { total: 0, page: 1, limit: 24, pages: 1 } })
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
      <aside
        className="mx-auto flex w-full max-w-6xl flex-col bg-base-100"
      >
        <header className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <h1 className="text-xl font-semibold">{t.search}</h1>
          <button className="btn btn-ghost btn-sm btn-square" onClick={onClose} type="button">
            <i className="ri-close-line text-xl" />
          </button>
        </header>

        <form className="grid gap-3 border-b border-base-300 p-4" onSubmit={handleSearch}>
          <div className="flex items-center gap-1 rounded-full border border-base-300 bg-base-100 py-1 pl-4 pr-1">
          <input
            autoFocus={isOpen}
            className="h-9 min-w-0 flex-1 bg-transparent text-base-content outline-none"
            onChange={(event) => updateFilter('query', event.currentTarget.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={filters.query}
          />
          <button className="btn btn-sm shrink-0 rounded-full border-0 bg-red-600 text-white hover:bg-red-700" disabled={isSearching} type="submit">
            <i className="ri-search-line" />
            {t.search}
          </button>
          <button className="btn btn-ghost btn-sm shrink-0 rounded-full" onClick={resetSearch} disabled={isSearching} type="button">
            <i className="ri-refresh-line" />{t.reset}
          </button>
          </div>

          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
            <select aria-label={t.allPlatforms} className="select select-bordered w-auto shrink-0" value={filters.platform} onChange={(event) => updateFilter('platform', event.currentTarget.value)}>
              <option value="">{t.allPlatforms}</option>
              {filterOptions.platforms.map((platform) => <option key={platform.name} value={platform.name}>{getPlatformLabel(platform.name, lang)}</option>)}
            </select>
            <select aria-label={t.allCategories} className="select select-bordered w-auto shrink-0" value={filters.category} onChange={(event) => updateFilter('category', event.currentTarget.value)}>
              <option value="">{t.allCategories}</option>
              {filterOptions.categories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
            </select>
            {([
              ['newest', t.newest], ['popular', t.popular], ['oldest', t.oldest], ['name_asc', t.nameAsc],
            ] as const).map(([sort, label]) => (
              <button key={sort} type="button" aria-pressed={filters.sort === sort} disabled={isSearching}
                className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm ${filters.sort === sort ? 'font-medium text-red-600' : 'text-base-content/70'}`}
                onClick={() => {
                  const next = { ...filters, sort }
                  setFilters(next)
                  void searchOverlayGames(next)
                }}>{label}</button>
            ))}
          </div>
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
