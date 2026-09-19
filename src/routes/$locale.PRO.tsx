import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getThemePlatforms, searchGames } from '#/lib/ggemu'
import type { FilterOption, GameSearchResult, PublicGame } from '#/lib/ggemu'
import { normalizeLocale } from '#/lib/i18n'
import { getI18n } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { getThemeAsset, themePlatformLabel } from '#/lib/k-team'
import { SWITCH_LIBRARY_GAMES } from '#/lib/switch-library'
import { PSP_LIBRARY_GAMES } from '#/lib/psp-library'
import {
  CoinRewardPopup,
  CoinRankBadge,
  FloatingHomeCoin,
  FlyingCollectedCoin,
  HomeCoinBag,
  useHomeCoinRewards,
} from '#/components/home/coin-rewards'
import { getOriginalGamesTitle } from '#/lib/original-games'
import { getLocalizedSeoLinks } from '#/lib/seo'
import { SITE_ORIGIN } from '#/lib/site-url'
import '#/styles/theme-mode.css'
import { createThemeGameCache } from '#/lib/theme-game-cache'
import themeImageFormats from '#/lib/theme-image-formats.json'
import libraryUpdates from '#/lib/library-updates.json'
import { prefersThemeMode, setThemeModePreference } from '#/lib/theme-mode-preference'

const themeGamesCache = createThemeGameCache<Array<PublicGame>>()
const themeFirstPagesCache = createThemeGameCache<Array<GameSearchResult>>()
const DAILY_CHALLENGE_STORAGE_KEY = 'game-adventure-daily-challenge'

export const Route = createFileRoute('/$locale/PRO')({
  validateSearch: (search: Record<string, unknown>) => ({
    platform: search.platform === 'psp' || search.platform === 'switch' ? search.platform : undefined,
  }),
  beforeLoad: ({ params }) => {
    const locale = normalizeLocale(params.locale)
    if (locale === 'en' || locale === 'ja') {
      throw redirect({ params: { locale }, replace: true, to: '/$locale' })
    }
  },
  loader: () => getThemePlatforms(),
  staleTime: 5 * 60 * 1000,
  preloadStaleTime: 5 * 60 * 1000,
  head: ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const seo = getI18n(locale).homeSeo
    return {
      links: getLocalizedSeoLinks({ locale, origin: SITE_ORIGIN, path: '/' }),
      meta: [
        { title: seo.title },
        { name: 'description', content: seo.description },
        { name: 'keywords', content: seo.keywords },
        { property: 'og:title', content: seo.title },
        { property: 'og:description', content: seo.description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: `${SITE_ORIGIN}/${locale}` },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: seo.title },
        { name: 'twitter:description', content: seo.description },
      ],
    }
  },
  component: ThemeMode,
})

