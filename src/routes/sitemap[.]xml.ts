import { createFileRoute } from '@tanstack/react-router'

import { fetchGameDeals } from '#/lib/game-deals.server'
import { DEFAULT_DEAL_REGION } from '#/lib/game-deals-region'
import type { BlogPost, Locale, PublicGame } from '#/lib/ggemu'
import { GAME_COLLECTIONS } from '#/lib/game-collections'
import { getLocalBlogPosts } from '#/lib/local-blog-posts'
import { PSP_LIBRARY_GAMES } from '#/lib/psp-library'
import { SWITCH_LIBRARY_GAMES } from '#/lib/switch-library'

const GGEMU_API_BASE_URL = 'https://ggemu.com'
const SITEMAP_PAGE_SIZE = 100
const SITEMAP_MAX_PAGES = 50
const SITEMAP_FETCH_CONCURRENCY = 8
const SITEMAP_CACHE_TTL_MS = 1000 * 60 * 60 * 24
const locales = ['zh-CN', 'en'] as const satisfies ReadonlyArray<Locale>
const sitemapFiles = [
  '/sitemap-pages.xml',
  '/sitemap-games-1.xml',
  '/sitemap-games-2.xml',
  '/sitemap-content.xml',
] as const

const sitemapCache = new Map<SitemapSection, {
  expiresAt: number
  xml: string
}>()

let sourceCache: {
  expiresAt: number
  value: SitemapSources
} | null = null

export type SitemapSection = 'content' | 'games-1' | 'games-2' | 'pages'

type SitemapSources = {
  blogPosts: Array<BlogPost>
  dealSteamAppIds: Array<number>
  dealsUpdatedAt?: string
  games: Array<PublicGame>
}

type SitemapEntry = {
  locale: Locale
  loc: string
  path: string
  changefreq?: 'daily' | 'weekly'
  lastmod?: string
  priority?: number
}

type GameSearchResponse = {
  success: true
  data: Array<PublicGame>
  pagination: {
    pages: number
  }
}

type BlogPostSearchResponse = {
  success: true
  blogPosts: Array<BlogPost>
  pagination: {
    pages: number
  }
}

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const xml = buildSitemapIndex(origin)

        return new Response(xml, {
          headers: {
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
            'Content-Type': 'application/xml; charset=utf-8',
          },
        })
      },
    },
  },
})

export async function getSitemapSectionXml(origin: string, section: SitemapSection) {
  const cached = sitemapCache.get(section)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.xml
  }

  const sources: SitemapSources = section === 'pages'
    ? { blogPosts: [], dealSteamAppIds: [], games: [] }
    : await getSitemapSources()
  const allEntries = buildSitemapEntries(
    origin,
    sources.games,
    sources.blogPosts,
    sources.dealSteamAppIds,
    sources.dealsUpdatedAt,
  )
  const gameEntries = allEntries.filter((entry) => entry.path.startsWith('/games/'))
  const midpoint = Math.ceil(gameEntries.length / 2)
  const entries = section === 'games-1'
    ? gameEntries.slice(0, midpoint)
    : section === 'games-2'
      ? gameEntries.slice(midpoint)
      : section === 'content'
        ? allEntries.filter((entry) => entry.path.startsWith('/blog/') || entry.path.startsWith('/collections/') || entry.path.startsWith('/deals/steam/') || entry.path.startsWith('/platform/psp/') || entry.path.startsWith('/platform/switch/'))
        : allEntries.filter((entry) => !entry.path.startsWith('/games/') && !entry.path.startsWith('/blog/') && !entry.path.startsWith('/collections/') && !entry.path.startsWith('/deals/steam/') && !entry.path.startsWith('/platform/psp/') && !entry.path.startsWith('/platform/switch/'))
  const xml = buildSitemapXml(entries)

  sitemapCache.set(section, {
    expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS,
    xml,
  })

  return xml
}

async function getSitemapSources(): Promise<SitemapSources> {
  if (sourceCache && sourceCache.expiresAt > Date.now()) return sourceCache.value

  try {
    const [games, blogPosts, dealsResult] = await Promise.all([
      fetchSitemapGames(),
      fetchSitemapBlogPosts(),
      fetchGameDeals('en', DEFAULT_DEAL_REGION).catch(() => null),
    ])
    const value = {
      blogPosts,
      dealSteamAppIds: dealsResult?.deals.map((deal) => deal.steamAppId) ?? [],
      dealsUpdatedAt: dealsResult?.updatedAt,
      games,
    }
    sourceCache = { expiresAt: Date.now() + SITEMAP_CACHE_TTL_MS, value }
    return value
  } catch {
    return sourceCache?.value ?? { blogPosts: [], dealSteamAppIds: [], games: [] }
  }
}

