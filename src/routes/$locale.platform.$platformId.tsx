import { createFileRoute, redirect } from '@tanstack/react-router'
import { CoinMachineWelcome } from '#/components/coin-machine-welcome'

import type { Locale, PublicGame } from '#/lib/ggemu'
import { searchCoinModeGames, searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'
import { PlatformModeContent } from './$locale.arcade'
import { SwitchDownloadLibrary } from '#/components/switch-download-library'
import { PspDownloadLibrary } from '#/components/psp-download-library'
import { FcCartridgeLibrary } from '#/components/fc-cartridge-library'
import { ARCADE_MAHJONG_GAME_QUERIES, normalizeArcadeMahjongGameName } from '#/lib/arcade-mahjong-games'

const PAGE_SIZE = 100
const PLATFORM_MODES = {
  psp: {
    apiPlatform: 'psp-library',
    descriptionKey: 'gbaDescription',
    seoTitleKey: 'gbaSeoTitle',
    subtitleKey: 'gbaSubtitle',
    titleKey: 'gbaTitle',
  },
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
  mahjong: {
    apiPlatform: 'mahjong-curated',
    descriptionKey: 'flashDescription',
    seoTitleKey: 'flashSeoTitle',
    subtitleKey: 'flashSubtitle',
    titleKey: 'flashTitle',
  },
  switch: {
    apiPlatform: 'switch-library',
    descriptionKey: 'gbaDescription',
    seoTitleKey: 'gbaSeoTitle',
    subtitleKey: 'gbaSubtitle',
    titleKey: 'gbaTitle',
  },
  'fc-cartridges': {
    apiPlatform: 'fc-cartridge-library',
    descriptionKey: 'famicomDescription',
    seoTitleKey: 'famicomSeoTitle',
    subtitleKey: 'famicomSubtitle',
    titleKey: 'famicomTitle',
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

  if (modeId === 'switch') return <SwitchDownloadLibrary lang={lang} />
  if (modeId === 'psp') return <PspDownloadLibrary lang={lang} />
  if (modeId === 'fc-cartridges') return <FcCartridgeLibrary lang={lang} />

  return (
    <>
    {modeId === 'coin' ? <CoinMachineWelcome lang={lang} /> : null}
    <PlatformModeContent
      body={copy.subtitle}
      description={copy.description}
      games={games}
      lang={lang}
      layout={modeId === 'coin' ? 'cards' : modeId === 'mahjong' ? 'library-cards' : 'list'}
      requireMember={modeId === 'mahjong'}
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
  if (modeId === 'mahjong') return getMahjongModeCopy(locale)
  if (modeId === 'switch') return getSwitchLibraryCopy(locale)
  if (modeId === 'psp') {
    const copy = getSwitchLibraryCopy(locale)
    return { description: copy.description.replaceAll('Switch', 'PSP'), seoTitle: copy.seoTitle.replaceAll('Switch', 'PSP'), subtitle: copy.subtitle.replaceAll('Switch', 'PSP'), title: copy.title.replaceAll('Switch', 'PSP') }
  }
  if (modeId === 'fc-cartridges') return getFcCartridgeLibraryCopy(locale)
  const t = getI18n(locale).arcade
  const mode = modeId ? PLATFORM_MODES[modeId] : PLATFORM_MODES.famicom

  return {
    description: t[mode.descriptionKey],
    seoTitle: t[mode.seoTitleKey],
    subtitle: t[mode.subtitleKey],
    title: t[mode.titleKey],
  }
}

function getMahjongModeCopy(locale: Locale) {
  if (locale === 'zh-TW') return { description: '匯集明星三缺一、全民鬥地主、幸運滿貫、電子基盤等經典街機麻將與休閒棋牌作品。登入玩家帳號後即可免費遊玩，沒有段位限制。', seoTitle: '街機麻將遊戲｜懷舊遊戲廳', subtitle: '精選街機麻將、鬥地主、電子基盤與經典休閒棋牌遊戲；登入後免費遊玩。', title: '街機麻將' }
  if (locale === 'en') return { description: 'A hand-picked collection of classic arcade mahjong and casual tabletop games. Sign in to play free, with no rank requirement.', seoTitle: 'Arcade Mahjong | Retro Game Hall', subtitle: 'Sign in to play classic mahjong and tabletop games free.', title: 'Arcade Mahjong' }
  if (locale === 'ja') return { description: '定番のアーケード麻雀やテーブルゲームを集めました。プレイヤーアカウントでログインすると、ランク制限なしで無料プレイできます。', seoTitle: 'アーケード麻雀｜懐かしゲームセンター', subtitle: 'ログイン後、定番の麻雀・テーブルゲームを無料で遊べます。', title: 'アーケード麻雀' }
  return { description: '汇集明星三缺一、全民斗地主、幸运满贯、电子基盘等经典街机麻将与休闲棋牌作品。登录玩家账号后即可免费游玩，没有等级限制。', seoTitle: '街机麻将游戏｜怀旧游戏厅', subtitle: '精选街机麻将、斗地主、电子基盘与经典休闲棋牌游戏；登录后免费游玩。', title: '街机麻将' }
}

function getSwitchLibraryCopy(locale: Locale) {
  if (locale === 'zh-TW') return { description: 'Switch 遊戲庫，集中展示中文 Switch 遊戲。', seoTitle: 'Switch遊戲庫｜懷舊遊戲廳', subtitle: '瀏覽 Switch 遊戲。', title: 'Switch遊戲庫' }
  if (locale === 'en') return { description: 'Browse available Switch games.', seoTitle: 'Switch Game Library | Retro Game Hall', subtitle: 'Browse available Switch games.', title: 'Switch Game Library' }
  if (locale === 'ja') return { description: 'Switchゲームの一覧です。', seoTitle: 'Switchゲームライブラリ｜懐かしゲームセンター', subtitle: 'Switchゲームを探せます。', title: 'Switchゲームライブラリ' }
  return { description: 'Switch 游戏库，集中展示中文 Switch 游戏。', seoTitle: 'Switch游戏库｜怀旧游戏厅', subtitle: '浏览 Switch 游戏。', title: 'Switch游戏库' }
}

function getFcCartridgeLibraryCopy(locale: Locale) {
  if (locale === 'en') return { description: 'Browse collected FC cartridges and launch them in FC Collection.', seoTitle: 'FC Cartridge Collection | Retro Game Hall', subtitle: 'Browse collected FC cartridges.', title: 'FC Cartridge Collection' }
  if (locale === 'zh-TW') return { description: '瀏覽已收藏的 FC 卡帶，並在 FC 收藏館中直接遊玩。', seoTitle: 'FC卡帶收藏｜懷舊遊戲廳', subtitle: '瀏覽已收藏的 FC 卡帶。', title: 'FC卡帶收藏' }
  if (locale === 'ja') return { description: '収集したFCカセットを閲覧してプレイできます。', seoTitle: 'FCカセットコレクション｜懐かしゲームセンター', subtitle: 'FCカセット一覧。', title: 'FCカセットコレクション' }
  return { description: '浏览已收藏的 FC 卡带，并在 FC 收藏馆中直接游玩。', seoTitle: 'FC卡带收藏｜怀旧游戏厅', subtitle: '浏览已收藏的 FC 卡带。', title: 'FC卡带收藏' }
}

async function loadModeGames(locale: Locale, platform: string) {
  if (platform === 'switch-library' || platform === 'psp-library' || platform === 'fc-cartridge-library') return []
  if (platform === 'mahjong-curated') return loadMahjongGames(locale)
  if (platform === 'coin') {
    return (await searchCoinModeGames({ data: { locale } })).games
  }

  const platforms = platform === 'web' ? ['FLASH', 'HTML5', 'DOS'] : [platform]
  const groups = await Promise.all(platforms.map((item) => loadAllPlatformPages(locale, item)))
  return dedupeGames(groups.flat())
}

async function loadMahjongGames(locale: Locale) {
  const results = await Promise.all(ARCADE_MAHJONG_GAME_QUERIES.map(query => searchGames({
    data: { locale, query, sort: 'popular', page: 1, limit: 10 },
  })))

  const selected = results.flatMap((result, index) => {
    const query = normalizeArcadeMahjongGameName(ARCADE_MAHJONG_GAME_QUERIES[index])
    const exact = result.games.find(game => normalizeArcadeMahjongGameName(game.name) === query)
      ?? result.games.find(game => {
        const identity = normalizeArcadeMahjongGameName(`${game.name ?? ''} ${game.keywords ?? ''}`)
        return identity.includes(query) || query.includes(normalizeArcadeMahjongGameName(game.name))
      })
    return exact ? [exact] : []
  })
  return dedupeGames(selected)
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
    description: '金幣模式遊戲依段位解鎖，只檢查段位與金幣餘額，開始遊戲不會扣除金幣。',
    seoTitle: '金幣模式｜專屬遊戲｜懷舊遊戲廳',
    subtitle: '美女打鑽、美女彈珠打磚塊需白銀段位；美女天蠶變需黃金段位。達到條件即可遊玩，不扣金幣。',
    title: '金幣模式',
  }
  if (locale === 'en') return {
    description: 'Coin Mode games unlock by rank. Starting a game does not spend coins.',
    seoTitle: 'Coin Mode | Exclusive Games | Retro Game Hall',
    subtitle: 'Wiggie Waggie and Excelsior require Silver; WOW New Fantasia requires Gold. Coins are not deducted.',
    title: 'Coin Mode',
  }
  if (locale === 'ja') return {
    description: 'コインモードのゲームはランクで解放され、開始時にコインは消費されません。',
    seoTitle: 'コインモード｜限定ゲーム｜レトロゲームセンター',
    subtitle: 'Wiggie WaggieとExcelsiorはシルバー、WOW New Fantasiaはゴールドが必要です。コインは消費されません。',
    title: 'コインモード',
  }
  return {
    description: '金币模式游戏按段位解锁，只检查段位和金币余额，开始游戏不会扣除金币。',
    seoTitle: '金币模式｜金币专属游戏｜怀旧游戏厅',
    subtitle: '美女打钻、美女弹珠打砖块需白银段位；美女天蚕变需黄金段位。达到条件即可游玩，不扣金币。',
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
