import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getGameDetail, searchGames, type Locale, type PublicGame } from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { siteConfig } from '#/lib/site-config'
import { useCurrentSiteTheme } from '#/lib/use-site-theme'
import {
  addCoinBalance,
  consumeGamePlayStartedAt,
  getDailyGameCoinMultiplier,
  markGamePlayStarted,
} from '#/lib/coin-wallet'
import { HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'

const pspCrossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'cross-origin-isolated=(self "https://ggemu.com")',
} as const

const noindexHeaders = {
  'X-Robots-Tag': 'noindex, nofollow',
} as const

const GAME_COIN_INTERVAL_MS = 60 * 1000

export const Route = createFileRoute('/$locale/games/$gameId/play')({
  validateSearch: (search: Record<string, unknown>) => ({
    autoplay: search.autoplay === '1' ? ('1' as const) : undefined,
  }),
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const game = await getGameDetail({ data: { id: params.gameId } })
    const seriesQuery = getSeriesQuery(game.name)
    const category = game.categories?.[0]
    const [seriesResult, categoryResult] = await Promise.all([
      seriesQuery
        ? searchGames({
            data: { limit: 18, locale, page: 1, query: seriesQuery },
          })
        : undefined,
      category
        ? searchGames({
            data: { category, limit: 18, locale, page: 1, sort: 'popular' },
          })
        : undefined,
    ])
    const seriesGames = (seriesResult?.games ?? [])
      .filter((candidate) => isSameSeries(game, candidate, seriesQuery))
      .slice(0, 6)
    const categoryGames = (categoryResult?.games ?? [])
      .filter((candidate) => !isCurrentGame(game, candidate))
      .slice(0, 6)

    return {
      game,
      recommendations: seriesGames.length ? seriesGames : categoryGames,
      recommendationType: seriesGames.length ? ('series' as const) : ('category' as const),
    }
  },
  headers: ({ loaderData }) => ({
    ...noindexHeaders,
    ...(loaderData && isPspGame(loaderData.game) ? pspCrossOriginIsolationHeaders : {}),
  }),
  component: LocalizedPlayGamePage,
})

