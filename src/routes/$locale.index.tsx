import {
  createFileRoute,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { readHomeCards, saveHomeCards } from '#/lib/home-card-cache'

import {
  CoinRewardPopup,
  FloatingHomeCoin,
  FlyingCollectedCoin,
  useHomeCoinRewards,
} from '#/components/home/coin-rewards'
import { DefaultHomeTemplate } from '#/components/home/default-template'
import {
  FEATURE_NEW_ARRIVAL_LIMIT,
  FEATURE_PLATFORM_LIMIT,
  FEATURE_PLATFORMS,
  FEATURE_SECTION_LIMIT,
  FeaturesHomeTemplate,
  getFeatureSections,
} from '#/components/home/features-template'
import {
  POKI_REQUEST_SIZE,
  PokiLikeHomeTemplate,
  getPokiDailyLayoutSeed,
} from '#/components/home/poki-like-template'
import { SidenavHomeTemplate } from '#/components/home/sidenav-template'
import { HOME_BLOG_POST_LIMIT, SearchForm } from '#/components/home/shared'
import type { Filters, HomeLoaderData } from '#/components/home/types'
import { TwoColumnHomeTemplate } from '#/components/home/two-column-template'
import { SiteLayout } from '#/components/site-layout'
import {
  type GameSearchSort,
  type GameSearchResult,
  type Locale,
  type PublicGame,
  getGameFilterOptions,
  searchBlogPosts,
  searchGames,
} from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalBlogPosts } from '#/lib/local-blog-posts'
import {
  type SiteTemplate,
  getSiteTemplate,
  normalizeSiteTemplate,
  siteConfig,
} from '#/lib/site-config'
import { getSeoOrigin, getLocalizedSeoLinks } from '#/lib/seo'
import { SITE_ORIGIN } from '#/lib/site-url'

const DEFAULT_HOME_REQUEST_SIZE = 21
const MOBILE_API_PAGE_SIZE = 36
const MOBILE_HOME_REQUEST_SIZE = 36
const POPULAR_HOME_REQUEST_SIZE = 21

type HomeSearch = {
  category?: string
  platform?: string
  sort?: GameSearchSort
  template?: SiteTemplate
  view?: 'all' | 'latest'
}

function validateHomeSearch(search: Record<string, unknown>): HomeSearch {
  return {
    category: normalizeFilterValue(search.category),
    platform: normalizeFilterValue(search.platform),
    sort: normalizeHomeSort(search.sort),
    template: normalizeSiteTemplate(search.template),
    view: normalizeHomeView(search.view),
  }
}

function normalizeHomeView(value: unknown) {
  return value === 'all' || value === 'latest' ? value : undefined
}

function normalizeFilterValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeHomeSort(value: unknown): GameSearchSort | undefined {
  return value === 'newest' ||
    value === 'popular' ||
    value === 'weekly' ||
    value === 'rising' ||
    value === 'oldest' ||
    value === 'name_asc'
    ? value
    : undefined
}

function getSearchTemplate(search: unknown) {
  if (!search || typeof search !== 'object') {
    return undefined
  }

  return normalizeSiteTemplate((search as Record<string, unknown>).template)
}

