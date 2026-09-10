import { createFileRoute } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { CoinFruitCard } from '#/components/coin-fruit-card'
import { GhostHunterCard } from '#/components/ghost-hunter-card'
import { normalizeLocale } from '#/lib/i18n'
import { getOriginalGamesTitle } from '#/lib/original-games'

export const Route = createFileRoute('/$locale/original-games')({
  head: ({ params }) => ({
    meta: [{ title: `${getOriginalGamesTitle(normalizeLocale(params.locale))}｜怀旧游戏厅` }],
  }),
  component: OriginalGamesPage,
})

function OriginalGamesPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  return (
    <SiteLayout locale={lang}>
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-black sm:text-4xl">{getOriginalGamesTitle(lang)}</h1>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <GhostHunterCard lang={lang} />
          <CoinFruitCard lang={lang} />
        </div>
      </section>
    </SiteLayout>
  )
}