function LocalizedPlayGamePage() {
  const { game, recommendations, recommendationType } = Route.useLoaderData()
  const { gameId, locale } = Route.useParams()
  const { autoplay } = Route.useSearch()
  const lang = normalizeLocale(locale)
  const embedId = encodeURIComponent(game._id || game.url_slug || gameId)
  const refcode = encodeURIComponent(siteConfig.GGEMU_REFCODE)
  const isPsp = isPspGame(game)
  const theme = useCurrentSiteTheme()
  const embedSrc = `https://ggemu.com/${lang}/game/${embedId}?${buildEmbedSearch(refcode, isPsp, theme, autoplay === '1')}`
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [settlement, setSettlement] = useState<GameSessionSettlement | null>(null)
  const activePlayTimeRef = useRef(0)
  const awardedCoinsRef = useRef(0)
  const playStartedAtRef = useRef<number | null>(null)
  const sessionCoinsRef = useRef(0)
  const settlementTimerRef = useRef<number | null>(null)
  const labels = useMemo(() => getRecommendationLabels(lang), [lang])
  const coinMultiplier = useMemo(() => getDailyGameCoinMultiplier(gameId), [gameId])
  const globalCoins = useGlobalCoinBalance()

  useEffect(() => {
    setShowRecommendations(false)
    setSettlement(null)
    activePlayTimeRef.current = 0
    awardedCoinsRef.current = 0
    playStartedAtRef.current = consumeGamePlayStartedAt(gameId)
    sessionCoinsRef.current = 0
  }, [gameId])

  const collectDueSessionCoins = useCallback(() => {
    const activeTime = getCurrentActivePlayTime(
      activePlayTimeRef.current,
      playStartedAtRef.current,
    )
    const earnedCoins = Math.floor(activeTime / GAME_COIN_INTERVAL_MS)
    const newBaseCoins = Math.max(0, earnedCoins - awardedCoinsRef.current)
    const newCoins = newBaseCoins * coinMultiplier

    if (newCoins > 0) {
      addStoredGameCoins(newCoins)
      awardedCoinsRef.current = earnedCoins
      sessionCoinsRef.current += newCoins
    }

    return {
      coins: sessionCoinsRef.current,
      minutes: Math.max(1, Math.ceil(activeTime / 60_000)),
    }
  }, [coinMultiplier])

  const settleAndShowRecommendations = useCallback(() => {
    if (playStartedAtRef.current !== null) {
      activePlayTimeRef.current = getCurrentActivePlayTime(
        activePlayTimeRef.current,
        playStartedAtRef.current,
      )
      playStartedAtRef.current = null
    }

    const result = collectDueSessionCoins()
    setSettlement(result)
    setShowRecommendations(true)

    if (settlementTimerRef.current !== null) {
      window.clearTimeout(settlementTimerRef.current)
    }
    settlementTimerRef.current = window.setTimeout(() => {
      setSettlement(null)
      settlementTimerRef.current = null
    }, 2_200)
  }, [collectDueSessionCoins])

  const continueGame = useCallback(() => {
    setSettlement(null)
    setShowRecommendations(false)
    playStartedAtRef.current = Date.now()
  }, [])

  const goBackOneStep = useCallback(() => {
    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign(`/${lang}/games/${gameId}`)
  }, [gameId, lang])

  useEffect(() => {
    if (showRecommendations) return

    const timer = window.setInterval(collectDueSessionCoins, 1_000)
    return () => window.clearInterval(timer)
  }, [collectDueSessionCoins, showRecommendations])

  useEffect(() => {
    const embedOrigin = new URL(embedSrc).origin
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || !isGameExitMessage(event.data)) {
        return
      }

      settleAndShowRecommendations()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        settleAndShowRecommendations()
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', handleKeyDown)

      if (settlementTimerRef.current !== null) {
        window.clearTimeout(settlementTimerRef.current)
      }

      if (!isPsp || !window.crossOriginIsolated) {
        return
      }

      window.setTimeout(() => {
        const url = new URL(window.location.href)

        url.searchParams.delete('isolated')
        window.location.href = url.toString()
      }, 0)
    }
  }, [embedSrc, isPsp, settleAndShowRecommendations])

  return (
    <main className="game-play-screen bg-black">
      <button
        aria-label={labels.exitGame}
        className="game-play-exit fixed left-2 top-2 z-30 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/90 sm:left-3 sm:top-3 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        onClick={settleAndShowRecommendations}
        type="button"
      >
        <i className="ri-logout-box-r-line text-sm sm:text-lg" />
        {labels.exitGame}
      </button>
      <div className="fixed right-2 top-2 z-30 flex items-center gap-1 rounded-lg bg-black/35 p-1 backdrop-blur-sm sm:right-3 sm:top-3">
        <button
          aria-label={labels.goBack}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-black/65 text-white transition hover:bg-black/90 sm:h-8 sm:w-8"
          onClick={goBackOneStep}
          title={labels.goBack}
          type="button"
        >
          <i className="ri-arrow-go-back-line text-base sm:text-lg" />
        </button>
        <HomeCoinBag
          balance={globalCoins.balance}
          lang={lang}
          onOpen={globalCoins.showBalance}
        />
      </div>
      <iframe
        allow={
          isPsp
            ? 'autoplay; gamepad; fullscreen; cross-origin-isolated'
            : 'autoplay; gamepad'
        }
        allowFullScreen
        className="game-play-frame border-0 bg-black"
        src={embedSrc}
        title={game.name ?? 'Retro game'}
      />
      {showRecommendations ? (
        <GameExitRecommendations
          games={recommendations}
          labels={labels}
          lang={lang}
          onContinue={continueGame}
          recommendationType={recommendationType}
        />
      ) : null}
      {settlement ? (
        <GameCoinSettlement labels={labels} settlement={settlement} />
      ) : null}
    </main>
  )
}

type GameSessionSettlement = {
  coins: number
  minutes: number
}

function GameCoinSettlement({
  labels,
  settlement,
}: {
  labels: ReturnType<typeof getRecommendationLabels>
  settlement: GameSessionSettlement
}) {
  return (
    <aside
      aria-live="polite"
      className="coin-reward-pop pointer-events-none fixed inset-0 z-50 grid place-items-center p-4"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-yellow-300/40 bg-black/85 px-5 py-4 text-white shadow-2xl backdrop-blur-sm">
        <img
          alt=""
          aria-hidden="true"
          className="h-14 w-14 object-contain [image-rendering:pixelated]"
          src="/images/coin-rewards/pixel-reward-coin.png"
        />
        <div className="whitespace-nowrap">
          <p className="text-xs text-white/60">{labels.sessionSettlement}</p>
          <p className="mt-0.5 text-xl font-black text-yellow-300">
            +{settlement.coins} {labels.coins}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {labels.playedMinutes.replace('{minutes}', String(settlement.minutes))}
          </p>
        </div>
      </div>
    </aside>
  )
}