function ThemeMode() {
  const { platforms: sourcePlatforms } = Route.useLoaderData()
  const requestedLibrary = Route.useSearch().platform
  const lang = normalizeLocale(Route.useParams().locale)
  const english = lang === 'en'
  const layoutCopy = getI18n(lang).layout
  const platforms = useMemo(() => {
    const merged: typeof sourcePlatforms = [
      { name: 'all-games' },
      { name: 'theme-favorites' },
      { name: 'theme-last-played' },
    ]
    let addedMd = false
    let addedFlash = false
    for (const item of sourcePlatforms) {
      const name = item.name.toLowerCase()
      if (name === 'genesis' || name === 'sega genesis') {
        if (!addedMd) {
          const members = sourcePlatforms.filter(entry => ['genesis', 'sega genesis'].includes(entry.name.toLowerCase()))
          merged.push({ ...item, name: 'Genesis', slug: 'theme-merged-md', count: members.reduce((sum, entry) => sum + (entry.count || 0), 0) })
          addedMd = true
        }
        continue
      }
      if (name === 'flash' || name === 'html5') {
        if (!addedFlash) {
          const members = sourcePlatforms.filter(entry => ['flash', 'html5'].includes(entry.name.toLowerCase()))
          merged.push({ ...item, name: 'Flash', slug: 'theme-merged-flash', count: members.reduce((sum, entry) => sum + (entry.count || 0), 0) })
          addedFlash = true
        }
        continue
      }
      merged.push(item)
    }
    const fcIndex = merged.findIndex(item => ['famicom', 'nes', 'nintendo entertainment system'].includes(item.name.toLowerCase()))
    const snesIndex = merged.findIndex(item => ['super famicom', 'snes', 'super nintendo'].includes(item.name.toLowerCase()))
    if (fcIndex >= 0 && snesIndex >= 0 && snesIndex !== fcIndex + 1) {
      const [snes] = merged.splice(snesIndex, 1)
      const updatedFcIndex = merged.findIndex(item => ['famicom', 'nes', 'nintendo entertainment system'].includes(item.name.toLowerCase()))
      merged.splice(updatedFcIndex + 1, 0, snes)
    }
    const segaItems = [
      merged.find(item => ['game gear', 'sega game gear'].includes(item.name.toLowerCase())),
      merged.find(item => item.slug === 'theme-merged-md' || ['genesis', 'sega genesis', 'mega drive', 'sega mega drive'].includes(item.name.toLowerCase())),
      merged.find(item => ['master system', 'sega master system', 'sms'].includes(item.name.toLowerCase())),
    ].filter((item): item is (typeof merged)[number] => Boolean(item))
    const saturn = merged.find(item => ['sega saturn', 'seag saturn', 'saturn'].includes(item.name.toLowerCase()))
    if (saturn && segaItems.length > 0) {
      for (const item of segaItems) {
        const index = merged.indexOf(item)
        if (index >= 0) merged.splice(index, 1)
      }
      const saturnIndex = merged.indexOf(saturn)
      merged.splice(saturnIndex + 1, 0, ...segaItems)
    }
    const endingPlatforms = [
      merged.find(item => isPspThemePlatform(item)),
      merged.find(item => ['playstation', 'playstation 1', 'ps1', 'psx'].includes(item.name.toLowerCase())),
      merged.find(item => isSwitchThemePlatform(item)),
    ].filter((item): item is (typeof merged)[number] => Boolean(item))
    for (const item of endingPlatforms) {
      const index = merged.indexOf(item)
      if (index >= 0) merged.splice(index, 1)
    }
    merged.push(...endingPlatforms)
    return merged
  }, [sourcePlatforms])
  const requestedLibraryIndex = platforms.findIndex(item => requestedLibrary === 'psp' ? isPspThemePlatform(item) : requestedLibrary === 'switch' ? isSwitchThemePlatform(item) : false)
  const [selected, setSelected] = useState(requestedLibraryIndex >= 0 ? requestedLibraryIndex : 0)
  const [inLibrary, setInLibrary] = useState(requestedLibraryIndex >= 0)
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [librarySort, setLibrarySort] = useState<'random' | 'popular' | 'updatedAt' | 'releaseDate'>('releaseDate')
  const [librarySortReverse, setLibrarySortReverse] = useState(false)
  const [librarySearchField, setLibrarySearchField] = useState<'all' | 'genre' | 'publisher'>('all')
  const [libraryRandomSeed, setLibraryRandomSeed] = useState(0)
  const [result, setResult] = useState<GameSearchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [gameIndex, setGameIndex] = useState(0)
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [showcaseVideoFailed, setShowcaseVideoFailed] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)
  const coinRewards = useHomeCoinRewards()
  const [dailyCheckIn, setDailyCheckIn] = useState({ completed: false, streak: 0 })
  const [fullscreen, setFullscreen] = useState(false)
  const [preferredMode, setPreferredMode] = useState(false)
  const [notice, setNotice] = useState('')
  const [favoriteGames, setFavoriteGames] = useState<Array<PublicGame>>([])
  const [browserStats, setBrowserStats] = useState({ favorites: 0, played: 0, frequent: '', lastDate: '' })
  const root = useRef<HTMLDivElement>(null)
  const lastWheel = useRef(0)
  const touchY = useRef(0)
  const navigationAudio = useRef<HTMLAudioElement | null>(null)
  const showcaseQueue = useRef<Array<number>>([])
  const platform = platforms[selected]
  const allGames = platform?.name === 'all-games'
  const favoritesPlatform = platform?.name === 'theme-favorites'
  const lastPlayedPlatform = platform?.name === 'theme-last-played'
  const platformIdentity = `${platform?.name || ''} ${platform?.slug || ''}`.toLowerCase()
  const atariPlatform = platformIdentity.includes('atari jaguar') || platformIdentity.includes('atarijaguar')
  const gbaPlatform = platformIdentity.includes('game boy advance') || platformIdentity.includes('gba')
  const sega32xPlatform = platformIdentity.includes('sega 32x') || platformIdentity.includes('sega32x')
  const virtualBoyPlatform = platformIdentity.includes('virtual boy') || platformIdentity.includes('virtualboy')
  const preciselyCenteredPlatform = ['java', 'j2me', 'sega 32x', 'sega32x', 'virtual boy', 'virtualboy', 'wonderswan', 'atari jaguar', 'atarijaguar']
    .some(name => platformIdentity.includes(name))
  const centeredCollectionPreview = allGames || favoritesPlatform || lastPlayedPlatform || preciselyCenteredPlatform
  const switchPlatform = isSwitchThemePlatform(platform)
  const pspPlatform = isPspThemePlatform(platform)

  useEffect(() => setPreferredMode(prefersThemeMode()), [])

  function togglePreferredMode() {
    const next = !preferredMode
    setPreferredMode(next)
    setThemeModePreference(next)
    setNotice(next
      ? (lang === 'zh-TW' ? '已設為預設模式' : '已设为默认模式')
      : (lang === 'zh-TW' ? '已取消預設模式' : '已取消默认模式'))
  }
  const asset = platform ? getThemeAsset(platform) : null
  const activeGame = result?.games[inLibrary ? gameIndex : showcaseIndex]
  const count = result?.pagination.total ?? platform?.count
  const platformLabel = themePlatformLabel(platform, lang) || getPlatformLabel(platform.name, lang)

  useEffect(() => {
    setDailyCheckIn(readProDailyCheckIn())
  }, [])

  function checkIn() {
    const current = readProDailyCheckIn()
    if (current.completed) return
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const streak = current.lastDate === getLocalDateKey(yesterday) ? current.streak + 1 : 1
    try {
      window.localStorage.setItem(DAILY_CHALLENGE_STORAGE_KEY, JSON.stringify({ lastCompletedDate: getLocalDateKey(now), streak }))
    } catch {
      // Keep the current visit usable when browser storage is unavailable.
    }
    setDailyCheckIn({ completed: true, streak })
    coinRewards.addCoins(streak * 10)
  }

  const advanceShowcase = useCallback(() => {
    const games = result?.games || []
    if (games.length < 2) return
    setShowcaseIndex(current => {
      if (showcaseQueue.current.length === 0) {
        showcaseQueue.current = createShowcaseQueue(games, current)
      }
      return showcaseQueue.current.shift() ?? current
    })
  }, [result?.games])

  useEffect(() => {
    const games = result?.games || []
    const queue = createShowcaseQueue(games)
    const first = queue.shift() ?? 0
    showcaseQueue.current = queue
    setShowcaseIndex(first)
  }, [platform?.name, result])

  useEffect(() => {
    setShowcaseVideoFailed(false)
  }, [activeGame?._id, activeGame?.url_slug])

  useEffect(() => {
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible')
    const restoreVisiblePage = () => setPageVisible(true)
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    window.addEventListener('focus', restoreVisiblePage)
    window.addEventListener('pageshow', restoreVisiblePage)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
      window.removeEventListener('focus', restoreVisiblePage)
      window.removeEventListener('pageshow', restoreVisiblePage)
    }
  }, [])

  useEffect(() => {
    if (inLibrary || !activeGame || !pageVisible) return
    const hasVideo = Boolean(!showcaseVideoFailed && activeGame.game_video && /\.(mp4|webm)(\?|$)/i.test(activeGame.game_video))
    if (hasVideo) return
    const timer = window.setTimeout(advanceShowcase, 10000)
    return () => window.clearTimeout(timer)
  }, [activeGame, advanceShowcase, inLibrary, pageVisible, showcaseVideoFailed])

  useEffect(() => {
    const syncFavorites = () => setFavoriteGames(readFavoriteGames())
    syncFavorites()
    window.addEventListener('storage', syncFavorites)
    window.addEventListener('ggemu-theme-favorites-changed', syncFavorites)
    return () => {
      window.removeEventListener('storage', syncFavorites)
      window.removeEventListener('ggemu-theme-favorites-changed', syncFavorites)
    }
  }, [])

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem('ggemu-recent-played-games') || '[]') as Array<{ name?: string; platform?: string; playedAt?: number }>
      const games = Array.isArray(parsed) ? parsed : []
      const platformNames = platform?.slug === 'theme-merged-md'
        ? ['genesis', 'sega genesis']
        : platform?.slug === 'theme-merged-flash'
          ? ['flash', 'html5']
          : [platform?.name.toLowerCase()]
      const relevant = allGames ? games : games.filter(game => Boolean(game.platform && platformNames.includes(game.platform.toLowerCase())))
      const latest = relevant.reduce<(typeof relevant)[number] | undefined>((current, game) => !current || (game.playedAt || 0) > (current.playedAt || 0) ? game : current, undefined)
      setBrowserStats({
        favorites: favoriteGames.filter(game => allGames || !game.platform || game.platform.toLowerCase() === platform?.name.toLowerCase()).length,
        played: relevant.length,
        frequent: latest?.name || '',
        lastDate: latest?.playedAt ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(latest.playedAt) : '',
      })
    } catch {
      setBrowserStats({ favorites: 0, played: 0, frequent: '', lastDate: '' })
    }
  }, [allGames, favoriteGames, lang, platform?.name, platform?.slug])

  const playNavigationSound = useCallback(() => {
    try {
      const audio = navigationAudio.current ?? new Audio('/themes/es-k-team/scroll.wav')
      navigationAudio.current = audio
      audio.volume = 0.7
      audio.currentTime = 0
      void audio.play().catch(() => {})
    } catch {
      // Sound support must never interrupt platform navigation.
    }
  }, [])

  const move = useCallback((delta: number) => {
    if (!platforms.length) return
    playNavigationSound()
    setSelected(value => (value + delta + platforms.length) % platforms.length)
    setPage(1); setQuery(''); setGameIndex(0); setResult(null)
  }, [platforms.length, playNavigationSound])

  useEffect(() => () => {
    navigationAudio.current?.pause()
    navigationAudio.current = null
  }, [])

  useEffect(() => {
    if (!platform) return
    let cancelled = false
    let hasFirstPage = false
    setLoading(true); setError(false); setGameIndex(0); setResult(null)
    if (favoritesPlatform || lastPlayedPlatform) {
      const games = favoritesPlatform ? favoriteGames : readRecentGamesForTheme()
      const normalizedQuery = query.trim().toLowerCase()
      const filtered = normalizedQuery ? games.filter(game => game.name?.toLowerCase().includes(normalizedQuery)) : games
      const start = (page - 1) * 24
      setResult(prioritizeFirstPageVideos({
        games: filtered.slice(start, start + 24),
        pagination: { total: filtered.length, page, limit: 24, pages: Math.max(1, Math.ceil(filtered.length / 24)) },
      }, page))
      setLoading(false)
      return
    }
    if (switchPlatform) {
      const games = prepareThemeLibraryGames(SWITCH_LIBRARY_GAMES, 'switch', query, librarySearchField, librarySort, librarySortReverse, libraryRandomSeed).map(game => ({
        _id: game.id,
        url_slug: game.id,
        name: game.title,
        description: game.description,
        developer: game.publisher,
        released_year: game.releaseDate,
        platform: 'Nintendo Switch',
        categories: [game.genre],
        languages: [game.language],
        game_cover: game.cover,
      }))
      setResult({ games, pagination: { total: games.length, page: 1, limit: games.length || 1, pages: 1 } })
      setLoading(false)
      return
    }
    if (pspPlatform) {
      const games = prepareThemeLibraryGames(PSP_LIBRARY_GAMES, 'psp', query, librarySearchField, librarySort, librarySortReverse, libraryRandomSeed).map(game => ({
        _id: game.id,
        url_slug: game.id,
        name: game.title,
        description: game.description,
        developer: game.publisher,
        released_year: game.releaseDate,
        platform: 'PSP',
        categories: [game.genre],
        languages: ['cardLanguage' in game ? String(game.cardLanguage ?? game.language) : game.language],
        game_cover: game.cover,
      }))
      setResult({ games, pagination: { total: games.length, page: 1, limit: games.length || 1, pages: 1 } })
      setLoading(false)
      return
    }
    const timer = window.setTimeout(() => {
      const mergedNames = platform.slug === 'theme-merged-md'
        ? sourcePlatforms.filter(item => ['genesis', 'sega genesis'].includes(item.name.toLowerCase())).map(item => item.name)
        : platform.slug === 'theme-merged-flash'
          ? sourcePlatforms.filter(item => ['flash', 'html5'].includes(item.name.toLowerCase())).map(item => item.name)
          : []
      const platformNames: Array<string | undefined> = allGames
        ? [undefined]
        : mergedNames.length > 0 ? mergedNames : [platform.name]
      const cacheKey = `${lang}:${platformNames.map(name => name || 'all-games').join('|').toLocaleLowerCase()}`
      const cachedGames = themeGamesCache.get(cacheKey)
      const completeGamesRequest = cachedGames ? Promise.resolve(cachedGames) : themeFirstPagesCache.load(`${cacheKey}:first`, () =>
        Promise.all(platformNames.map(platform => searchGames({ data: { platform, locale: lang, page: 1, limit: 100, query: '', sort: 'name_asc' } }))),
      ).then(firstPages => {
        if (!cancelled && !query && page === 1) {
          const total = firstPages.reduce((sum, first) => sum + first.pagination.total, 0)
          const initial = paginateThemePlatformGames(firstPages.flatMap(first => first.games), '', 1, allGames ? 18 : 24)
          setResult({ ...initial, pagination: { total, page: 1, limit: 24, pages: Math.max(1, Math.ceil(total / 24)) } })
          hasFirstPage = true
          setLoading(false)
        }
        return themeGamesCache.load(cacheKey, () => loadCompleteThemePlatform(platformNames, lang, firstPages))
      })
      const request = allGames
        ? Promise.all([
            completeGamesRequest,
            themeGamesCache.load(`${lang}:latest`, () => searchGames({ data: { platform: undefined, locale: lang, page: 1, limit: 24, query: '', sort: 'newest' } }).then(value => value.games)),
          ]).then(([games, latest]) => paginateThemePlatformGames(games, query, page, 18, latest))
        : completeGamesRequest.then(games => paginateThemePlatformGames(games, query, page, 24))
      request
        .then(value => { if (!cancelled) setResult(value) })
        .catch(() => { if (!cancelled && !hasFirstPage) setError(true) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, query ? 220 : 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [platform, allGames, favoritesPlatform, lastPlayedPlatform, favoriteGames, switchPlatform, pspPlatform, lang, page, query, retry, sourcePlatforms, librarySearchField, librarySort, librarySortReverse, libraryRandomSeed])

  function toggleFavorite(game: PublicGame) {
    const id = game.url_slug || game._id
    if (!id) return
    setFavoriteGames(current => {
      const next = current.some(item => (item.url_slug || item._id) === id)
        ? current.filter(item => (item.url_slug || item._id) !== id)
        : [game, ...current]
      window.localStorage.setItem('ggemu-theme-favorite-games', JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    root.current?.focus()
    const changed = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', changed)
    return () => { document.body.style.overflow = previous; document.removeEventListener('fullscreenchange', changed) }
  }, [])

  useEffect(() => {
    if (!inLibrary) {
      if (!platforms.length) return
      const preloadNeighbors = () => {
        const sources = new Set<string>()
        for (const offset of [-1, 1]) {
          const neighbor = getThemeAsset(platforms[(selected + offset + platforms.length) % platforms.length])
          sources.add(window.innerWidth > 1920 ? neighbor.background : getOptimizedThemeBackground(neighbor.background))
          if (neighbor.console) sources.add(getLosslessThemeImage(neighbor.console))
        }
        for (const source of sources) {
          const image = new Image()
          image.decoding = 'async'
          image.fetchPriority = 'low'
          image.src = source
          void image.decode().catch(() => {})
        }
      }
      const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
      if (idleWindow.requestIdleCallback) {
        const id = idleWindow.requestIdleCallback(preloadNeighbors, { timeout: 1800 })
        return () => idleWindow.cancelIdleCallback?.(id)
      }
      const timer = window.setTimeout(preloadNeighbors, 300)
      return () => window.clearTimeout(timer)
    }
  }, [inLibrary, selected, platforms])

  useEffect(() => {
    const list = root.current?.querySelector<HTMLElement>('.kt-game-list')
    const item = list?.querySelector<HTMLElement>('[data-active-game="true"]')
    if (!list || !item) return
    const container = list.getBoundingClientRect()
    const row = item.getBoundingClientRect()
    if (row.top < container.top) list.scrollTop += row.top - container.top
    else if (row.bottom > container.bottom) list.scrollTop += row.bottom - container.bottom
    if (row.left < container.left) list.scrollLeft += row.left - container.left
    else if (row.right > container.right) list.scrollLeft += row.right - container.right
  }, [gameIndex])

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await root.current?.requestFullscreen()
    } catch { setNotice(english ? 'Browser fullscreen unavailable. Window-filling mode is active.' : '当前浏览器不支持全屏，已使用铺满窗口模式。') }
  }

  function enter() {
    setInLibrary(true); setGameIndex(0)
  }
  function back() { setInLibrary(false); setQuery(''); setPage(1) }
  function keyDown(event: React.KeyboardEvent) {
    if ((event.target as HTMLElement).closest('input')) return
    if (event.key === 'Escape' && inLibrary) { event.preventDefault(); back() }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      const delta = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1
      if (inLibrary) setGameIndex(value => Math.max(0, Math.min((result?.games.length || 1) - 1, value + delta)))
      else move(delta)
    }
    if (event.key === 'Enter' && (!(event.target as HTMLElement).closest('button,a') || (event.target as HTMLElement).closest('.kt-game-list,.kt-wheel'))) {
      event.preventDefault()
      if (!inLibrary) enter()
      else root.current?.querySelector<HTMLAnchorElement>('[data-start-game]')?.click()
    }
  }

  if (!platform || !asset) return <div className="kt-root"><a href={`/${lang}#classic`}>{english ? 'No platforms available · Home' : '暂无平台数据 · 返回首页'}</a></div>
  const box = (position: number[], size: number[]): CSSProperties => ({ left: `${position[0] * 100}%`, top: `${position[1] * 100}%`, width: `${size[0] * 100}%`, height: `${size[1] * 100}%` })

  return (
    <div className="kt-root" ref={root} tabIndex={-1} onKeyDown={keyDown}>
      <div className="kt-rotate-notice" role="status">
        <span aria-hidden="true">↻</span>
        <strong>{english ? 'Please rotate your phone' : lang === 'ja' ? 'スマートフォンを横向きにしてください' : lang === 'zh-TW' ? '請將手機旋轉為橫屏' : '请将手机旋转为横屏'}</strong>
        <small>{english ? 'Theme mode is available in landscape.' : lang === 'ja' ? 'テーマモードは横画面で利用できます。' : lang === 'zh-TW' ? '主題模式僅支援橫屏操作' : '主题模式仅支持横屏操作'}</small>
      </div>
      <div className="kt-stage">
        <picture>
          <source media="(max-width: 1920px)" srcSet={getOptimizedThemeBackground(asset.background)} />
          <img alt="" className="kt-background" decoding="async" fetchPriority="high" key={asset.background} src={asset.background} />
        </picture>
        <div className="kt-shade" />
        <header className="kt-header">
          <button className={preferredMode ? 'is-liked' : ''} onClick={togglePreferredMode}>{preferredMode ? (lang === 'zh-TW' ? '已喜歡' : '已喜欢') : (lang === 'zh-TW' ? '喜歡' : '喜欢')} ♥</button>
          <button onClick={toggleFullscreen}>{fullscreen ? (english ? 'Exit fullscreen' : '退出全屏') : (english ? 'Fullscreen' : '全屏')} ⛶</button>
        </header>

        {!inLibrary ? <>
          <div className="kt-platform-marquee" aria-label={asset.description || platform.name}>
            <div>
              <span>{asset.description || platform.name}</span>
              <span aria-hidden="true">{asset.description || platform.name}</span>
            </div>
          </div>
          <section className="kt-description" aria-live="polite">
            <span className="kt-eyebrow">{String(selected + 1).padStart(2, '0')} / {String(platforms.length).padStart(2, '0')}　 PLATFORM SELECT</span>
            <h1>{platformLabel}</h1>
            {(switchPlatform || pspPlatform) ? <p className="kt-switch-notice">{getSwitchPlatformNotice(lang).map(line => <span key={line}>{line}</span>)}</p> : null}
          </section>
          <div className="kt-scene" key={platform.name}>
            {asset.console ? <>
              <div className={`kt-machine-video ${centeredCollectionPreview ? 'is-centered' : ''} ${!preciselyCenteredPlatform && centeredCollectionPreview ? 'is-nudged-left' : ''} ${atariPlatform ? 'is-atari' : ''} ${gbaPlatform ? 'is-gba' : ''} ${sega32xPlatform ? 'is-sega32x' : ''}`} style={{ ...box(asset.videoPosition, asset.videoSize), ...(gbaPlatform ? { height: `calc(${asset.videoSize[1] * 100}% + 3px)` } : {}), ...(sega32xPlatform ? { width: `calc(${asset.videoSize[0] * 100}% + 5px)` } : {}), ...(virtualBoyPlatform ? { width: `calc(${asset.videoSize[0] * 100}% + 40px)` } : {}) }}><GamePreview game={activeGame} onEnded={advanceShowcase} onVideoError={() => setShowcaseVideoFailed(true)} playing={pageVisible} /></div>
              <img className="kt-console" src={getLosslessThemeImage(asset.console)} decoding="async" fetchPriority="high" alt="" style={box(asset.consolePosition, asset.consoleSize)} />
            </> : <div className="kt-fallback-preview"><GamePreview game={activeGame} onEnded={advanceShowcase} onVideoError={() => setShowcaseVideoFailed(true)} playing={pageVisible} /></div>}
          </div>
          <div className="kt-platform-info">
            <dl>
              <div><dt>{english ? 'Games' : lang === 'ja' ? 'ゲーム数' : lang === 'zh-TW' ? '遊戲數量' : '游戏数量'}：</dt><dd>{loading ? '…' : count == null ? '—' : count.toLocaleString()}{english ? '' : '款'}</dd></div>
              <div><dt>{english ? 'Favorites' : lang === 'ja' ? 'お気に入り' : lang === 'zh-TW' ? '最愛的遊戲' : '最爱的游戏'}：</dt><dd>{browserStats.favorites}{english ? '' : '款'}</dd></div>
              <div><dt>{english ? 'Played' : lang === 'ja' ? '遊んだゲーム' : lang === 'zh-TW' ? '玩過的遊戲' : '玩过的游戏'}：</dt><dd>{browserStats.played}{english ? '' : '款'}</dd></div>
              <div><dt>{english ? 'Frequent game' : lang === 'ja' ? 'よく遊ぶゲーム' : lang === 'zh-TW' ? '常玩的遊戲' : '常玩的游戏'}：</dt><dd>{browserStats.frequent || (english ? 'No record' : '暂无记录')}</dd></div>
              <div><dt>{english ? 'Last game' : lang === 'ja' ? '最後のゲーム' : lang === 'zh-TW' ? '最後遊戲' : '最后游戏'}：</dt><dd>{browserStats.lastDate || (english ? 'No record' : '暂无记录')}</dd></div>
            </dl>
          </div>
          <img src={getLosslessThemeImage('/themes/es-k-team/wheel.png')} decoding="async" className="kt-wheel-art" alt="" />
          <nav className="kt-wheel" aria-label={english ? 'Select platform' : '选择游戏平台'}
            onWheel={event => { if (Math.abs(event.deltaY) > 8 && Date.now() - lastWheel.current > 180) { lastWheel.current = Date.now(); move(event.deltaY > 0 ? 1 : -1) } }}
            onTouchStart={event => { touchY.current = event.touches[0].clientY }}
            onTouchEnd={event => { const delta = touchY.current - event.changedTouches[0].clientY; if (Math.abs(delta) > 25) move(delta > 0 ? 1 : -1) }}>
            {platforms.map((item, index) => {
              let offset = (index - selected + platforms.length) % platforms.length
              if (offset > platforms.length / 2) offset -= platforms.length
              if (Math.abs(offset) > 3) return null
              const itemAsset = getThemeAsset(item)
              return <button key={item.name} className={`kt-wheel-item ${offset === 0 ? 'is-selected' : ''}`} aria-current={offset === 0 ? 'true' : undefined}
                aria-label={themePlatformLabel(item, lang) || getPlatformLabel(item.name, lang)} style={{ '--offset': offset, '--curve': Math.abs(offset) ** 2 } as CSSProperties}
                onClick={() => offset === 0 ? enter() : move(offset)}>
                {itemAsset.logo ? <img src={getOptimizedThemeLogo(itemAsset.logo)} alt={themePlatformLabel(item, lang) || getPlatformLabel(item.name, lang)} decoding="async" draggable={false} /> : <span>{themePlatformLabel(item, lang) || getPlatformLabel(item.name, lang)}</span>}
              </button>
            })}
          </nav>
          <img className="kt-pointer" src={getLosslessThemeImage(asset.pointer)} decoding="async" alt="" />
        </> : <section className="kt-library">
          <div className="kt-library-top">
            <button onClick={back}>← {english ? 'Platforms' : '平台选择'}</button><h1>{platformLabel}</h1>
            {(switchPlatform || pspPlatform) ? <a
              className="kt-library-archive"
              href={switchPlatform ? 'https://www.kdocs.cn/l/cs8H4NUI4lC4' : 'https://www.kdocs.cn/l/coH3Z1VLgop3'}
              rel="noreferrer"
              target="_blank"
            >{switchPlatform ? (lang === 'zh-TW' ? 'Switch全遊戲檔案' : 'Switch全游戏档案') : (lang === 'zh-TW' ? 'PSP全遊戲檔案' : 'PSP全游戏档案')}</a> : null}
            {(switchPlatform || pspPlatform) ? <div className="kt-library-filters">
              {getThemeLibraryFilters(lang).map(filter => <button
                aria-pressed={filter.field === librarySearchField || filter.field === librarySort}
                className={filter.field === librarySearchField || filter.field === librarySort ? 'is-active' : ''}
                key={filter.field}
                onClick={() => {
                  if (filter.field === 'genre' || filter.field === 'publisher') setLibrarySearchField(filter.field)
                  else {
                    setLibrarySearchField('all')
                    setLibrarySortReverse(filter.field === librarySort && filter.field !== 'random' ? value => !value : false)
                    setLibrarySort(filter.field)
                    if (filter.field === 'random') setLibraryRandomSeed(Date.now())
                  }
                  setPage(1)
                }}
                type="button"
              >{filter.label}{filter.field === librarySort && filter.field !== 'random' ? <span aria-hidden="true">{librarySortReverse ? '↑' : '↓'}</span> : null}</button>)}
            </div> : null}
            <input aria-label="搜索游戏" placeholder={getThemeLibrarySearchPlaceholder(lang, librarySearchField)} value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
          </div>
          <div className={`kt-game-list${switchPlatform || pspPlatform ? ' kt-download-list' : ''}`} aria-label="游戏列表" aria-busy={loading}>
            {loading ? <p role="status">{english ? 'Loading games…' : '正在加载游戏…'}</p> : error ? <p role="alert">{english ? 'Could not load games.' : '游戏加载失败。'} <button onClick={() => setRetry(v => v + 1)}>{english ? 'Retry' : '重试'}</button></p> : !result?.games.length ? <p>{english ? 'No games found' : '没有找到游戏'}</p> : result.games.map((game, index) => {
              const id = game.url_slug || game._id
              const favorite = favoriteGames.some(item => (item.url_slug || item._id) === id)
              return <div key={id} data-active-game={index === gameIndex} className={`kt-game-row ${index === gameIndex ? 'is-selected' : ''}`}>
                <a
                  className={`kt-game-select${switchPlatform || pspPlatform ? ' kt-download-card' : ''}`}
                  data-start-game
                  href={switchPlatform ? `/${lang}/platform/switch/${id}#PRO` : pspPlatform ? `/${lang}/platform/psp/${id}#PRO` : `/${lang}/games/${id}#PRO`}
                  onFocus={() => setGameIndex(index)}
                >
                  <span className="kt-game-number">{String((page - 1) * 24 + index + 1).padStart(3, '0')}</span>
                  <ThemeGameCardPreview game={game} eager={index < 6} />
                  <strong>{game.name}</strong>
                  {(switchPlatform || pspPlatform) ? <small className="kt-game-meta">{formatThemeLibraryCardMeta(game)}</small> : null}
                </a>
                {allGames && <button className={`kt-favorite ${favorite ? 'is-favorite' : ''}`} aria-label={favorite ? '取消收藏' : '收藏游戏'} aria-pressed={favorite} onClick={() => toggleFavorite(game)}>{favorite ? '♥' : '♡'}</button>}
              </div>
            })}
          </div>
          <div className="kt-pagination"><button disabled={loading || page <= 1} onClick={() => setPage(v => v - 1)}>← {english ? 'Previous' : '上一页'}</button><span>{page} / {result?.pagination.pages || 1}</span><button disabled={loading || !result || page >= result.pagination.pages} onClick={() => setPage(v => v + 1)}>{english ? 'Next' : '下一页'} →</button></div>
        </section>}
        <footer className="kt-footer">
          <div className="kt-footer-brand">
            <a href={`/${lang}#classic`} aria-label={layoutCopy.siteName}><img src="/logo.png" alt="" /><span className="kt-footer-title"><strong>{layoutCopy.siteName}</strong><small>{layoutCopy.siteSlogan}</small></span></a>
            <HomeCoinBag balance={coinRewards.balance} lang={lang} onOpen={() => {}} />
            <CoinRankBadge balance={coinRewards.balance} compact lang={lang} />
            <Link className="kt-footer-shortcut" to="/$locale/platform/$platformId" params={{ locale: lang, platformId: 'coin' }} hash="PRO">{getThemeFooterCopy(lang).coinMode}</Link>
            <Link className="kt-footer-shortcut" to="/$locale/original-games" params={{ locale: lang }} hash="PRO">{getOriginalGamesTitle(lang)}</Link>
          </div>
          <span className="kt-footer-help"><strong>游戏交流Q群：62119057</strong><small>喜欢V群的（比较活跃）：扫主页的码-需要手拉</small></span>
          <div className="kt-footer-actions">
            <button className="kt-check-in" disabled={dailyCheckIn.completed} onClick={checkIn} type="button">{dailyCheckIn.completed ? '已签到' : '签到'}</button>
            <Link to="/$locale/live" params={{ locale: lang }} hash="PRO" className="kt-watch"><span aria-hidden="true" className="live-watch-eye"><span className="live-watch-pupil" /></span><span>{getThemeFooterCopy(lang).watching}</span></Link>
            <details className="kt-language"><summary>{lang === 'zh-CN' ? '简' : lang === 'zh-TW' ? '繁' : lang === 'en' ? '英' : '日'} ▴</summary><div>
              {(['zh-CN', 'zh-TW'] as const).map(locale => <Link key={locale} to="/$locale/PRO" params={{ locale }} search={{ platform: undefined }}>{locale === 'zh-CN' ? '简' : '繁'}</Link>)}
            </div></details>
            <span className="kt-version">v1.1</span>
          </div>
        </footer>
        {notice && <button className="kt-notice" onClick={() => setNotice('')}>{notice} ×</button>}
      </div>
      <FloatingHomeCoin lang={lang} onCollect={coinRewards.collectFloatingCoin} positions={coinRewards.coinPositions} />
      <FlyingCollectedCoin flight={coinRewards.collectedCoinFlight} />
      <CoinRewardPopup feedback={coinRewards.rewardFeedback} />
    </div>
  )
}

function getThemeFooterCopy(lang: ReturnType<typeof normalizeLocale>) {
  if (lang === 'zh-TW') return { coinMode: '金幣模式', watching: '看別人在玩什麼' }
  if (lang === 'en') return { coinMode: 'Coin Mode', watching: 'See What Others Play' }
  if (lang === 'ja') return { coinMode: 'コインモード', watching: 'みんなが遊んでいるゲーム' }
  return { coinMode: '金币模式', watching: '看别人在玩什么' }
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readProDailyCheckIn() {
  const fallback = { completed: false, lastDate: '', streak: 0 }
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(DAILY_CHALLENGE_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) as { lastCompletedDate?: string; streak?: number } : null
    const lastDate = parsed?.lastCompletedDate || ''
    return {
      completed: lastDate === getLocalDateKey(new Date()),
      lastDate,
      streak: Math.max(0, Number(parsed?.streak) || 0),
    }
  } catch {
    return fallback
  }
}

function getSwitchPlatformNotice(lang: ReturnType<typeof normalizeLocale>) {
  if (lang === 'zh-TW') return ['此平台僅整理遊戲資料', '無法直接線上遊玩', '不分享 ROM', '如需遊玩，請自行下載並搭配模擬器']
  if (lang === 'en') return ['This platform is for game information only.', 'Games cannot be played online here.', 'ROM files are not shared.', 'Download games yourself and use an emulator to play.']
  if (lang === 'ja') return ['このプラットフォームはゲーム資料の整理専用です', 'オンラインで直接プレイすることはできません', 'ROMは共有していません', '遊ぶ場合は各自でダウンロードし、エミュレーターをご利用ください']
  return ['这个平台只是游戏资料整理', '不能在线直接游玩', '不分享 ROM', '想玩需自行下载搭配模拟器去玩']
}

function getThemeLibraryFilters(lang: ReturnType<typeof normalizeLocale>) {
  if (lang === 'zh-TW') return [{ field: 'random' as const, label: '隨機' }, { field: 'popular' as const, label: '最受歡迎' }, { field: 'updatedAt' as const, label: '更新時間' }, { field: 'genre' as const, label: '遊戲類型' }, { field: 'publisher' as const, label: '遊戲廠商' }, { field: 'releaseDate' as const, label: '發行日期' }]
  return [{ field: 'random' as const, label: '随机' }, { field: 'popular' as const, label: '最受欢迎' }, { field: 'updatedAt' as const, label: '更新时间' }, { field: 'genre' as const, label: '游戏类型' }, { field: 'publisher' as const, label: '游戏厂商' }, { field: 'releaseDate' as const, label: '发行日期' }]
}

function getThemeLibrarySearchPlaceholder(lang: ReturnType<typeof normalizeLocale>, field: 'all' | 'genre' | 'publisher') {
  if (lang === 'zh-TW') return field === 'genre' ? '搜尋遊戲類型' : field === 'publisher' ? '搜尋遊戲廠商' : '搜尋遊戲'
  return field === 'genre' ? '搜索游戏类型' : field === 'publisher' ? '搜索游戏厂商' : '搜索游戏'
}

type ThemeLibraryGame = (typeof SWITCH_LIBRARY_GAMES)[number]

function prepareThemeLibraryGames<T extends ThemeLibraryGame>(
  library: Array<T>,
  platform: 'switch' | 'psp',
  query: string,
  searchField: 'all' | 'genre' | 'publisher',
  sort: 'random' | 'popular' | 'updatedAt' | 'releaseDate',
  reverse: boolean,
  randomSeed: number,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const games = library.filter(game => {
    if (!normalizedQuery) return true
    const values = searchField === 'genre'
      ? [game.genre]
      : searchField === 'publisher'
        ? [game.publisher]
        : [game.title, game.foreignTitle || '', game.genre, game.publisher, game.releaseDate, game.language, game.description]
    return values.some(value => value.toLocaleLowerCase().includes(normalizedQuery))
  })
  return games.sort((left, right) => {
    let result = 0
    if (sort === 'popular') result = (right.popularity || 0) - (left.popularity || 0)
    else if (sort === 'updatedAt') result = getThemeLibraryUpdateTime(platform, right) - getThemeLibraryUpdateTime(platform, left) || parseThemeLibraryDate(right.releaseDate) - parseThemeLibraryDate(left.releaseDate)
    else if (sort === 'random') return hashThemeLibraryId(`${left.id}:${randomSeed}`) - hashThemeLibraryId(`${right.id}:${randomSeed}`)
    else result = parseThemeLibraryDate(right.releaseDate) - parseThemeLibraryDate(left.releaseDate)
    return reverse ? -result : result
  })
}

function getThemeLibraryUpdateTime(platform: 'switch' | 'psp', game: ThemeLibraryGame) {
  const updates = libraryUpdates as Record<string, { updatedAt?: string | null }>
  return Date.parse(updates[`${platform}/${game.id}`]?.updatedAt ?? game.updatedAt ?? '') || 0
}

function parseThemeLibraryDate(value: string) {
  const parts = value.trim().match(/^(\d{4})[-./年](\d{1,2})?(?:[-./月](\d{1,2}))?/)
  if (parts) return Date.UTC(Number(parts[1]), Math.max(0, Number(parts[2] || 1) - 1), Number(parts[3] || 1))
  return Date.parse(value) || 0
}

function formatThemeLibraryCardMeta(game: PublicGame) {
  const language = game.languages?.[0]?.split(/[、，,\/；;]/)[0]?.trim() || ''
  const genre = game.categories?.[0]?.split('、')[0]?.trim() || ''
  return [game.platform === 'Nintendo Switch' ? 'Switch' : game.platform, language, genre, game.released_year].filter(Boolean).join(' · ')
}

function hashThemeLibraryId(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  return hash
}

function prioritizeFirstPageVideos(result: GameSearchResult, page: number) {
  if (page !== 1 || result.games.length < 2) return result

  return {
    ...result,
    games: result.games
      .map((game, index) => ({ game, index }))
      .sort((left, right) => {
        const leftHasVideo = Boolean(left.game.game_video && /\.(mp4|webm)(\?|$)/i.test(left.game.game_video))
        const rightHasVideo = Boolean(right.game.game_video && /\.(mp4|webm)(\?|$)/i.test(right.game.game_video))
        return Number(rightHasVideo) - Number(leftHasVideo) || left.index - right.index
      })
      .map(item => item.game),
  }
}

async function loadCompleteThemePlatform(
  platformNames: Array<string | undefined>,
  locale: ReturnType<typeof normalizeLocale>,
  firstPages: Array<GameSearchResult>,
) {
  const groups = await Promise.all(platformNames.map(async (platform, index) => {
    const first = firstPages[index]
    const remaining = []
    const pages = Array.from({ length: Math.max(0, first.pagination.pages - 1) }, (_, index) => index + 2)
    for (let offset = 0; offset < pages.length; offset += 4) {
      remaining.push(...await Promise.all(pages.slice(offset, offset + 4).map(page =>
        searchGames({ data: { platform, locale, page, limit: 100, query: '', sort: 'name_asc' } }),
      )))
    }
    return [first.games, ...remaining.map(result => result.games)].flat()
  }))

  const seen = new Set<string>()
  const games = groups.flat().filter(game => {
    const id = game.url_slug || game._id || game.name
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
  return games
}

function paginateThemePlatformGames(
  games: Array<PublicGame>,
  query: string,
  page: number,
  firstPageVideoLimit: number,
  newestGames: Array<PublicGame> = [],
): GameSearchResult {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const filtered = normalizedQuery
    ? games.filter(game => [game.name, game.keywords, game.description, game.developer, game.platform, ...(game.categories || [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery))
    : games
  const limit = 24
  const videos = filtered.filter(game => Boolean(game.game_video && /\.(mp4|webm)(\?|$)/i.test(game.game_video)))
  const images = filtered.filter(game => !game.game_video || !/\.(mp4|webm)(\?|$)/i.test(game.game_video))
  const filteredIds = new Set(filtered.map(game => game.url_slug || game._id || game.name))
  const latestLimit = newestGames.length > 0 ? Math.max(0, limit - firstPageVideoLimit) : 0
  const latestFill = newestGames
    .filter(game => {
      const id = game.url_slug || game._id || game.name
      return Boolean(id && filteredIds.has(id))
    })
    .slice(0, latestLimit)
  const latestIds = new Set(latestFill.map(game => game.url_slug || game._id || game.name))
  const promotedVideos = videos
    .filter(game => !latestIds.has(game.url_slug || game._id || game.name))
    .slice(0, firstPageVideoLimit)
  const firstPageIds = new Set([...promotedVideos, ...latestFill].map(game => game.url_slug || game._id || game.name))
  const fallbackFill = [...videos, ...images]
    .filter(game => !firstPageIds.has(game.url_slug || game._id || game.name))
    .slice(0, Math.max(0, limit - firstPageIds.size))
  const firstPage = [...latestFill, ...promotedVideos, ...fallbackFill]
  const completeFirstPageIds = new Set(firstPage.map(game => game.url_slug || game._id || game.name))
  const ordered = [
    ...firstPage,
    ...videos.filter(game => !completeFirstPageIds.has(game.url_slug || game._id || game.name)),
    ...images.filter(game => !completeFirstPageIds.has(game.url_slug || game._id || game.name)),
  ]
  const pages = Math.max(1, Math.ceil(ordered.length / limit))
  const safePage = Math.min(page, pages)
  const start = (safePage - 1) * limit

  return {
    games: ordered.slice(start, start + limit),
    pagination: { total: ordered.length, page: safePage, limit, pages },
  }
}

function isSwitchThemePlatform(platform?: FilterOption) {
  return Boolean(platform && `${platform.name} ${platform.slug || ''}`.toLowerCase().replace(/[^a-z]/g, '').includes('switch'))
}

function isPspThemePlatform(platform?: FilterOption) {
  if (!platform) return false
  const identity = `${platform.name} ${platform.slug || ''}`.toLowerCase().replace(/[^a-z]/g, '')
  return identity.includes('psp') || identity.includes('playstationportable')
}

function readFavoriteGames() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('ggemu-theme-favorite-games') || '[]')
    return Array.isArray(parsed) ? parsed as Array<PublicGame> : []
  } catch {
    return []
  }
}

function readRecentGamesForTheme() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('ggemu-recent-played-games') || '[]') as Array<{ cover?: string; id?: string; name?: string; platform?: string }>
    if (!Array.isArray(parsed)) return []
    return parsed.filter(game => game.id && game.name).map(game => ({
      _id: game.id,
      url_slug: game.id,
      name: game.name,
      platform: game.platform,
      game_cover: game.cover,
    }))
  } catch {
    return []
  }
}

function createShowcaseQueue(games: Array<PublicGame>, avoidFirst = -1) {
  const shuffle = (indices: Array<number>) => {
    const next = [...indices]
    for (let index = next.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1))
      ;[next[index], next[target]] = [next[target], next[index]]
    }
    return next
  }
  const videos: Array<number> = []
  const images: Array<number> = []
  games.forEach((game, index) => {
    const target = game.game_video && /\.(mp4|webm)(\?|$)/i.test(game.game_video) ? videos : images
    target.push(index)
  })
  const queue = [...shuffle(videos), ...shuffle(images)]
  if (queue.length > 1 && queue[0] === avoidFirst) {
    const replacement = queue.findIndex(index => index !== avoidFirst)
    if (replacement > 0) [queue[0], queue[replacement]] = [queue[replacement], queue[0]]
  }
  return queue
}