async function fetchSitemapGames() {
  const firstPage = await fetchGamesPage(1)
  const pageCount = Math.min(firstPage.pagination.pages, SITEMAP_MAX_PAGES)
  const remainingPages = await fetchPagesInBatches(pageCount, fetchGamesPage)
  const games = [firstPage, ...remainingPages].flatMap((result) => result.data)

  return dedupeGames(games)
}

async function fetchGamesPage(page: number) {
  const params = new URLSearchParams({
    is_gcoin_game: '0',
    limit: String(SITEMAP_PAGE_SIZE),
    page: String(page),
    play_online: '1',
    sort: 'newest',
  })

  const response = await fetch(`${GGEMU_API_BASE_URL}/api/games/search?${params}`)

  if (!response.ok) {
    throw new Error(`GGEMU sitemap request failed with ${response.status}`)
  }

  return response.json() as Promise<GameSearchResponse>
}

async function fetchSitemapBlogPosts() {
  const firstPage = await fetchBlogPostsPage(1)
  const pageCount = Math.min(firstPage.pagination.pages, SITEMAP_MAX_PAGES)
  const remainingPages = await fetchPagesInBatches(pageCount, fetchBlogPostsPage)
  const blogPosts = [firstPage, ...remainingPages].flatMap((result) => result.blogPosts)

  return dedupeBlogPosts(blogPosts)
}

async function fetchPagesInBatches<T>(pageCount: number, fetchPage: (page: number) => Promise<T>) {
  const results: Array<T> = []

  for (let firstPage = 2; firstPage <= pageCount; firstPage += SITEMAP_FETCH_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(SITEMAP_FETCH_CONCURRENCY, pageCount - firstPage + 1) },
      (_, index) => firstPage + index,
    )
    results.push(...await Promise.all(pages.map(fetchPage)))
  }

  return results
}

async function fetchBlogPostsPage(page: number) {
  const params = new URLSearchParams({
    limit: String(SITEMAP_PAGE_SIZE),
    page: String(page),
  })

  const response = await fetch(`${GGEMU_API_BASE_URL}/api/blog-posts?${params}`)

  if (!response.ok) {
    throw new Error(`GGEMU blog sitemap request failed with ${response.status}`)
  }

  return response.json() as Promise<BlogPostSearchResponse>
}

function dedupeGames(games: Array<PublicGame>) {
  return dedupeByRouteId(games, getGameRouteId)
}

function dedupeBlogPosts(blogPosts: Array<BlogPost>) {
  return dedupeByRouteId(blogPosts, getBlogPostRouteId)
}

function dedupeByRouteId<T>(items: Array<T>, getRouteId: (item: T) => string) {
  const seen = new Set<string>()

  return items.filter((item) => {
    const id = getRouteId(item)

    if (!id || seen.has(id)) {
      return false
    }

    seen.add(id)
    return true
  })
}

function getGameRouteId(game: PublicGame) {
  return game.url_slug?.trim() || game._id?.trim() || ''
}

function getBlogPostRouteId(blogPost: BlogPost) {
  return blogPost.slug?.trim() || blogPost._id?.trim() || ''
}

