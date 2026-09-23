import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'

import { getGameDetail, getRandomPlayableGame, type GameFilterOptions, type Locale, type PublicGame } from '#/lib/ggemu'
import { getHomeFaqs, getI18n, normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { getOriginalGamesTitle } from '#/lib/original-games'
import { getSiteThemes, normalizeSiteTheme } from '#/lib/site-themes'
import { CoinRankBadge, HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'
import { addCoinBalance, prepareRandomGameCoinMultiplier } from '#/lib/coin-wallet'
import { confirmResourceDownload, unlockPaidResource } from '#/lib/paid-resource'

const SITE_VISIT_COIN_SESSION_KEY = 'game-adventure-site-visit-coin-awarded'
const DESKTOP_SIDEBAR_STATE_KEY = 'retro-games-desktop-sidebar-state'
const DAILY_CHECK_IN_STORAGE_KEY = 'game-adventure-daily-challenge'

export function SiteLayout({
  children,
  brandAddon,
  headerActions,
  hideHeaderNav = false,
  hideFooterOnMobile = false,
  hideFooter = false,
  gameFilterOptions,
  locale,
  onOpenSearch,
  topContent,
}: {
  children: ReactNode
  brandAddon?: ReactNode
  gameFilterOptions?: GameFilterOptions
  headerActions?: ReactNode
  hideHeaderNav?: boolean
  hideFooterOnMobile?: boolean
  hideFooter?: boolean
  locale: Locale
  onOpenSearch?: () => void
  topContent?: ReactNode
}) {
  const t = getI18n(locale).layout
  const homeT = getI18n(locale).home
  const location = useRouterState({ select: (state) => state.location })
  const navigate = useNavigate()
  const isHomePage = location.pathname.replace(/\/+$/, '') === `/${locale}` || location.pathname === '/'
  const siteThemes = getSiteThemes()
  const [theme, setTheme] = useState(() => normalizeSiteTheme(null))
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false)
  const [isUsefulMenuOpen, setIsUsefulMenuOpen] = useState(true)
  const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(true)
  const localeMenuRef = useRef<HTMLDetailsElement>(null)
  const edgeSwipeRef = useRef<{ identifier: number; x: number; y: number } | null>(null)
  const canSwitchTheme = siteThemes.length > 1
  const sidebarSearchParams = new URLSearchParams(location.searchStr)
  const globalCoins = useGlobalCoinBalance()
  const [dailyCheckIn, setDailyCheckIn] = useState({ completed: false, lastDate: '', streak: 0 })
  const [randomPopupGame, setRandomPopupGame] = useState<PublicGame | null>(null)
  const [randomPopupMultiplier, setRandomPopupMultiplier] = useState(2)
  const [isRandomGameLoading, setIsRandomGameLoading] = useState(false)
  const loadRandomGame = useServerFn(getRandomPlayableGame)
  const loadGameDetail = useServerFn(getGameDetail)

  async function showRandomGame() {
    if (isRandomGameLoading) return
    setIsRandomGameLoading(true)
    try {
      const randomGame = await loadRandomGame({ data: {} })
      const gameId = randomGame?.url_slug?.trim() || randomGame?._id?.trim()
      if (!gameId) return
      const multiplier = prepareRandomGameCoinMultiplier()
      const game = await loadGameDetail({ data: { id: gameId } })
      setRandomPopupMultiplier(multiplier)
      setRandomPopupGame(game)
    } finally {
      setIsRandomGameLoading(false)
    }
  }

  useEffect(() => {
    const current = readDailyCheckIn()
    setDailyCheckIn(current)
  }, [])

  function handleDailyCheckIn() {
    const current = readDailyCheckIn()
    if (current.completed) return
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(now.getDate() - 1)
    const streak = current.lastDate === getSiteDateKey(yesterday) ? current.streak + 1 : 1
    try {
      window.localStorage.setItem(DAILY_CHECK_IN_STORAGE_KEY, JSON.stringify({ lastCompletedDate: getSiteDateKey(now), streak }))
    } catch {
      // Keep check-in usable for the current visit if storage is unavailable.
    }
    addCoinBalance(streak * 10)
    setDailyCheckIn({ completed: true, lastDate: getSiteDateKey(now), streak })
  }

  useEffect(() => {
    const storedTheme = normalizeSiteTheme(
      window.localStorage.getItem('retro-games-theme'),
    )
    setTheme(storedTheme)
    document.documentElement.dataset.theme = storedTheme
  }, [])

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SITE_VISIT_COIN_SESSION_KEY) === '1') return
      window.sessionStorage.setItem(SITE_VISIT_COIN_SESSION_KEY, '1')
      addCoinBalance(1)
    } catch {
      // The site remains usable when session storage is unavailable.
    }
  }, [])

  useEffect(() => {
    setIsMobileSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    try {
      const storedState = window.localStorage.getItem(DESKTOP_SIDEBAR_STATE_KEY)

      if (storedState === 'open') {
        setIsDesktopSidebarCollapsed(false)
      } else if (storedState === 'closed') {
        setIsDesktopSidebarCollapsed(true)
      }
    } catch {
      // Keep the default collapsed state when local storage is unavailable.
    }
  }, [])

  useEffect(() => {
    if (hideHeaderNav) return

    const handleTouchStart = (event: TouchEvent) => {
      const touch = event.changedTouches[0]
      if (!touch || touch.clientX > 28 || isMobileSidebarOpen) return
      edgeSwipeRef.current = {
        identifier: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
      }
    }
    const handleTouchMove = (event: TouchEvent) => {
      const start = edgeSwipeRef.current
      if (!start) return
      const touch = Array.from(event.changedTouches).find(
        (item) => item.identifier === start.identifier,
      )
      if (!touch) return
      const distanceX = touch.clientX - start.x
      const distanceY = Math.abs(touch.clientY - start.y)
      if (distanceX > 64 && distanceX > distanceY * 1.25) {
        event.preventDefault()
        edgeSwipeRef.current = null
        setIsMobileSidebarOpen(true)
      }
    }
    const clearTouch = () => {
      edgeSwipeRef.current = null
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', clearTouch, { passive: true })
    document.addEventListener('touchcancel', clearTouch, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', clearTouch)
      document.removeEventListener('touchcancel', clearTouch)
    }
  }, [hideHeaderNav, isMobileSidebarOpen])

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (!localeMenuRef.current?.contains(target)) {
        setIsLocaleMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  function handleThemeChange(nextTheme: string) {
    setTheme(nextTheme)
    document.documentElement.dataset.theme = nextTheme
    window.localStorage.setItem('retro-games-theme', nextTheme)
  }

  function toggleDesktopSidebar() {
    setIsDesktopSidebarCollapsed((current) => {
      const nextState = !current
      saveDesktopSidebarState(nextState)
      return nextState
    })
  }

  function handleCollapsedSidebarClick(event: MouseEvent<HTMLElement>) {
    if (
      !isDesktopSidebarCollapsed ||
      !window.matchMedia('(min-width: 1024px)').matches
    ) {
      return
    }

    const target = event.target
    if (!(target instanceof Element) || !target.closest('nav summary')) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const details = target.closest('summary')?.parentElement
    if (details instanceof HTMLDetailsElement) details.open = true
    setIsDesktopSidebarCollapsed(false)
    saveDesktopSidebarState(false)
  }

  function handleLocaleChange(nextValue: string) {
    const nextLocale = normalizeLocale(nextValue)
    const nextPath = location.pathname.replace(
      /^\/(zh-CN|zh-TW|en|ja)(?=\/|$)/,
      `/${nextLocale}`,
    )

    window.location.assign(nextPath)
  }

  function handlePaidResourceClick(
    event: MouseEvent<HTMLAnchorElement>,
    resourceId: string,
    cost = 10,
  ) {
    if (!confirmResourceDownload(locale, cost)) {
      event.preventDefault()
      return
    }
    if (unlockPaidResource(resourceId, cost)) return

    event.preventDefault()
    window.alert(getResourceCoinCopy(locale).insufficient)
  }

  const isProStandalone = location.hash === 'PRO' || location.hash === '#PRO'
  const proLibraryPlatform = location.pathname.includes('/platform/psp/')
    ? 'psp'
    : location.pathname.includes('/platform/switch/')
      ? 'switch'
      : undefined

  if (isProStandalone) {
    return (
      <main className="min-h-screen w-full max-w-full overflow-x-clip bg-base-100 text-base-content">
        <button
          className="fixed right-4 top-3 z-[100] border-b border-base-content/30 bg-transparent px-1 py-1 text-sm font-medium text-base-content/70 transition hover:border-base-content/70 hover:text-base-content"
            onClick={() => {
              if (location.pathname.endsWith('/play')) {
                window.dispatchEvent(new Event('ggemu-request-game-exit'))
              } else {
                void navigate({ to: '/$locale/PRO', params: { locale }, search: { platform: proLibraryPlatform } })
              }
            }}
          type="button"
        >
          ← {proLibraryPlatform
            ? locale === 'zh-TW' ? `返回${proLibraryPlatform === 'psp' ? 'PSP' : 'Switch'}遊戲庫` : locale === 'en' ? `Back to ${proLibraryPlatform === 'psp' ? 'PSP' : 'Switch'} library` : locale === 'ja' ? `${proLibraryPlatform === 'psp' ? 'PSP' : 'Switch'}ライブラリへ戻る` : `返回${proLibraryPlatform === 'psp' ? 'PSP' : 'Switch'}游戏库`
            : locale === 'zh-TW' ? '返回主機模式' : locale === 'en' ? 'Back to Console Mode' : locale === 'ja' ? 'コンソールモードに戻る' : '返回主机模式'}
        </button>
        {children}
      </main>
    )
  }

  return (
    <main className="desktop-clean-shell min-h-screen w-full max-w-full overflow-x-clip bg-base-100 text-base-content">
      <header className={`desktop-clean-header top-0 z-40 border-b shadow-sm ${isHomePage ? 'desktop-awwwards-header lg:static' : ''} sticky border-red-700 bg-red-600 text-white lg:border-0 lg:bg-[#f0f0ed] lg:text-black lg:shadow-none`}>
        <div className="navbar flex-nowrap gap-1 pl-0 pr-2 sm:px-6 lg:grid lg:grid-cols-[max-content_minmax(0,1fr)_auto] lg:gap-0 lg:px-8">
          <div className="navbar-start min-w-0 w-auto flex-none">
            {hideHeaderNav ? null : (
              <button
                aria-label={isMobileSidebarOpen ? t.closeSidebar : t.openSidebar}
                className="mr-1 grid h-6 w-3 shrink-0 place-items-start bg-transparent p-0 text-white/90 hover:text-white lg:hidden"
                onClick={() => setIsMobileSidebarOpen((isOpen) => !isOpen)}
                type="button"
              >
                <span aria-hidden="true" className="mt-1.5 grid w-2 gap-[2px]">
                  <span className="h-px w-2 bg-current" />
                  <span className="h-px w-2 bg-current" />
                  <span className="h-px w-2 bg-current" />
                </span>
              </button>
            )}
            <Link
              className="flex shrink-0 items-center gap-3"
              params={{ locale }}
              to="/$locale"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-base-100 sm:h-10 sm:w-10">
                <img
                  alt={t.siteName}
                  className="h-full w-full object-contain"
                  src="/logo.png"
                />
              </span>
              <span className="hidden w-max shrink-0 text-left leading-tight sm:flex sm:flex-col sm:items-start sm:justify-center">
                <span className="flex w-full items-center whitespace-nowrap">
                  <span
                    className={`block w-full whitespace-nowrap text-2xl font-bold ${
                    locale === 'zh-CN' || locale === 'zh-TW'
                      ? 'text-justify [text-align-last:justify]'
                      : ''
                    }`}
                  >
                    {t.siteName}
                  </span>
                  <i aria-hidden="true" className="mb-0.5 ml-1 hidden h-1.5 w-1.5 shrink-0 self-end rounded-full bg-current lg:block" />
                </span>
                <span className="block w-full truncate text-xs text-white/75 lg:hidden">
                  {t.siteSlogan}
                </span>
              </span>
            </Link>
            <div className="relative ml-2 flex shrink-0 items-center sm:ml-4 lg:hidden">
              <HomeCoinBag
                balance={globalCoins.balance}
                lang={locale}
                onOpen={globalCoins.showBalance}
              />
              <CoinRankBadge balance={globalCoins.balance} lang={locale} />
              {brandAddon ? <div className="absolute left-full top-1/2 -translate-y-1/2">{brandAddon}</div> : null}
            </div>
          </div>

          {topContent ? (
            <div className="order-3 hidden w-full border-t border-white/20 pt-3 lg:order-none lg:block lg:min-w-0 lg:border-t-0 lg:pt-0">
              {topContent}
            </div>
          ) : (
            <DesktopUnifiedHeaderNavigation isRandomGameLoading={isRandomGameLoading} locale={locale} onRandomGame={showRandomGame} />
          )}

          <div className="navbar-end ml-auto w-auto flex-none flex-nowrap gap-1 sm:gap-2">
            {onOpenSearch ? (
              <button
                aria-label={t.searchGames}
                className="btn btn-circle btn-xs shrink-0 border border-rose-200 bg-rose-100 text-black shadow-sm hover:border-rose-300 hover:bg-rose-200 sm:btn-sm lg:hidden"
                onClick={onOpenSearch}
                title={t.searchGames}
                type="button"
              >
                <i className="ri-search-line text-base" />
              </button>
            ) : null}
            <Link
              aria-label={t.watchOthers}
              className={`desktop-watch-button btn h-6 min-h-6 shrink-0 gap-0.5 rounded-full border border-rose-200 bg-rose-100 px-1.5 text-[10px] font-semibold text-black shadow-sm hover:border-rose-300 hover:bg-rose-200 lg:h-9 lg:min-h-9 lg:gap-2 lg:px-4 lg:text-sm max-lg:[&_.live-watch-eye]:scale-75 ${isHomePage ? '' : 'hidden lg:flex'}`}
              params={{ locale }}
              to="/$locale/live"
            >
              <span aria-hidden="true" className="live-watch-eye">
                <span className="live-watch-pupil" />
              </span>
              <span>{t.watchOthers}</span>
            </Link>

            {headerActions}

            {isHomePage && canSwitchTheme ? (
              <>
                <div
                  aria-label={t.theme}
                  role="group"
                  className="join flex h-6 shrink-0 items-stretch overflow-hidden rounded-full border border-rose-200 bg-rose-100 text-black lg:hidden"
                >
                  <button
                    aria-label={t.lightTheme}
                    title={t.lightTheme}
                    aria-pressed={theme === 'light'}
                    className={`grid h-full w-5 lg:w-8 place-items-center border-r border-rose-200 text-[10px] lg:text-sm ${
                      theme === 'light'
                        ? 'bg-rose-200 text-black shadow-sm'
                        : 'bg-transparent opacity-60'
                    }`}
                    onClick={() => handleThemeChange('light')}
                    type="button"
                  >
                    <i className="ri-sun-line" />
                  </button>
                  <button
                    aria-label={t.darkTheme}
                    title={t.darkTheme}
                    aria-pressed={theme === 'dark'}
                    className={`grid h-full w-5 lg:w-8 place-items-center text-[10px] lg:text-sm ${
                      theme === 'dark'
                        ? 'bg-rose-200 text-black shadow-sm'
                        : 'bg-transparent opacity-60'
                    }`}
                    onClick={() => handleThemeChange('dark')}
                    type="button"
                  >
                    <i className="ri-moon-line" />
                  </button>
                </div>
              </>
            ) : null}

            <details
              className={`dropdown dropdown-end ${isHomePage ? '' : 'hidden lg:block'}`}
              onToggle={(event) => setIsLocaleMenuOpen(event.currentTarget.open)}
              open={isLocaleMenuOpen}
              ref={localeMenuRef}
            >
              <summary
                className="btn h-6 min-h-6 lg:h-9 lg:min-h-9 gap-0.5 lg:gap-2 rounded-full border border-rose-200 bg-rose-100 px-1 text-[10px] lg:text-sm text-black shadow-sm hover:border-rose-300 hover:bg-rose-200 lg:px-3"
                onClick={(event) => {
                  event.preventDefault()
                  setIsLocaleMenuOpen((isOpen) => !isOpen)
                }}
              >
                <i className="ri-global-line" />
                {locale === 'en' ? '英' : '中'}
              </summary>
              <ul className="menu dropdown-content z-50 mt-3 w-36 rounded-box border border-base-300 bg-base-100 p-2 text-black shadow-xl">
                <li>
                  <button onClick={() => handleLocaleChange('zh-CN')} type="button">
                    中
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('en')} type="button">
                    英
                  </button>
                </li>
              </ul>
            </details>
            <button
              className="hidden h-9 shrink-0 items-center gap-1 rounded-full border border-black/35 px-3 text-sm font-semibold text-black transition hover:border-black hover:bg-black/5 disabled:cursor-default disabled:opacity-55 lg:flex"
              disabled={dailyCheckIn.completed}
              onClick={handleDailyCheckIn}
              title={dailyCheckIn.completed ? (locale === 'zh-TW' ? '今日已簽到' : '今日已签到') : `+${getNextCheckInMultiplier(dailyCheckIn) * 10}`}
              type="button"
            >
              <span>{dailyCheckIn.completed
                ? locale === 'zh-TW' ? '已簽到' : locale === 'en' ? 'Checked in' : locale === 'ja' ? 'チェック済み' : '已签到'
                : locale === 'zh-TW' ? '簽到' : locale === 'en' ? 'Check in' : locale === 'ja' ? 'チェックイン' : '签到'}</span>
              <strong>×{dailyCheckIn.completed ? Math.max(1, dailyCheckIn.streak) : getNextCheckInMultiplier(dailyCheckIn)}</strong>
            </button>
            <div className="ml-2 hidden shrink-0 items-center gap-0 [&_.coin-rank-badge]:-mr-2 lg:flex">
              <CoinRankBadge balance={globalCoins.balance} lang={locale} />
              <HomeCoinBag
                balance={globalCoins.balance}
                lang={locale}
                onOpen={globalCoins.showBalance}
              />
            </div>
          </div>
        </div>
      </header>

      {isMobileSidebarOpen && !hideHeaderNav ? (
        <button
          aria-label={t.closeSidebar}
          className="fixed inset-0 top-[61px] z-30 bg-black/35 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <div
        className={
          hideHeaderNav
            ? 'min-w-0'
            : 'min-w-0 lg:block'
        }
      >
        {hideHeaderNav ? null : (
          <>
          <aside
            className={`fixed bottom-0 left-0 top-[61px] z-40 w-[min(82vw,280px)] overflow-y-auto border-r border-base-300 bg-base-100 px-3 py-5 shadow-2xl transition-all duration-200 lg:hidden ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${isDesktopSidebarCollapsed ? 'lg:px-2 lg:[&_.sidebar-label]:hidden lg:[&_.sidebar-badge]:hidden lg:[&_.sidebar-submenu]:hidden lg:[&_nav_.menu>li>a]:justify-center lg:[&_nav_.menu>li>details>summary]:justify-center lg:[&_nav_.menu>li>details>summary]:after:hidden' : ''}`}
            onClickCapture={handleCollapsedSidebarClick}
          >
            <nav aria-label={t.mainNavigation}>
              <ul className="menu gap-1 p-0 text-sm [&_.sidebar-submenu_a]:text-xs [&_.sidebar-submenu_a]:font-normal [&_.sidebar-submenu_summary]:text-xs [&_.sidebar-submenu_summary]:font-normal [&_.sidebar-submenu_button]:text-xs [&_.sidebar-submenu_button]:font-normal">
                <li>
                  <Link
                    className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition hover:bg-base-200 ${
                      location.pathname === `/${locale}`
                        ? 'bg-base-200 font-semibold text-primary'
                        : ''
                    }`}
                    params={{ locale }}
                    to="/$locale"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                      <i className="ri-home-5-fill text-base text-red-500" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1 text-red-500">{t.games}</span>
                  </Link>
                </li>
                <li>
                  <details open>
                    <summary className="group min-h-12 gap-3 rounded-xl px-3 py-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                        <i className="ri-gamepad-line text-base" />
                      </span>
                      <span className="sidebar-label min-w-0 flex-1">{t.gameLibrary}</span>
                    </summary>
                    <ul className="sidebar-submenu">
                      <li>
                        <a href={`/${locale}/all-games`}>
                          {t.allGames}
                        </a>
                      </li>
                      <li>
                        <details open={sidebarSearchParams.has('platform')}>
                          <summary>{t.gamePlatforms}</summary>
                          <ul className="max-h-64 overflow-y-auto">
                            {gameFilterOptions?.platforms.map((platform) => (
                              <li key={platform.name}>
                                <a
                                  href={getHomeFilterHref(locale, {
                                    platform: platform.name,
                                  })}
                                >
                                  {getPlatformLabel(platform.name, locale)}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                      <li>
                        <details open={sidebarSearchParams.has('category')}>
                          <summary>{t.gameTypes}</summary>
                          <ul className="max-h-64 overflow-y-auto">
                            {gameFilterOptions?.categories.map((category) => (
                              <li key={category.name}>
                                <a
                                  href={getHomeFilterHref(locale, {
                                    category: category.name,
                                  })}
                                >
                                  {category.name}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </li>
                      <li>
                        <a href={`/${locale}/rankings/latest`}>
                          {t.latestGames}
                        </a>
                      </li>
                      <li>
                        <a href={`/${locale}/rankings/popular`}>
                          {t.mostPopularGames}
                          <span className="badge badge-xs border-0 bg-red-500 font-bold text-white">
                            HOT
                          </span>
                        </a>
                      </li>
                      <li>
                        <a href={`/${locale}/rankings/weekly`}>
                          {t.weeklyPopularGames}
                        </a>
                      </li>
                      <li>
                        <a href={`/${locale}/rankings/rising`}>
                          {t.fastestGrowingGames}
                        </a>
                      </li>
                    </ul>
                  </details>
                </li>
                <li>
                  <Link
                    className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition hover:bg-base-200 ${
                      location.pathname.startsWith(`/${locale}/deals`)
                        ? 'bg-base-200 font-semibold text-primary'
                        : ''
                    }`}
                    params={{ locale }}
                    search={{ region: undefined }}
                    to="/$locale/deals"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                      <i className="ri-price-tag-3-line text-base" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1">{t.gameDeals}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    className="group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition hover:bg-base-200"
                    params={{ locale }}
                    search={{}}
                    to="/$locale/play-my-rom"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                      <i className="ri-cpu-line text-base" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1">{homeT.superEmulator}</span>
                  </Link>
                </li>
                <li>
                  <Link
                    className="group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition hover:bg-base-200"
                    params={{ locale }}
                    to="/$locale/blog"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                      <i className="ri-newspaper-line text-base" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1">{t.blog}</span>
                  </Link>
                </li>
                <li className="hidden lg:block">
                  <details
                    onToggle={(event) =>
                      setIsUsefulMenuOpen(event.currentTarget.open)
                    }
                    open={isUsefulMenuOpen}
                  >
                    <summary className="group min-h-12 gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                        <i className="ri-gift-line text-base" />
                      </span>
                      <span className="sidebar-label min-w-0 flex-1 whitespace-nowrap">{homeT.usefulResources}</span>
                      <span className="sidebar-badge inline-flex h-3.5 shrink-0 items-center rounded bg-red-500 px-1 text-[8px] font-bold leading-none text-white">
                        HOT
                      </span>
                    </summary>
                    <ul className="sidebar-submenu">
                      <li>
                        <a
                          href="https://www.kdocs.cn/l/coH3Z1VLgop3"
                          onClick={(event) => handlePaidResourceClick(event, 'psp-library', 20)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.pspLibrary}
                          <ResourceCoinCost cost={20} />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/l/cl536kMzB2WN"
                          onClick={(event) => handlePaidResourceClick(event, 'psv-library', 20)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.psvLibrary}
                          <ResourceCoinCost cost={20} />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/l/cs8H4NUI4lC4"
                          onClick={(event) => handlePaidResourceClick(event, 'switch-library', 20)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.switchLibrary}
                          <ResourceCoinCost cost={20} />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                          onClick={(event) => handlePaidResourceClick(event, 'arcade-library', 20)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.arcadeLibrary}
                          <ResourceCoinCost cost={20} />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://kdocs.cn/l/cqE4v1WZxdnc"
                          onClick={(event) => handlePaidResourceClick(event, 'popular-library', 50)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.popularGameLibrary}
                          <ResourceCoinCost cost={50} />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/l/cn3lNtXTnq5W"
                          onClick={(event) => handlePaidResourceClick(event, 'mahjong-slots', 50)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.mahjongSlots}
                          <ResourceCoinCost cost={50} />
                        </a>
                      </li>
                    </ul>
                  </details>
                </li>
                <li>
                  <details
                    onToggle={(event) =>
                      setIsFriendsMenuOpen(event.currentTarget.open)
                    }
                    open={isFriendsMenuOpen}
                  >
                    <summary className="group min-h-12 gap-3 rounded-xl px-3 py-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                        <i className="ri-user-add-line text-base" />
                      </span>
                      <span className="sidebar-label min-w-0 flex-1">{homeT.findFriends}</span>
                    </summary>
                    <ul className="sidebar-submenu">
                      <li>
                        <details>
                          <summary>
                            <i className="ri-wechat-fill text-[#07c160]" />
                            {homeT.wechat}
                          </summary>
                          <div className="px-2 pb-2 pt-1">
                            <img
                              alt={homeT.wechatQrAlt}
                              className="w-full rounded-lg bg-white object-contain"
                              src="/wechat-qr.png"
                            />
                          </div>
                        </details>
                      </li>
                      <li>
                        <details>
                          <summary>
                            <i className="ri-qq-fill" />
                            QQ
                          </summary>
                          <div className="px-2 pb-2 pt-1">
                            <img
                              alt={homeT.qqQrAlt}
                              className="w-full rounded-lg object-contain"
                              src="/qq-qr.jpg"
                            />
                          </div>
                        </details>
                      </li>
                    </ul>
                  </details>
                </li>
                <li>
                  <Link
                    className={`group flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition hover:bg-base-200 ${
                      location.pathname === `/${locale}/original-games`
                        ? 'bg-base-200 font-semibold text-primary'
                        : ''
                    }`}
                    params={{ locale }}
                    to="/$locale/original-games"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 group-hover:bg-violet-200">
                      <i className="ri-gamepad-line text-base" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1">{getOriginalGamesTitle(locale)}</span>
                  </Link>
                </li>
              </ul>
            </nav>
          </aside>
          <button
            aria-label={isDesktopSidebarCollapsed ? t.openSidebar : t.closeSidebar}
            className="fixed top-1/2 z-[70] hidden h-9 w-5 -translate-y-1/2 cursor-pointer text-base-content transition-[left,color] duration-200 hover:text-primary"
            onClick={toggleDesktopSidebar}
            style={{ left: isDesktopSidebarCollapsed ? '54px' : '202px' }}
            title={isDesktopSidebarCollapsed ? t.openSidebar : t.closeSidebar}
            type="button"
          >
            <span className="absolute bottom-0 left-[6px] top-0 w-px rounded-full bg-base-content/65" />
            <span className="absolute bottom-0 left-[11px] top-0 w-px rounded-full bg-base-content/65" />
            <i
              className={`absolute left-[9px] top-1/2 -translate-x-1/2 -translate-y-1/2 bg-base-100 py-0.5 text-sm font-bold leading-none ${
                isDesktopSidebarCollapsed
                  ? 'ri-arrow-right-s-line'
                  : 'ri-arrow-left-s-line'
              }`}
            />
          </button>
          </>
        )}

        <div className="w-full min-w-0 max-w-full overflow-x-clip">
          {children}
          {hideFooter ? null : hideFooterOnMobile ? (
            <div className="hidden lg:block">
              <SiteFooter locale={locale} />
            </div>
          ) : (
            <SiteFooter locale={locale} />
          )}
        </div>
      </div>
      {randomPopupGame ? (
        <SiteRandomGameModal
          game={randomPopupGame}
          locale={locale}
          multiplier={randomPopupMultiplier}
          onClose={() => setRandomPopupGame(null)}
          onRandomAgain={showRandomGame}
        />
      ) : null}
    </main>
  )
}

function DesktopUnifiedHeaderNavigation({
  isRandomGameLoading,
  locale,
  onRandomGame,
}: {
  isRandomGameLoading: boolean
  locale: Locale
  onRandomGame: () => void | Promise<void>
}) {
  const layout = getI18n(locale).layout
  const home = getI18n(locale).home
  const linkClass = 'flex h-9 shrink-0 items-center whitespace-nowrap px-2 text-sm font-normal'

  return (
    <nav
      aria-label={layout.mainNavigation}
      className="hidden min-w-0 items-center gap-2 lg:flex lg:pl-10"
    >
      <details className="dropdown shrink-0">
        <summary className="flex h-9 cursor-pointer list-none items-center gap-1 whitespace-nowrap px-2 text-sm font-normal">
          {layout.explore}<i className="ri-arrow-down-s-line text-sm" />
        </summary>
        <div className="dropdown-content z-50 mt-2 flex w-max overflow-hidden bg-[#f0f0ed] text-sm text-black shadow-xl">
          <ul className="menu w-52 shrink-0 p-2">
            <li><Link params={{ locale }} to="/$locale">{layout.games}</Link></li>
            <li>
              <span>{layout.gameLibrary}</span>
            </li>
            <li><Link params={{ locale }} search={{ region: undefined }} to="/$locale/deals">{layout.gameDeals}</Link></li>
            <li><Link params={{ locale }} search={{}} to="/$locale/play-my-rom">{home.superEmulator}</Link></li>
            <li><Link params={{ locale }} to="/$locale/blog">{layout.blog}</Link></li>
            <li><Link params={{ locale }} to="/$locale/original-games">{getOriginalGamesTitle(locale)}</Link></li>
          </ul>
          <ul className="menu w-52 shrink-0 border-l border-black/10 p-2">
              <li><Link params={{ locale }} search={{ page: 1 }} to="/$locale/all-games">{layout.allGames}</Link></li>
              <li>
                <Link className="tooltip tooltip-bottom" data-tip={locale === 'en' ? 'A beautiful visual guide to classic game consoles' : locale === 'zh-TW' ? '各種遊戲機的精美圖鑑' : '各种游戏机的精美图鉴'} params={{ locale }} search={{ platform: undefined }} to="/$locale/PRO">
                  {locale === 'zh-CN' ? '所有平台' : locale === 'zh-TW' ? '所有平台' : locale === 'ja' ? 'すべてのプラットフォーム' : 'All Platforms'}
                </Link>
              </li>
              <li><Link params={{ locale, rankingId: 'latest' }} to="/$locale/rankings/$rankingId">{layout.latestGames}</Link></li>
              <li><Link params={{ locale, rankingId: 'popular' }} to="/$locale/rankings/$rankingId">{layout.mostPopularGames}</Link></li>
              <li><Link params={{ locale, rankingId: 'weekly' }} to="/$locale/rankings/$rankingId">{layout.weeklyPopularGames}</Link></li>
              <li><Link params={{ locale, rankingId: 'rising' }} to="/$locale/rankings/$rankingId">{layout.fastestGrowingGames}</Link></li>
          </ul>
        </div>
      </details>
      {(locale === 'zh-CN' || locale === 'zh-TW' || locale === 'en') ? (
        <Link className={`${linkClass} tooltip tooltip-bottom`} data-tip={locale === 'en' ? 'A beautiful visual guide to classic game consoles' : locale === 'zh-TW' ? '各種遊戲機的精美圖鑑' : '各种游戏机的精美图鉴'} params={{ locale }} search={{ platform: undefined }} to="/$locale/PRO">
          <i className="ri-gamepad-line mr-1" />{locale === 'en' ? 'Console Mode' : locale === 'zh-TW' ? '主機模式' : '主机模式'}
        </Link>
      ) : null}
      <Link className={linkClass} params={{ locale, platformId: 'coin' }} to="/$locale/platform/$platformId">{getGameModeLabels(locale).coin}</Link>
      <Link className={linkClass} params={{ locale, platformId: 'mahjong' }} title={getMahjongChargeTip(locale)} to="/$locale/platform/$platformId">{getGameModeLabels(locale).mahjong}</Link>
      <div className="ml-1 flex h-9 min-w-48 max-w-md flex-1 items-center rounded-full border border-black/30 text-xs text-black/60">
        <Link className="flex min-w-0 flex-1 items-center gap-2 px-3" params={{ locale }} search={{ q: '' }} to="/$locale/search">
          <i className="ri-search-line text-lg" />
          <span className="truncate">{locale === 'zh-CN' ? '按需求搜索' : layout.searchGames}</span>
        </Link>
        <button
          className="flex h-5 shrink-0 items-center border-l border-black/20 px-3 font-medium text-black/75 hover:text-black"
          disabled={isRandomGameLoading}
          onClick={onRandomGame}
          type="button"
        >
          {isRandomGameLoading
            ? locale === 'en' ? 'Loading…' : '加载中…'
            : locale === 'en' ? 'Random Play' : '随机玩玩'}
        </button>
      </div>
    </nav>
  )
}

function SiteRandomGameModal({
  game,
  locale,
  multiplier,
  onClose,
  onRandomAgain,
}: {
  game: PublicGame
  locale: Locale
  multiplier: number
  onClose: () => void
  onRandomAgain: () => void | Promise<void>
}) {
  const gameId = game.url_slug?.trim() || game._id?.trim() || ''
  const copy = getI18n(locale).home

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/65 p-4" onClick={onClose} role="presentation">
      <section aria-label={copy.randomGame} aria-modal="true" className="w-full max-w-md overflow-hidden rounded-2xl bg-white text-black shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
        <figure className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
          {game.game_cover ? <img alt={game.name ?? copy.randomGame} className="h-full w-full object-cover" src={game.game_cover} /> : null}
          {game.platform ? <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs text-white">{getPlatformLabel(game.platform, locale)}</span> : null}
          <button aria-label={copy.close} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-black shadow" onClick={onClose} type="button">✕</button>
        </figure>
        <div className="p-4">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-xl font-semibold">{game.name}</h2>
            <span className="flex shrink-0 items-center gap-1 font-black text-amber-600"><img alt="" aria-hidden="true" className="h-5 w-5" src="/images/coin-rewards/pixel-reward-coin.webp" />×{multiplier}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button className="btn btn-warning" onClick={onRandomAgain} type="button">{copy.randomAgain}</button>
            <Link className="btn btn-primary" onClick={onClose} params={{ gameId, locale }} search={{}} to="/$locale/games/$gameId">{copy.playNow}</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

function getGameModeLabels(locale: Locale) {
  if (locale === 'zh-TW') return { navigation: '遊戲模式', arcade: '街機模式', famicom: '小霸王模式', gba: 'GBA模式', web: '網頁模式', coin: '金幣模式', mahjong: '街機麻將' }
  if (locale === 'en') return { navigation: 'Game modes', arcade: 'Arcade', famicom: 'Famicom', gba: 'GBA', web: 'Web games', coin: 'Coin mode', mahjong: 'Arcade Mahjong' }
  if (locale === 'ja') return { navigation: 'ゲームモード', arcade: 'アーケード', famicom: 'FC', gba: 'GBA', web: 'ウェブゲーム', coin: 'コインモード', mahjong: 'アーケード麻雀' }
  return { navigation: '游戏模式', arcade: '街机模式', famicom: '小霸王模式', gba: 'GBA模式', web: '网页模式', coin: '金币模式', mahjong: '街机麻将' }
}

function getMahjongChargeTip(locale: Locale) {
  if (locale === 'zh-TW') return '經典的麻將遊戲'
  if (locale === 'en') return 'Classic mahjong games'
  if (locale === 'ja') return 'クラシック麻雀ゲーム'
  return '经典的麻将游戏'
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getI18n(locale).layout
  const homeT = getI18n(locale).home
  const faq = getHomeFaqs(locale)
  const modeLabels = getGameModeLabels(locale)
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (pathname.replace(/\/+$/, '') !== `/${locale}` && pathname !== '/') return null

  const footerNavigationLabel = locale === 'zh-TW'
    ? '快速入口'
    : locale === 'en'
      ? 'Quick links'
      : locale === 'ja'
        ? 'クイックリンク'
        : '快捷入口'
  const themeModeLabel = locale === 'zh-TW'
    ? '主機模式'
    : locale === 'en'
      ? 'Console mode'
      : locale === 'ja'
        ? 'コンソールモード'
        : '主机模式'

  return (
    <footer className="min-h-44 bg-[#f0f0ed] lg:bg-white">
      <div className="w-full px-4 pb-14 pt-6 text-sm text-base-content/70 sm:px-6 lg:px-8">
        <nav aria-label={footerNavigationLabel} className="mb-12">
          <h2 className="mb-6 text-sm font-semibold tracking-wide text-base-content">{footerNavigationLabel}</h2>
          <div className="grid grid-cols-2 gap-x-10 gap-y-7 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-16 lg:gap-y-9">
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale }} search={{ platform: undefined }} to="/$locale/PRO">
              {themeModeLabel}
            </Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, platformId: 'coin' }} to="/$locale/platform/$platformId">
              {modeLabels.coin}
            </Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, platformId: 'mahjong' }} title={getMahjongChargeTip(locale)} to="/$locale/platform/$platformId">
              {modeLabels.mahjong}
            </Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, platformId: 'psp' }} to="/$locale/platform/$platformId">PSP</Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, platformId: 'switch' }} to="/$locale/platform/$platformId">Switch</Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale }} search={{ page: 1 }} to="/$locale/all-games">{t.allGames}</Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, rankingId: 'latest' }} to="/$locale/rankings/$rankingId">{t.latestGames}</Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55" params={{ locale, rankingId: 'popular' }} to="/$locale/rankings/$rankingId">{t.mostPopularGames}</Link>
            <Link className="text-base font-medium text-base-content transition hover:opacity-55 lg:hidden" params={{ locale }} to="/$locale/original-games">{getOriginalGamesTitle(locale)}</Link>
            <details className="group relative hidden lg:block">
              <summary className="cursor-pointer list-none text-base font-medium text-base-content transition hover:opacity-55">
                {homeT.findFriends}
              </summary>
              <div className="absolute bottom-full left-0 z-30 mb-4 grid w-80 grid-cols-2 gap-4 rounded-2xl border border-base-content/10 bg-base-100 p-4 text-center shadow-2xl">
                <div>
                  <p className="mb-2 font-medium text-base-content"><i className="ri-wechat-fill mr-1 text-[#07c160]" />{homeT.wechat}</p>
                  <img alt={homeT.wechatQrAlt} className="aspect-square w-full rounded-lg bg-white object-contain" loading="lazy" src="/wechat-qr.png" />
                </div>
                <div>
                  <p className="mb-2 font-medium text-base-content"><i className="ri-qq-fill mr-1" />QQ</p>
                  <img alt={homeT.qqQrAlt} className="aspect-square w-full rounded-lg object-contain" loading="lazy" src="/qq-qr.jpg" />
                </div>
              </div>
            </details>
            <details className="group relative">
              <summary className="cursor-pointer list-none text-base font-medium text-base-content transition hover:opacity-55">
                {faq.title}
              </summary>
              <div className="absolute bottom-full right-0 z-30 mb-4 w-[min(88vw,38rem)] rounded-2xl border border-base-content/10 bg-base-100 p-5 text-left shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-base-content/10 pb-3">
                  <h3 className="text-lg font-semibold text-base-content">{faq.title}</h3>
                  <i className="ri-close-line text-lg text-base-content/45" />
                </div>
                <div className="max-h-[55vh] overflow-y-auto pr-1">
                  {faq.items.map((item) => (
                    <details className="border-b border-base-content/10" key={item.question}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-4 font-medium text-base-content">
                        <span>{item.question}</span>
                        <i className="ri-add-line shrink-0 text-lg text-base-content/45" />
                      </summary>
                      <p className="pb-4 pr-7 text-sm leading-7 text-base-content/60">{item.answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </nav>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="font-medium text-base-content">{t.copyright}</p>
              <Link className="link-hover link text-xs" params={{ locale }} to="/$locale/privacy-policy">
                {t.privacyPolicy}
              </Link>
              <Link className="link-hover link text-xs" params={{ locale }} to="/$locale/terms-of-service">
                {t.termsOfService}
              </Link>
            </div>
            <nav aria-label="Social media" className="flex flex-wrap justify-end gap-x-5 gap-y-2 text-xs font-medium text-base-content/70">
              <a className="transition hover:text-base-content" href="https://www.xiaohongshu.com/" rel="noreferrer" target="_blank">小红书</a>
              <a className="transition hover:text-base-content" href="https://www.douyin.com/" rel="noreferrer" target="_blank">抖音</a>
              <a className="transition hover:text-base-content" href="https://channels.weixin.qq.com/" rel="noreferrer" target="_blank">视频号</a>
              <a className="transition hover:text-base-content" href="https://mp.weixin.qq.com/" rel="noreferrer" target="_blank">公众号</a>
              <a className="transition hover:text-base-content" href="https://x.com/" rel="noreferrer" target="_blank">X</a>
              <a className="transition hover:text-base-content" href="https://www.youtube.com/" rel="noreferrer" target="_blank">YouTube</a>
            </nav>
          </div>
          <p className="mt-2 max-w-5xl text-xs leading-5 text-base-content/50">
            {t.disclaimer}
          </p>
        </div>
      </div>
    </footer>
  )
}

function ResourceCoinCost({ cost = 10 }: { cost?: number }) {
  return (
    <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-800">
      <img
        alt=""
        aria-hidden="true"
        className="h-3.5 w-3.5 object-contain"
        src="/images/coin-rewards/pixel-reward-coin.webp"
      />
      {cost}
    </span>
  )
}

function getResourceCoinCopy(locale: Locale) {
  if (locale === 'zh-CN') {
    return { insufficient: '余额不足。金币随处可见，玩游戏、看别人玩都可获得。' }
  }
  if (locale === 'zh-TW') {
    return { insufficient: '餘額不足。金幣隨處可見，玩遊戲、看別人玩都可獲得。' }
  }
  if (locale === 'ja') {
    return { insufficient: 'コイン残高が不足しています。ゲームを遊んだり、ほかの人のプレイを見たりすると獲得できます。' }
  }
  return { insufficient: 'Not enough coins. Find coins around the site, play games, or watch others play to earn more.' }
}

function getSiteDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readDailyCheckIn() {
  const fallback = { completed: false, lastDate: '', streak: 0 }
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(DAILY_CHECK_IN_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) as { lastCompletedDate?: string; streak?: number } : null
    const lastDate = parsed?.lastCompletedDate || ''
    return {
      completed: lastDate === getSiteDateKey(new Date()),
      lastDate,
      streak: Math.max(0, Number(parsed?.streak) || 0),
    }
  } catch {
    return fallback
  }
}

function getNextCheckInMultiplier(progress: { completed: boolean; lastDate: string; streak: number }) {
  if (progress.completed) return Math.max(1, progress.streak)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return progress.lastDate === getSiteDateKey(yesterday)
    ? Math.max(1, progress.streak + 1)
    : 1
}

function saveDesktopSidebarState(collapsed: boolean) {
  try {
    window.localStorage.setItem(
      DESKTOP_SIDEBAR_STATE_KEY,
      collapsed ? 'closed' : 'open',
    )
  } catch {
    // The sidebar still works for the current page when storage is unavailable.
  }
}

function getHomeFilterHref(
  locale: Locale,
  filters: { category?: string; platform?: string },
) {
  const searchParams = new URLSearchParams({
    sort: 'newest',
    ...filters,
  })

  return `/${locale}?${searchParams.toString()}`
}
