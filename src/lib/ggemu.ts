import { createServerFn } from '@tanstack/react-start'

import { SITE_ORIGIN } from './site-url'

const API_BASE_URL = 'https://ggemu.com'
const PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const NON_GCOIN_GAME = '0'
const COIN_MODE_GAME_NAMES = ['wow new fantasia', 'excelsior'] as const

export type Locale = 'zh-CN' | 'zh-TW' | 'en' | 'ja'
export type GameSearchSort =
  | 'newest'
  | 'popular'
  | 'weekly'
  | 'rising'
  | 'oldest'
  | 'name_asc'
  | 'likes'
  | 'plays_count'
  | 'views'
  | 'likes_count'
  | 'views_count'

export type PublicGame = {
  _id?: string
  url_slug?: string
  name?: string
  description?: string
  how_to_play?: string
  developer?: string
  released_year?: string
  keywords?: string
  platform?: string
  platform_slug?: string
  platformSlug?: string
  categories?: Array<string>
  languages?: Array<string>
  players?: number
  play_online?: number
  play_device?: number
  downloadable?: number
  is_gcoin_game?: number
  game_cover?: string
  game_video?: string
  likes_count?: number
  comments_count?: number
  views_count?: number
  plays_count?: number
}

export type Pagination = {
  total: number
  page: number
  limit: number
  pages: number
}

export type GameSearchResult = {
  games: Array<PublicGame>
  pagination: Pagination
}

export type PublicLiveRoom = {
  roomId: string
  game: {
    _id: string
    slug: string
    url_slug: string
    name: string
    game_cover: string
    platform: string
  }
}

export type LiveRoomSearchResult = {
  rooms: Array<PublicLiveRoom>
  pagination: Pagination
}

export type FilterOption = {
  name: string
  slug?: string
  href?: string
  count?: number
}

export type GameFilterOptions = {
  platforms: Array<FilterOption>
  categories: Array<FilterOption>
}

export type GameDetailPageData = {
  canonicalUrl: string
  game: PublicGame
}

export type RelatedGamesData = {
  relatedByCategory: Array<PublicGame>
  relatedByDeveloper: Array<PublicGame>
}

export type BlogPost = {
  _id?: string
  title?: string
  slug?: string
  href?: string
  cover_image_url?: string
  comments_count?: number
  excerpt?: string
  content?: string
  created_at?: string
  updated_at?: string
}

export type BlogPostSearchResult = {
  blogPosts: Array<BlogPost>
  pagination: Pagination
}

export type BlogPostDetailPageData = {
  blogPost: BlogPost
  canonicalUrl: string
}

type GameSearchPayload = {
  query?: string
  locale?: Locale
  page?: number
  limit?: number
  platform?: string
  category?: string
  sort?: GameSearchSort
}

type GameDetailPayload = {
  id: string
  locale?: Locale
}

type LiveRoomSearchPayload = {
  page?: number
  limit?: number
}

type RandomGamePayload = {
  platform?: string
}

type RelatedGamesPayload = {
  category?: string
  currentId: string
  developer?: string
}

type BlogPostSearchPayload = {
  keyword?: string
  page?: number
  limit?: number
  includeContent?: boolean
}

type BlogPostDetailPayload = {
  id: string
  locale?: Locale
}

type FilterOptionResponse = {
  success: true
  data: Array<FilterOption>
}

type GameSearchResponse = {
  success: true
  data: Array<PublicGame>
  pagination: Pagination
}

type GameDetailResponse = {
  success: true
  data: PublicGame
}

type LiveRoomSearchResponse = {
  success: true
  count: number
  items: Array<PublicLiveRoom>
  pagination: Pagination
}

type RandomGame = Pick<PublicGame, '_id' | 'url_slug'>

type BlogPostSearchResponse = {
  success: true
  blogPosts: Array<BlogPost>
  pagination: Pagination
}

type BlogPostDetailResponse = {
  success: true
  blogPost: BlogPost
}

function normalizePage(page: unknown) {
  const parsed = Number(page)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function normalizeLimit(limit: unknown) {
  const parsed = Number(limit)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return PAGE_SIZE
  }

  return Math.min(parsed, MAX_PAGE_SIZE)
}

function normalizeLocale(locale: unknown): Locale {
  return locale === 'zh-TW' || locale === 'en' || locale === 'ja'
    ? locale
    : 'zh-CN'
}

