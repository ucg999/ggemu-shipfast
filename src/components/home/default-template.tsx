import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import {
  GamesSection,
  HomeFaqSection,
  HomeLatestBlogPostsSection,
} from './shared'
import {
  PopularGameCollections,
  RecentPlayedGamesSection,
  useRecentPlayedGames,
} from './recent-played-games'
import type { HomeTemplateProps } from './types'
import { getPlatformLabel } from '#/lib/platform-label'

export function DefaultHomeTemplate(props: HomeTemplateProps) {
  const {
    filterOptions,
    filters,
    lang,
    latestBlogPosts,
    onFilterChange,
    onHomeRecommendations,
    t,
  } = props
  const [showMobileRecent, setShowMobileRecent] = useState(false)
  const recentPlayedGames = useRecentPlayedGames()
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
          <div className="w-full">
            <h1 className="rainbow-title hidden whitespace-nowrap text-[clamp(2rem,3.7vw,4rem)] font-bold leading-tight sm:block">
              {t.title}
            </h1>
          </div>
        </div>
      </section>

      <div className="hidden lg:block">
        <RecentPlayedGamesSection lang={lang} />
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
        <GamesSection
          {...props}
          games={showMobileRecent ? mobileRecentGames : props.games}
          gridClassName="game-mosaic-grid grid grid-flow-dense grid-cols-12 gap-1 sm:grid-cols-12"
          mobileItemLimit={102}
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
      </div>

      <section className="px-3 pb-5 pt-4 lg:hidden">
        <PopularGameCollections lang={lang} />
      </section>

      <div className="hidden lg:block">
        <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
        <HomeFaqSection lang={lang} />
      </div>
    </>
  )
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
