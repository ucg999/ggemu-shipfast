import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SiteLayout } from '#/components/site-layout'
import { SwitchLibraryImage } from '#/components/switch-library-image'
import type { Locale } from '#/lib/ggemu'
import { SWITCH_LIBRARY_GAMES } from '#/lib/switch-library'

export function SwitchDownloadLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const [sortField, setSortField] = useState<'random' | 'popular' | 'updatedAt' | 'releaseDate'>('releaseDate')
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [draftField, setDraftField] = useState<'genre' | 'publisher' | null>(null)
  const [reverse, setReverse] = useState(false)
  const [randomIds, setRandomIds] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [draftQuery, setDraftQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const searchFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!isSearchOpen) return
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (searchFormRef.current?.contains(target) || target.closest('[data-switch-search-trigger]')) return
      setIsSearchOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSearchOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside, true)
    document.addEventListener('keydown', dismissOnEscape)
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true)
      document.removeEventListener('keydown', dismissOnEscape)
    }
  }, [isSearchOpen])
  const games = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    const filtered = SWITCH_LIBRARY_GAMES.filter((game) => {
      const values = searchField
        ? [game[searchField]]
        : [game.title, game.foreignTitle ?? '', game.genre, game.publisher, game.releaseDate, game.language, game.requiredSystem, game.description, game.shareVersion ?? '', game.downloadStatus ?? '', 'Switch']
      return values.some((value) => value.toLocaleLowerCase().includes(query))
    })
    return filtered.sort((a, b) => {
      let result = 0
      if (sortField === 'random') result = randomIds.indexOf(a.id) - randomIds.indexOf(b.id)
      else if (sortField === 'popular') result = (b.popularity ?? 0) - (a.popularity ?? 0)
      else if (sortField === 'releaseDate') result = b.releaseDate.localeCompare(a.releaseDate)
      else result = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
      return reverse ? -result : result
    })
  }, [sortField, reverse, randomIds, searchQuery, searchField])
  const pageCount = Math.max(1, Math.ceil(games.length / 20))
  const visibleGames = games.slice((page - 1) * 20, page * 20)
  const filters = [
    { field: 'random' as const, label: copy.random },
    { field: 'popular' as const, label: copy.popular },
    { field: 'updatedAt' as const, label: copy.updatedAt },
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
              <span className="text-xs font-normal text-base-content/55">{copy.gameCount(SWITCH_LIBRARY_GAMES.length)}</span>
            </div>
            <div className="flex min-w-0 max-w-full flex-nowrap items-center justify-end gap-1 overflow-x-auto max-sm:w-full max-sm:justify-center max-sm:gap-0 max-sm:[&>.btn]:h-7 max-sm:[&>.btn]:min-h-7 max-sm:[&>.btn]:min-w-0 max-sm:[&>.btn]:shrink max-sm:[&>.btn]:gap-0.5 max-sm:[&>.btn]:px-1 max-sm:[&>.btn]:text-[clamp(11px,3vw,13px)] max-sm:[&>.btn]:whitespace-nowrap max-sm:[&>.btn-square]:w-7 max-sm:[&>.btn-square]:shrink-0 max-sm:[&>.btn>i]:text-sm">
              {filters.map(({ field, label }) => (
                <button
                  className={`btn btn-ghost btn-sm shrink-0 px-2 text-sm font-medium ${sortField === field || (searchField === field && searchQuery) ? 'text-error' : ''}`}
                  aria-pressed={sortField === field || (searchField === field && !!searchQuery)}
                  type="button"
                  key={field}
                  data-switch-search-trigger={field === 'genre' || field === 'publisher' ? '' : undefined}
                  onClick={() => {
                    if (field === 'genre' || field === 'publisher') {
                      setDraftField(field)
                      setDraftQuery(searchField === field ? searchQuery : '')
                      setIsSearchOpen(true)
                      return
                    }
                    if (field === 'random') {
                      const ids = SWITCH_LIBRARY_GAMES.map((game) => game.id)
                      for (let i = ids.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1))
                        ;[ids[i], ids[j]] = [ids[j], ids[i]]
                      }
                      setRandomIds(ids)
                    }
                    setReverse(field === sortField && field !== 'random' ? !reverse : false)
                    setSortField(field)
                    setPage(1)
                  }}
                >
                  {label}
                  {sortField === field && field !== 'random' ? <span aria-hidden="true">{reverse ? '↑' : '↓'}</span> : null}
                </button>
              ))}
              <button data-switch-search-trigger="" className="btn btn-ghost btn-sm btn-square shrink-0" type="button" aria-label={copy.search} aria-expanded={isSearchOpen && draftField === null} onClick={() => { setDraftField(null); setDraftQuery(searchField === null ? searchQuery : ''); setIsSearchOpen(!isSearchOpen || draftField !== null) }}>
                <i className="ri-search-line text-lg" aria-hidden="true" />
              </button>
            </div>
          </div>
          {isSearchOpen ? (
            <form
              ref={searchFormRef}
              className="fixed right-3 top-3 z-[60] flex w-[calc(100vw-11rem)] items-center gap-1 sm:left-1/2 sm:right-auto sm:w-[min(460px,calc(100vw-20rem))] sm:-translate-x-1/2 sm:gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                setSearchQuery(draftQuery)
                setSearchField(draftField)
                setPage(1)
                setIsSearchOpen(false)
              }}
            >
              <input
                key={draftField ?? 'all'}
                autoFocus
                className="h-8 min-w-0 flex-1 appearance-none border-0 bg-transparent px-2 text-sm text-white shadow-none outline-none placeholder:text-white/70 focus:outline-none"
                type="search"
                aria-label={draftField ? `${copy.search} · ${copy[draftField]}` : '输入游戏名称、关键词'}
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder={draftField ? `${copy.search} · ${copy[draftField]}` : '输入游戏名称、关键词'}
              />
              <button className="h-8 shrink-0 border-0 bg-transparent px-2 text-sm text-white shadow-none" type="submit">{copy.confirm}</button>
            </form>
          ) : null}
          {searchQuery ? <button className="btn btn-ghost btn-sm mb-3" onClick={() => { setSearchQuery(''); setDraftQuery(''); setPage(1) }}>{copy.clear}: {searchQuery} ×</button> : null}
          {games.length === 0 ? <p className="py-12 text-center text-base-content/60">{copy.empty}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {visibleGames.map((game) => (
              <Link className="group overflow-hidden rounded-xl bg-base-100" key={game.id} params={{ gameId: game.id, locale: lang }} to="/$locale/platform/switch/$gameId">
                <SwitchLibraryImage className="aspect-[616/353] w-full transition group-hover:scale-[1.02]" src={game.cover} alt={game.title} />
                <div className="p-2.5 sm:py-4">
                  <h2 className="truncate text-sm font-semibold text-base-content sm:text-lg" title={game.title}>{game.title}</h2>
                  <div className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-base-content/55 sm:mt-2 sm:text-xs">
                    <span>Switch</span>{' · '}<span>{getCardLanguage(game.language)}</span>{' · '}<span>{game.genre.split('、')[0]}</span>{' · '}<time>{game.releaseDate}</time>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {pageCount > 1 ? <nav className="mt-8 flex items-center justify-center gap-4" aria-label={copy.pagination}>
            <button className="btn btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>{copy.previous}</button>
            <span className="text-sm" aria-live="polite">{page} / {pageCount}</span>
            <button className="btn btn-sm" disabled={page === pageCount} onClick={() => setPage(page + 1)}>{copy.next}</button>
          </nav> : null}
        </div>
      </main>
    </SiteLayout>
  )
}

function getCardLanguage(language: string) {
  const first = language.split(/[、，,\/；;]/)[0].trim()
  const names: Record<string, string> = { 中: '中文', 日: '日文', 英: '英文', 法: '法文', 德: '德文', 西: '西班牙文', 韩: '韩文', 俄: '俄文', 意: '意大利文', 葡: '葡萄牙文' }
  return names[first] ?? first
}

function getCopy(lang: Locale) {
  if (lang === 'zh-TW') return { random: '隨機', popular: '最受歡迎', updatedAt: '修改時間', clear: '清除搜尋', empty: '沒有找到相關遊戲', pagination: '分頁', previous: '上一頁', next: '下一頁', title: 'Switch 遊戲庫', gameCount: (count: number) => `共 ${count} 款遊戲`, genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', search: '搜尋', confirm: '確認' }
  if (lang === 'en') return { random: 'Random', popular: 'Most popular', updatedAt: 'Last updated', clear: 'Clear search', empty: 'No games found', pagination: 'Pagination', previous: 'Previous', next: 'Next', title: 'Switch Game Library', gameCount: (count: number) => `${count} games`, genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', search: 'Search ', confirm: 'Confirm' }
  if (lang === 'ja') return { random: 'ランダム', popular: '人気順', updatedAt: '更新日時', clear: '検索をクリア', empty: 'ゲームが見つかりません', pagination: 'ページ', previous: '前へ', next: '次へ', title: 'Switch ゲームライブラリ', gameCount: (count: number) => `${count}本`, genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', search: '検索：', confirm: '確認' }
  return { random: '随机', popular: '最受欢迎', updatedAt: '修改时间', clear: '清除搜索', empty: '没有找到相关游戏', pagination: '分页', previous: '上一页', next: '下一页', title: 'Switch游戏库', gameCount: (count: number) => `共 ${count} 款游戏`, genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', search: '搜索', confirm: '确认' }
}
