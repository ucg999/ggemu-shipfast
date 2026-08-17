import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import { SiteLayout } from '#/components/site-layout'
import { type GameSearchSort, type Locale, type PublicGame, searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const RANKINGS = {
  latest: 'newest',
  popular: 'popular',
  weekly: 'weekly',
  rising: 'rising',
} as const satisfies Record<string, GameSearchSort>

type RankingId = keyof typeof RANKINGS

export const Route = createFileRoute('/$locale/rankings/$rankingId')({
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const rankingId = normalizeRankingId(params.rankingId)
    if (!rankingId) throw redirect({ params: { locale }, to: '/$locale' })

    const [result, seoOrigin] = await Promise.all([
      searchGames({
        data: {
          category: '',
          limit: 100,
          locale,
          page: 1,
          platform: '',
          query: '',
          sort: RANKINGS[rankingId],
        },
      }),
      getSeoOrigin(),
    ])

    return { games: result.games, rankingId, seoOrigin }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const rankingId = loaderData?.rankingId ?? 'popular'
    const copy = getRankingCopy(locale, rankingId)

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: `/rankings/${rankingId}`,
          })
        : undefined,
      meta: [
        { title: copy.seoTitle },
        { name: 'description', content: copy.description },
      ],
    }
  },
  component: RankingPage,
})

function RankingPage() {
  const { games, rankingId } = Route.useLoaderData()
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const copy = getRankingCopy(lang, rankingId)

  return (
    <SiteLayout locale={lang}>
      <header className="border-b border-base-300 bg-base-100 px-4 py-8 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Ranking</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">{copy.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-base-content/65">{copy.description}</p>
      </header>

      <main className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:p-5 lg:grid-cols-5 xl:grid-cols-7">
        {games.map((game, index) => (
          <RankingGameCard game={game} index={index} key={game.url_slug || game._id} lang={lang} />
        ))}
      </main>
    </SiteLayout>
  )
}

function RankingGameCard({ game, index, lang }: { game: PublicGame; index: number; lang: Locale }) {
  const gameId = game.url_slug?.trim() || game._id?.trim() || ''

  return (
    <Link className="group min-w-0" params={{ gameId, locale: lang }} search={{}} to="/$locale/games/$gameId">
      <figure className="relative aspect-[4/3] overflow-hidden rounded-md bg-base-200">
        {game.game_cover ? (
          <img alt={game.name ?? ''} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" src={game.game_cover} />
        ) : null}
        <span className="absolute left-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-black/75 px-2 text-xs font-bold text-white">
          {index + 1}
        </span>
        {game.platform ? (
          <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
            {getPlatformLabel(game.platform, lang)}
          </span>
        ) : null}
      </figure>
      <h2 className="mt-1.5 truncate text-sm font-medium text-base-content">{game.name}</h2>
    </Link>
  )
}

function normalizeRankingId(value: string): RankingId | undefined {
  return value in RANKINGS ? (value as RankingId) : undefined
}

function getRankingCopy(locale: Locale, rankingId: RankingId) {
  const labels = getI18n(locale).layout
  const copy = {
    'zh-CN': {
      latest: ['最新游戏', '查看最近加入游戏历险记、可以直接在线游玩的经典游戏。'],
      popular: ['最火游戏', '按照累计游玩热度排列，快速发现最受玩家欢迎的经典游戏。'],
      weekly: ['本周热门', '结合本周互动变化与玩家热度，每周更新值得关注的游戏。'],
      rising: ['增长最快', '根据近期游玩转化与互动增长表现，发现正在快速升温的游戏。'],
    },
    'zh-TW': {
      latest: ['最新遊戲', '查看最近加入遊戲歷險記、可以直接線上遊玩的經典遊戲。'],
      popular: ['最熱門遊戲', '依累計遊玩熱度排列，快速發現最受玩家歡迎的經典遊戲。'],
      weekly: ['本週熱門', '結合本週互動變化與玩家熱度，每週更新值得關注的遊戲。'],
      rising: ['成長最快', '依近期遊玩轉換與互動成長表現，發現正在快速升溫的遊戲。'],
    },
    en: {
      latest: ['Latest Games', 'Explore the newest playable classic games added to Game Adventure.'],
      popular: ['Popular Games', 'Discover the classic games with the highest all-time player activity.'],
      weekly: ['Popular This Week', 'A weekly view combining fresh interaction signals and current player interest.'],
      rising: ['Fastest Rising', 'Find games gaining momentum through strong play conversion and engagement.'],
    },
    ja: {
      latest: ['最新ゲーム', 'ゲームアドベンチャーに最近追加された、オンラインで遊べる名作ゲームです。'],
      popular: ['人気ゲーム', '累計プレイ人気順で、最も遊ばれている名作ゲームを探せます。'],
      weekly: ['今週の人気', '今週の反応とプレイヤー人気を組み合わせ、注目ゲームを毎週更新します。'],
      rising: ['急上昇', 'プレイ率と反応の伸びから、人気が急上昇しているゲームを紹介します。'],
    },
  }[locale][rankingId]
  const fallbackTitle = rankingId === 'latest' ? labels.latestGames : rankingId === 'popular' ? labels.mostPopularGames : rankingId === 'weekly' ? labels.weeklyPopularGames : labels.fastestGrowingGames

  return {
    description: copy[1],
    seoTitle: `${copy[0] || fallbackTitle} | ${labels.siteName}`,
    title: copy[0] || fallbackTitle,
  }
}
