import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { getGameDetail, searchGames, type Locale, type PublicGame } from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { siteConfig } from '#/lib/site-config'
import { useCurrentSiteTheme } from '#/lib/use-site-theme'

const pspCrossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Permissions-Policy': 'cross-origin-isolated=(self "https://ggemu.com")',
} as const

const noindexHeaders = {
  'X-Robots-Tag': 'noindex, nofollow',
} as const

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
  const labels = useMemo(() => getRecommendationLabels(lang), [lang])

  useEffect(() => {
    const embedOrigin = new URL(embedSrc).origin
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== embedOrigin || !isGameExitMessage(event.data)) {
        return
      }

      setShowRecommendations(true)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRecommendations(true)
      }
    }

    window.addEventListener('message', handleMessage)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('message', handleMessage)
      window.removeEventListener('keydown', handleKeyDown)

      if (!isPsp || !window.crossOriginIsolated) {
        return
      }

      window.setTimeout(() => {
        const url = new URL(window.location.href)

        url.searchParams.delete('isolated')
        window.location.href = url.toString()
      }, 0)
    }
  }, [embedSrc, isPsp])

  return (
    <main className="game-play-screen bg-black">
      <button
        aria-label={labels.exitGame}
        className="game-play-exit fixed left-2 top-2 z-30 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/90 sm:left-3 sm:top-3 sm:gap-2 sm:px-4 sm:py-2 sm:text-sm"
        onClick={() => setShowRecommendations(true)}
        type="button"
      >
        <i className="ri-logout-box-r-line text-sm sm:text-lg" />
        {labels.exitGame}
      </button>
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
          onContinue={() => setShowRecommendations(false)}
          recommendationType={recommendationType}
        />
      ) : null}
    </main>
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
                    params={{ gameId: id, locale: lang }}
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

function getRecommendationLabels(locale: Locale) {
  if (locale === 'zh-CN') {
    return {
      backToHome: '退出并返回首页',
      categoryTitle: '再玩一款同类型游戏',
      continueGame: '继续游戏',
      empty: '暂时没有找到同系列游戏，可以返回首页继续挑选。',
      exitGame: '退出游戏',
      finished: '本局结束了吗？',
      game: '经典游戏',
      playNow: '立即游玩',
      title: '再玩一款同系列游戏',
    }
  }

  if (locale === 'zh-TW') {
    return {
      backToHome: '退出並返回首頁',
      categoryTitle: '再玩一款同類型遊戲',
      continueGame: '繼續遊戲',
      empty: '暫時沒有找到同系列遊戲，可以返回首頁繼續挑選。',
      exitGame: '退出遊戲',
      finished: '本局結束了嗎？',
      game: '經典遊戲',
      playNow: '立即遊玩',
      title: '再玩一款同系列遊戲',
    }
  }

  if (locale === 'ja') {
    return {
      backToHome: '終了してホームへ戻る',
      categoryTitle: '同じジャンルのゲーム',
      continueGame: 'ゲームを続ける',
      empty: '同じシリーズのゲームが見つかりません。ホームでほかのゲームを探せます。',
      exitGame: 'ゲームを終了',
      finished: 'プレイを終了しますか？',
      game: 'クラシックゲーム',
      playNow: '今すぐプレイ',
      title: '同じシリーズのゲーム',
    }
  }

  return {
    backToHome: 'Exit to home',
    categoryTitle: 'Play another game in this genre',
    continueGame: 'Continue playing',
    empty: 'No games from the same series were found. Return home to browse more games.',
    exitGame: 'Exit game',
    finished: 'Finished this round?',
    game: 'Classic game',
    playNow: 'Play now',
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
