import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'

import {
  GamesSection,
  HomeFaqSection,
  HomeLatestGamesRow,
  HomeLatestBlogPostsSection,
  HomeMostPlayedGamesSection,
} from './shared'
import {
  PopularGameCollections,
  RecentPlayedHeaderPanel,
  useRecentPlayedGames,
} from './recent-played-games'
import type { HomeTemplateProps } from './types'
import type { PublicGame } from '#/lib/ggemu'
import { getGameDetail, getRandomPlayableGame } from '#/lib/ggemu'
import { getI18n } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { setDailyGameCoinMultiplier } from '#/lib/coin-wallet'
import { confirmResourceDownload, unlockPaidResource } from '#/lib/paid-resource'
import { useServerFn } from '@tanstack/react-start'

export function DefaultHomeTemplate(
  props: HomeTemplateProps & { onCoinsEarned?: (amount: number) => void },
) {
  const {
    filterOptions,
    filters,
    lang,
    latestBlogPosts,
    latestGames,
    mostPlayedGames,
    onFilterChange,
    onHomeRecommendations,
    onCoinsEarned,
    t,
  } = props
  const [showMobileRecent, setShowMobileRecent] = useState(false)
  const [randomVideoGames, setRandomVideoGames] = useState(() =>
    mostPlayedGames.slice(0, 6),
  )
  const [randomPopupGame, setRandomPopupGame] = useState<PublicGame | null>(null)
  const [randomPopupMultiplier, setRandomPopupMultiplier] = useState(2)
  const [isRandomGameLoading, setIsRandomGameLoading] = useState(false)
  const [challengeCompleted, setChallengeCompleted] = useState(false)
  const [challengeReward, setChallengeReward] = useState(10)
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
    setChallengeReward(getDailyChallengeReward(progress))
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
        setRandomPopupMultiplier(pickWeightedRandomCoinMultiplier())
        const progress = completeDailyChallenge()
        if (progress.newlyCompleted) {
          onCoinsEarned?.(progress.streak * 10)
        }
        setChallengeCompleted(true)
        setChallengeReward(progress.streak * 10)
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
  const mobileModeLabels = getMobileModeLabels(lang)
  const mobileModes = [
    { label: mobileModeLabels.arcade, to: '/$locale/arcade' as const },
    { label: mobileModeLabels.famicom, platformId: 'famicom' },
    { label: mobileModeLabels.gba, platformId: 'gba' },
    { label: mobileModeLabels.web, platformId: 'flash' },
    { label: mobileModeLabels.coin, platformId: 'coin' },
  ]
  return (
    <>
      <nav
        aria-label={modeCopyLabel(lang)}
        className="border-b border-base-300 bg-base-100 px-1 lg:hidden"
      >
        <div className="flex flex-nowrap items-center justify-around gap-1 overflow-x-auto py-1.5">
          {mobileModes.map((mode) => mode.to ? (
            <Link className="btn btn-ghost btn-xs shrink-0 rounded-full border-0 px-2 text-xs text-base-content/75" key={mode.label} params={{ locale: lang }} to={mode.to}>
              {mode.label}
            </Link>
          ) : (
            <Link className="btn btn-ghost btn-xs shrink-0 rounded-full border-0 px-2 text-xs text-base-content/75" key={mode.label} params={{ locale: lang, platformId: mode.platformId! }} to="/$locale/platform/$platformId">
              {mode.label}
            </Link>
          ))}
        </div>
      </nav>

      <section className="hidden bg-base-100 lg:block">
        <div className="flex w-full flex-wrap items-start gap-8 px-4 py-6 sm:px-6 lg:px-8 xl:flex-nowrap">
          <div className="w-fit">
            <h1 className="rainbow-title hidden whitespace-nowrap text-[clamp(2rem,3.7vw,4rem)] font-bold leading-tight sm:block">
              {t.title}
            </h1>
            <p className="mt-3 hidden text-center text-lg font-medium text-base-content/65 sm:block lg:text-xl">
              {t.nostalgiaSubtitle}
            </p>
          </div>
          <RecentPlayedHeaderPanel games={recentPlayedGames} lang={lang} />
        </div>
      </section>

      <div className="hidden lg:block">
        <HomeMostPlayedGamesSection
          challengeCompleted={challengeCompleted}
          challengeReward={challengeReward}
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

      <div className="lg:hidden">
        <HomeMostPlayedGamesSection
          challengeCompleted={challengeCompleted}
          challengeReward={challengeReward}
          games={randomVideoGames}
          isRandomGameLoading={isRandomGameLoading}
          lang={lang}
          mobile
          onRandomGame={showOneRandomGame}
          streakDays={streakDays}
        />
      </div>

      <nav
        aria-label={t.mobilePlatformNavigation}
        className="border-y border-base-300 bg-base-100 px-1 lg:hidden"
      >
        <div className="flex flex-nowrap items-center gap-1 overflow-x-auto py-1.5">
          <button
            className={`btn btn-xs shrink-0 rounded-full border-0 px-2 text-[11px] ${showMobileRecent || filters.platform || filters.category || filters.query || filters.sort !== 'popular' ? 'btn-ghost text-base-content/65' : 'bg-base-content text-base-100'}`}
            onClick={() => {
              setShowMobileRecent(false)
              onHomeRecommendations()
            }}
            type="button"
          >
            {t.homeRecommendations}
          </button>
          <button
            className={`btn btn-xs shrink-0 rounded-full border-0 px-3 ${showMobileRecent ? 'bg-base-content text-base-100' : 'btn-ghost text-base-content/65'}`}
            onClick={() => setShowMobileRecent(true)}
            type="button"
          >
            {t.recentlyPlayed}
          </button>
          <RankingButton active={!showMobileRecent && filters.sort === 'weekly'} label={t.weeklyPopularGames} mobile onClick={() => { setShowMobileRecent(false); onFilterChange('sort', 'weekly') }} />
          <RankingButton active={!showMobileRecent && filters.sort === 'rising'} label={t.fastestGrowingGames} mobile onClick={() => { setShowMobileRecent(false); onFilterChange('sort', 'rising') }} />
          {orderedPlatforms.map((platform) => (
            <button
              className={`btn btn-xs shrink-0 rounded-full border-0 px-3 ${filters.platform === platform.name ? 'bg-base-content text-base-100' : 'btn-ghost text-base-content/65'}`}
              key={platform.name}
              onClick={() => { setShowMobileRecent(false); onFilterChange('platform', platform.name) }}
              type="button"
            >
              {getPlatformLabel(platform.name, lang)}
            </button>
          ))}
        </div>
      </nav>

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
        <section className="bg-base-100 px-4 py-5 sm:px-6 lg:px-8">
          <PopularGameCollections lang={lang} />
        </section>
        <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
        <HomeFaqSection lang={lang} />
      </div>

      {randomPopupGame ? (
        <RandomGameModal
          game={randomPopupGame}
          lang={lang}
          multiplier={randomPopupMultiplier}
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
  newlyCompleted: boolean
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
      newlyCompleted: false,
      streak: Math.max(0, Number(parsed?.streak) || 0),
    }
  } catch {
    return { completedToday: false, lastCompletedDate: '', newlyCompleted: false, streak: 0 }
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
  const next = { completedToday: true, lastCompletedDate: today, newlyCompleted: true, streak }

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

function getDailyChallengeReward(progress: DailyChallengeProgress) {
  if (progress.completedToday) return Math.max(1, progress.streak) * 10

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return progress.lastCompletedDate === getLocalDateKey(yesterday)
    ? (progress.streak + 1) * 10
    : 10
}

function RandomGameModal({
  game,
  lang,
  multiplier,
  onClose,
  onRandomAgain,
}: {
  game: PublicGame
  lang: HomeTemplateProps['lang']
  multiplier: number
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
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 truncate text-xl font-semibold">{game.name}</h3>
            <span className="flex shrink-0 items-center gap-1 text-sm font-black text-amber-600">
              <img alt="" aria-hidden="true" className="h-5 w-5 [image-rendering:pixelated]" src="/images/coin-rewards/pixel-reward-coin.webp" />
              ×{multiplier}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-warning" onClick={onRandomAgain} type="button">{t.randomAgain}</button>
            <Link className="btn btn-primary" onClick={() => setDailyGameCoinMultiplier(gameId, multiplier)} params={{ gameId, locale: lang }} search={{}} to="/$locale/games/$gameId">{t.playNow}</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function pickWeightedRandomCoinMultiplier() {
  const choices = Math.random() < 0.8
    ? [
        { multiplier: 2, weight: 4 },
        { multiplier: 3, weight: 3 },
        { multiplier: 4, weight: 2 },
        { multiplier: 5, weight: 1 },
      ]
    : [
        { multiplier: 6, weight: 5 },
        { multiplier: 7, weight: 4 },
        { multiplier: 8, weight: 3 },
        { multiplier: 9, weight: 2 },
        { multiplier: 10, weight: 1 },
      ]
  const totalWeight = choices.reduce((sum, choice) => sum + choice.weight, 0)
  let draw = Math.random() * totalWeight

  for (const choice of choices) {
    draw -= choice.weight
    if (draw < 0) return choice.multiplier
  }

  return 2
}

function selectDailyVideoGames(games: Array<PublicGame>, limit: number) {
  const today = new Date()
  const dayOfWeek = (today.getDay() + 6) % 7
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  weekStart.setDate(weekStart.getDate() - dayOfWeek)
  const weeklyKey = getLocalDateKey(weekStart)
  const weeklyGames = [...games]
    .filter((game) => Boolean(getGameId(game)))
    .sort(
      (left, right) =>
        dailyGameScore(`${weeklyKey}:${getGameId(left)}`) -
        dailyGameScore(`${weeklyKey}:${getGameId(right)}`),
    )
  if (weeklyGames.length <= limit) return weeklyGames
  const startIndex = (dayOfWeek * limit) % weeklyGames.length
  const dailyGames = weeklyGames.slice(startIndex, startIndex + limit)

  if (dailyGames.length >= limit) {
    return dailyGames
  }

  return [
    ...dailyGames,
    ...weeklyGames.slice(0, limit - dailyGames.length),
  ]
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

function getMobileModeLabels(lang: HomeTemplateProps['lang']) {
  if (lang === 'zh-TW') return { arcade: '街機模式', famicom: '小霸王模式', gba: 'GBA模式', web: '網頁模式', coin: '金幣模式' }
  if (lang === 'en') return { arcade: 'Arcade Mode', famicom: 'Famicom Mode', gba: 'GBA Mode', web: 'Web Mode', coin: 'Coin Mode' }
  if (lang === 'ja') return { arcade: 'アーケードモード', famicom: 'FCモード', gba: 'GBAモード', web: 'ウェブモード', coin: 'コインモード' }
  return { arcade: '街机模式', famicom: '小霸王模式', gba: 'GBA模式', web: '网页模式', coin: '金币模式' }
}

function modeCopyLabel(lang: HomeTemplateProps['lang']) {
  if (lang === 'zh-TW') return '遊戲模式'
  if (lang === 'en') return 'Game modes'
  if (lang === 'ja') return 'ゲームモード'
  return '游戏模式'
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
  const paidLink = (resourceId: string, cost = 10) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!confirmResourceDownload(lang, cost)) {
      event.preventDefault()
      return
    }
    if (unlockPaidResource(resourceId, cost)) return
    event.preventDefault()
    window.alert(getMobileResourceCoinCopy(lang))
  }

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

        <details open>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-gift-line" />
            </span>
            <span className="flex-1 whitespace-nowrap">{t.usefulResources}</span>
            <span className="inline-flex h-3.5 shrink-0 items-center rounded bg-red-500 px-1 text-[8px] font-bold leading-none text-white">HOT</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <ul className="menu menu-sm ml-11">
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG" onClick={paidLink('psp-library', 20)} rel="noreferrer" target="_blank">
                {t.pspLibrary} · 20
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/RclPTyXd" onClick={paidLink('psv-library', 20)} rel="noreferrer" target="_blank">
                {t.psvLibrary} · 20
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/detUdefK" onClick={paidLink('switch-library', 20)} rel="noreferrer" target="_blank">
                {t.switchLibrary} · 20
              </a>
            </li>
            <li>
              <a
                href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                onClick={paidLink('arcade-library', 20)}
                rel="noreferrer"
                target="_blank"
              >
                {t.arcadeLibrary} · 20
              </a>
            </li>
            <li>
              <a href="https://kdocs.cn/l/cqE4v1WZxdnc" onClick={paidLink('popular-library', 50)} rel="noreferrer" target="_blank">
                {t.popularGameLibrary} · 50
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/l/cn3lNtXTnq5W" onClick={paidLink('mahjong-slots', 50)} rel="noreferrer" target="_blank">
                {t.mahjongSlots} · 50
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

function getMobileResourceCoinCopy(lang: HomeTemplateProps['lang']) {
  if (lang === 'zh-CN') return '余额不足。金币随处可见，玩游戏、看别人玩都可获得。'
  if (lang === 'zh-TW') return '餘額不足。金幣隨處可見，玩遊戲、看別人玩都可獲得。'
  if (lang === 'ja') return 'コイン残高が不足しています。ゲームや視聴でコインを獲得できます。'
  return 'Not enough coins. Play games or watch others play to earn more.'
}