export const Route = createFileRoute('/$locale/')({
  staleTime: 0,
  // Reuse the index-route cache immediately while refreshing in the background.
  validateSearch: validateHomeSearch,
  loaderDeps: ({ search }): HomeSearch => ({
    category: normalizeFilterValue(search.category),
    platform: normalizeFilterValue(search.platform),
    sort: normalizeHomeSort(search.sort),
    template: getSearchTemplate(search),
    view: normalizeHomeView(search.view),
  }),
  loader: async ({ deps, params }): Promise<HomeLoaderData> => {
    const locale = normalizeLocale(params.locale)

    const template = getSiteTemplate(getSearchTemplate(deps))

    if (template === 'features') {
      const [
        seoOrigin,
        newArrival,
        platformResults,
        filterOptions,
        latestBlogPosts,
        latestGamesResult,
        mostPlayedGames,
      ] = await Promise.all([
        getSeoOrigin(),
        loadFeatureGames(locale, 'newest', FEATURE_NEW_ARRIVAL_LIMIT),
        loadFeaturePlatformGames(locale),
        loadGameFilterOptions(),
        loadLatestBlogPosts(locale),
        safeSearchGames({ query: '', limit: 20, locale, page: 1, sort: 'newest' }),
        loadMostPlayedVideoGames(locale),
      ])

      return {
        ...newArrival,
        featureSections: getFeatureSections({
          newArrival: newArrival.games,
          platformGames: platformResults,
        }),
        filterOptions,
        layoutSeed: getPokiDailyLayoutSeed(),
        latestBlogPosts,
        latestGames: latestGamesResult.games.slice(0, 20),
        mostPlayedGames: mostPlayedGames.games,
        videoLoadFailed: mostPlayedGames.loadFailed,
        seoOrigin,
      }
    }

    const [seoOrigin, result, filterOptions, latestBlogPosts, latestGamesResult, mostPlayedGames] = await Promise.all([
      getSeoOrigin(),
      safeSearchGames({
          query: '',
          limit: getHomeRequestLimit(template, deps.sort, deps.view),
          locale,
          page: 1,
          platform: deps.platform,
          category: deps.category,
          sort: deps.sort ?? getHomeSort(template),
      }),
      loadGameFilterOptions(),
      loadLatestBlogPosts(locale),
      safeSearchGames({ query: '', limit: 20, locale, page: 1, sort: 'newest' }),
      loadMostPlayedVideoGames(locale),
    ])

    return {
      ...result,
      filterOptions,
      layoutSeed: getPokiDailyLayoutSeed(),
      latestBlogPosts,
      latestGames: latestGamesResult.games.slice(0, 20),
      mostPlayedGames: mostPlayedGames.games,
      videoLoadFailed: mostPlayedGames.loadFailed,
      seoOrigin,
    }
  },
  head: ({ params, match, matches }) => {
    if (matches.at(-1)?.routeId !== match.routeId) {
      return {}
    }

    const locale = normalizeLocale(params.locale)
    const meta = getI18n(locale).homeSeo
    const isTemplatePreview = Boolean(getSearchTemplate(match.search))

    return {
      links: getLocalizedSeoLinks({ locale, origin: SITE_ORIGIN, path: '/' }),
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'keywords', content: meta.keywords },
        { property: 'og:title', content: meta.title },
        { property: 'og:description', content: meta.description },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: meta.title },
        { name: 'twitter:description', content: meta.description },
        ...(isTemplatePreview
          ? [{ name: 'robots', content: 'noindex,nofollow' }]
          : []),
      ],
    }
  },
  component: LocalizedHomePage,
})

