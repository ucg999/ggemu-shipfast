import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { HomeSearchOverlay } from '#/components/home/search-overlay'
import { getGameFilterOptions } from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'

export const Route = createFileRoute('/$locale/search')({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === 'string' ? search.q : '' }),
  loader: () => getGameFilterOptions(),
  component: SearchPage,
})

function SearchPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const options = Route.useLoaderData()
  const { q } = Route.useSearch()
  return (
    <SiteLayout locale={lang} gameFilterOptions={options} hideFooter>
      <HomeSearchOverlay filterOptions={options} gameTotal={100000} initialQuery={q} isOpen lang={lang} onClose={() => window.location.assign(`/${lang}`)} t={getI18n(lang).home} />
    </SiteLayout>
  )
}
