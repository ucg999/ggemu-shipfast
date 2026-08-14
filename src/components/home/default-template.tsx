import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  GamesSection,
  HomeFaqSection,
  HomeLatestGamesRow,
  HomeLatestBlogPostsSection,
  HomeMostPlayedGamesSection,
} from './shared'
import {
  PopularGameCollections,
  RecentPlayedGamesSection,
  useRecentPlayedGames,
} from './recent-played-games'
import type { HomeTemplateProps } from './types'
import type { PublicGame } from '#/lib/ggemu'
import { getGameDetail, getRandomPlayableGame } from '#/lib/ggemu'
import { getPlatformLabel } from '#/lib/platform-label'
import { useServerFn } from '@tanstack/react-start'

export function DefaultHomeTemplate(props: HomeTemplateProps) {
  const {
    filterOptions,
    filters,
    lang,
    latestBlogPosts,
    latestGames,
    mostPlayedGames,
    onFilterChange,
    onHomeRecommendations,
    t,
  } = props
  const [showMobileRecent, setShowMobileRecent] = useState(false)
  const [randomVideoGames, setRandomVideoGames] = useState(() =>
    mostPlayedGames.slice(0, 6),
  )
  const [randomPopupGame, setRandomPopupGame] = useState<PublicGame | null>(null)
  const [isRandomGameLoading, setIsRandomGameLoading] = useState(false)
  const loadRandomGame = useServerFn(getRandomPlayableGame)
  const loadGameDetail = useServerFn(getGameDetail)
  const recentPlayedGames = useRecentPlayedGames()

  useEffect(() => {
    setRandomVideoGames(selectDailyVideoGames(mostPlayedGames, 6))
  }, [mostPlayedGames])

  async function showOneRandomGame() {
    if (isRandomGameLoading) return

    setIsRandomGameLoading(true)

    try {
      const randomGame = await loadRandomGame({ data: {} })
      const gameId = randomGame?.url_slug?.trim() || randomGame?._id?.trim()

      if (gameId) {
        const game = await loadGameDetail({ data: { id: gameId } })
        setRandomPopupGame(game)
      }
    } finally {
      setIsRandomGameLoading(false)
    }
  }
  const mobileRecentGames = recentPlayedGames.map((game) => ({
    _id: game.id,
    game_cover: game.cover,
    name: game.name,
    url_slug: game.id,
  }))
  const mobileRecentPagination = {
    limit: Math.max(mobileRecentGames.length, 1),
    page: 1,
    pages: 1,
    total: mobileRecentGames.length,
  }
  const orderedPlatforms = orderHomePlatforms(filterOptions.platforms)
  return (
    <>
      <section className="hidden bg-base-100 lg:block">
        <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-fit">
            <h1 className="rainbow-title hidden whitespace-nowrap text-[clamp(2rem,3.7vw,4rem)] font-bold leading-tight sm:block">
              {t.title}
            </h1>
            <p className="mt-3 hidden text-center text-lg font-medium text-base-content/65 sm:block lg:text-xl">
              {t.nostalgiaSubtitle}
            </p>
          </div>
        </div>
      </section>

      <div className="hidden lg:block">
        <HomeMostPlayedGamesSection
          games={randomVideoGames}
          isRandomGameLoading={isRandomGameLoading}
          lang={lang}
          onRandomGame={showOneRandomGame}
        />
      </div>

      <nav
        aria-label="游戏平台导航"
        className="hidden border-y border-base-300 bg-base-100 px-4 sm:px-6 lg:block lg:px-8"
      >
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          <button
            className={`btn btn-sm shrink-0 rounded-full border-0 px-4 ${
              filters.platform ||
              filters.category ||
              filters.query ||
              filters.sort !== 'popular'
                ? 'btn-ghost text-base-content/65'
                : 'bg-base-content text-base-100'
            }`}
            onClick={onHomeRecommendations}
            type="button"
          >
            首页推荐
          </button>

          {orderedPlatforms.map((platform) => {
            const isActive = filters.platform === platform.name

            return (
              <button
                className={`btn btn-sm shrink-0 rounded-full border-0 px-4 ${
                  isActive
                    ? 'bg-base-content text-base-100'
                    : 'btn-ghost text-base-content/65'
                }`}
                key={platform.name}
                onClick={() => onFilterChange('platform', platform.name)}
                type="button"
              >
                {getPlatformLabel(platform.name, lang)}
              </button>
            )
          })}
        </div>
      </nav>

      <nav
        aria-label="手机端游戏平台导航"
        className="border-y border-base-300 bg-base-100 px-1 lg:hidden"
      >
        <div className="flex items-center gap-1 overflow-x-auto py-1.5">
          <button
            className={`btn btn-xs shrink-0 rounded-full border-0 px-3 ${
              showMobileRecent
                ? 'bg-base-content text-base-100'
                : 'btn-ghost text-base-content/65'
            }`}
            onClick={() => setShowMobileRecent(true)}
            type="button"
          >
            最近玩过
          </button>
          <button
            className={`btn btn-xs shrink-0 rounded-full border-0 px-3 ${
              showMobileRecent ||
              filters.platform ||
              filters.category ||
              filters.query ||
              filters.sort !== 'popular'
                ? 'btn-ghost text-base-content/65'
                : 'bg-base-content text-base-100'
            }`}
            onClick={() => {
              setShowMobileRecent(false)
              onHomeRecommendations()
            }}
            type="button"
          >
            首页推荐
          </button>
          {orderedPlatforms.map((platform) => {
            const isActive = filters.platform === platform.name

            return (
              <button
                className={`btn btn-xs shrink-0 rounded-full border-0 px-3 ${
                  isActive
                    ? 'bg-base-content text-base-100'
                    : 'btn-ghost text-base-content/65'
                }`}
                key={platform.name}
                onClick={() => {
                  setShowMobileRecent(false)
                  onFilterChange('platform', platform.name)
                }}
                type="button"
              >
                {getPlatformLabel(platform.name, lang)}
              </button>
            )
          })}
        </div>
      </nav>

      <div className="lg:hidden">
        <HomeMostPlayedGamesSection
          games={randomVideoGames}
          isRandomGameLoading={isRandomGameLoading}
          lang={lang}
          mobile
          onRandomGame={showOneRandomGame}
        />
      </div>

      <div className="lg:hidden">
        <GamesSection
          {...props}
          games={showMobileRecent ? mobileRecentGames : props.games}
          gridClassName="game-mosaic-grid grid grid-flow-dense grid-cols-12 gap-1 sm:grid-cols-12"
          mobileItemLimit={36}
          page={showMobileRecent ? 1 : props.page}
          pages={showMobileRecent ? 1 : props.pages}
          pagination={
            showMobileRecent ? mobileRecentPagination : props.pagination
          }
          sectionClassName="flex w-full flex-col gap-3 p-1"
          showHeader={false}
        />
      </div>

      <div className="hidden lg:block">
        <GamesSection
          {...props}
          games={props.games}
          gridClassName="game-mosaic-grid grid grid-flow-dense grid-cols-7 gap-2"
          page={props.page}
          pages={props.pages}
          pagination={props.pagination}
          sectionClassName="flex w-full flex-col gap-3 px-3 py-3"
          showHeader={false}
        />
        <HomeLatestGamesRow games={latestGames} lang={lang} />
      </div>

      <section className="px-3 pb-5 pt-4 lg:hidden">
        <PopularGameCollections lang={lang} />
      </section>

      <div className="hidden lg:block">
        <RecentPlayedGamesSection lang={lang} />
        <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
        <HomeFaqSection lang={lang} />
      </div>

      {randomPopupGame ? (
        <RandomGameModal
          game={randomPopupGame}
          lang={lang}
          onClose={() => setRandomPopupGame(null)}
          onRandomAgain={showOneRandomGame}
        />
      ) : null}
    </>
  )
}

