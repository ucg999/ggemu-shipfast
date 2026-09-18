import { Link, createFileRoute, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getCoinModeGameMinimumBalance, getCoinModeGameRequiredRank, getGameDetail, searchGames, type Locale, type PublicGame } from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { siteConfig } from '#/lib/site-config'
import { useCurrentSiteTheme } from '#/lib/use-site-theme'
import { calculateGameCoinAward } from '#/lib/game-session-coins'
import { isArcadeMahjongGame } from '#/lib/arcade-mahjong-games'
import { HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'
import {
  addCoinReward,
  consumeGamePlayStartedAt,
  getDailyGameCoinMultiplier,
  hasCoinRank,
  readCoinBalance,
  spendCoinBalance,
} from '#/lib/coin-wallet'

const trialDragDocuments = new WeakSet<Document>()

const pspCrossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'cross-origin-isolated=(self "https://ggemu.com")',
} as const

const noindexHeaders = {
  'X-Robots-Tag': 'noindex, nofollow',
} as const


type PlayGameSearch = {
  autoplay?: '1'
  inline?: '1'
}

export const Route = createFileRoute('/$locale/games/$gameId/play')({
  validateSearch: (search: Record<string, unknown>): PlayGameSearch => ({
    autoplay: search.autoplay === '1' ? ('1' as const) : undefined,
    inline: search.inline === '1' ? ('1' as const) : undefined,
  }),
  loader: async ({ params }) => {
    const game = await getGameDetail({ data: { id: params.gameId } })

    return { game, trialGame: Math.random() < 0.5 ? ('ghost' as const) : ('coin' as const) }
  },
  headers: ({ loaderData }) => ({
    ...noindexHeaders,
    ...(loaderData && isPspGame(loaderData.game) ? pspCrossOriginIsolationHeaders : {}),
  }),
  component: LocalizedPlayGamePage,
})

