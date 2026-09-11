import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { GamesSection } from '#/components/home/shared'
import { SiteLayout } from '#/components/site-layout'
import { searchGames } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks } from '#/lib/seo'
import { SITE_ORIGIN } from '#/lib/site-url'

export const Route = createFileRoute('/$locale/all-games')({
  validateSearch: (search: Record<string, unknown>) => ({
    page: Number.isInteger(Number(search.page)) && Number(search.page) > 0 ? Number(search.page) : 1,
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ params, deps }) => searchGames({ data: {
    locale: normalizeLocale(params.locale), query: '', sort: 'popular', page: deps.page, limit: 36,
  } }),
  head: ({ params }) => {
    const locale = normalizeLocale(params.locale)
    return {
      meta: [{ title: getI18n(locale).layout.allGames }],
      links: getLocalizedSeoLinks({ locale, origin: SITE_ORIGIN, path: '/all-games' }),
    }
  },
  component: AllGamesPage,
})

function AllGamesPage() {
  const { games, pagination } = Route.useLoaderData()
  const lang = normalizeLocale(Route.useParams().locale)
  const navigate = useNavigate({ from: Route.fullPath })
  const t = getI18n(lang)
  const props = {
    games, pagination, lang, t: t.home, page: pagination.page, pages: pagination.pages,
    isLoading: Route.useMatch().status === 'pending', showHeader: false,
    onLoadPage: async (page: number) => { await navigate({ search: { page } }) },
  }
  return <SiteLayout locale={lang}>
    <h1 className="px-3 py-4 text-2xl font-bold sm:px-6 lg:px-8">{t.layout.allGames}</h1>
    <div className="lg:hidden">
      <GamesSection {...props} mobileItemLimit={36}
        gridClassName="game-mosaic-grid grid grid-flow-dense grid-cols-12 gap-2 sm:grid-cols-12"
        sectionClassName="flex w-full min-w-0 flex-col gap-1 px-3 py-1 sm:px-4" />
    </div>
    <div className="hidden lg:block">
      <GamesSection {...props} gridClassName="grid grid-cols-7 gap-2"
        sectionClassName="flex w-full flex-col gap-1 px-4 py-1 sm:px-6 lg:px-8" />
    </div>
  </SiteLayout>
}