function buildSitemapEntries(
  origin: string,
  games: Array<PublicGame>,
  blogPosts: Array<BlogPost>,
  dealSteamAppIds: Array<number>,
  dealsUpdatedAt?: string,
) {
  const entries: Array<SitemapEntry> = []

  for (const locale of locales) {
    for (const path of ['/arcade', '/platform/famicom', '/platform/gba', '/platform/flash', '/platform/coin', '/platform/mahjong', '/platform/psp', '/platform/switch', '/rankings/latest', '/rankings/popular', '/rankings/weekly', '/rankings/rising']) {
      entries.push({ locale, loc: toAbsoluteLocalizedUrl(origin, locale, path), path, changefreq: 'daily', priority: 0.8 })
    }
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/deals'),
      path: '/deals',
      changefreq: 'daily',
      priority: 0.8,
    })
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/'),
      path: '/',
      changefreq: 'daily',
      priority: 1,
    })
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/about'),
      path: '/about',
      changefreq: 'weekly',
      priority: 0.4,
    })
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/privacy-policy'),
      path: '/privacy-policy',
      changefreq: 'weekly',
      priority: 0.3,
    })
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/terms-of-service'),
      path: '/terms-of-service',
      changefreq: 'weekly',
      priority: 0.3,
    })
    entries.push({
      locale,
      loc: toAbsoluteLocalizedUrl(origin, locale, '/blog'),
      path: '/blog',
      changefreq: 'weekly',
      priority: 0.7,
    })

    for (const game of games) {
      const gameId = encodeURIComponent(getGameRouteId(game))
      const path = `/games/${gameId}`

      entries.push({
        locale,
        loc: toAbsoluteLocalizedUrl(origin, locale, path),
        path,
        changefreq: 'weekly',
        priority: 0.8,
      })
    }

    for (const collection of GAME_COLLECTIONS) {
      const path = `/collections/${encodeURIComponent(collection.id)}`
      entries.push({ locale, loc: toAbsoluteLocalizedUrl(origin, locale, path), path, changefreq: 'weekly', priority: 0.7 })
    }

    for (const game of SWITCH_LIBRARY_GAMES) {
      const path = `/platform/switch/${encodeURIComponent(game.id)}`
      entries.push({ locale, loc: toAbsoluteLocalizedUrl(origin, locale, path), path, changefreq: 'weekly', priority: 0.7 })
    }

    for (const game of PSP_LIBRARY_GAMES) {
      const path = `/platform/psp/${encodeURIComponent(game.id)}`
      entries.push({ locale, loc: toAbsoluteLocalizedUrl(origin, locale, path), path, changefreq: 'weekly', priority: 0.7 })
    }

    for (const blogPost of dedupeBlogPosts([...getLocalBlogPosts(locale), ...blogPosts])) {
      const blogPostId = encodeURIComponent(getBlogPostRouteId(blogPost))
      const path = `/blog/${blogPostId}`

      entries.push({
        locale,
        loc: toAbsoluteLocalizedUrl(origin, locale, path),
        path,
        changefreq: 'weekly',
        lastmod: blogPost.updated_at || blogPost.created_at,
        priority: 0.6,
      })
    }

    for (const steamAppId of dealSteamAppIds) {
      const path = `/deals/steam/${steamAppId}`
      entries.push({
        locale,
        loc: toAbsoluteLocalizedUrl(origin, locale, path),
        path,
        changefreq: 'daily',
        lastmod: dealsUpdatedAt,
        priority: 0.7,
      })
    }
  }

  return entries
}

function toAbsoluteLocalizedUrl(origin: string, locale: Locale, path: string) {
  return path === '/' ? `${origin}/${locale}` : `${origin}/${locale}${path}`
}

function buildSitemapXml(entries: Array<SitemapEntry>) {
  const urls = entries.map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${formatSitemapAlternateLinks(entry)}${formatOptionalTag('lastmod', entry.lastmod)}${formatOptionalTag('changefreq', entry.changefreq)}${formatOptionalTag('priority', entry.priority)}
  </url>`,
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`
}

function buildSitemapIndex(origin: string) {
  const sitemaps = sitemapFiles.map((path) => `  <sitemap>\n    <loc>${escapeXml(`${origin}${path}`)}</loc>\n  </sitemap>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemaps.join('\n')}\n</sitemapindex>\n`
}

function formatSitemapAlternateLinks(entry: SitemapEntry) {
  const origin = new URL(entry.loc).origin
  const links = [
    ...locales.map((locale) => ({
      href: toAbsoluteLocalizedUrl(origin, locale, entry.path),
      hrefLang: locale,
    })),
    {
      href: toAbsoluteLocalizedUrl(origin, 'en', entry.path),
      hrefLang: 'x-default',
    },
  ]

  return links
    .map(
      (link) => `
    <xhtml:link rel="alternate" hreflang="${escapeXml(link.hrefLang)}" href="${escapeXml(link.href)}" />`,
    )
    .join('')
}

function formatOptionalTag(name: string, value: string | number | undefined) {
  if (value === undefined) {
    return ''
  }

  return `
    <${name}>${escapeXml(String(value))}</${name}>`
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
