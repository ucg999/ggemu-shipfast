import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { SwitchLibraryImage } from '#/components/switch-library-image'
import type { Locale } from '#/lib/ggemu'
import { PSP_LIBRARY_GAMES } from '#/lib/psp-library'

export function PspDownloadLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | 'releaseDate' | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [draftQuery, setDraftQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const games = useMemo(() => {
    if (!searchField || !searchQuery.trim()) return PSP_LIBRARY_GAMES
    const query = searchQuery.trim().toLocaleLowerCase()
    return PSP_LIBRARY_GAMES.filter((game) => game[searchField].toLocaleLowerCase().includes(query))
  }, [searchField, searchQuery])
  const filters = [
    { field: 'genre' as const, label: copy.genre },
    { field: 'publisher' as const, label: copy.publisher },
    { field: 'releaseDate' as const, label: copy.releaseDate },
  ]
  return (
    <SiteLayout locale={lang} hideFooter>
      <main className="min-h-screen bg-base-200 px-3 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h1 className="text-3xl font-bold text-base-content">{copy.title}</h1>
              <span className="text-xs font-normal text-base-content/55">{copy.gameCount(PSP_LIBRARY_GAMES.length)}</span>
            </div>
            <div className="flex flex-nowrap items-center justify-end gap-1 overflow-x-auto">
              {filters.map(({ field, label }) => (
                <button
                  className={`btn btn-ghost btn-sm shrink-0 px-2 text-sm font-medium ${searchField === field ? 'text-error' : ''}`}
                  type="button"
                  key={field}
                  onClick={() => {
                    setSearchField(field)
                    setDraftQuery('')
                    setSearchQuery('')
                    setIsSearchOpen(true)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {searchField && isSearchOpen ? (
            <form
              className="fixed left-1/2 top-3 z-[60] flex w-[min(420px,calc(100vw-12rem))] -translate-x-1/2 gap-1 sm:w-[min(460px,calc(100vw-20rem))]"
              onSubmit={(event) => {
                event.preventDefault()
                setSearchQuery(draftQuery)
                setIsSearchOpen(false)
              }}
            >
              <input
                autoFocus
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm text-white shadow-none outline-none placeholder:text-white/70 focus:outline-none"
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder={`${copy.search}${filters.find(({ field }) => field === searchField)?.label ?? ''}`}
              />
              <button className="btn btn-error btn-sm text-white" type="submit">{copy.confirm}</button>
            </form>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {games.map((game) => (
              <Link className="group overflow-hidden rounded-xl bg-base-100" key={game.id} params={{ gameId: game.id, locale: lang }} to="/$locale/platform/psp/$gameId">
                <SwitchLibraryImage className="aspect-[616/353] w-full [&_img]:object-contain transition group-hover:scale-[1.02]" src={game.cover} alt={game.title} />
                <div className="p-2.5 sm:p-4">
                  <h2 className="text-sm font-semibold text-base-content sm:text-lg">{game.title}</h2>
                  <div className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-base-content/55 sm:mt-2 sm:flex sm:flex-wrap sm:gap-2 sm:whitespace-normal sm:text-xs">
                    <span>PSP</span>{' · '}<span>{game.cardLanguage ?? game.language}</span>{' · '}<span>{game.genre.split('、')[0]}</span>{' · '}<time>{game.releaseDate}</time>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </SiteLayout>
  )
}

function getCopy(lang: Locale) {
  if (lang === 'zh-TW') return { title: 'PSP 遊戲庫', gameCount: (count: number) => `共 ${count} 款遊戲`, genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', search: '搜尋', confirm: '確認' }
  if (lang === 'en') return { title: 'PSP Game Library', gameCount: (count: number) => `${count} games`, genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', search: 'Search ', confirm: 'Confirm' }
  if (lang === 'ja') return { title: 'PSP ゲームライブラリ', gameCount: (count: number) => `${count}本`, genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', search: '検索：', confirm: '確認' }
  return { title: 'PSP游戏库', gameCount: (count: number) => `共 ${count} 款游戏`, genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', search: '搜索', confirm: '确认' }
}