function LocalizedPlayGamePage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { game, trialGame } = Route.useLoaderData()
  const { gameId, locale } = Route.useParams()
  const { autoplay, inline } = Route.useSearch()
  const locationHash = useRouterState({ select: state => state.location.hash })
  const isProGame = locationHash === 'PRO' || locationHash === '#PRO'
  const lang = normalizeLocale(locale)
  const requiredCoinRank = getCoinModeGameRequiredRank(game)
  const isMahjongCoinChargeGame = isArcadeMahjongGame(game)
  const loadingTrialDisabled = isMahjongCoinChargeGame
  const minimumCoinBalance = getCoinModeGameMinimumBalance(game)
  const [rankAccessGranted, setRankAccessGranted] = useState(requiredCoinRank === null)
  const embedId = encodeURIComponent(game._id || game.url_slug || gameId)
  const refcode = encodeURIComponent(siteConfig.GGEMU_REFCODE)
  const isPsp = isPspGame(game)
  const theme = useCurrentSiteTheme()
  const embedSrc = rankAccessGranted ? `https://ggemu.com/${lang}/game/${embedId}?${buildEmbedSearch(refcode, isPsp, theme, autoplay === '1')}` : 'about:blank'
  const [showRecommendations, setShowRecommendations] = useState(false)
  const [recommendations, setRecommendations] = useState<Array<PublicGame>>([])
  const [recommendationType, setRecommendationType] = useState<'series' | 'category'>('category')
  const [settlement, setSettlement] = useState<GameSessionSettlement | null>(null)
  const [showLoadingTrial, setShowLoadingTrial] = useState(!loadingTrialDisabled)
  const [trialPosition, setTrialPosition] = useState<{ x: number; y: number } | null>(null)
  const loadGameRecommendations = useServerFn(searchGames)
  const activePlayTimeRef = useRef(0)
  const awardedCoinsRef = useRef(0)
  const playStartedAtRef = useRef<number | null>(null)
  const sessionCoinsRef = useRef(0)
  const coinMultiplierRef = useRef(1)
  const settlementTimerRef = useRef<number | null>(null)
  const exitingRef = useRef(false)
  const coinDepletedRef = useRef(false)
  const [returnPending, setReturnPending] = useState(false)
  const recommendationsRequestedRef = useRef(false)
  const trialDragRef = useRef<{ offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const labels = useMemo(() => getRecommendationLabels(lang), [lang])
  const playerRef = useRef<HTMLElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const globalCoins = useGlobalCoinBalance()
  const fullscreenLabel = lang === 'en' ? (isFullscreen ? 'Exit fullscreen' : 'Fullscreen')
    : lang === 'ja' ? (isFullscreen ? '全画面を終了' : '全画面')
    : lang === 'zh-TW' ? (isFullscreen ? '退出全螢幕' : '全螢幕')
    : (isFullscreen ? '退出全屏' : '全屏')

  useEffect(() => {
    if (!requiredCoinRank || (hasCoinRank(requiredCoinRank) && readCoinBalance() >= minimumCoinBalance)) {
      setRankAccessGranted(true)
      return
    }
    const rankName = requiredCoinRank === 'gold' ? '黄金' : requiredCoinRank === 'silver' ? '白银' : '青铜'
    window.alert(minimumCoinBalance > 0 ? `需要达到青铜段位并拥有至少 ${minimumCoinBalance} 个金币才可以开始游戏，金币不会扣除。` : `需要达到${rankName}段位才可以开始游戏。`)
    void navigate({ hash: isProGame ? 'PRO' : undefined, params: { gameId, locale: lang }, to: '/$locale/games/$gameId' })
  }, [gameId, isProGame, lang, minimumCoinBalance, navigate, requiredCoinRank])

  useEffect(() => {
    const update = () => setIsFullscreen(document.fullscreenElement === playerRef.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await playerRef.current?.requestFullscreen()
    } catch {
      window.alert(lang === 'en' ? 'Fullscreen is unavailable in this browser.' : '当前浏览器暂不支持全屏，请使用浏览器的全屏功能。')
    }
  }

  useEffect(() => {
    setShowRecommendations(false)
    setSettlement(null)
    exitingRef.current = false
    setReturnPending(false)
    setShowLoadingTrial(!loadingTrialDisabled)
    setTrialPosition(null)
    activePlayTimeRef.current = 0
    awardedCoinsRef.current = 0
    playStartedAtRef.current = consumeGamePlayStartedAt(gameId)
    sessionCoinsRef.current = 0
    coinDepletedRef.current = false
    coinMultiplierRef.current = getDailyGameCoinMultiplier(gameId)
    recommendationsRequestedRef.current = false
    setRecommendations([])
    setRecommendationType('category')
  }, [gameId, loadingTrialDisabled])

  useEffect(() => {
    if (!isProGame) return
    // Warm the return route while the player is already open.
    void router.preloadRoute({ to: '/$locale/PRO', params: { locale: lang }, search: { platform: undefined } }).catch(() => {})
  }, [isProGame, lang, router])

  const loadRecommendations = useCallback(async () => {
    if (recommendationsRequestedRef.current) return
    recommendationsRequestedRef.current = true

    const seriesQuery = getSeriesQuery(game.name)
    const category = game.categories?.[0]

    try {
      const [seriesResult, categoryResult] = await Promise.all([
        seriesQuery
          ? loadGameRecommendations({
              data: { limit: 18, locale: lang, page: 1, query: seriesQuery },
            })
          : undefined,
        category
          ? loadGameRecommendations({
              data: { category, limit: 18, locale: lang, page: 1, sort: 'popular' },
            })
          : undefined,
      ])
      const seriesGames = (seriesResult?.games ?? [])
        .filter((candidate) => isSameSeries(game, candidate, seriesQuery))
        .slice(0, 6)
      const categoryGames = (categoryResult?.games ?? [])
        .filter((candidate) => !isCurrentGame(game, candidate))
        .slice(0, 6)

      setRecommendations(seriesGames.length ? seriesGames : categoryGames)
      setRecommendationType(seriesGames.length ? 'series' : 'category')
    } catch {
      recommendationsRequestedRef.current = false
    }
  }, [game, lang, loadGameRecommendations])

  const collectDueSessionCoins = useCallback(() => {
    const activeTime = getCurrentActivePlayTime(
      activePlayTimeRef.current,
      playStartedAtRef.current,
    )

    if (isMahjongCoinChargeGame) {
      const chargeableCoins = Math.floor(Math.max(0, activeTime) / 60_000)
      const dueCoins = Math.max(0, chargeableCoins - awardedCoinsRef.current)
      awardedCoinsRef.current = chargeableCoins

      if (dueCoins > 0) {
        const currentBalance = readCoinBalance()
        const deductedCoins = Math.min(dueCoins, currentBalance)
        if (deductedCoins > 0 && spendCoinBalance(deductedCoins)) {
          sessionCoinsRef.current += deductedCoins
        }

        if (currentBalance - deductedCoins <= 0 && !coinDepletedRef.current) {
          coinDepletedRef.current = true
          playStartedAtRef.current = null
          setShowLoadingTrial(false)
          window.setTimeout(() => {
            window.alert(labels.mahjongCoinsDepleted)
            if (isProGame) {
              void navigate({ params: { locale: lang }, search: { platform: 'mahjong' }, to: '/$locale/PRO' })
            } else {
              void navigate({ params: { gameId, locale: lang }, to: '/$locale/games/$gameId' })
            }
          }, 0)
        }
      }

      return {
        coins: sessionCoinsRef.current,
        deducted: true,
        multiplier: 1,
        minutes: Math.max(1, Math.ceil(activeTime / 60_000)),
      }
    }

    const multiplier = coinMultiplierRef.current
    const { earned: earnedCoins, additional: newCoins } = calculateGameCoinAward(
      activeTime, multiplier, awardedCoinsRef.current, sessionCoinsRef.current,
    )

    awardedCoinsRef.current = earnedCoins

    if (newCoins > 0) {
      sessionCoinsRef.current += addStoredGameCoins(newCoins)
    }

    return {
      coins: sessionCoinsRef.current,
      deducted: false,
      multiplier,
      minutes: Math.max(1, Math.ceil(activeTime / 60_000)),
    }
  }, [gameId, isMahjongCoinChargeGame, isProGame, labels.mahjongCoinsDepleted, lang, navigate])

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
    void loadRecommendations()

    if (settlementTimerRef.current !== null) {
      window.clearTimeout(settlementTimerRef.current)
    }
    settlementTimerRef.current = window.setTimeout(() => {
      setSettlement(null)
      settlementTimerRef.current = null
    }, 2_200)
  }, [collectDueSessionCoins, loadRecommendations])

  const continueGame = useCallback(() => {
    setSettlement(null)
    setShowRecommendations(false)
    playStartedAtRef.current = Date.now()
  }, [])

  const exitGame = useCallback(() => {
    if (exitingRef.current) return
    if (!isProGame) {
      settleAndShowRecommendations()
      return
    }
    exitingRef.current = true
    if (playStartedAtRef.current !== null) {
      activePlayTimeRef.current = getCurrentActivePlayTime(activePlayTimeRef.current, playStartedAtRef.current)
      playStartedAtRef.current = null
    }
    const summary = collectDueSessionCoins()
    setShowLoadingTrial(false)
    setReturnPending(true)
    setSettlement(summary)
    settlementTimerRef.current = window.setTimeout(() => {
      settlementTimerRef.current = null
      // Isolated PSP documents must leave their isolation boundary with a full navigation.
      if (window.crossOriginIsolated) window.location.assign(`/${lang}/PRO`)
      else void navigate({ to: '/$locale/PRO', params: { locale: lang }, search: { platform: undefined } }).catch(() => window.location.assign(`/${lang}/PRO`))
    }, 2_200)
  }, [collectDueSessionCoins, isProGame, lang, navigate, settleAndShowRecommendations])

  useEffect(() => {
    if (showRecommendations || returnPending) return

    const timer = window.setInterval(() => {
      collectDueSessionCoins()
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [collectDueSessionCoins, showRecommendations, returnPending])

  useEffect(() => {
    const embedOrigin = new URL(embedSrc).origin
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || event.source !== playerRef.current?.querySelector<HTMLIFrameElement>('iframe.game-play-frame')?.contentWindow) return
      if (isGameExitMessage(event.data)) exitGame()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        exitGame()
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('ggemu-request-game-exit', exitGame)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('ggemu-request-game-exit', exitGame)
      window.removeEventListener('keydown', handleKeyDown)

      if (settlementTimerRef.current !== null) {
        window.clearTimeout(settlementTimerRef.current)
      }

      if (exitingRef.current || !isPsp || !window.crossOriginIsolated) {
        return
      }

      window.setTimeout(() => {
        const url = new URL(window.location.href)

        url.searchParams.delete('isolated')
        window.location.href = url.toString()
      }, 0)
    }
  }, [embedSrc, exitGame, isPsp])

  return (
    <main ref={playerRef} className={`game-play-screen bg-black ${inline === '1' ? 'game-play-screen-inline' : ''}`}>
      <div className="absolute left-2 top-2 z-30 flex items-center gap-2 sm:left-3 sm:top-3">
      <button
        aria-label={labels.exitGame}
        className="game-play-exit inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-1 text-xs font-semibold text-white opacity-20 backdrop-blur-sm transition hover:bg-black/80 hover:opacity-100 focus-visible:bg-black/80 focus-visible:opacity-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        onClick={exitGame}
        type="button"
      >
        <i className="ri-logout-box-r-line text-sm sm:text-lg" />
        {labels.exitGame}
      </button>
      <button type="button" onClick={toggleFullscreen} aria-label={fullscreenLabel} title={fullscreenLabel} className="game-play-exit inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-1 text-xs font-semibold text-white opacity-20 backdrop-blur-sm transition hover:bg-black/80 hover:opacity-100 focus-visible:bg-black/80 focus-visible:opacity-100 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm">
        <i className={`${isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-sm sm:text-lg`} />
        {fullscreenLabel}
      </button>
      </div>
      {isMahjongCoinChargeGame ? (
        <div className="fixed right-2 top-2 z-50 rounded-full bg-black/55 p-1 shadow-lg backdrop-blur-sm sm:right-3 sm:top-3">
          <HomeCoinBag balance={globalCoins.balance} lang={lang} onOpen={globalCoins.showBalance} />
        </div>
      ) : null}
      <p
        aria-live="polite"
        className="game-loading-notice pointer-events-none absolute left-1/2 top-12 z-20 w-[min(90%,42rem)] -translate-x-1/2 text-center text-sm font-medium text-white/85 drop-shadow-md sm:top-16 sm:text-base"
      >
        {labels.loadingNotice}
      </p>
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
      {showLoadingTrial ? (
        <section
          aria-label={`等待游戏加载时试玩${trialGame === 'ghost' ? '幽灵捕手' : '金币娱乐'}`}
          className="fixed right-2 top-16 z-40 w-[min(92vw,520px)] overflow-visible rounded-xl border border-white/25 bg-black shadow-2xl"
          role="region"
          style={{
            height: 'min(78dvh, calc(92vw + 164px), 684px)',
            ...(trialPosition ? { left: trialPosition.x, top: trialPosition.y, right: 'auto' } : {}),
          }}
        >
          <button
            aria-label="关闭等待试玩游戏"
            className="absolute -right-3 -top-3 z-10 grid size-8 place-items-center rounded-full border border-white/30 bg-zinc-900 text-white shadow-lg hover:bg-red-600"
            onClick={() => setShowLoadingTrial(false)}
            title="进入主游戏"
            type="button"
          ><i className="ri-close-line" /></button>
          <iframe
            className="h-full w-full rounded-xl border-0 bg-black"
            onLoad={event => {
              const frame = event.currentTarget
              const doc = frame.contentDocument
              if (!doc || trialDragDocuments.has(doc)) return
              trialDragDocuments.add(doc)
              const globalPoint = (pointer: globalThis.PointerEvent) => {
                const rect = frame.getBoundingClientRect()
                return { x: rect.left + pointer.clientX, y: rect.top + pointer.clientY }
              }
              doc.addEventListener('pointerdown', pointer => {
                const target = pointer.target as HTMLElement | null
                if (target?.closest('button, [role="button"]')) return
                const windowRect = frame.parentElement?.getBoundingClientRect()
                if (!windowRect) return
                const point = globalPoint(pointer)
                target?.setPointerCapture?.(pointer.pointerId)
                trialDragRef.current = {
                  offsetX: point.x - windowRect.left,
                  offsetY: point.y - windowRect.top,
                  width: windowRect.width,
                  height: windowRect.height,
                }
                pointer.preventDefault()
              })
              doc.addEventListener('pointermove', pointer => {
                const drag = trialDragRef.current
                if (!drag) return
                const point = globalPoint(pointer)
                setTrialPosition({
                  x: Math.max(0, Math.min(window.innerWidth - drag.width, point.x - drag.offsetX)),
                  y: Math.max(0, Math.min(window.innerHeight - drag.height, point.y - drag.offsetY)),
                })
              })
              const stopDragging = () => { trialDragRef.current = null }
              doc.addEventListener('pointerup', stopDragging)
              doc.addEventListener('pointercancel', stopDragging)
            }}
            src={trialGame === 'ghost'
              ? `/${lang}/ghost-hunter?embed=1&trialLayout=3`
              : `/${lang}/coin-challenge?embed=1`}
            title={`${trialGame === 'ghost' ? '幽灵捕手' : '金币娱乐'}试玩`}
          />
        </section>
      ) : null}
      {showRecommendations ? (
        <GameExitRecommendations
          gameId={gameId}
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
      {returnPending ? <div className="fixed inset-0 z-40 bg-black/70" role="status"><p className="absolute inset-x-0 bottom-12 text-center text-sm text-white">{lang === 'en' ? 'Settlement complete. Returning…' : '金币已结算，正在返回 PRO 主页…'}</p></div> : null}
    </main>
  )
}

type GameSessionSettlement = {
  coins: number
  deducted: boolean
  multiplier: number
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
          src="/images/coin-rewards/pixel-reward-coin.webp"
        />
        <div className="whitespace-nowrap">
          <p className="text-xs text-white/60">{settlement.deducted ? labels.sessionCharge : labels.sessionSettlement}</p>
          <p className={`mt-0.5 text-xl font-black ${settlement.deducted ? 'text-orange-300' : 'text-yellow-300'}`}>
            {settlement.deducted ? '-' : '+'}{settlement.coins} {labels.coins}
            {!settlement.deducted && settlement.multiplier > 1 ? <span className="ml-2 text-sm">×{settlement.multiplier}</span> : null}
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
  gameId,
  games,
  labels,
  lang,
  onContinue,
  recommendationType,
}: {
  gameId: string
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
              {games.map((game, index) => {
                const id = game.url_slug?.trim() || game._id?.trim()

                return id ? (
                  <Link
                    className={`group min-w-0 ${index >= 4 ? 'hidden lg:block' : ''}`}
                    key={id}
                    params={{ gameId: id, locale: lang }}
                    search={{}}
                    to="/$locale/games/$gameId"
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
              params={{ gameId, locale: lang }}
              search={{}}
              to="/$locale/games/$gameId"
            >
              {labels.exitAndReturn}
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
  return addCoinReward(amount).awarded
}

function getRecommendationLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      exitAndReturn: '退出返回',
      categoryTitle: '再玩一款同类型游戏',
      coins: '金币',
      continueGame: '继续游戏',
      empty: '暂时没有找到同系列游戏，可以返回首页继续挑选。',
      exitGame: '退出游戏',
      finished: '本局结束了吗？',
      game: '经典游戏',
      loadingNotice: '游戏加载速度跟你的设备和网速有关，请耐心等待',
      playNow: '立即游玩',
      playedMinutes: '本局游玩 {minutes} 分钟',
      mahjongCoinsDepleted: '金币已经用完，游戏已自动关闭。',
      sessionCharge: '街机麻将游玩扣币',
      sessionSettlement: '本局金币结算',
      title: '再玩一款同系列游戏',
    }
  }

  if (locale === 'zh-TW') {
    return {
      exitAndReturn: '退出返回',
      categoryTitle: '再玩一款同類型遊戲',
      coins: '金幣',
      continueGame: '繼續遊戲',
      empty: '暫時沒有找到同系列遊戲，可以返回首頁繼續挑選。',
      exitGame: '退出遊戲',
      finished: '本局結束了嗎？',
      game: '經典遊戲',
      loadingNotice: '遊戲載入速度與您的裝置及網路速度有關，請耐心等候',
      playNow: '立即遊玩',
      playedMinutes: '本局遊玩 {minutes} 分鐘',
      mahjongCoinsDepleted: '金幣已經用完，遊戲已自動關閉。',
      sessionCharge: '街機麻將遊玩扣幣',
      sessionSettlement: '本局金幣結算',
      title: '再玩一款同系列遊戲',
    }
  }

  if (locale === 'ja') {
    return {
      exitAndReturn: '終了して戻る',
      categoryTitle: '同じジャンルのゲーム',
      coins: 'コイン',
      continueGame: 'ゲームを続ける',
      empty: '同じシリーズのゲームが見つかりません。ホームでほかのゲームを探せます。',
      exitGame: 'ゲームを終了',
      finished: 'プレイを終了しますか？',
      game: 'クラシックゲーム',
      loadingNotice: 'ゲームの読み込み速度は端末と通信環境によって異なります。しばらくお待ちください',
      playNow: '今すぐプレイ',
      playedMinutes: '今回のプレイ：{minutes}分',
      mahjongCoinsDepleted: 'コインがなくなったため、ゲームを終了しました。',
      sessionCharge: 'アーケード麻雀のコイン消費',
      sessionSettlement: 'コイン精算',
      title: '同じシリーズのゲーム',
    }
  }

  return {
    exitAndReturn: 'Exit and return',
    categoryTitle: 'Play another game in this genre',
    coins: 'coins',
    continueGame: 'Continue playing',
    empty: 'No games from the same series were found. Return home to browse more games.',
    exitGame: 'Exit game',
    finished: 'Finished this round?',
    game: 'Classic game',
    loadingNotice: 'Loading speed depends on your device and connection. Please wait patiently.',
    playNow: 'Play now',
    playedMinutes: 'Played {minutes} minutes this session',
    mahjongCoinsDepleted: 'You are out of coins. The game has been closed.',
    sessionCharge: 'Arcade Mahjong coin charge',
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