function GameExitRecommendations({
  games,
  labels,
  lang,
  onContinue,
  recommendationType,
}: {
  games: Array<PublicGame>
  labels: ReturnType<typeof getRecommendationLabels>
  lang: Locale
  onContinue: () => void
  recommendationType: 'series' | 'category'
}) {
  return (
    <section
      aria-labelledby="game-exit-recommendations-title"
      aria-modal="true"
      className="fixed inset-0 z-40 overflow-y-auto bg-black/90 px-4 py-8 text-white backdrop-blur-sm"
      role="dialog"
    >
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <div className="w-full rounded-2xl border border-white/15 bg-zinc-950 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-white/55">{labels.finished}</p>
              <h1 className="mt-1 text-2xl font-bold sm:text-3xl" id="game-exit-recommendations-title">
                {recommendationType === 'series' ? labels.title : labels.categoryTitle}
              </h1>
            </div>
            <button
              aria-label={labels.continueGame}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"
              onClick={onContinue}
              type="button"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>

          {games.length ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {games.map((game) => {
                const id = game.url_slug?.trim() || game._id?.trim()

                return id ? (
                  <Link
                    className="group min-w-0"
                    key={id}
                    onClick={() => markGamePlayStarted(id)}
                    params={{ gameId: id, locale: lang }}
                    search={{ autoplay: '1' }}
                    to="/$locale/games/$gameId/play"
                  >
                    <div className="aspect-square overflow-hidden rounded-lg bg-zinc-800">
                      {game.game_cover ? (
                        <img
                          alt={game.name ?? labels.game}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                          src={game.game_cover}
                        />
                      ) : null}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium">{game.name ?? labels.game}</p>
                    <p className="mt-0.5 truncate text-xs text-white/45">
                      {game.platform ? getPlatformLabel(game.platform, lang) : labels.playNow}
                    </p>
                  </Link>
                ) : null
              })}
            </div>
          ) : (
            <p className="mt-6 rounded-xl bg-white/5 px-4 py-8 text-center text-sm text-white/60">
              {labels.empty}
            </p>
          )}

          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <button
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/10"
              onClick={onContinue}
              type="button"
            >
              {labels.continueGame}
            </button>
            <Link
              className="rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-yellow-300"
              params={{ locale: lang }}
              search={{}}
              to="/$locale"
            >
              {labels.backToHome}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function isGameExitMessage(data: unknown) {
  const rawType =
    typeof data === 'string'
      ? data
      : data && typeof data === 'object'
        ? String(
            (data as Record<string, unknown>).type ??
              (data as Record<string, unknown>).event ??
              (data as Record<string, unknown>).action ??
              '',
          )
        : ''
  const type = rawType.toLowerCase().replaceAll(/[^a-z]/g, '')

  return ['gameover', 'gameend', 'gameended', 'exit', 'exitgame', 'quit', 'closegame'].includes(type)
}

function isSameSeries(current: PublicGame, candidate: PublicGame, seriesQuery: string) {
  const currentId = current.url_slug?.trim() || current._id?.trim()
  const candidateId = candidate.url_slug?.trim() || candidate._id?.trim()

  return (
    Boolean(candidateId && candidateId !== currentId) &&
    normalizeSeriesText(candidate.name).includes(normalizeSeriesText(seriesQuery))
  )
}

function isCurrentGame(current: PublicGame, candidate: PublicGame) {
  const currentId = current.url_slug?.trim() || current._id?.trim()
  const candidateId = candidate.url_slug?.trim() || candidate._id?.trim()

  return Boolean(currentId && candidateId && currentId === candidateId)
}

function getSeriesQuery(name: string | undefined) {
  const normalized = normalizeSeriesText(name)
  const knownSeries = [
    'the king of fighters',
    'king of fighters',
    'metal slug',
    'street fighter',
    'samurai shodown',
    'fatal fury',
    'super mario',
    'mega man',
    'final fantasy',
    'dragon ball',
    'double dragon',
    'golden axe',
    'sonic',
    'pokemon',
    'contra',
    'bomberman',
    '拳皇',
    '合金弹头',
    '街头霸王',
    '侍魂',
    '饿狼传说',
    '超级马里奥',
    '洛克人',
    '最终幻想',
    '七龙珠',
    '双截龙',
    '战斧',
    '索尼克',
    '口袋妖怪',
    '魂斗罗',
    '炸弹人',
  ]
  const known = knownSeries.find((series) => normalized.includes(series))

  if (known) {
    return known
  }

  return normalized
    .replaceAll(/\b(?:19|20)\d{2}\b/g, '')
    .replaceAll(/\b(?:part|episode|vol(?:ume)?)\s*[\divx]+\b/g, '')
    .replaceAll(/\b[\divx]+\b$/g, '')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ')
}

function normalizeSeriesText(value: string | undefined) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replaceAll(/[\[\]()（）【】:'’"“”.,，。!！?？_/-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function getCurrentActivePlayTime(accumulatedTime: number, startedAt: number | null) {
  return accumulatedTime + (startedAt === null ? 0 : Date.now() - startedAt)
}

function addStoredGameCoins(amount: number) {
  addCoinBalance(amount)
}

function getRecommendationLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      backToHome: '退出并返回首页',
      categoryTitle: '再玩一款同类型游戏',
      coins: '金币',
      continueGame: '继续游戏',
      empty: '暂时没有找到同系列游戏，可以返回首页继续挑选。',
      exitGame: '退出游戏',
      finished: '本局结束了吗？',
      game: '经典游戏',
      goBack: '返回上一步',
      playNow: '立即游玩',
      playedMinutes: '本局游玩 {minutes} 分钟',
      sessionSettlement: '本局金币结算',
      title: '再玩一款同系列游戏',
    }
  }

  if (locale === 'zh-TW') {
    return {
      backToHome: '退出並返回首頁',
      categoryTitle: '再玩一款同類型遊戲',
      coins: '金幣',
      continueGame: '繼續遊戲',
      empty: '暫時沒有找到同系列遊戲，可以返回首頁繼續挑選。',
      exitGame: '退出遊戲',
      finished: '本局結束了嗎？',
      game: '經典遊戲',
      goBack: '返回上一步',
      playNow: '立即遊玩',
      playedMinutes: '本局遊玩 {minutes} 分鐘',
      sessionSettlement: '本局金幣結算',
      title: '再玩一款同系列遊戲',
    }
  }

  if (locale === 'ja') {
    return {
      backToHome: '終了してホームへ戻る',
      categoryTitle: '同じジャンルのゲーム',
      coins: 'コイン',
      continueGame: 'ゲームを続ける',
      empty: '同じシリーズのゲームが見つかりません。ホームでほかのゲームを探せます。',
      exitGame: 'ゲームを終了',
      finished: 'プレイを終了しますか？',
      game: 'クラシックゲーム',
      goBack: '前のページに戻る',
      playNow: '今すぐプレイ',
      playedMinutes: '今回のプレイ：{minutes}分',
      sessionSettlement: 'コイン精算',
      title: '同じシリーズのゲーム',
    }
  }

  return {
    backToHome: 'Exit to home',
    categoryTitle: 'Play another game in this genre',
    coins: 'coins',
    continueGame: 'Continue playing',
    empty: 'No games from the same series were found. Return home to browse more games.',
    exitGame: 'Exit game',
    finished: 'Finished this round?',
    game: 'Classic game',
    goBack: 'Go back',
    playNow: 'Play now',
    playedMinutes: 'Played {minutes} minutes this session',
    sessionSettlement: 'Session coin summary',
    title: 'Play another game in the series',
  }
}

function buildEmbedSearch(refcode: string, isPsp: boolean, theme: string, autoplay: boolean) {
  const params = new URLSearchParams({
    r: refcode,
    embed: '1',
    theme,
  })

  if (isPsp) {
    params.set('isolated', '1')
  }

  if (isPsp || autoplay) {
    params.set('autoplay', '1')
  }

  return params.toString()
}

function isPspGame(game: {
  platform?: string
  platform_slug?: string
  platformSlug?: string
  url_slug?: string
}) {
  return [game.platform, game.platform_slug, game.platformSlug, game.url_slug].some((value) =>
    isPspPlatform(value),
  )
}

function isPspPlatform(value: string | undefined) {
  const platform = value?.trim().toLowerCase()

  return (
    platform === 'psp' ||
    platform === 'playstation portable' ||
    platform?.includes('-psp-') ||
    platform?.endsWith('-psp')
  )
}
