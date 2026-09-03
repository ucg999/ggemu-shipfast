import { createFileRoute, redirect } from '@tanstack/react-router'
import { CoinMachineWelcome } from '#/components/coin-machine-welcome'

import type { Locale, PublicGame } from '#/lib/ggemu'
import { searchCoinModeGames, searchGames } from '#/lib/ggemu'
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
    apiPlatform: 'web',
    descriptionKey: 'flashDescription',
    seoTitleKey: 'flashSeoTitle',
    subtitleKey: 'flashSubtitle',
    titleKey: 'flashTitle',
  },
  coin: {
    apiPlatform: 'coin',
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

    const [seoOrigin, games] = await Promise.all([
      getSeoOrigin(),
      loadModeGames(locale, mode.apiPlatform),
    ])

    return {
      games,
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
    <>
    {modeId === 'coin' ? <CoinMachineWelcome lang={lang} /> : null}
    <PlatformModeContent
      body={copy.subtitle}
      description={copy.description}
      games={games}
      lang={lang}
      layout={modeId === 'coin' ? 'cards' : 'list'}
      showCoinChallenge={modeId === 'coin'}
      title={copy.title}
    />
    </>
  )
}

function getPlatformMode(value: string) {
  return value in PLATFORM_MODES
    ? PLATFORM_MODES[value as PlatformModeId]
    : undefined
}

function getModeCopy(locale: Locale, modeId: PlatformModeId | undefined) {
  if (modeId === 'coin') return getCoinModeCopy(locale)
  const t = getI18n(locale).arcade
  const mode = modeId ? PLATFORM_MODES[modeId] : PLATFORM_MODES.famicom

  return {
    description: t[mode.descriptionKey],
    seoTitle: t[mode.seoTitleKey],
    subtitle: t[mode.subtitleKey],
    title: t[mode.titleKey],
  }
}

async function loadModeGames(locale: Locale, platform: string) {
  if (platform === 'coin') {
    return (await searchCoinModeGames()).games
  }

  const platforms = platform === 'web' ? ['FLASH', 'HTML5', 'DOS'] : [platform]
  const groups = await Promise.all(platforms.map((item) => loadAllPlatformPages(locale, item)))
  return dedupeGames(groups.flat())
}

async function loadAllPlatformPages(locale: Locale, platform: string) {
  const firstPage = await loadPlatformPage(locale, platform, 1)
  const remainingPages = await Promise.all(
    Array.from(
      { length: Math.max(0, firstPage.pagination.pages - 1) },
      (_, index) => loadPlatformPage(locale, platform, index + 2),
    ),
  )
  return dedupeGames([...firstPage.games, ...remainingPages.flatMap((result) => result.games)])
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

function getCoinModeCopy(locale: Locale) {
  if (locale === 'zh-TW') return {
    description: '只在金幣模式出現的專屬遊戲，每次遊玩需要 20 枚金幣。',
    seoTitle: '金幣模式｜專屬遊戲｜遊戲歷險記',
    subtitle: '收集金幣，解鎖 WOW New Fantasia 與 Excelsior。點擊遊戲可查看詳情並開始遊玩。',
    title: '金幣模式',
  }
  if (locale === 'en') return {
    description: 'Exclusive coin-mode games. Each play costs 20 coins.',
    seoTitle: 'Coin Mode | Exclusive Games | Game Adventure',
    subtitle: 'Collect coins to unlock WOW New Fantasia and Excelsior.',
    title: 'Coin Mode',
  }
  if (locale === 'ja') return {
    description: 'コインモード限定ゲームです。1回のプレイに20コインが必要です。',
    seoTitle: 'コインモード｜限定ゲーム｜ゲームアドベンチャー',
    subtitle: 'コインを集めて WOW New Fantasia と Excelsior をプレイしましょう。',
    title: 'コインモード',
  }
  return {
    description: '只在金币模式出现的专属游戏，每次游玩需要 20 个金币。',
    seoTitle: '金币模式｜金币专属游戏｜游戏历险记',
    subtitle: '收集金币，解锁 WOW New Fantasia 和 Excelsior。点击游戏可查看详情并开始游玩。',
    title: '金币模式',
  }
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