function LocalizedHomePage() {
  const { locale } = Route.useParams()
  const homeSearch = Route.useSearch()
  const template = getSearchTemplate(homeSearch)
  const loadedResult = Route.useLoaderData() as HomeLoaderData
  const [initialResult, setInitialResult] = useState(loadedResult)
  const cacheKey = `${locale}:home:${JSON.stringify(homeSearch)}`
  useEffect(() => {
    const previous = readHomeCards<HomeLoaderData>(cacheKey)
    const next = {
      ...loadedResult,
      games: loadedResult.games.length ? loadedResult.games : previous?.games ?? [],
      pagination: loadedResult.games.length ? loadedResult.pagination : previous?.pagination ?? loadedResult.pagination,
      latestGames: loadedResult.latestGames.length ? loadedResult.latestGames : previous?.latestGames ?? [],
      mostPlayedGames: loadedResult.videoLoadFailed && previous?.mostPlayedGames.length
        ? previous.mostPlayedGames
        : loadedResult.mostPlayedGames.length ? loadedResult.mostPlayedGames : previous?.mostPlayedGames ?? [],
    }
    saveHomeCards(cacheKey, next)
    setInitialResult(next)
  }, [loadedResult, cacheKey])
  const [lastVideoGames, setLastVideoGames] = useState<{ locale: string; games: Array<PublicGame> }>({ locale, games: initialResult.mostPlayedGames })
  const router = useRouter()
  const [isRetrying, setIsRetrying] = useState(false)
  const runSearch = useServerFn(searchGames)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lang = normalizeLocale(locale)
  const currentTemplate = getSiteTemplate(template)
  const t = getI18n(lang).home
  const [result, setResult] = useState<GameSearchResult>(initialResult)
  const [filters, setFilters] = useState<Filters>({
    query: '',
    platform: normalizeFilterValue(homeSearch.platform) ?? '',
    category: normalizeFilterValue(homeSearch.category) ?? '',
    sort: normalizeHomeSort(homeSearch.sort) ?? 'popular',
  })
  const [isLoading, setIsLoading] = useState(false)
  const coinRewards = useHomeCoinRewards()

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 1023px)').matches
      ? readHomeCards<GameSearchResult>(`${cacheKey}:mobile`) : undefined
    if (mobile?.games.length) setResult(mobile)
    else if (initialResult.games.length > 0) setResult(initialResult)
  }, [initialResult, cacheKey])

  useEffect(() => {
    if (initialResult.mostPlayedGames.length > 0) {
      setLastVideoGames({ locale, games: initialResult.mostPlayedGames })
    }
  }, [initialResult.mostPlayedGames, locale])

  useEffect(() => {
    if (
      currentTemplate !== 'default' ||
      pathname.replace(/\/$/, '') !== `/${locale}` ||
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return
    }

    let isCancelled = false

    Promise.all(
      [1].map((apiPage) =>
        runSearch({
          data: {
            query: filters.query,
            limit: MOBILE_API_PAGE_SIZE,
            locale: lang,
            page: apiPage,
            platform: filters.platform,
            category: filters.category,
            sort: filters.sort,
          },
        }),
      ),
    ).then((mobileResults) => {
      if (!isCancelled) {
        const next = mergeMobileResults(mobileResults, 1)
        if (next.games.length > 0) {
          saveHomeCards(`${cacheKey}:mobile`, next)
          setResult(next)
        }
      }
    }).catch(() => {
      // Preserve the current cards if the mobile refresh fails.
    })

    return () => {
      isCancelled = true
    }
  }, [currentTemplate, initialResult, lang, runSearch, pathname, locale, cacheKey])

  const { games, pagination } = result
  const page = pagination.page
  const pages = Math.max(pagination.pages, 1)
  const isPokiLike = currentTemplate === 'poki-like'
  const isFeatures = currentTemplate === 'features'
  const templateProps = {
    filters,
    featureSections: initialResult.featureSections,
    filterOptions: initialResult.filterOptions,
    games,
    isLoading,
    lang,
    layoutSeed: initialResult.layoutSeed,
    latestBlogPosts: initialResult.latestBlogPosts,
    latestGames: initialResult.latestGames,
    mostPlayedGames: initialResult.videoLoadFailed && initialResult.mostPlayedGames.length === 0 && lastVideoGames.locale === locale
      ? lastVideoGames.games
      : initialResult.mostPlayedGames,
    onFilterChange: updateFilter,
    onHomeRecommendations: showHomeRecommendations,
    onLoadPage: (nextPage: number) => loadGames(filters, nextPage),
    onQueryChange: (query: string) => {
      setFilters((current) => ({
        ...current,
        query,
      }))
    },
    onReset: resetFilters,
    onSearch: handleSearch,
    page,
    pages,
    pagination,
    t,
  }

  async function loadGames(nextFilters: Filters, nextPage: number) {
    setIsLoading(true)

    try {
      const isMobileHome =
        currentTemplate === 'default' &&
        window.matchMedia('(max-width: 1023px)').matches
      if (isMobileHome) {
        const firstApiPage = nextPage
        const mobileResults = await Promise.all(
          [firstApiPage].map((apiPage) =>
            runSearch({
              data: {
                query: nextFilters.query,
                limit: MOBILE_API_PAGE_SIZE,
                locale: lang,
                page: apiPage,
                platform: nextFilters.platform,
                category: nextFilters.category,
                sort: nextFilters.sort,
              },
            }),
          ),
        )

        setResult(mergeMobileResults(mobileResults, nextPage))
        return
      }

      const requestLimit = getHomeRequestLimit(
        siteConfig.SITE_TEMPLATE,
        nextFilters.sort,
      )
      const nextResult = await runSearch({
        data: {
          query: nextFilters.query,
          limit: requestLimit,
          locale: lang,
          page: nextPage,
          platform: nextFilters.platform,
          category: nextFilters.category,
          sort: nextFilters.sort,
        },
      })

      setResult(nextResult)
    } finally {
      setIsLoading(false)
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    window.location.assign(`/${lang}/search?q=${encodeURIComponent(filters.query)}`)
  }

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    const nextFilters = { ...filters, [key]: value }
    setFilters(nextFilters)
    loadGames(nextFilters, 1)
  }

  function resetFilters() {
    const nextFilters: Filters = {
      query: '',
      platform: '',
      category: '',
      sort: 'popular',
    }

    setFilters(nextFilters)
    loadGames(nextFilters, 1)
  }

  function showHomeRecommendations() {
    const nextFilters: Filters = {
      query: '',
      platform: '',
      category: '',
      sort: 'popular',
    }

    setFilters(nextFilters)
    loadGames(nextFilters, 1)
  }

  if (isPokiLike) {
    return <PokiLikeHomeTemplate {...templateProps} />
  }

  if (isFeatures) {
    return <FeaturesHomeTemplate {...templateProps} />
  }

  if (currentTemplate === 'sidenav') {
    return <SidenavHomeTemplate {...templateProps} />
  }

  if (currentTemplate === 'two-column') {
    return (
      <SiteLayout locale={lang}>
        <TwoColumnHomeTemplate {...templateProps} />
      </SiteLayout>
    )
  }

  return (
    <>
      <SiteLayout
        gameFilterOptions={initialResult.filterOptions}
        hideFooterOnMobile
        locale={lang}
        onOpenSearch={() => window.location.assign(`/${lang}/search`)}
        topContent={
          <div className="hidden w-full lg:block">
            <SearchForm {...templateProps} mode="default" />
          </div>
        }
      >
        {initialResult.loadFailed || initialResult.videoLoadFailed ? (
          <div role="status" className="mx-4 my-3 flex items-center justify-between gap-3 rounded-lg bg-base-200 p-3 text-sm">
            <span>{lang === 'en' ? 'Games could not be loaded. Please retry.' : lang === 'ja' ? 'ゲームを読み込めませんでした。再試行してください。' : lang === 'zh-TW' ? '遊戲暫時載入失敗，請重新載入。' : '游戏暂时加载失败，请重新加载。'}</span>
            <button
              className="btn btn-sm shrink-0"
              disabled={isRetrying}
              onClick={async () => {
                setIsRetrying(true)
                try { await router.invalidate({ sync: true }) } finally { setIsRetrying(false) }
              }}
              type="button"
            >{lang === 'en' ? 'Retry' : lang === 'ja' ? '再試行' : lang === 'zh-TW' ? '重新載入' : '重新加载'}</button>
          </div>
        ) : null}
        <DefaultHomeTemplate
          {...templateProps}
          onCoinsEarned={coinRewards.addCoins}
        />
      </SiteLayout>
      <FloatingHomeCoin
        lang={lang}
        onCollect={coinRewards.collectFloatingCoin}
        positions={coinRewards.coinPositions}
      />
      <FlyingCollectedCoin flight={coinRewards.collectedCoinFlight} />
      <CoinRewardPopup feedback={coinRewards.rewardFeedback} />
    </>
  )
}

