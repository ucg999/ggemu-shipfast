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
import { getI18n } from '#/lib/i18n'
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
  const [challengeCompleted, setChallengeCompleted] = useState(false)
  const [streakDays, setStreakDays] = useState(0)
  const loadRandomGame = useServerFn(getRandomPlayableGame)
  const loadGameDetail = useServerFn(getGameDetail)
  const recentPlayedGames = useRecentPlayedGames()

  useEffect(() => {
    setRandomVideoGames(selectDailyVideoGames(mostPlayedGames, 6))
  }, [mostPlayedGames])

  useEffect(() => {
    const progress = readDailyChallengeProgress()
    setChallengeCompleted(progress.completedToday)
    setStreakDays(progress.streak)
  }, [])

  async function showOneRandomGame() {
    if (isRandomGameLoading) return

    setIsRandomGameLoading(true)

    try {
      const randomGame = await loadRandomGame({ data: {} })
      const gameId = randomGame?.url_slug?.trim() || randomGame?._id?.trim()

      if (gameId) {
        const game = await loadGameDetail({ data: { id: gameId } })
        setRandomPopupGame(game)
        const progress = completeDailyChallenge()
        setChallengeCompleted(true)
        setStreakDays(progress.streak)
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
          challengeCompleted={challengeCompleted}
          games={randomVideoGames}
          isRandomGameLoading={isRandomGameLoading}
          lang={lang}
          onRandomGame={showOneRandomGame}
          streakDays={streakDays}
        />
      </div>

      <nav
        aria-label={t.platformNavigation}
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
            {t.homeRecommendations}
          </button>
          <RankingButton
            active={filters.sort === 'weekly' && !filters.platform && !filters.category && !filters.query}
            label={t.weeklyPopularGames}
            onClick={() => onFilterChange('sort', 'weekly')}
          />
          <RankingButton
            active={filters.sort === 'rising' && !filters.platform && !filters.category && !filters.query}
            label={t.fastestGrowingGames}
            onClick={() => onFilterChange('sort', 'rising')}
          />

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
        aria-label={t.mobilePlatformNavigation}
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
            {t.recentlyPlayed}
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
            {t.homeRecommendations}
          </button>
          <RankingButton
            active={!showMobileRecent && filters.sort === 'weekly'}
            label={t.weeklyPopularGames}
            mobile
            onClick={() => {
              setShowMobileRecent(false)
              onFilterChange('sort', 'weekly')
            }}
          />
          <RankingButton
            active={!showMobileRecent && filters.sort === 'rising'}
            label={t.fastestGrowingGames}
            mobile
            onClick={() => {
              setShowMobileRecent(false)
              onFilterChange('sort', 'rising')
            }}
          />
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
          challengeCompleted={challengeCompleted}
          games={randomVideoGames}
          isRandomGameLoading={isRandomGameLoading}
          lang={lang}
          mobile
          onRandomGame={showOneRandomGame}
          streakDays={streakDays}
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

function RankingButton({
  active,
  label,
  mobile = false,
  onClick,
}: {
  active: boolean
  label: string
  mobile?: boolean
  onClick: () => void
}) {
  return (
    <button
      className={`btn shrink-0 rounded-full border-0 ${mobile ? 'btn-xs px-3' : 'btn-sm px-4'} ${
        active ? 'bg-base-content text-base-100' : 'btn-ghost text-base-content/65'
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  )
}

const DAILY_CHALLENGE_STORAGE_KEY = 'game-adventure-daily-challenge'

type DailyChallengeProgress = {
  completedToday: boolean
  lastCompletedDate: string
  streak: number
}

function readDailyChallengeProgress(): DailyChallengeProgress {
  const today = getLocalDateKey(new Date())

  try {
    const stored = window.localStorage.getItem(DAILY_CHALLENGE_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as Partial<DailyChallengeProgress>) : null
    return {
      completedToday: parsed?.lastCompletedDate === today,
      lastCompletedDate: parsed?.lastCompletedDate ?? '',
      streak: Math.max(0, Number(parsed?.streak) || 0),
    }
  } catch {
    return { completedToday: false, lastCompletedDate: '', streak: 0 }
  }
}

function completeDailyChallenge(): DailyChallengeProgress {
  const current = readDailyChallengeProgress()
  if (current.completedToday) return current

  const now = new Date()
  const today = getLocalDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const streak = current.lastCompletedDate === getLocalDateKey(yesterday) ? current.streak + 1 : 1
  const next = { completedToday: true, lastCompletedDate: today, streak }

  try {
    window.localStorage.setItem(DAILY_CHALLENGE_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The challenge still works for the current visit when storage is unavailable.
  }

  return next
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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
  const t = getI18n(lang).home

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/65 p-4" role="presentation" onClick={onClose}>
      <section
        aria-label={t.randomGame}
        aria-modal="true"
        className="w-full max-w-md overflow-hidden rounded-2xl bg-base-100 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <figure className="relative aspect-[4/3] bg-base-200">
          {game.game_cover ? (
            <img alt={game.name ?? t.randomGame} className="h-full w-full object-cover" src={game.game_cover} />
          ) : null}
          {game.platform ? (
            <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
              {getPlatformLabel(game.platform, lang)}
            </span>
          ) : null}
          <button aria-label={t.close} className="btn btn-circle btn-sm absolute right-3 top-3" onClick={onClose} type="button">✕</button>
        </figure>
        <div className="p-4">
          <h3 className="truncate text-xl font-semibold">{game.name}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-warning" onClick={onRandomAgain} type="button">{t.randomAgain}</button>
            <Link className="btn btn-primary" params={{ gameId, locale: lang }} search={{}} to="/$locale/games/$gameId">{t.playNow}</Link>
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
  const t = getI18n(lang).home

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
          {t.superEmulator}
        </Link>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-gift-line" />
            </span>
            <span className="flex-1">{t.usefulResources}</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <ul className="menu menu-sm ml-11">
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG" rel="noreferrer" target="_blank">
                {t.pspLibrary}
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/RclPTyXd" rel="noreferrer" target="_blank">
                {t.psvLibrary}
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/detUdefK" rel="noreferrer" target="_blank">
                {t.switchLibrary}
              </a>
            </li>
            <li>
              <a
                href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                rel="noreferrer"
                target="_blank"
              >
                {t.arcadeLibrary}
              </a>
            </li>
            <li>
              <a href="https://kdocs.cn/l/cqE4v1WZxdnc" rel="noreferrer" target="_blank">
                {t.popularGameLibrary}
              </a>
            </li>
          </ul>
        </details>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-user-add-line" />
            </span>
            <span className="flex-1">{t.findFriends}</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <div className="ml-11 grid grid-cols-2 gap-3 p-2">
            <details className="rounded-xl bg-base-200 p-2">
              <summary className="cursor-pointer list-none text-center text-sm font-medium">
                <i className="ri-wechat-fill mr-1 text-[#07c160]" />
                {t.wechat}
              </summary>
              <img
                alt={t.wechatQrAlt}
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
                alt={t.qqQrAlt}
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
