import { Link } from '@tanstack/react-router'
import { useRef } from 'react'

import {
  GameCardPreviewVideo,
  gameCardPreviewHandlers,
} from '#/components/game-card-preview'
import type { BlogPost, GameSearchSort, Locale, PublicGame } from '#/lib/ggemu'
import { formatCopy, getHomeFaqs, getI18n } from '#/lib/i18n'

import type { GamesSectionProps, HomeCopy, SearchFormProps } from './types'
import { getPlatformLabel } from '#/lib/platform-label'

export const HOME_BLOG_POST_LIMIT = 4

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
      <div className="w-full px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-base-content">
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

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => (
            <HomeBlogPostCard
              blogPost={post}
              key={getBlogPostRouteId(post)}
              lang={lang}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export function HomeFaqSection({ lang }: { lang: Locale }) {
  const faq = getHomeFaqs(lang)

  return (
    <section className="bg-base-100">
      <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <h2 className="text-xl font-semibold text-base-content">{faq.title}</h2>

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
        <label className="flex w-full min-w-0 items-center gap-3 rounded-full border border-white/70 bg-white px-5 shadow-sm transition focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-md sm:w-96">
          <i className="ri-search-line text-lg text-gray-500" />
          <input
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-black caret-black outline-none placeholder:text-gray-500"
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder={searchPlaceholder}
            type="search"
            value={filters.query}
          />
          <button
            aria-label={t.search}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-content text-base-100 transition hover:scale-105"
            disabled={isLoading}
            type="submit"
          >
            <i className="ri-arrow-right-line" />
          </button>
        </label>

      </div>
    </form>
  )
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

export function getSearchPlaceholder(t: HomeCopy, total: number) {
  return `${t.searchPlaceholder} ${formatCopy(t.totalGames, { total })}`
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
}: {
  game: PublicGame
  isCompactTail?: boolean
  lang: Locale
  layoutIndex?: number
}) {
  const gameId = game.url_slug || game._id || ''
  const playCount = game.plays_count ?? 0
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
        <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full border border-base-300 bg-base-100/90 text-xs text-base-content opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:right-3 sm:top-3">
          ▶
        </span>

        <span
          className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm"
          title={`${playCount} ${getI18n(lang).home.plays}`}
        >
          <i className="ri-play-circle-line" />
          {formatGameCount(playCount, lang)}
        </span>
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
