import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import {
  GameCardPreviewVideo,
  gameCardPreviewHandlers,
} from '#/components/game-card-preview'
import type { BlogPost, GameSearchSort, Locale, PublicGame } from '#/lib/ggemu'
import { formatCopy, getHomeFaqs, getI18n } from '#/lib/i18n'

import type { GamesSectionProps, HomeCopy, SearchFormProps } from './types'
import { getPlatformLabel } from '#/lib/platform-label'
import { setDailyGameCoinMultiplier } from '#/lib/coin-wallet'
import { CardScrollRow } from './card-scroll-row'
import { CoinFruitCard } from '#/components/coin-fruit-card'

export const HOME_BLOG_POST_LIMIT = 4

export function HomeLatestGamesRow({
  games,
  lang,
  title,
  pinnedCoin = false,
}: {
  games: Array<PublicGame>
  lang: Locale
  title?: string
  pinnedCoin?: boolean
}) {
  const items = games.slice(0, 20)
  const t = getI18n(lang).home

  if (items.length === 0 && !pinnedCoin) return null

  return (
    <section className="bg-base-100 px-4 py-1 sm:px-6 lg:px-8">
      <h2 className="mb-1 text-left text-sm lg:text-lg font-semibold text-base-content">{title ?? t.latestGamesSection}</h2>
      <CardScrollRow lang={lang}>
        {pinnedCoin ? <div className="w-[72px] shrink-0 sm:w-[88px] lg:w-48"><CoinFruitCard lang={lang} hideTitle /></div> : null}
              {items.map((game, index) => (
                <div
                  className="w-[72px] shrink-0 sm:w-[88px] lg:w-48"
                  key={game.url_slug || game._id}
                >
                  <GameCard
                    game={game}
                    lang={lang}
                    layoutIndex={index}
                    mobileCoverOnly
                  />
                </div>
              ))}
      </CardScrollRow>
    </section>
  )
}

export function HomeMostPlayedGamesSection({
  challengeCompleted = false,
  challengeReward = 10,
  games,
  lang,
  mobile = false,
  isRandomGameLoading = false,
  onRandomGame,
  streakDays = 0,
}: {
  challengeCompleted?: boolean
  challengeReward?: number
  games: Array<PublicGame>
  lang: Locale
  mobile?: boolean
  isRandomGameLoading?: boolean
  onRandomGame: () => void | Promise<void>
  streakDays?: number
}) {
  const items = games.slice(0, mobile ? 4 : 5)
  const t = getI18n(lang).home

  return (
    <section className="bg-base-100">
      <div className={mobile ? 'w-full px-4 py-1' : 'w-full px-4 pt-1 sm:px-6 lg:px-8'}>
        <div className="flex items-center gap-2">
          <h2 className="text-left text-sm lg:text-lg font-semibold text-base-content">
            {t.dailyRandom}
          </h2>
          <button
            aria-label={t.randomGame}
            className={mobile ? 'grid h-8 w-12 place-items-center bg-transparent p-0 text-black hover:opacity-65 disabled:opacity-40' : 'grid h-10 w-16 place-items-center bg-transparent p-0 text-black hover:opacity-65 disabled:opacity-40'}
            disabled={isRandomGameLoading}
            onClick={onRandomGame}
            title={t.randomGame}
            type="button"
          >
            <SlotMachineIcon className={mobile ? 'h-5 w-10' : 'h-7 w-14'} />
          </button>
          <button
            className={`btn shrink-0 rounded-full border-0 ${mobile ? 'btn-xs' : 'btn-sm'} ${
              challengeCompleted ? 'bg-success/15 text-success' : 'bg-warning text-warning-content'
            }`}
            disabled={isRandomGameLoading || challengeCompleted}
            onClick={onRandomGame}
            type="button"
          >
            <i className={challengeCompleted ? 'ri-checkbox-circle-fill' : 'ri-fire-fill'} />
            {challengeCompleted ? t.challengeCompleted : t.dailyChallenge}
            <span className="font-bold">+{challengeReward}</span>
          </button>
          {streakDays > 0 ? (
            <span className="shrink-0 text-xs font-semibold text-base-content/60">
              {formatCopy(t.streakDays, { days: streakDays })}
            </span>
          ) : null}
        </div>
        <div className={mobile ? 'mt-1 grid grid-cols-2 gap-px' : 'mt-1 grid grid-cols-6 gap-2'}>
          {items.map((game, index) => {
            const gameId = game.url_slug || game._id || ''
            const multiplier = getDailyCoinMultiplier(items, index)

            return (
              <Link
                className="group min-w-0"
                key={gameId}
                onClick={() => setDailyGameCoinMultiplier(gameId, multiplier)}
                params={{ gameId, locale: lang }}
                search={{}}
                to="/$locale/games/$gameId"
              >
                <figure className="relative aspect-[4/3] overflow-hidden rounded-md bg-base-200">
                  <LazyAutoplayVideo
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    poster={game.game_cover}
                    src={game.game_video}
                  />
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-1 text-[11px] font-black text-yellow-300 backdrop-blur-sm">
                    <img
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 object-contain"
                      src="/images/coin-rewards/pixel-reward-coin.webp"
                    />
                    ×{multiplier}
                  </span>
                  {game.platform ? (
                    <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                      {getPlatformLabel(game.platform, lang)}
                    </span>
                  ) : null}
                </figure>
              </Link>
            )
          })}
          {!mobile ? <div className="aspect-[4/3] min-w-0"><div className="mx-auto w-3/4"><CoinFruitCard lang={lang} /></div></div> : null}
        </div>
      </div>
    </section>
  )
}

