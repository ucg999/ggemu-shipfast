import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { HomeSearchOverlay } from '#/components/home/search-overlay'
import { getGameFilterOptions, searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'

export const Route = createFileRoute('/$locale/search')({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === 'string' ? search.q : '' }),
  loader: async ({ params }) => {
    const locale = normalizeLocale(params.locale)
    const [filterOptions, games] = await Promise.all([
      getGameFilterOptions(),
      searchGames({ data: { locale, page: 1, limit: 1, query: '', sort: 'popular' } }),
    ])
    return { filterOptions, gameTotal: games.pagination.total }
  },
  head: ({ params }) => {
    const lang = normalizeLocale(params.locale)
    const english = lang === 'en'
    return { meta: [
      { title: english ? 'Search Classic Games | Retro Game Hall' : '搜索经典游戏｜怀旧游戏厅' },
      { name: 'description', content: english ? 'Search classic Arcade, NES, GBA and other retro games by title, alias, platform or genre.' : '按游戏名称、别名、平台或类型搜索街机、小霸王FC、GBA等经典游戏。' },
      { name: 'robots', content: 'noindex,follow' },
    ] }
  },
  component: SearchPage,
})

function SearchPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const { filterOptions: options, gameTotal } = Route.useLoaderData()
  const { q } = Route.useSearch()
  return (
    <SiteLayout locale={lang} gameFilterOptions={options} hideFooter>
      <HomeSearchOverlay filterOptions={options} gameTotal={gameTotal} initialQuery={q} isOpen lang={lang} onClose={() => window.location.assign(`/${lang}`)} t={getI18n(lang).home} />
    </SiteLayout>
  )
}