async function loadLatestBlogPosts(locale: Locale) {
  if (locale !== 'zh-CN') {
    return []
  }

  const result = await searchBlogPosts({
    data: {
      limit: HOME_BLOG_POST_LIMIT,
      page: 1,
    },
  }).catch(() => null)

  const localPosts = getLocalBlogPosts(locale)
  const remotePosts = (result?.blogPosts ?? []).filter(
    (post) =>
      !localPosts.some(
        (localPost) =>
          localPost.slug === post.slug || localPost._id === post._id,
      ),
  )

  return [...localPosts, ...remotePosts].slice(0, HOME_BLOG_POST_LIMIT)
}

async function loadGameFilterOptions() {
  const result = await getGameFilterOptions().catch(() => null)

  return result ?? { platforms: [], categories: [] }
}

function getHomeRequestLimit(
  template = siteConfig.SITE_TEMPLATE,
  sort?: GameSearchSort,
  view?: HomeSearch['view'],
) {
  if (sort === 'popular' || view === 'latest') {
    return POPULAR_HOME_REQUEST_SIZE
  }

  if (template === 'poki-like') {
    return POKI_REQUEST_SIZE
  }

  if (template === 'features') {
    return FEATURE_SECTION_LIMIT
  }

  return DEFAULT_HOME_REQUEST_SIZE
}