function getOptimizedThemeBackground(background: string) {
  return background.replace(/\.jpe?g$/i, '-1920.jpeg')
}

function getOptimizedThemeLogo(logo: string) {
  return getLosslessThemeImage(logo.replace(/\.png$/i, '-800.png'))
}

function getLosslessThemeImage(source: string) {
  return (themeImageFormats as Record<string, string>)[source] || source
}

function GamePreview({ game, onEnded, onVideoError, playing = true }: { game?: PublicGame; onEnded?: () => void; onVideoError?: () => void; playing?: boolean }) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => setFailed(false), [game?.game_video])
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (!playing) {
      video.pause()
      return
    }
    void video.play().catch(() => {})
  }, [game?.game_video, playing])
  if (game?.game_video && /\.(mp4|webm)(\?|$)/i.test(game.game_video) && !failed) return <video ref={videoRef} src={game.game_video} poster={game.game_cover} autoPlay={playing} preload="metadata" loop={!onEnded} muted playsInline onCanPlay={() => { if (playing) void videoRef.current?.play().catch(() => {}) }} onEnded={onEnded} onError={() => { setFailed(true); onVideoError?.() }} />
  return game?.game_cover ? <img src={game.game_cover} alt={game.name || ''} decoding="async" /> : <div className="kt-preview-placeholder">UCG999<span>SELECT YOUR GAME</span></div>
}

function ThemeGameCardPreview({ game, eager = false }: { game: PublicGame; eager?: boolean }) {
  const [hovered, setHovered] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const playableVideo = Boolean(game.game_video && /\.(mp4|webm)(\?|$)/i.test(game.game_video))

  return (
    <span className="kt-game-cover" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {hovered && playableVideo && !videoFailed
        ? <video autoPlay loop muted playsInline poster={game.game_cover} preload="none" src={game.game_video} onError={() => setVideoFailed(true)} />
        : game.game_cover
          ? <img alt="" decoding="async" loading={eager ? 'eager' : 'lazy'} src={game.game_cover} />
          : <span>UCG999</span>}
    </span>
  )
}
