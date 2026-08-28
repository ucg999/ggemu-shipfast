import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'

import type { GameFilterOptions, Locale } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { siteConfig } from '#/lib/site-config'
import { getSiteThemes, normalizeSiteTheme } from '#/lib/site-themes'
import { HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'
import { unlockPaidResource } from '#/lib/paid-resource'

export function SiteLayout({
  children,
  brandAddon,
  headerActions,
  hideHeaderNav = false,
  hideFooterOnMobile = false,
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
  locale: Locale
  onOpenSearch?: () => void
  topContent?: ReactNode
}) {
  const t = getI18n(locale).layout
  const homeT = getI18n(locale).home
  const location = useRouterState({ select: (state) => state.location })
  const siteThemes = getSiteThemes()
  const [theme, setTheme] = useState(() => normalizeSiteTheme(null))
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false)
  const [isUsefulMenuOpen, setIsUsefulMenuOpen] = useState(false)
  const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false)
  const localeMenuRef = useRef<HTMLDetailsElement>(null)
  const edgeSwipeRef = useRef<{ identifier: number; x: number; y: number } | null>(null)
  const canSwitchTheme = siteThemes.length > 1
  const sidebarSearchParams = new URLSearchParams(location.searchStr)
  const globalCoins = useGlobalCoinBalance()

  useEffect(() => {
    const storedTheme = normalizeSiteTheme(
      window.localStorage.getItem('retro-games-theme'),
    )
    setTheme(storedTheme)
    document.documentElement.dataset.theme = storedTheme
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

  function toggleTheme() {
    handleThemeChange(theme === 'dark' ? 'light' : 'dark')
  }

  function toggleDesktopSidebar() {
    setIsDesktopSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem('game-adventure-sidebar-collapsed', next ? '1' : '0')
      return next
    })
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
    if (unlockPaidResource(resourceId, cost)) return

    event.preventDefault()
    window.alert(getResourceCoinCopy(locale).insufficient)
  }

  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <header className="sticky top-0 z-40 border-b border-red-700 bg-red-600 text-white shadow-sm">
        <div className="navbar flex-nowrap gap-1 px-2 sm:px-6 lg:grid lg:grid-cols-[290px_minmax(0,1fr)_auto] lg:gap-0 lg:px-8">
          <div className="navbar-start min-w-0 w-auto flex-none">
            {hideHeaderNav ? null : (
              <button
                aria-label={isMobileSidebarOpen ? t.closeSidebar : t.openSidebar}
                className="btn btn-circle btn-xs mr-1 border border-white/40 bg-white/10 text-white hover:bg-white/20 sm:btn-sm lg:hidden"
                onClick={() => setIsMobileSidebarOpen((isOpen) => !isOpen)}
                type="button"
              >
                <i
                  className={
                    isMobileSidebarOpen
                      ? 'ri-menu-fold-line text-lg'
                      : 'ri-menu-unfold-line text-lg'
                  }
                />
              </button>
            )}
            <Link
              className="flex min-w-0 items-center gap-3"
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
              <span className="hidden w-max min-w-0 text-left leading-tight sm:flex sm:flex-col sm:items-start">
                <span
                  className={`block w-full text-2xl font-bold ${
                    locale === 'zh-CN' || locale === 'zh-TW'
                      ? 'text-justify [text-align-last:justify]'
                      : ''
                  }`}
                >
                  {t.siteName}
                </span>
                <span className="block w-full truncate text-xs text-white/75">
                  {t.siteSlogan}
                </span>
              </span>
            </Link>
            <HomeCoinBag
              balance={globalCoins.balance}
              lang={locale}
              onOpen={globalCoins.showBalance}
            />
            {brandAddon}
          </div>

          {topContent ? (
            <div className="order-3 hidden w-full border-t border-white/20 pt-3 lg:order-none lg:block lg:min-w-0 lg:border-t-0 lg:pt-0">
              {topContent}
            </div>
          ) : null}

          <div className="navbar-end ml-auto w-auto flex-none flex-nowrap gap-1 sm:gap-2">
            {onOpenSearch ? (
              <button
                aria-label={t.searchGames}
                className="btn btn-circle btn-xs shrink-0 border border-white/70 bg-white text-black shadow-sm hover:border-white hover:bg-gray-100 sm:btn-sm lg:hidden"
                onClick={onOpenSearch}
                title={t.searchGames}
                type="button"
              >
                <i className="ri-search-line text-base" />
              </button>
            ) : null}
            <Link
              aria-label={t.watchOthers}
              className="btn btn-xs h-8 shrink-0 gap-1 rounded-full border border-white/70 bg-white px-2 text-xs font-semibold text-black shadow-sm hover:border-white hover:bg-gray-100 sm:btn-sm sm:h-11 sm:gap-2 sm:px-5 sm:text-base"
              params={{ locale }}
              to="/$locale/live"
            >
              <span aria-hidden="true" className="live-watch-eye">
                <span className="live-watch-pupil" />
              </span>
              <span>{t.watchOthers}</span>
            </Link>

            {headerActions}

            {canSwitchTheme ? (
              <>
                <button
                  aria-label={t.theme}
                  aria-pressed={theme === 'dark'}
                  className="btn btn-circle btn-xs shrink-0 border border-white/70 bg-white text-black shadow-sm hover:border-white hover:bg-gray-100 sm:btn-sm lg:hidden"
                  onClick={toggleTheme}
                  title={theme === 'dark' ? t.switchToLight : t.switchToDark}
                  type="button"
                >
                  <i className={theme === 'dark' ? 'ri-sun-line' : 'ri-moon-line'} />
                </button>
                <div
                  aria-label={t.theme}
                  className="join hidden shrink-0 rounded-full border border-white/70 bg-white p-0.5 text-black shadow-sm lg:flex"
                >
                  <button
                    aria-pressed={theme === 'light'}
                    className={`btn join-item btn-sm rounded-l-full border-0 ${
                      theme === 'light'
                        ? 'bg-base-100 shadow-sm'
                        : 'bg-transparent opacity-60'
                    }`}
                    onClick={() => handleThemeChange('light')}
                    type="button"
                  >
                    <i className="ri-sun-line" />
                    <span>{t.lightTheme}</span>
                  </button>
                  <button
                    aria-pressed={theme === 'dark'}
                    className={`btn join-item btn-sm rounded-r-full border-0 ${
                      theme === 'dark'
                        ? 'bg-base-100 shadow-sm'
                        : 'bg-transparent opacity-60'
                    }`}
                    onClick={() => handleThemeChange('dark')}
                    type="button"
                  >
                    <i className="ri-moon-line" />
                    <span>{t.darkTheme}</span>
                  </button>
                </div>
              </>
            ) : null}

            <details
              className="dropdown dropdown-end"
              onToggle={(event) => setIsLocaleMenuOpen(event.currentTarget.open)}
              open={isLocaleMenuOpen}
              ref={localeMenuRef}
            >
              <summary
                className="btn btn-xs rounded-full border border-white/70 bg-white px-2 text-black shadow-sm hover:border-white hover:bg-gray-100 sm:btn-sm sm:px-3"
                onClick={(event) => {
                  event.preventDefault()
                  setIsLocaleMenuOpen((isOpen) => !isOpen)
                }}
              >
                <i className="ri-global-line" />
                {locale === 'zh-CN'
                  ? '简'
                  : locale === 'zh-TW'
                    ? '繁'
                    : locale === 'en'
                      ? '英'
                      : '日'}
              </summary>
              <ul className="menu dropdown-content z-50 mt-3 w-36 rounded-box border border-base-300 bg-base-100 p-2 text-black shadow-xl">
                <li>
                  <button onClick={() => handleLocaleChange('zh-CN')} type="button">
                    简
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('zh-TW')} type="button">
                    繁
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('en')} type="button">
                    英
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('ja')} type="button">
                    日
                  </button>
                </li>
              </ul>
            </details>
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
            : isDesktopSidebarCollapsed
              ? 'min-w-0 lg:grid lg:grid-cols-[72px_minmax(0,1fr)]'
              : 'min-w-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]'
        }
      >
        {hideHeaderNav ? null : (
          <aside
            className={`fixed bottom-0 left-0 top-[61px] z-40 w-[min(82vw,280px)] overflow-y-auto border-r border-base-300 bg-base-100 px-3 py-5 shadow-2xl transition-all duration-200 lg:sticky lg:top-[65px] lg:block lg:h-[calc(100vh-65px)] lg:w-auto lg:translate-x-0 lg:shadow-none ${
              isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } ${isDesktopSidebarCollapsed ? 'lg:px-2 lg:[&_.sidebar-label]:hidden lg:[&_.sidebar-submenu]:hidden lg:[&_nav_.menu>li>a]:justify-center lg:[&_nav_.menu>li>details>summary]:justify-center lg:[&_nav_.menu>li>details>summary]:after:hidden' : ''}`}
          >
            <button
              aria-label={isDesktopSidebarCollapsed ? t.openSidebar : t.closeSidebar}
              className="mb-3 ml-auto hidden h-8 w-8 place-items-center rounded-lg bg-base-200 text-base-content transition hover:bg-base-300 lg:grid"
              onClick={toggleDesktopSidebar}
              title={isDesktopSidebarCollapsed ? t.openSidebar : t.closeSidebar}
              type="button"
            >
              <i className={isDesktopSidebarCollapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} />
            </button>
            <nav aria-label={t.mainNavigation}>
              <ul className="menu gap-1 p-0 text-sm">
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
                      <i className="ri-home-5-fill text-base" />
                    </span>
                    <span className="sidebar-label min-w-0 flex-1">{t.games}</span>
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
                        <a href={`/${locale}?view=all`}>
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
                <li>
                  <details
                    onToggle={(event) =>
                      setIsUsefulMenuOpen(event.currentTarget.open)
                    }
                    open={isUsefulMenuOpen}
                  >
                    <summary className="group min-h-12 gap-3 rounded-xl px-3 py-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                        <i className="ri-gift-line text-base" />
                      </span>
                      <span className="sidebar-label min-w-0 flex-1">{homeT.usefulResources}</span>
                    </summary>
                    <ul className="sidebar-submenu">
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG"
                          onClick={(event) => handlePaidResourceClick(event, 'psp-library')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.pspLibrary}
                          <ResourceCoinCost />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/RclPTyXd"
                          onClick={(event) => handlePaidResourceClick(event, 'psv-library')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.psvLibrary}
                          <ResourceCoinCost />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/detUdefK"
                          onClick={(event) => handlePaidResourceClick(event, 'switch-library')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.switchLibrary}
                          <ResourceCoinCost />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                          onClick={(event) => handlePaidResourceClick(event, 'arcade-library')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.arcadeLibrary}
                          <ResourceCoinCost />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://kdocs.cn/l/cqE4v1WZxdnc"
                          onClick={(event) => handlePaidResourceClick(event, 'popular-library')}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.popularGameLibrary}
                          <ResourceCoinCost />
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/l/cn3lNtXTnq5W"
                          onClick={(event) => handlePaidResourceClick(event, 'mahjong-slots', 20)}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {homeT.mahjongSlots}
                          <ResourceCoinCost cost={20} />
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
              </ul>
            </nav>
          </aside>
        )}

        <div className="min-w-0">
          {children}
          {hideFooterOnMobile ? (
            <div className="hidden lg:block">
              <SiteFooter locale={locale} />
            </div>
          ) : (
            <SiteFooter locale={locale} />
          )}
        </div>
      </div>
    </main>
  )
}

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = getI18n(locale).layout

  return (
    <footer className="border-t border-base-300 bg-base-100">
      <div className="w-full px-4 py-6 text-sm text-base-content/70 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-10">
          <section className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-lg bg-base-100">
                <img
                  alt={t.siteName}
                  className="h-full w-full object-contain"
                  src="/logo.png"
                />
              </span>
              <div>
                <p className="text-base font-semibold text-base-content">
                  {t.siteName}
                </p>
              </div>
            </div>
            <p className="mt-3 overflow-x-auto whitespace-nowrap text-[clamp(11px,1vw,14px)] leading-6">
              {t.footer}
            </p>
          </section>

          <nav className="md:min-w-40">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-base-content/45">
              {t.legal}
            </p>
            <div className="flex flex-col items-start gap-2.5">
              <Link
                className="link-hover link flex items-center"
                params={{ locale }}
                to="/$locale/privacy-policy"
              >
                <i className="ri-shield-check-line mr-1" />
                {t.privacyPolicy}
              </Link>
              <Link
                className="link-hover link flex items-center"
                params={{ locale }}
                to="/$locale/terms-of-service"
              >
                <i className="ri-file-list-3-line mr-1" />
                {t.termsOfService}
              </Link>
            </div>
          </nav>
        </div>

        <div className="mt-6 border-t border-base-300 pt-4">
          <p className="font-medium text-base-content">{t.copyright}</p>
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
        src="/images/coin-rewards/pixel-reward-coin.png"
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