function RandomGameModal({
  game,
  lang,
  onClose,
  onRandomAgain,
}: {
  game: PublicGame
  lang: HomeTemplateProps['lang']
  onClose: () => void
  onRandomAgain: () => void | Promise<void>
}) {
  const gameId = getGameId(game)

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" role="presentation" onClick={onClose}>
      <section
        aria-label="随机游戏"
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-base-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <figure className="relative aspect-[4/3] bg-base-200">
          {game.game_cover ? (
            <img alt={game.name ?? '随机游戏'} className="h-full w-full object-cover" src={game.game_cover} />
          ) : null}
          {game.platform ? (
            <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
              {getPlatformLabel(game.platform, lang)}
            </span>
          ) : null}
          <button aria-label="关闭" className="btn btn-circle btn-sm absolute right-3 top-3" onClick={onClose} type="button">✕</button>
        </figure>
        <div className="p-4">
          <h3 className="truncate text-xl font-semibold">{game.name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-warning" onClick={onRandomAgain} type="button">再摇一次</button>
            <Link className="btn btn-primary" params={{ gameId, locale: lang }} search={{}} to="/$locale/games/$gameId">立即游玩</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function selectDailyVideoGames(games: Array<PublicGame>, limit: number) {
  const today = new Date()
  const dailyKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`

  return [...games]
    .sort(
      (left, right) =>
        dailyGameScore(`${dailyKey}:${getGameId(left)}`) -
        dailyGameScore(`${dailyKey}:${getGameId(right)}`),
    )
    .slice(0, limit)
}

function dailyGameScore(value: string) {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function getGameId(game: PublicGame) {
  return game.url_slug?.trim() || game._id?.trim() || ''
}

function orderHomePlatforms<T extends { name: string }>(platforms: Array<T>) {
  const normalizedName = (platform: T) => platform.name.trim().toLowerCase()
  const byName = new Map(platforms.map((platform) => [normalizedName(platform), platform]))
  const arcade = byName.get('arcade')
  const famicom = byName.get('famicom')
  const gba = byName.get('game boy advance')
  const atari = byName.get('atari jaguar')
  const movedNames = new Set(
    [arcade, famicom, gba, atari]
      .filter((platform): platform is T => Boolean(platform))
      .map(normalizedName),
  )
  const remaining = platforms.filter(
    (platform) => !movedNames.has(normalizedName(platform)),
  )
  const arcadeIndex = arcade
    ? platforms.findIndex((platform) => normalizedName(platform) === 'arcade')
    : -1
  const insertionIndex =
    arcadeIndex >= 0
      ? platforms
          .slice(0, arcadeIndex)
          .filter((platform) => !movedNames.has(normalizedName(platform))).length
      : 0

  remaining.splice(
    insertionIndex,
    0,
    ...[arcade, famicom, gba].filter(
      (platform): platform is T => Boolean(platform),
    ),
  )

  if (atari) {
    remaining.push(atari)
  }

  return remaining
}

function MobileQuickLinks({ lang }: { lang: HomeTemplateProps['lang'] }) {
  return (
    <section className="px-4 pb-4 sm:px-6 lg:hidden">
      <div className="rounded-2xl bg-base-100 p-3">
        <Link
          className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200"
          params={{ locale: lang }}
          search={{}}
          to="/$locale/play-my-rom"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
            <i className="ri-cpu-line" />
          </span>
          超级模拟器
        </Link>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-gift-line" />
            </span>
            <span className="flex-1">拿点有用的</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <ul className="menu menu-sm ml-11">
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG" rel="noreferrer" target="_blank">
                PSP游戏库
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/RclPTyXd" rel="noreferrer" target="_blank">
                PSV游戏库
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/detUdefK" rel="noreferrer" target="_blank">
                Switch游戏库
              </a>
            </li>
            <li>
              <a
                href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                rel="noreferrer"
                target="_blank"
              >
                街机库
              </a>
            </li>
            <li>
              <a href="https://kdocs.cn/l/cqE4v1WZxdnc" rel="noreferrer" target="_blank">
                热门游戏合集
              </a>
            </li>
          </ul>
        </details>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-user-add-line" />
            </span>
            <span className="flex-1">找点新朋友</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <div className="ml-11 grid grid-cols-2 gap-3 p-2">
            <details className="rounded-xl bg-base-200 p-2">
              <summary className="cursor-pointer list-none text-center text-sm font-medium">
                <i className="ri-wechat-fill mr-1 text-[#07c160]" />
                微信
              </summary>
              <img
                alt="游戏历险记微信二维码"
                className="mt-2 w-full rounded-lg bg-white object-contain"
                src="/wechat-qr.png"
              />
            </details>
            <details className="rounded-xl bg-base-200 p-2">
              <summary className="cursor-pointer list-none text-center text-sm font-medium">
                <i className="ri-qq-fill mr-1" />
                QQ
              </summary>
              <img
                alt="游戏历险记QQ二维码"
                className="mt-2 w-full rounded-lg object-contain"
                src="/qq-qr.jpg"
              />
            </details>
          </div>
        </details>
      </div>
    </section>
  )
}
