import {
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

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
import { HomeSearchOverlay } from '#/components/home/search-overlay'
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
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const DEFAULT_HOME_REQUEST_SIZE = 42
const MOBILE_API_PAGE_SIZE = 51
const MOBILE_HOME_REQUEST_SIZE = 102
const POPULAR_HOME_REQUEST_SIZE = 42

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

function parseHomeSearchStr(searchStr: string) {
  const searchParams = new URLSearchParams(searchStr)
  const category = normalizeFilterValue(searchParams.get('category'))
  const platform = normalizeFilterValue(searchParams.get('platform'))
  const template = normalizeSiteTemplate(searchParams.get('template'))
  const sort = normalizeHomeSort(searchParams.get('sort'))
  const view = normalizeHomeView(searchParams.get('view'))
  const supportedKeys = new Set([
    'category',
    'platform',
    'sort',
    'template',
    'view',
  ])
  const hasSupportedParamsOnly = Array.from(searchParams.keys()).every((key) =>
    supportedKeys.has(key),
  )
  const hasInvalidValue =
    (searchParams.has('template') && !template) ||
    (searchParams.has('sort') && !sort) ||
    (searchParams.has('view') && !view)

  return {
    category,
    hasSupportedParamsOnly: hasSupportedParamsOnly && !hasInvalidValue,
    platform,
    sort,
    template,
    view,
  }
}

export const Route = createFileRoute('/$locale')({
  validateSearch: validateHomeSearch,
  headers: ({ match }) =>
    getSearchTemplate(match.search)
      ? {
          'X-Robots-Tag': 'noindex, nofollow',
        }
      : undefined,
  beforeLoad: ({ location, params }) => {
    if (!location.searchStr || location.pathname !== `/${params.locale}`) {
      return undefined as never
    }

    const {
      category,
      hasSupportedParamsOnly,
      platform,
      sort,
      template,
      view,
    } = parseHomeSearchStr(location.searchStr)

    if (!hasSupportedParamsOnly) {
      throw redirect({
        params: { locale: params.locale },
        replace: true,
        search: {
          ...(category ? { category } : {}),
          ...(platform ? { platform } : {}),
          ...(sort ? { sort } : {}),
          ...(template ? { template } : {}),
          ...(view ? { view } : {}),
        },
        to: '/$locale',
      })
    }

    return undefined as never
  },
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
        mostPlayedGames,
      ] = await Promise.all([
        getSeoOrigin(),
        loadFeatureGames(locale, 'newest', FEATURE_NEW_ARRIVAL_LIMIT),
        loadFeaturePlatformGames(locale),
        loadGameFilterOptions(),
        loadLatestBlogPosts(locale),
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
        mostPlayedGames,
        seoOrigin,
      }
    }

    const [seoOrigin, result, filterOptions, latestBlogPosts, mostPlayedGames] = await Promise.all([
      getSeoOrigin(),
      searchGames({
        data: {
          query: '',
          limit: getHomeRequestLimit(template, deps.sort, deps.view),
          locale,
          page: 1,
          platform: deps.platform,
          category: deps.category,
          sort: deps.sort ?? getHomeSort(template),
        },
      }),
      loadGameFilterOptions(),
      loadLatestBlogPosts(locale),
      loadMostPlayedVideoGames(locale),
    ])

    return {
      ...result,
      filterOptions,
      layoutSeed: getPokiDailyLayoutSeed(),
      latestBlogPosts,
      mostPlayedGames,
      seoOrigin,
    }
  },
  head: ({ loaderData, params, match }) => {
    const data = loaderData as unknown as HomeLoaderData | undefined
    const locale = normalizeLocale(params.locale)
    const meta = getI18n(locale).homeSeo
    const isTemplatePreview = Boolean(getSearchTemplate(match.search))

    return {
      links: data?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: data.seoOrigin,
            path: '/',
          })
        : undefined,
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
  const initialResult = Route.useLoaderData() as HomeLoaderData
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  useEffect(() => {
    setResult(initialResult)
  }, [initialResult])

  useEffect(() => {
    if (
      currentTemplate !== 'default' ||
      !window.matchMedia('(max-width: 1023px)').matches
    ) {
      return
    }

    let isCancelled = false

    Promise.all(
      [1, 2].map((apiPage) =>
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
        setResult(mergeMobileResults(mobileResults, 1))
      }
    })

    return () => {
      isCancelled = true
    }
  }, [currentTemplate, initialResult, lang, runSearch])

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
    mostPlayedGames: initialResult.mostPlayedGames,
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

  if (pathname !== `/${locale}`) {
    return <Outlet />
  }

  async function loadGames(nextFilters: Filters, nextPage: number) {
    setIsLoading(true)

    try {
      const isMobileHome =
        currentTemplate === 'default' &&
        window.matchMedia('(max-width: 1023px)').matches
      if (isMobileHome) {
        const firstApiPage = (nextPage - 1) * 2 + 1
        const mobileResults = await Promise.all(
          [firstApiPage, firstApiPage + 1].map((apiPage) =>
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
    loadGames(filters, 1)
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
        onOpenSearch={() => setIsSearchOpen(true)}
        topContent={
          <div className="hidden w-full max-w-4xl lg:block">
            <SearchForm {...templateProps} mode="default" />
          </div>
        }
      >
        <DefaultHomeTemplate {...templateProps} />
      </SiteLayout>
      <HomeSearchOverlay
        filterOptions={initialResult.filterOptions}
        gameTotal={pagination.total}
        isOpen={isSearchOpen}
        lang={lang}
        onClose={() => setIsSearchOpen(false)}
        t={t}
      />
    </>
  )
}

async function loadLatestBlogPosts(locale: Locale) {
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
  const results = await Promise.all(
    (['plays_count', 'newest', 'popular'] as const).flatMap((sort) =>
      [1, 2, 3].map((page) =>
        searchGames({
          data: {
            query: '',
            limit: 100,
            locale,
            page,
            sort,
          },
        }),
      ),
    ),
  )

  const uniqueGames = new Map<string, PublicGame>()

  results
    .flatMap((result) => result.games)
    .filter((game) => Boolean(game.game_video?.trim()))
    .forEach((game) => {
      const id = game.url_slug?.trim() || game._id?.trim()

      if (id && !uniqueGames.has(id)) {
        uniqueGames.set(id, game)
      }
    })

  return [...uniqueGames.values()]
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
