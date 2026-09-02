import { Outlet, createFileRoute, redirect, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { CoinRewardPopup, FloatingHomeCoin, FlyingCollectedCoin } from '#/components/home/coin-rewards'
import { normalizeLocale } from '#/lib/i18n'
import { addCoinBalance } from '#/lib/coin-wallet'
import type { GameSearchSort } from '#/lib/ggemu'
import { type SiteTemplate, normalizeSiteTemplate } from '#/lib/site-config'

const INNER_PAGE_COIN_COOLDOWN_MS = 5 * 60 * 1000
const INNER_PAGE_COIN_CHANCE = 0.35

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

function normalizeHomeView(value: unknown): HomeSearch['view'] {
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
  component: LocaleLayout,
})

function LocaleLayout() {
  const { locale } = Route.useParams()
  const pathname = useRouterState({ select: state => state.location.pathname })
  const lang = normalizeLocale(locale)
  const [innerPageReward, setInnerPageReward] = useState<{
    amount: number
    id: number
    prefix: '+'
  } | null>(null)
  const [innerPageCoin, setInnerPageCoin] = useState<{
    id: number
    left: number
    top: number
  } | null>(null)
  const [innerPageCoinFlight, setInnerPageCoinFlight] = useState<{
    id: number
    left: number
    top: number
    travelX: number
    travelY: number
  } | null>(null)
  const lastRewardPathRef = useRef<string | null>(null)
  const innerRewardTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (pathname === `/${locale}` || lastRewardPathRef.current === pathname) return
    lastRewardPathRef.current = pathname
    setInnerPageCoin(null)
    setInnerPageCoinFlight(null)
    setInnerPageReward(null)

    const opportunityKey = `inner-page-coin-opportunity:${pathname}`
    const lastOpportunity = Number(window.localStorage.getItem(opportunityKey)) || 0
    const now = Date.now()
    if (now - lastOpportunity < INNER_PAGE_COIN_COOLDOWN_MS) return
    window.localStorage.setItem(opportunityKey, String(now))
    if (Math.random() >= INNER_PAGE_COIN_CHANCE) return

    const minimumLeft = window.innerWidth >= 1024
      ? Math.min(28, (240 / window.innerWidth) * 100)
      : 6
    setInnerPageCoin({
      id: now,
      left: minimumLeft + Math.random() * (88 - minimumLeft),
      top: 16 + Math.random() * 68,
    })
  }, [locale, pathname])

  function collectInnerPageCoin(coinId: number) {
    if (!innerPageCoin || innerPageCoin.id !== coinId) return
    const amount = Math.random() < 0.5 ? 1 : 2
    const coinBox = document.querySelector<HTMLElement>('[data-coin-box]')
    const coinBoxRect = coinBox?.getBoundingClientRect()
    const left = (window.innerWidth * innerPageCoin.left) / 100
    const top = (window.innerHeight * innerPageCoin.top) / 100

    setInnerPageCoinFlight({
      id: Date.now(),
      left,
      top,
      travelX: coinBoxRect ? coinBoxRect.left + coinBoxRect.width / 2 - left : 0,
      travelY: coinBoxRect ? coinBoxRect.top + coinBoxRect.height / 2 - top : -top,
    })
    setInnerPageCoin(null)
    window.setTimeout(() => {
      addCoinBalance(amount)
      setInnerPageCoinFlight(null)
      setInnerPageReward({ amount, id: Date.now(), prefix: '+' })
      if (innerRewardTimerRef.current !== null) {
        window.clearTimeout(innerRewardTimerRef.current)
      }
      innerRewardTimerRef.current = window.setTimeout(() => {
        setInnerPageReward(null)
        innerRewardTimerRef.current = null
      }, 1400)
    }, 720)
  }


  if (pathname.replace(/\/$/, '') === `/${locale}`) return <Outlet />
    return (
      <>
        <Outlet />
        <FloatingHomeCoin
          lang={lang}
          onCollect={collectInnerPageCoin}
          positions={innerPageCoin ? [innerPageCoin] : []}
        />
        <FlyingCollectedCoin flight={innerPageCoinFlight} />
        <CoinRewardPopup feedback={innerPageReward} />
      </>
    )
}
