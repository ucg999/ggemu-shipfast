import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { SwitchLibraryImage } from '#/components/switch-library-image'
import { normalizeLocale } from '#/lib/i18n'
import { PSP_LIBRARY_GAMES } from '#/lib/psp-library'

export const Route = createFileRoute('/$locale/platform/psp/$gameId')({
  loader: ({ params }) => {
    const game = PSP_LIBRARY_GAMES.find((item) => item.id === params.gameId)
    if (!game) throw notFound()
    return game
  },
  component: PspGameDetailPage,
})

function PspGameDetailPage() {
  const game = Route.useLoaderData()
  const lang = normalizeLocale(Route.useParams().locale)
  const copy = getCopy(lang)
  return (
    <SiteLayout locale={lang} hideFooter>
      <main className="min-h-screen bg-base-200 px-3 py-5 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-6xl">
          <Link className="mb-4 inline-flex items-center gap-1 text-sm text-base-content/65" params={{ locale: lang, platformId: 'psp' }} to="/$locale/platform/$platformId">← {copy.back}</Link>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <section className="min-w-0">
              <header className="mb-7 w-full max-w-2xl text-center">
                <h1 className="border-b border-dashed border-base-content/20 pb-4 text-4xl font-bold tracking-tight sm:text-5xl">{game.title}</h1>
                <SwitchLibraryImage
                  className="mt-5 aspect-[600/338] w-full rounded-lg [&_img]:object-contain"
                  src={game.cover}
                  alt={`${game.title} ${copy.screenshot} 1`}
                  eager
                />
                <p className="mt-4 whitespace-pre-line text-left text-sm leading-6 text-base-content/70 sm:text-base">{game.description}</p>
              </header>
              <h2 className="mb-2 text-xl font-semibold">{copy.screenshots}</h2>
              <div className="flex flex-col items-start gap-3">
                {game.screenshots.map((src, index) => (
                  <figure className="w-full max-w-2xl overflow-hidden rounded-lg bg-base-100" key={src}>
                    <SwitchLibraryImage
                      className="aspect-[600/338] w-full"
                      src={src}
                      alt={`${game.title} ${copy.screenshot} ${index + 2}`}
                    />
                  </figure>
                ))}
              </div>
            </section>
            <div className="lg:sticky lg:top-20">
            <aside className="rounded-xl bg-base-100 p-5 shadow-sm">
              <h2 className="text-xl font-semibold">{copy.information}</h2>
              <dl className="mt-4 divide-y divide-base-200 text-sm">
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.gameName}</dt><dd className="text-right">{game.title}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.genre}</dt><dd className="text-right">{game.genre}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.platform}</dt><dd>PSP</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.publisher}</dt><dd className="text-right">{game.publisher}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.release}</dt><dd>{game.releaseDate}</dd></div>
                <div className="flex justify-between gap-4 py-3"><dt className="text-base-content/50">{copy.language}</dt><dd>{game.language}</dd></div>
              </dl>
            </aside>
            {game.boxCover ? <SwitchLibraryImage className="mt-4 aspect-[2/3] w-full [&_img]:object-contain" src={game.boxCover} alt={`${game.title} 封面`} transparent /> : null}
            </div>
          </div>
          <section className="mt-7 rounded-xl bg-base-100 p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {game.downloadUrl ? <a className="btn btn-error text-white" href={game.downloadUrl} target="_blank" rel="noopener noreferrer">{copy.downloadButton}</a> : <button className="btn" disabled type="button">{game.downloadStatus ?? copy.preparing}</button>}
              {game.shareVersion ? <span className="text-sm text-base-content/60">{game.shareVersion}</span> : null}
            </div>
          </section>
        </article>
      </main>
    </SiteLayout>
  )
}

function getCopy(lang: ReturnType<typeof normalizeLocale>) {
  if (lang === 'zh-TW') return { back: '返回PSP遊戲庫', information: '遊戲資訊', gameName: '遊戲名稱', genre: '遊戲類型', platform: '平台', publisher: '遊戲廠商', language: '語言', release: '發行日期', requiredSystem: '所需系統', screenshots: '遊戲截圖', screenshot: '遊戲截圖', downloadButton: '遊戲分享', preparing: '分享資源待添加' }
  if (lang === 'en') return { back: 'Back to PSP Library', information: 'Game information', gameName: 'Game title', genre: 'Genre', platform: 'Platform', publisher: 'Publisher', language: 'Language', release: 'Release date', requiredSystem: 'Required system', screenshots: 'Screenshots', screenshot: 'screenshot', downloadButton: 'Game share', preparing: 'Share link coming soon' }
  if (lang === 'ja') return { back: 'PSPライブラリへ戻る', information: 'ゲーム情報', gameName: 'ゲーム名', genre: 'ジャンル', platform: '機種', publisher: 'メーカー', language: '言語', release: '発売日', requiredSystem: '必要システム', screenshots: 'スクリーンショット', screenshot: 'スクリーンショット', downloadButton: 'ゲーム共有', preparing: '共有リンク準備中' }
  return { back: '返回PSP游戏库', information: '游戏信息', gameName: '游戏名称', genre: '游戏类型', platform: '平台', publisher: '游戏厂商', language: '语言', release: '发行日期', requiredSystem: '所需系统', screenshots: '游戏截图', screenshot: '游戏截图', downloadButton: '游戏分享', preparing: '分享资源待添加' }
}
