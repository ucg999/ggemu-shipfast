import { Link, createFileRoute } from '@tanstack/react-router'

import { SiteLayout } from '#/components/site-layout'
import { searchGames, type PublicGame } from '#/lib/ggemu'
import { getGameCollection, type GameCollection } from '#/lib/game-collections'
import { normalizeLocale } from '#/lib/i18n'
import { getPlatformLabel } from '#/lib/platform-label'

export const Route = createFileRoute('/$locale/collections/$collectionId')({
  loader: async ({ params }) => {
    const collection = getGameCollection(params.collectionId)

    if (!collection) {
      throw new Error('找不到这个游戏合集')
    }

    const locale = normalizeLocale(params.locale)
    const games = await loadCollectionGames(collection, locale)

    return { collection: localizeCollection(collection, locale), games }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.collection.title ?? '游戏合集'} - 游戏历险记` },
      {
        content: loaderData?.collection.description,
        name: 'description',
      },
    ],
  }),
  component: GameCollectionPage,
})

async function loadCollectionGames(collection: GameCollection, locale: ReturnType<typeof normalizeLocale>) {
  if (collection.platform && collection.yearRange) {
    const firstPage = await searchGames({
      data: {
        limit: 100,
        locale,
        page: 1,
        platform: collection.platform,
        sort: 'popular',
      },
    })
    const remainingPages = await Promise.all(
      Array.from({ length: Math.max(0, firstPage.pagination.pages - 1) }, (_, index) =>
        searchGames({
          data: {
            limit: 100,
            locale,
            page: index + 2,
            platform: collection.platform,
            sort: 'popular',
          },
        }),
      ),
    )
    const [fromYear, toYear] = collection.yearRange

    return dedupeCollectionGames([
      ...firstPage.games,
      ...remainingPages.flatMap((result) => result.games),
    ]).filter((game) => {
      const year = Number.parseInt(game.released_year ?? '', 10)
      return Number.isFinite(year) && year >= fromYear && year <= toYear
    })
  }

  const results = await Promise.all(
    collection.keywords.map((query) =>
      searchGames({
        data: { limit: 50, locale, page: 1, query, sort: 'popular' },
      }).catch(() => ({ games: [] })),
    ),
  )

  return dedupeCollectionGames(results.flatMap((result) => result.games)).slice(0, 50)
}

function dedupeCollectionGames(games: Array<PublicGame>) {
  return Array.from(
    new Map(games.map((game) => [game.url_slug || game._id, game])).values(),
  ).filter((game) => Boolean(game.url_slug || game._id))
}

function localizeCollection(collection: GameCollection, locale: ReturnType<typeof normalizeLocale>) {
  if (collection.id !== '8090-arcade') return collection

  const copy = {
    'zh-CN': {
      description: collection.description,
      title: '8090系列',
    },
    'zh-TW': {
      description: '8090經典街機收錄 1988 至 1994 年推出的格鬥、清版動作、射擊與闖關作品，重溫投幣、搖桿與好友並肩作戰的熱鬧回憶。',
      title: '8090經典街機',
    },
    en: {
      description: 'A collection of arcade games released from 1988 to 1994, covering fighting, beat ’em ups, shooters and action classics from the golden age of arcades.',
      title: '1988–1994 Arcade Classics',
    },
    ja: {
      description: '1988年から1994年に登場した格闘、ベルトスクロール、シューティングなど、アーケード黄金期の名作を集めたコレクションです。',
      title: '1988〜1994 アーケード名作',
    },
  }[locale]

  return { ...collection, ...copy }
}

function GameCollectionPage() {
  const { locale } = Route.useParams()
  const { collection, games } = Route.useLoaderData()
  const lang = normalizeLocale(locale)

  return (
    <SiteLayout locale={lang}>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid overflow-hidden rounded-2xl bg-base-200 lg:grid-cols-[minmax(320px,0.8fr)_1.2fr]">
          <img
            alt={collection.title}
            className="aspect-square h-full w-full object-cover lg:aspect-[4/3]"
            src={collection.cover}
          />
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-12">
            <span className="text-sm font-semibold text-primary">热门游戏合集</span>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {collection.title}
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-base-content/70">
              {collection.description}
            </p>
            <p className="mt-5 text-sm text-base-content/50">
              已收录 {games.length} 款相关游戏
            </p>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-2xl font-bold">系列游戏</h2>
          {games.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
              {games.map((game) => (
                <CollectionGameCard game={game} key={game.url_slug || game._id} lang={lang} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-base-200 p-10 text-center text-base-content/55">
              暂未找到相关游戏
            </div>
          )}
        </section>
      </main>
    </SiteLayout>
  )
}

function CollectionGameCard({
  game,
  lang,
}: {
  game: PublicGame
  lang: ReturnType<typeof normalizeLocale>
}) {
  const gameId = game.url_slug || game._id || ''

  return (
    <Link
      className="group block"
      params={{ gameId, locale: lang }}
      search={{}}
      to="/$locale/games/$gameId"
    >
      <figure className="relative aspect-[4/3] overflow-hidden rounded-lg bg-base-200">
        <img
          alt={game.name ?? '游戏封面'}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          loading="lazy"
          src={game.game_cover}
        />
        {game.platform ? (
          <span className="absolute left-2 top-2 rounded bg-black/75 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            {getPlatformLabel(game.platform, lang)}
          </span>
        ) : null}
      </figure>
    </Link>
  )
}