function LazyAutoplayVideo({ className, poster, src }: { className: string; poster?: string; src?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(entry.isIntersecting)
      },
      { rootMargin: '200px' },
    )
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <video
      autoPlay={isNearViewport}
      className={className}
      loop
      muted
      playsInline
      poster={poster}
      preload="none"
      ref={videoRef}
      src={isNearViewport ? src : undefined}
    />
  )
}

function getDailyCoinMultiplier(games: Array<PublicGame>, index: number) {
  const date = new Date()
  const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  let hash = 2166136261

  for (const character of dateKey) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return index === (hash >>> 0) % games.length ? 5 : 2
}

function SlotMachineIcon({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 72 36"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 14V24M8 10V28" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <rect fill="white" height="28" rx="6" stroke="currentColor" strokeWidth="3" width="44" x="12" y="4" />
      <rect fill="white" height="15" rx="3" stroke="currentColor" strokeWidth="2" width="12" x="16" y="10.5" />
      <rect fill="white" height="15" rx="3" stroke="currentColor" strokeWidth="2" width="12" x="28" y="10.5" />
      <rect fill="white" height="15" rx="3" stroke="currentColor" strokeWidth="2" width="12" x="40" y="10.5" />
      <text fill="currentColor" fontFamily="Arial Black, Arial, sans-serif" fontSize="12" fontWeight="900" textAnchor="middle" x="22" y="22">7</text>
      <text fill="currentColor" fontFamily="Arial Black, Arial, sans-serif" fontSize="12" fontWeight="900" textAnchor="middle" x="34" y="22">7</text>
      <text fill="currentColor" fontFamily="Arial Black, Arial, sans-serif" fontSize="12" fontWeight="900" textAnchor="middle" x="46" y="22">7</text>
      <path d="M59 12V26M63 9V29" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <path d="M64 27L68 8" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
      <circle cx="68.5" cy="5" fill="white" r="4" stroke="currentColor" strokeWidth="3" />
    </svg>
  )
}

