import { createFileRoute, redirect } from '@tanstack/react-router'

import type { Locale, PublicGame } from '#/lib/ggemu'
import { searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'
import { PlatformModeContent } from './$locale.arcade'

const PAGE_SIZE = 100
const PLATFORM_MODES = {
  famicom: {
    apiPlatform: 'Famicom',
    descriptionKey: 'famicomDescription',
    seoTitleKey: 'famicomSeoTitle',
    subtitleKey: 'famicomSubtitle',
    titleKey: 'famicomTitle',
  },
  gba: {
    apiPlatform: 'Game Boy Advance',
    descriptionKey: 'gbaDescription',
    seoTitleKey: 'gbaSeoTitle',
    subtitleKey: 'gbaSubtitle',
    titleKey: 'gbaTitle',
  },
  flash: {
    apiPlatform: 'FLASH',
    descriptionKey: 'flashDescription',
    seoTitleKey: 'flashSeoTitle',
    subtitleKey: 'flashSubtitle',
    titleKey: 'flashTitle',
  },
} as const

type PlatformModeId = keyof typeof PLATFORM_MODES

export const Route = createFileRoute('/$locale/platform/$platformId')({
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const mode = getPlatformMode(params.platformId)

    if (!mode) {
      throw redirect({ params: { locale }, to: '/$locale' })
    }

    const [seoOrigin, firstPage] = await Promise.all([
      getSeoOrigin(),
      loadPlatformPage(locale, mode.apiPlatform, 1),
    ])
    const remainingPages = await Promise.all(
      Array.from(
        { length: Math.max(0, firstPage.pagination.pages - 1) },
        (_, index) => loadPlatformPage(locale, mode.apiPlatform, index + 2),
      ),
    )

    return {
      games: dedupeGames([
        ...firstPage.games,
        ...remainingPages.flatMap((result) => result.games),
      ]),
      modeId: params.platformId as PlatformModeId,
      seoOrigin,
    }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const copy = getModeCopy(locale, loaderData?.modeId)

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: `/platform/${params.platformId}`,
          })
        : undefined,
      meta: [
        { title: copy.seoTitle },
        { name: 'description', content: copy.description },
      ],
    }
  },
  component: PlatformModePage,
})

function PlatformModePage() {
  const { games, modeId } = Route.useLoaderData()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const copy = getModeCopy(lang, modeId)

  return (
    <PlatformModeContent
      body={copy.subtitle}
      description={copy.description}
      games={games}
      lang={lang}
      title={copy.title}
    />
  )
}

function getPlatformMode(value: string) {
  return value in PLATFORM_MODES
    ? PLATFORM_MODES[value as PlatformModeId]
    : undefined
}

function getModeCopy(locale: Locale, modeId: PlatformModeId | undefined) {
  const t = getI18n(locale).arcade
  const mode = modeId ? PLATFORM_MODES[modeId] : PLATFORM_MODES.famicom

  return {
    description: t[mode.descriptionKey],
    seoTitle: t[mode.seoTitleKey],
    subtitle: t[mode.subtitleKey],
    title: t[mode.titleKey],
  }
}

function loadPlatformPage(locale: Locale, platform: string, page: number) {
  return searchGames({
    data: {
      limit: PAGE_SIZE,
      locale,
      page,
      platform,
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