function getHomeSort(_template: SiteTemplate): GameSearchSort {
  return 'popular'
}

async function loadFeatureGames(
  locale: Locale,
  sort: GameSearchSort,
  limit = FEATURE_SECTION_LIMIT,
  platform = '',
) {
  return searchGames({
    data: {
      limit,
      locale,
      page: 1,
      platform,
      sort,
    },
  })
}

async function loadFeaturePlatformGames(locale: Locale) {
  return Promise.all(
    FEATURE_PLATFORMS.map(async (platform) => {
      const result = await loadFeatureGames(
        locale,
        'popular',
        FEATURE_PLATFORM_LIMIT,
        platform,
      )

      return {
        title: platform,
        games: result.games,
      }
    }),
  )
}

async function loadMostPlayedVideoGames(locale: Locale) {
  const results = await Promise.allSettled(
    (['plays_count', 'popular'] as const).map((sort) =>
      searchGames({
        data: { query: '', limit: 100, locale, page: 1, sort },
      }),
    ),
  )

  const uniqueGames = new Map<string, PublicGame>()

  results
    .flatMap((result) => result.status === 'fulfilled' ? result.value.games : [])
    .filter((game) => Boolean(game.game_video?.trim()))
    .forEach((game) => {
      const id = game.url_slug?.trim() || game._id?.trim()

      if (id && !uniqueGames.has(id)) {
        uniqueGames.set(id, game)
      }
    })

  return {
    games: [...uniqueGames.values()],
    loadFailed: results.some((result) => result.status === 'rejected'),
  }
}

async function safeSearchGames(data: Parameters<typeof searchGames>[0]['data']): Promise<GameSearchResult & { loadFailed?: boolean }> {
  try {
    return await searchGames({ data })
  } catch {
    return {
      games: [],
      loadFailed: true,
      pagination: { total: 0, page: 1, limit: data.limit ?? DEFAULT_HOME_REQUEST_SIZE, pages: 1 },
    }
  }
}

function shuffleGames(games: Array<PublicGame>) {
  const shuffledGames = [...games]

  for (let index = shuffledGames.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const currentGame = shuffledGames[index]
    shuffledGames[index] = shuffledGames[swapIndex]
    shuffledGames[swapIndex] = currentGame
  }

  return shuffledGames
}

function mergeMobileResults(
  results: Array<GameSearchResult>,
  page: number,
): GameSearchResult {
  const firstResult = results[0]

  if (!firstResult) {
    return {
      games: [],
      pagination: {
        limit: MOBILE_HOME_REQUEST_SIZE,
        page,
        pages: 1,
        total: 0,
      },
    }
  }

  return {
    ...firstResult,
    games: shuffleGames(
      results.flatMap((result) => result.games).slice(0, MOBILE_HOME_REQUEST_SIZE),
    ),
    pagination: {
      ...firstResult.pagination,
      limit: MOBILE_HOME_REQUEST_SIZE,
      page,
      pages: Math.max(
        1,
        Math.ceil(firstResult.pagination.total / MOBILE_HOME_REQUEST_SIZE),
      ),
    },
  }
}