export function HomeLatestBlogPostsSection({
  blogPosts,
  lang,
}: {
  blogPosts: Array<BlogPost>
  lang: Locale
}) {
  const posts = blogPosts.filter((post) => getBlogPostRouteId(post)).slice(0, HOME_BLOG_POST_LIMIT)
  const t = getI18n(lang).home

  if (posts.length === 0) {
    return null
  }

  return (
    <section className="bg-base-100">
      <div className="w-full px-4 py-1 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-left text-lg font-semibold text-base-content">
              {t.latestBlogPosts}
            </h2>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              {t.latestBlogSubtitle}
            </p>
          </div>
          <Link
            className="btn btn-outline btn-sm w-fit"
            params={{ locale: lang }}
            to="/$locale/blog"
          >
            {t.viewAllBlog}
          </Link>
        </div>

        <div className="mt-1"><CardScrollRow lang={lang} className="[&>*]:w-52 [&>*]:shrink-0">
          {posts.map((post) => (
            <HomeBlogPostCard
              blogPost={post}
              key={getBlogPostRouteId(post)}
              lang={lang}
            />
          ))}
        </CardScrollRow></div>
      </div>
    </section>
  )
}

export function HomeFaqSection({ lang }: { lang: Locale }) {
  const faq = getHomeFaqs(lang)

  return (
    <section className="bg-base-100">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <h2 className="text-left text-lg font-semibold text-base-content">{faq.title}</h2>

        <div className="mt-3 grid max-w-6xl border-t border-base-300 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-3">
          {faq.items.map((item) => (
            <details className="group border-b border-base-300" key={item.question}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-sm font-medium text-base-content">
                <span>{item.question}</span>
                <i className="ri-add-line shrink-0 text-lg text-base-content/45 transition-transform group-open:rotate-45" />
              </summary>
              <p className="pb-3 pr-8 text-sm leading-6 text-base-content/60">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SearchForm({
  filterOptions,
  filters,
  isLoading,
  lang,
  mode,
  onFilterChange,
  onQueryChange,
  onReset,
  onSearch,
  pagination,
  t,
}: SearchFormProps) {
  const searchPlaceholder = getSearchPlaceholder(t, pagination.total)

  if (mode === 'sidebar') {
    return (
      <form className="flex flex-col gap-3" onSubmit={onSearch}>
        <input
          className="input input-bordered w-full"
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={filters.query}
        />
        <button className="btn btn-primary w-full" disabled={isLoading} type="submit">
          <i className="ri-search-line" />
          {t.search}
        </button>
        <FilterSelects
          filterOptions={filterOptions}
          filters={filters}
          isLoading={isLoading}
          lang={lang}
          onFilterChange={onFilterChange}
          onReset={onReset}
          t={t}
        />
      </form>
    )
  }

  return (
    <form className="flex w-full flex-col gap-3" onSubmit={onSearch}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 w-full min-w-0 items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 shadow-sm transition focus-within:border-rose-300 focus-within:bg-white sm:w-64">
          <i className="ri-search-line text-lg text-gray-500" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-xs text-black caret-black outline-none placeholder:text-gray-500"
            onFocus={() => window.location.assign(`/${lang}/search`)}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={filters.query}
          />
          <button
            aria-label={t.search}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red-800 text-white transition hover:bg-red-900"
            disabled={isLoading}
            type="submit"
          >
            <i className="ri-arrow-right-line" />
          </button>
        </label>

        <div className="tooltip tooltip-bottom" data-tip={getI18n(lang).arcade.tooltip}>
          <Link
            className="flex h-9 items-center whitespace-nowrap px-2 text-sm font-normal text-white/95 transition hover:text-white"
            params={{ locale: lang }}
            to="/$locale/arcade"
          >
            {getI18n(lang).arcade.mode}
          </Link>
        </div>
        <div className="tooltip tooltip-bottom" data-tip={getI18n(lang).arcade.famicomTooltip}>
          <Link
            className="flex h-9 items-center whitespace-nowrap px-2 text-sm font-normal text-white/95 transition hover:text-white"
            params={{ locale: lang, platformId: 'famicom' }}
            to="/$locale/platform/$platformId"
          >
            {getI18n(lang).arcade.famicomMode}
          </Link>
        </div>
        <div className="tooltip tooltip-bottom" data-tip={getI18n(lang).arcade.gbaTooltip}>
          <Link
            className="flex h-9 items-center whitespace-nowrap px-2 text-sm font-normal text-white/95 transition hover:text-white"
            params={{ locale: lang, platformId: 'gba' }}
            to="/$locale/platform/$platformId"
          >
            {getI18n(lang).arcade.gbaMode}
          </Link>
        </div>
        <div className="tooltip tooltip-bottom" data-tip={getI18n(lang).arcade.flashTooltip}>
          <Link
            className="flex h-9 items-center whitespace-nowrap px-2 text-sm font-normal text-white/95 transition hover:text-white"
            params={{ locale: lang, platformId: 'flash' }}
            to="/$locale/platform/$platformId"
          >
            {getI18n(lang).arcade.flashMode}
          </Link>
        </div>
        <div className="tooltip tooltip-bottom" data-tip={getCoinModeCopy(lang).tooltip}>
          <Link
            className="flex h-9 items-center whitespace-nowrap px-2 text-sm font-normal text-white/95 transition hover:text-white"
            params={{ locale: lang, platformId: 'coin' }}
            to="/$locale/platform/$platformId"
          >
            {getCoinModeCopy(lang).mode}
          </Link>
        </div>

      </div>
    </form>
  )
}

function getCoinModeCopy(lang: Locale) {
  if (lang === 'zh-TW') return { mode: '金幣模式', tooltip: '使用金幣遊玩專屬遊戲' }
  if (lang === 'en') return { mode: 'Coin Mode', tooltip: 'Play exclusive games with coins' }
  if (lang === 'ja') return { mode: 'コインモード', tooltip: 'コインで限定ゲームを遊ぶ' }
  return { mode: '金币模式', tooltip: '使用金币游玩专属游戏' }
}


export function FilterSelects({
  filterOptions,
  filters,
  isLoading,
  lang,
  onFilterChange,
  onReset,
  t,
}: Omit<SearchFormProps, 'mode' | 'onQueryChange' | 'onSearch' | 'pagination'>) {
  return (
    <>
      <select
        className="select select-bordered w-full"
        onChange={(event) => onFilterChange('platform', event.currentTarget.value)}
        value={filters.platform}
      >
        <option value="">{t.allPlatforms}</option>
        {filterOptions.platforms.map((platform) => (
          <option key={platform.name} value={platform.name}>
            {getPlatformLabel(platform.name, lang)}
          </option>
        ))}
      </select>

      <select
        className="select select-bordered w-full"
        onChange={(event) => onFilterChange('category', event.currentTarget.value)}
        value={filters.category}
      >
        <option value="">{t.allCategories}</option>
        {filterOptions.categories.map((category) => (
          <option key={category.name} value={category.name}>
            {category.name}
          </option>
        ))}
      </select>

      <select
        className="select select-bordered w-full"
        onChange={(event) =>
          onFilterChange('sort', event.currentTarget.value as GameSearchSort)
        }
        value={filters.sort}
      >
        <option value="newest">{t.newest}</option>
        <option value="popular">{t.popular}</option>
        <option value="oldest">{t.oldest}</option>
        <option value="name_asc">{t.nameAsc}</option>
      </select>

      <button
        className="btn btn-ghost"
        disabled={isLoading}
        onClick={onReset}
        type="button"
      >
        <i className="ri-refresh-line" />
        {t.reset}
      </button>
    </>
  )
}

export function getSearchPlaceholder(t: HomeCopy, _total: number) {
  return t.searchPlaceholder
}

export function GamesSection({
  games,
  gridClassName,
  isLoading,
  lang,
  mobileItemLimit,
  onLoadPage,
  page,
  pages,
  pagination,
  sectionClassName,
  showHeader = true,
  t,
}: GamesSectionProps) {
  const gamesGridRef = useRef<HTMLDivElement>(null)

  async function loadPageAndShowFirstRow(nextPage: number) {
    await onLoadPage(nextPage)
    window.requestAnimationFrame(() =>
      gamesGridRef.current?.scrollIntoView({
        behavior: 'auto',
        block: 'start',
      }),
    )
  }

  const paginationControls = (
    <div className="join mx-auto pt-1">
      <button
        className={`btn btn-sm join-item ${page <= 1 ? 'btn-disabled' : ''}`}
        disabled={isLoading || page <= 1}
        onClick={() => loadPageAndShowFirstRow(1)}
        type="button"
      >
        <i className="ri-skip-left-line" />
        {t.latestPage}
      </button>
      <button
        className={`btn btn-sm join-item ${page <= 1 ? 'btn-disabled' : ''}`}
        disabled={isLoading || page <= 1}
        onClick={() => loadPageAndShowFirstRow(Math.max(1, page - 1))}
        type="button"
      >
        <i className="ri-arrow-left-s-line" />
        {t.previous}
      </button>
      <button className="btn btn-sm join-item btn-disabled">
        {formatCopy(t.page, { page, pages })}
      </button>
      <button
        className={`btn btn-sm join-item ${page >= pages ? 'btn-disabled' : ''}`}
        disabled={isLoading || page >= pages}
        onClick={() =>
          loadPageAndShowFirstRow(Math.min(pages, page + 1))
        }
        type="button"
      >
        {t.next}
        <i className="ri-arrow-right-s-line" />
      </button>
      <button
        className={`btn btn-sm join-item ${page >= pages ? 'btn-disabled' : ''}`}
        disabled={isLoading || page >= pages}
        onClick={() => loadPageAndShowFirstRow(pages)}
        type="button"
      >
        {t.lastPage}
        <i className="ri-skip-right-line" />
      </button>
    </div>
  )

  return (
    <section className={sectionClassName} id="all-games">
      {showHeader ? (
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold">{t.featured}</h2>
            <p className="text-sm text-base-content/60">
              {formatCopy(t.page, { page, pages })}
            </p>
          </div>
          <span className="text-sm text-base-content/60">
            {pagination.total} / {pagination.limit}
          </span>
        </div>
      ) : null}

      {games.length > 0 ? (
        <div className={gridClassName.includes('flex-nowrap') ? 'relative' : ''}>
        <div
          className={`${gridClassName} scroll-mt-20 ${isLoading ? 'opacity-60' : ''}`}
          ref={gamesGridRef}
        >
          {games.map((game, index) => {
            const key = game._id ?? game.url_slug
            const card = (
              <GameCard
                game={game}
                isCompactTail={index >= games.length - 3}
                lang={lang}
                layoutIndex={index}
              />
            )

            return mobileItemLimit && index >= mobileItemLimit ? (
              <div className="hidden lg:contents" key={key}>
                {card}
              </div>
            ) : (
              <GameCard
                game={game}
                isCompactTail={index >= games.length - 3}
                key={key}
                lang={lang}
                layoutIndex={index}
              />
            )
          })}
        </div>
        {gridClassName.includes('flex-nowrap') ? <button type="button" aria-label={t.previous} className="absolute -left-4 top-1/2 grid h-10 w-4 -translate-y-1/2 place-items-center text-black" onClick={() => {
          const row = gamesGridRef.current
          if (row) row.scrollBy({ left: -row.clientWidth * 0.8, behavior: 'smooth' })
        }}><svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="m8 4-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button> : null}
        {gridClassName.includes('flex-nowrap') ? <button type="button" aria-label={t.next} className="absolute -right-4 top-1/2 grid h-10 w-4 -translate-y-1/2 place-items-center text-black" onClick={() => {
          const row = gamesGridRef.current
          if (row) row.scrollBy({ left: row.clientWidth * 0.8, behavior: 'smooth' })
        }}><svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="m4 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button> : null}
        </div>
      ) : (
        <div className="rounded-box border border-base-300 bg-base-100 p-12 text-center text-base-content/60">
          {t.empty}
        </div>
      )}
      {paginationControls}
    </section>
  )
}

function HomeBlogPostCard({
  blogPost,
  lang,
}: {
  blogPost: BlogPost
  lang: Locale
}) {
  const id = getBlogPostRouteId(blogPost)
  const title = blogPost.title?.trim() || getI18n(lang).home.blogPostFallback

  return (
    <Link
      className="group flex aspect-square flex-col overflow-hidden rounded-xl bg-base-200"
      params={{ blogId: id, locale: lang }}
      to="/$locale/blog/$blogId"
    >
      <div className="h-1/2 shrink-0 bg-base-300">
        {blogPost.cover_image_url ? (
          <img
            alt={title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            src={blogPost.cover_image_url}
          />
        ) : (
          <div className="grid h-full place-items-center text-sm font-semibold text-base-content/40">
            Blog
          </div>
        )}
      </div>
      <div className="flex h-1/2 flex-col px-4 py-3">
        <p className="text-[11px] text-base-content/50">
          {formatBlogDate(blogPost.created_at, lang)}
        </p>
        <h3 className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-base-content sm:text-base">
          {title}
        </h3>
        {blogPost.excerpt ? (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-base-content/60">
            {blogPost.excerpt}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function GameCard({
  game,
  isCompactTail = false,
  lang,
  layoutIndex = 1,
  mobileCoverOnly = false,
}: {
  game: PublicGame
  isCompactTail?: boolean
  lang: Locale
  layoutIndex?: number
  mobileCoverOnly?: boolean
}) {
  const gameId = game.url_slug || game._id || ''
  const viewCount = game.views_count ?? 0
  const isFeaturedTile =
    !isCompactTail && (layoutIndex % 11 === 0 || layoutIndex % 11 === 5)

  return (
    <Link
      className={`game-mosaic-card group block h-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:rounded-sm ${
        isFeaturedTile ? 'is-featured' : ''
      }`}
      {...gameCardPreviewHandlers}
      params={{ gameId, locale: lang }}
      search={{}}
      to="/$locale/games/$gameId"
    >
      <figure className="relative isolate aspect-square w-full overflow-hidden rounded-md bg-base-200 lg:aspect-[4/3] lg:rounded-sm">
        {game.game_cover ? (
          <img
            alt={game.name ?? 'Game cover'}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
            src={game.game_cover}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral via-black to-primary/30 text-sm font-bold uppercase tracking-[0.25em] text-white/45">
            Retro
          </div>
        )}
        <GameCardPreviewVideo src={game.game_video} />
        <div className={mobileCoverOnly ? 'hidden lg:contents' : 'contents'}>
        <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-base-300 bg-base-100/90 text-xs text-base-content opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-3 sm:top-3">
          ▶
        </span>

        {isFeaturedTile ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-yellow-400 px-2 py-0.5 text-[9px] font-semibold text-black lg:hidden">
            {getI18n(lang).home.playNow}
          </span>
        ) : null}

        <span
          className={`game-card-view-count absolute bottom-2 right-2 items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm ${
            isFeaturedTile ? 'flex' : 'hidden lg:flex'
          }`}
          title={`${viewCount} ${getI18n(lang).home.views}`}
        >
          <i className="ri-eye-line" />
          {formatGameCount(viewCount, lang)}
        </span>
        </div>
      </figure>
    </Link>
  )
}

function formatGameCount(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale, {
    compactDisplay: 'short',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(value)
}

function getBlogPostRouteId(blogPost: BlogPost) {
  return blogPost.slug?.trim() || blogPost._id?.trim() || ''
}

function formatBlogDate(value: string | undefined, locale: Locale) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