function normalizeSort(sort: unknown): GameSearchSort {
  if (
    sort === 'popular' ||
    sort === 'weekly' ||
    sort === 'rising' ||
    sort === 'oldest' ||
    sort === 'name_asc' ||
    sort === 'likes' ||
    sort === 'plays_count' ||
    sort === 'views' ||
    sort === 'likes_count' ||
    sort === 'views_count'
  ) {
    return sort
  }

  return 'newest'
}

function addOptionalParam(
  params: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const trimmed = value?.trim()

  if (trimmed) {
    params.set(key, trimmed)
  }
}

async function fetchJson<T>(path: string, params: URLSearchParams) {
  const query = params.toString()
  const response = await fetch(`${API_BASE_URL}${path}${query ? `?${query}` : ''}`)

  if (!response.ok) {
    throw new Error(`GGEMU API request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function fetchGames(params: URLSearchParams, includeCoinMode = false) {
  const result = await fetchJson<GameSearchResponse>('/api/games/search', params)
  const games = includeCoinMode
    ? result.data
    : result.data.filter((game) => !isCoinModeGame(game))

  return {
    games,
    pagination: includeCoinMode
      ? result.pagination
      : { ...result.pagination, total: Math.max(0, result.pagination.total - (result.data.length - games.length)) },
  } satisfies GameSearchResult
}

function getGameId(game: PublicGame) {
  return game.url_slug?.trim() || game._id?.trim() || ''
}

function getAbsoluteGameUrl(origin: string, locale: Locale, game: PublicGame, fallbackId: string) {
  const id = encodeURIComponent(getGameId(game) || fallbackId)

  return `${origin}/${locale}/games/${id}`
}

function getBlogPostId(blogPost: BlogPost) {
  return blogPost.slug?.trim() || blogPost._id?.trim() || ''
}

function getAbsoluteBlogPostUrl(
  origin: string,
  locale: Locale,
  blogPost: BlogPost,
  fallbackId: string,
) {
  const id = encodeURIComponent(getBlogPostId(blogPost) || fallbackId)

  return `${origin}/${locale}/blog/${id}`
}

function isSameGame(game: PublicGame, id: string) {
  return getGameId(game) === id
}

function dedupeGames(games: Array<PublicGame>) {
  const seen = new Set<string>()

  return games.filter((game) => {
    const id = getGameId(game)

    if (!id || seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

function normalizeFilterOptions(options: Array<FilterOption>) {
  const seen = new Set<string>()

  return options.filter((option) => {
    const name = option.name?.trim()

    if (!name || seen.has(name)) {
      return false
    }

    seen.add(name)
    return true
  })
}

function normalizePlatformKey(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function getHrefLastSegment(href: string | undefined) {
  const cleaned = href?.trim().split(/[?#]/)[0]?.replace(/\/+$/, '')

  return cleaned?.split('/').pop()
}

function resolvePlatformName(value: string, platforms: Array<FilterOption>) {
  const key = normalizePlatformKey(value)
  const matched = platforms.find((platform) => {
    return [
      platform.name,
      platform.slug,
      getHrefLastSegment(platform.href),
    ].some((candidate) => normalizePlatformKey(candidate) === key)
  })

  return matched?.name?.trim() || value
}

function parseRandomPlatforms(value: string | undefined, platforms: Array<FilterOption>) {
  const seen = new Set<string>()
  const resolved = value
    ?.split(',')
    .map((platform) => platform.trim())
    .filter(Boolean)
    .map((platform) => resolvePlatformName(platform, platforms)) ?? []

  return resolved.filter((platform) => {
    const key = normalizePlatformKey(platform)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function pickRandomItem<T>(items: Array<T>) {
  return items[Math.floor(Math.random() * items.length)]
}

function pickRandomPlatform(value: string | undefined, platforms: Array<FilterOption>) {
  const resolvedPlatforms = parseRandomPlatforms(value, platforms)

  return resolvedPlatforms.length > 0 ? pickRandomItem(resolvedPlatforms) : undefined
}

function isOnlinePlayableGame(game: PublicGame) {
  return game.play_online === 1 && (game.play_device === 0 || game.play_device === 2)
}

function toRandomGame(game: PublicGame): RandomGame {
  return {
    _id: game._id,
    url_slug: game.url_slug,
  }
}

async function fetchRandomPlayableGame(platform: string | undefined) {
  const randomPageSize = 20
  const baseParams = new URLSearchParams({
    limit: '1',
    page: '1',
    play_online: '1',
  })

  addOptionalParam(baseParams, 'platform', platform)

  const firstPage = await fetchGames(baseParams)
  const total = firstPage.pagination.total

  if (total <= 0) {
    return null
  }

  for (let attempt = 0; attempt < Math.min(total, 8); attempt += 1) {
    const params = new URLSearchParams(baseParams)
    params.set('limit', String(randomPageSize))
    params.set(
      'page',
      String(Math.floor(Math.random() * Math.ceil(total / randomPageSize)) + 1),
    )

    const result = await fetchGames(params)
    const playableGames = result.games.filter(isOnlinePlayableGame)

    if (playableGames.length > 0) {
      return toRandomGame(pickRandomItem(playableGames))
    }
  }

  return null
}

async function fetchRelatedGames({
  category,
  currentId,
  developer,
}: {
  category?: string
  currentId: string
  developer?: string
}) {
  const categoryParams = new URLSearchParams({
    is_gcoin_game: NON_GCOIN_GAME,
    limit: '8',
    page: '1',
    play_online: '1',
    sort: 'popular',
  })
  const developerParams = new URLSearchParams({
    is_gcoin_game: NON_GCOIN_GAME,
    limit: '8',
    page: '1',
    play_online: '1',
    sort: 'popular',
  })

  addOptionalParam(categoryParams, 'category', category)
  addOptionalParam(developerParams, 'query', developer)

  const [categoryResult, developerResult] = await Promise.all([
    category ? fetchGames(categoryParams).catch(() => null) : null,
    developer ? fetchGames(developerParams).catch(() => null) : null,
  ])

  const relatedByCategory = dedupeGames(categoryResult?.games ?? [])
    .filter((game) => !isSameGame(game, currentId))
    .slice(0, 6)
  const relatedByDeveloper = dedupeGames(developerResult?.games ?? [])
    .filter((game) => !isSameGame(game, currentId))
    .filter((game) => game.developer?.trim() === developer?.trim())
    .slice(0, 6)

  return { relatedByCategory, relatedByDeveloper }
}

async function fetchBlogPosts(params: URLSearchParams) {
  const result = await fetchJson<BlogPostSearchResponse>('/api/blog-posts', params)

  return {
    blogPosts: result.blogPosts,
    pagination: result.pagination,
  } satisfies BlogPostSearchResult
}

export const searchGames = createServerFn({ method: 'GET' })
  .validator((payload: GameSearchPayload) => ({
    query: payload.query ?? '',
    locale: normalizeLocale(payload.locale),
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
    platform: payload.platform ?? '',
    category: payload.category ?? '',
    sort: normalizeSort(payload.sort),
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      is_gcoin_game: NON_GCOIN_GAME,
      page: String(data.page),
      limit: String(data.limit),
      play_online: '1',
    })

    addOptionalParam(params, 'query', data.query)
    addOptionalParam(params, 'platform', data.platform)
    addOptionalParam(params, 'category', data.category)
    addOptionalParam(
      params,
      'sort',
      data.sort === 'weekly' || data.sort === 'rising' ? 'popular' : data.sort,
    )

    const result = await fetchGames(params)

    if (data.sort === 'weekly') {
      result.games.sort((left, right) => weeklyTrendScore(right) - weeklyTrendScore(left))
    } else if (data.sort === 'rising') {
      result.games.sort((left, right) => risingScore(right) - risingScore(left))
    }

    return result
  })

export const searchCoinModeGames = createServerFn({ method: 'GET' })
  .handler(async () => {
    const results = await Promise.all(
      COIN_MODE_GAME_NAMES.map((query) =>
        fetchGames(new URLSearchParams({
          is_gcoin_game: NON_GCOIN_GAME,
          limit: '20',
          page: '1',
          play_online: '1',
          query,
          sort: 'name_asc',
        }), true),
      ),
    )
    const games = dedupeGames(results.flatMap((result) => result.games))
      .filter((game) => isCoinModeGame(game))

    return {
      games,
      pagination: { limit: games.length || 1, page: 1, pages: 1, total: games.length },
    } satisfies GameSearchResult
  })

export function isCoinModeGame(game: Pick<PublicGame, 'name'> | string | undefined) {
  const name = typeof game === 'string' ? game : game?.name
  const normalized = name?.trim().toLocaleLowerCase() ?? ''
  return COIN_MODE_GAME_NAMES.includes(normalized as (typeof COIN_MODE_GAME_NAMES)[number])
}

function weeklyTrendScore(game: PublicGame) {
  const week = Math.floor(Date.now() / 604_800_000)
  const identity = game.url_slug || game._id || game.name || ''
  let hash = week
  for (const character of identity) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  const weeklyWeight = 0.72 + (hash % 57) / 100
  return ((game.plays_count ?? 0) * 2 + (game.views_count ?? 0) + (game.likes_count ?? 0) * 8) * weeklyWeight
}

function risingScore(game: PublicGame) {
  const views = Math.max(game.views_count ?? 0, 1)
  const plays = game.plays_count ?? 0
  const likes = game.likes_count ?? 0
  return (plays / views) * 10_000 + (likes / views) * 25_000 + Math.log10(views + 10) * 10
}

export const searchLiveRooms = createServerFn({ method: 'GET' })
  .validator((payload: LiveRoomSearchPayload) => ({
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
  }))
  .handler(async ({ data }) => {
    const result = await fetchJson<LiveRoomSearchResponse>(
      '/api/live/rooms',
      new URLSearchParams({
        page: String(data.page),
        limit: String(data.limit),
      }),
    )

    return {
      rooms: result.items,
      pagination: result.pagination,
    } satisfies LiveRoomSearchResult
  })

export const getGameFilterOptions = createServerFn({ method: 'GET' })
  .handler(async () => {
    const emptyParams = new URLSearchParams()
    const [platformsResult, genresResult] = await Promise.all([
      fetchJson<FilterOptionResponse>('/api/games/platforms', emptyParams),
      fetchJson<FilterOptionResponse>('/api/games/genres', emptyParams),
    ])

    return {
      platforms: normalizeFilterOptions(platformsResult.data),
      categories: normalizeFilterOptions(genresResult.data),
    } satisfies GameFilterOptions
  })

export const getRandomPlayableGame = createServerFn({ method: 'GET' })
  .validator((payload: RandomGamePayload) => ({
    platform: payload.platform?.trim(),
  }))
  .handler(async ({ data }) => {
    const platformsResult = await fetchJson<FilterOptionResponse>(
      '/api/games/platforms',
      new URLSearchParams(),
    )
    const platform = pickRandomPlatform(
      data.platform,
      normalizeFilterOptions(platformsResult.data),
    )

    return fetchRandomPlayableGame(platform)
  })

export const getGameDetail = createServerFn({ method: 'GET' })
  .validator((payload: GameDetailPayload) => ({
    id: payload.id,
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({ id: data.id })
    const result = await fetchJson<GameDetailResponse>('/api/game/detail', params)

    return result.data
  })

export const getGameDetailPageData = createServerFn({ method: 'GET' })
  .validator((payload: GameDetailPayload) => ({
    id: payload.id,
    locale: normalizeLocale(payload.locale),
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({ id: data.id })
    const result = await fetchJson<GameDetailResponse>('/api/game/detail', params)
    const game = result.data
    return {
      canonicalUrl: getAbsoluteGameUrl(SITE_ORIGIN, data.locale, game, data.id),
      game,
    } satisfies GameDetailPageData
  })

export const getRelatedGamePageData = createServerFn({ method: 'GET' })
  .validator((payload: RelatedGamesPayload) => ({
    category: payload.category,
    currentId: payload.currentId,
    developer: payload.developer,
  }))
  .handler(async ({ data }) => {
    return fetchRelatedGames(data) satisfies Promise<RelatedGamesData>
  })

export const searchBlogPosts = createServerFn({ method: 'GET' })
  .validator((payload: BlogPostSearchPayload) => ({
    keyword: payload.keyword ?? '',
    page: normalizePage(payload.page),
    limit: normalizeLimit(payload.limit),
    includeContent: payload.includeContent ?? false,
  }))
  .handler(async ({ data }) => {
    const params = new URLSearchParams({
      page: String(data.page),
      limit: String(data.limit),
    })

    addOptionalParam(params, 'keyword', data.keyword)

    if (data.includeContent) {
      params.set('includeContent', '1')
    }

    return fetchBlogPosts(params)
  })

export const getBlogPostDetailPageData = createServerFn({ method: 'GET' })
  .validator((payload: BlogPostDetailPayload) => ({
    id: payload.id,
    locale: normalizeLocale(payload.locale),
  }))
  .handler(async ({ data }) => {
    const result = await fetchJson<BlogPostDetailResponse>(
      `/api/blog-posts/${encodeURIComponent(data.id)}`,
      new URLSearchParams(),
    )
    return {
      blogPost: result.blogPost,
      canonicalUrl: getAbsoluteBlogPostUrl(
        SITE_ORIGIN,
        data.locale,
        result.blogPost,
        data.id,
      ),
    } satisfies BlogPostDetailPageData
  })
