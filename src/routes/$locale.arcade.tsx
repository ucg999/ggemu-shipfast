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
        { title: `${t.title} | ${getI18n(locale).homeSeo.title}` },
        { name: 'description', content: t.subtitle },
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

  return <PlatformModeContent games={games} lang={lang} subtitle={t.subtitle} title={t.title} />
}

export function PlatformModeContent({
  games,
  lang,
  subtitle,
  title,
}: {
  games: Array<PublicGame>
  lang: Locale
  subtitle: string
  title: string
}) {
  const t = getI18n(lang).arcade
  const [letter, setLetter] = useState('ALL')
  const visibleGames = useMemo(
    () =>
      letter === 'HOT'
        ? [...games].sort((left, right) => (right.plays_count ?? 0) - (left.plays_count ?? 0))
        : letter === 'ALL'
          ? games
          : games.filter((game) => game.name?.trim().toUpperCase().startsWith(letter)),
    [games, letter],
  )

  return (
    <SiteLayout locale={lang}>
      <section className="bg-base-100 px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">{title}</h1>
        <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-base-content/65">{subtitle}</p>
      </section>

      <nav
        aria-label={title}
        className="sticky top-[61px] z-30 border-y border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-6 lg:px-8"
      >
        <div className="flex gap-1 overflow-x-auto py-3">
          <LetterButton active={letter === 'ALL'} label={t.allGames} onClick={() => setLetter('ALL')} />
          <LetterButton active={letter === 'HOT'} label={t.mostPopular} onClick={() => setLetter('HOT')} />
          {LETTERS.map((item) => (
            <LetterButton active={letter === item} key={item} label={item} onClick={() => setLetter(item)} />
          ))}
        </div>
      </nav>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        {visibleGames.length > 0 ? (
          <div className="flex flex-col gap-2">
            {visibleGames.map((game) => (
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
