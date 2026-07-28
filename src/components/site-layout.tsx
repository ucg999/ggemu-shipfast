import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { GameFilterOptions, Locale } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'
import { siteConfig } from '#/lib/site-config'
import { getSiteThemes, normalizeSiteTheme } from '#/lib/site-themes'

export function SiteLayout({
  children,
  headerActions,
  hideHeaderNav = false,
  gameFilterOptions,
  locale,
  topContent,
}: {
  children: ReactNode
  gameFilterOptions?: GameFilterOptions
  headerActions?: ReactNode
  hideHeaderNav?: boolean
  locale: Locale
  topContent?: ReactNode
}) {
  const t = getI18n(locale).layout
  const location = useRouterState({ select: (state) => state.location })
  const siteThemes = getSiteThemes()
  const [theme, setTheme] = useState(() => normalizeSiteTheme(null))
  const [isLocaleMenuOpen, setIsLocaleMenuOpen] = useState(false)
  const [isUsefulMenuOpen, setIsUsefulMenuOpen] = useState(false)
  const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false)
  const localeMenuRef = useRef<HTMLDetailsElement>(null)
  const canSwitchTheme = siteThemes.length > 1
  const sidebarSearchParams = new URLSearchParams(location.searchStr)

  useEffect(() => {
    const storedTheme = normalizeSiteTheme(
      window.localStorage.getItem('retro-games-theme'),
    )
    setTheme(storedTheme)
    document.documentElement.dataset.theme = storedTheme
  }, [])

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

  function handleLocaleChange(nextValue: string) {
    const nextLocale = normalizeLocale(nextValue)
    const nextPath = location.pathname.replace(
      /^\/(zh-CN|en|ja)(?=\/|$)/,
      `/${nextLocale}`,
    )

    window.location.assign(nextPath)
  }

  return (
    <main className="min-h-screen bg-base-100 text-base-content">
      <header className="sticky top-0 z-40 border-b border-base-300/70 bg-base-100/90 backdrop-blur">
        <div className="navbar flex-wrap gap-3 px-4 sm:px-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:gap-0 lg:px-8">
          <div className="navbar-start w-auto flex-none">
            <Link
              className="flex min-w-0 items-center gap-3"
              params={{ locale }}
              to="/$locale"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-base-100">
                <img
                  alt={siteConfig.SITE_NAME}
                  className="h-full w-full object-contain"
                  src="/logo.png"
                />
              </span>
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className="block text-lg font-semibold tracking-wide">
                  {siteConfig.SITE_NAME}
                </span>
                <span className="block truncate text-xs text-base-content/55">
                  {siteConfig.SITE_SLOGAN}
                </span>
              </span>
            </Link>
          </div>

          {topContent ? (
            <div className="order-3 w-full border-t border-base-300/60 pt-3 lg:order-none lg:min-w-0 lg:border-t-0 lg:pt-0">
              {topContent}
            </div>
          ) : null}

          <div className="navbar-end ml-auto w-auto flex-none gap-2">
            <Link
              aria-label="看别人玩"
              className="btn btn-xs shrink-0 gap-1.5 rounded-lg border border-base-300 bg-white px-3 text-black shadow-sm hover:border-base-300 hover:bg-gray-100 sm:btn-sm sm:px-4"
              params={{ locale }}
              to="/$locale/live"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-35" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
              </span>
              <span>看别人玩</span>
            </Link>

            {headerActions}

            {canSwitchTheme ? (
              <div
                aria-label={t.theme}
                className="join flex shrink-0 rounded-lg border border-base-300 bg-base-200 p-0.5"
              >
                <button
                  aria-pressed={theme === 'light'}
                  className={`btn join-item btn-xs border-0 sm:btn-sm ${
                    theme === 'light'
                      ? 'bg-base-100 shadow-sm'
                      : 'bg-transparent opacity-60'
                  }`}
                  onClick={() => handleThemeChange('light')}
                  type="button"
                >
                  <i className="ri-sun-line" />
                  <span>亮色</span>
                </button>
                <button
                  aria-pressed={theme === 'dark'}
                  className={`btn join-item btn-xs border-0 sm:btn-sm ${
                    theme === 'dark'
                      ? 'bg-base-100 shadow-sm'
                      : 'bg-transparent opacity-60'
                  }`}
                  onClick={() => handleThemeChange('dark')}
                  type="button"
                >
                  <i className="ri-moon-line" />
                  <span>暗色</span>
                </button>
              </div>
            ) : null}

            <details
              className="dropdown dropdown-end"
              onToggle={(event) => setIsLocaleMenuOpen(event.currentTarget.open)}
              open={isLocaleMenuOpen}
              ref={localeMenuRef}
            >
              <summary
                className="btn btn-sm btn-ghost border border-base-300"
                onClick={(event) => {
                  event.preventDefault()
                  setIsLocaleMenuOpen((isOpen) => !isOpen)
                }}
              >
                <i className="ri-global-line" />
                {locale === 'zh-CN' ? '中文' : locale === 'en' ? 'EN' : '日本語'}
              </summary>
              <ul className="menu dropdown-content z-50 mt-3 w-36 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
                <li>
                  <button onClick={() => handleLocaleChange('zh-CN')} type="button">
                    中文
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('en')} type="button">
                    English
                  </button>
                </li>
                <li>
                  <button onClick={() => handleLocaleChange('ja')} type="button">
                    日本語
                  </button>
                </li>
              </ul>
            </details>
          </div>
        </div>
      </header>

      <div
        className={
          hideHeaderNav
            ? 'min-w-0'
            : 'min-w-0 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]'
        }
      >
        {hideHeaderNav ? null : (
          <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] border-r border-base-300 bg-base-100 px-3 py-5 lg:block">
            <nav aria-label="主导航">
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
                    <span className="min-w-0 flex-1">{t.games}</span>
                  </Link>
                </li>
                <li>
                  <details open>
                    <summary className="group min-h-12 gap-3 rounded-xl px-3 py-2.5 font-medium">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-base-200 text-base-content group-hover:bg-base-300">
                        <i className="ri-gamepad-line text-base" />
                      </span>
                      <span className="min-w-0 flex-1">{t.gameLibrary}</span>
                    </summary>
                    <ul>
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
                        <a href={`/${locale}?sort=newest&view=latest`}>
                          {t.latestGames}
                        </a>
                      </li>
                      <li>
                        <a href={`/${locale}?sort=popular`}>
                          {t.mostPopularGames}
                          <span className="badge badge-xs border-0 bg-red-500 font-bold text-white">
                            HOT
                          </span>
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
                    <span className="min-w-0 flex-1">超级模拟器</span>
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
                    <span className="min-w-0 flex-1">{t.blog}</span>
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
                      <span className="min-w-0 flex-1">拿点有用的</span>
                    </summary>
                    <ul>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG"
                          rel="noreferrer"
                          target="_blank"
                        >
                          PSP游戏库
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/RclPTyXd"
                          rel="noreferrer"
                          target="_blank"
                        >
                          PSV游戏库
                        </a>
                      </li>
                      <li>
                        <a
                          href="https://www.kdocs.cn/etapps/query/q/detUdefK"
                          rel="noreferrer"
                          target="_blank"
                        >
                          Switch游戏库
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
                      <span className="min-w-0 flex-1">找点新朋友</span>
                    </summary>
                    <ul>
                      <li>
                        <details>
                          <summary>
                            <i className="ri-wechat-fill text-[#07c160]" />
                            微信
                          </summary>
                          <div className="px-2 pb-2 pt-1">
                            <img
                              alt="游戏历险记微信二维码"
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
                              alt="游戏历险记QQ二维码"
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
          <SiteFooter locale={locale} />
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
                  alt={siteConfig.SITE_NAME}
                  className="h-full w-full object-contain"
                  src="/logo.png"
                />
              </span>
              <div>
                <p className="text-base font-semibold text-base-content">
                  {siteConfig.SITE_NAME}
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
