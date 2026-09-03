import { Link, createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import type { Locale, PublicGame } from '#/lib/ggemu'
import { searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const ARCADE_PAGE_SIZE = 100
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

export const Route = createFileRoute('/$locale/arcade')({
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const [seoOrigin, firstPage] = await Promise.all([
      getSeoOrigin(),
      loadArcadePage(locale, 1),
    ])
    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(0, firstPage.pagination.pages - 1) },
        (_, index) => loadArcadePage(locale, index + 2),
      ),
    )

    return {
      games: dedupeGames([
        ...firstPage.games,
        ...remainingPages.flatMap((result) => result.games),
      ]),
      seoOrigin,
    }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const t = getI18n(locale).arcade

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({ locale, origin: loaderData.seoOrigin, path: '/arcade' })
        : undefined,
      meta: [
        { title: t.seoTitle },
        { name: 'description', content: t.description },
      ],
    }
  },
  component: ArcadeModePage,
})

function ArcadeModePage() {
  const { games } = Route.useLoaderData()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const t = getI18n(lang).arcade

  return <PlatformModeContent body={t.subtitle} description={t.description} games={games} lang={lang} title={t.title} />
}

export function PlatformModeContent({
  body,
  description,
  games,
  lang,
  layout = 'list',
  showCoinChallenge = false,
  title,
}: {
  body: string
  description: string
  games: Array<PublicGame>
  lang: Locale
  layout?: 'cards' | 'list'
  showCoinChallenge?: boolean
  title: string
}) {
  const t = getI18n(lang).arcade
  const home = getI18n(lang).home
  const [letter, setLetter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const totalGamesLabel = t.allGames
  const coinChallengeTitle = getCoinChallengeTitle(lang)
  const normalizedQuery = query.trim().toLocaleLowerCase(lang)
  const showCoinChallengeCard =
    showCoinChallenge &&
    letter === 'ALL' &&
    (!normalizedQuery ||
      coinChallengeTitle.toLocaleLowerCase(lang).includes(normalizedQuery))
  const visibleGames = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase(lang)

      if (normalizedQuery) {
        const terms = normalizedQuery.split(/\s+/).filter(Boolean)

        return games.filter((game) => {
          const searchableText = [
            game.name,
            game.keywords,
            game.description,
            game.developer,
            game.platform,
            game.platform ? getPlatformLabel(game.platform, lang) : undefined,
            ...(game.categories ?? []),
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase(lang)

          return terms.every((term) => searchableText.includes(term))
        })
      }

      const letterGames = letter === 'HOT'
        ? [...games].sort((left, right) => (right.plays_count ?? 0) - (left.plays_count ?? 0))
        : letter === 'ALL'
          ? games
          : games.filter((game) => game.name?.trim().toUpperCase().startsWith(letter))

      return letterGames
    },
    [games, lang, letter, query],
  )

  return (
    <SiteLayout locale={lang}>
      <section className="bg-base-100 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
          <span className="text-base font-medium text-base-content/65 sm:text-lg">
            {formatGameTotal(games.length + (showCoinChallenge ? 1 : 0), lang)}
          </span>
        </div>
        <p className="mt-3 text-lg font-medium leading-relaxed text-base-content/75">{description}</p>
        <div className="mt-5 max-w-5xl whitespace-pre-line text-base leading-relaxed text-base-content/65">{body}</div>
      </section>

      <nav
        aria-label={title}
        className="sticky top-[61px] z-30 border-y border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <div className="flex gap-1 overflow-x-auto py-3">
          <LetterButton active={letter === 'ALL'} label={totalGamesLabel} onClick={() => setLetter('ALL')} />
          <LetterButton active={letter === 'HOT'} label={t.mostPopular} onClick={() => setLetter('HOT')} />
          {LETTERS.map((item) => (
            <LetterButton active={letter === item} key={item} label={item} onClick={() => setLetter(item)} />
          ))}
          <button
            aria-label={home.search}
            className={`btn btn-sm btn-square shrink-0 rounded-full border-0 ${isSearchOpen ? 'bg-base-content text-base-100' : 'btn-ghost'}`}
            onClick={() => setIsSearchOpen((current) => !current)}
            title={home.search}
            type="button"
          >
            <i className="ri-search-line text-lg" />
          </button>
          {isSearchOpen ? (
            <label className="flex h-8 w-56 shrink-0 items-center gap-2 rounded-full border border-base-300 bg-base-100 px-3">
              <i className="ri-search-line text-base-content/45" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40"
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={t.searchPlaceholder}
                type="search"
                value={query}
              />
            </label>
          ) : null}
        </div>
      </nav>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        {visibleGames.length > 0 || showCoinChallengeCard ? (
          <div className={layout === 'cards' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'flex flex-col gap-2'}>
            {showCoinChallengeCard ? <CoinChallengeGameCard lang={lang} /> : null}
            {visibleGames.map((game) => layout === 'cards' ? (
              <CoinModeGameCard game={game} key={game.url_slug || game._id} lang={lang} />
            ) : (
              <ArcadeGameRow game={game} key={game.url_slug || game._id} lang={lang} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-base-300 p-12 text-center text-base-content/60">
            {t.empty}
          </div>
        )}
      </section>
    </SiteLayout>
  )
}

function CoinChallengeGameCard({ lang }: { lang: Locale }) {
  const title = getCoinChallengeTitle(lang)
  const modeLabel = getCoinChallengeModeLabel(lang)

  return (
    <Link
      className="group min-w-0"
      params={{ locale: lang }}
      to="/$locale/coin-challenge"
    >
      <article className="relative aspect-square overflow-hidden rounded-lg border border-base-300 bg-base-100 transition hover:-translate-y-0.5 hover:border-amber-400">
        <figure className="relative aspect-square overflow-hidden bg-black">
          <img
            alt={title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            src="/coin-fruit-machine-cover.jpg"
          />
        </figure>
        <div className="absolute inset-x-0 bottom-0 bg-black/75 p-2.5 text-white">
          <h2 className="truncate text-sm font-bold sm:text-base">{title}</h2>
          <p className="mt-1 truncate text-xs text-white/75">{modeLabel}</p>
        </div>
      </article>
    </Link>
  )
}

function getCoinChallengeTitle(locale: Locale) {
  if (locale === 'zh-TW') return '金幣娛樂遊戲'
  if (locale === 'en') return 'Coin Entertainment Game'
  if (locale === 'ja') return 'コインエンターテインメントゲーム'
  return '金币娱乐游戏'
}

function getCoinChallengeModeLabel(locale: Locale) {
  if (locale === 'zh-TW') return '金幣模式'
  if (locale === 'en') return 'Coin Mode'
  if (locale === 'ja') return 'コインモード'
  return '金币模式'
}

function CoinModeGameCard({ game, lang }: { game: PublicGame; lang: Locale }) {
  const gameId = game.url_slug?.trim() || game._id?.trim() || ''
  const t = getI18n(lang).arcade

  return (
    <Link className="group min-w-0" params={{ gameId, locale: lang }} search={{}} to="/$locale/games/$gameId">
      <article className="overflow-hidden rounded-lg border border-base-300 bg-base-100 transition hover:-translate-y-0.5 hover:border-amber-400">
        <figure className="relative aspect-[4/3] overflow-hidden bg-base-200">
          {game.game_cover ? (
            <img alt={game.name ?? t.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" src={game.game_cover} />
          ) : null}
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-xs font-black text-yellow-300">
            <img alt="" aria-hidden="true" className="h-4 w-4 [image-rendering:pixelated]" src="/images/coin-rewards/pixel-reward-coin.webp" />
            ×20
          </span>
        </figure>
        <div className="p-2.5">
          <h2 className="truncate text-sm font-bold sm:text-base">{game.name}</h2>
          <p className="mt-1 truncate text-xs text-base-content/55">{game.platform ? getPlatformLabel(game.platform, lang) : t.gameInfo}</p>
        </div>
      </article>
    </Link>
  )
}

function LetterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={`btn btn-sm shrink-0 rounded-full border-0 ${active ? 'bg-base-content text-base-100' : 'btn-ghost'}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

function ArcadeGameRow({ game, lang }: { game: PublicGame; lang: Locale }) {
  const gameId = game.url_slug?.trim() || game._id?.trim() || ''
  const t = getI18n(lang).arcade
  const detail = getI18n(lang).detail
  const information = [
    game.platform ? getPlatformLabel(game.platform, lang) : '',
    game.released_year,
    game.developer,
  ].filter(Boolean)

  return (
    <article className="flex items-center gap-4 rounded-xl border border-base-300 bg-base-100 p-3 transition hover:border-base-content/25 sm:gap-5">
      <Link
        className="h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-base-200 sm:h-24 sm:w-32"
        params={{ gameId, locale: lang }}
        search={{}}
        to="/$locale/games/$gameId"
      >
        {game.game_cover ? (
          <img alt={game.name ?? t.title} className="h-full w-full object-cover" loading="lazy" src={game.game_cover} />
        ) : null}
      </Link>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-bold sm:text-xl">{game.name}</h2>
        <p className="mt-1 truncate text-xs text-base-content/55 sm:text-sm">
          {information.length > 0 ? information.join(' · ') : t.gameInfo}
        </p>
        {game.description ? (
          <p className="mt-1 line-clamp-1 text-xs text-base-content/65 sm:text-sm">{game.description}</p>
        ) : null}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-base-content/55">
          <span><i className="ri-play-circle-line mr-1" />{detail.plays} {formatCount(game.plays_count ?? 0, lang)}</span>
          <span><i className="ri-eye-line mr-1" />{detail.views} {formatCount(game.views_count ?? 0, lang)}</span>
        </p>
      </div>

      <Link
        className="btn btn-primary btn-sm shrink-0 rounded-full sm:btn-md"
        params={{ gameId, locale: lang }}
        to="/$locale/games/$gameId/play"
      >
        <i className="ri-play-fill" />
        <span className="hidden sm:inline">{t.startGame}</span>
      </Link>
    </article>
  )
}

function formatCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

function formatGameTotal(value: number, locale: Locale) {
  const total = new Intl.NumberFormat(locale).format(value)
  if (locale === 'zh-CN') return `${total}款`
  if (locale === 'zh-TW') return `${total}款`
  if (locale === 'ja') return `${total}本`
  return `${total} games`
}

function loadArcadePage(locale: Locale, page: number) {
  return searchGames({
    data: {
      limit: ARCADE_PAGE_SIZE,
      locale,
      page,
      platform: 'Arcade',
      query: '',
      sort: 'name_asc',
    },
  })
}

function dedupeGames(games: Array<PublicGame>) {
  const seen = new Set<string>()

  return games.filter((game) => {
    const id = game.url_slug?.trim() || game._id?.trim()
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}
