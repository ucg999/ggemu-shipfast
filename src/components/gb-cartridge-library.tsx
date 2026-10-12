import { useEffect, useMemo, useRef, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { CartridgeControlsDialog, CartridgePlayerDialog } from '#/components/cartridge-controls-dialog'
import { readMemberCoinBalance, spendMemberCoinBalance } from '#/lib/coin-wallet'
import type { Locale } from '#/lib/ggemu'
import { useMemberSession } from '#/lib/member-client'

const PRICE = 50
const LOCAL_KEY = 'ucg999-gb-owned-cartridges'
function isLocalDevelopment() {
  return typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
}
const CARTRIDGES = [
  { id: 'castlevania-2', number: '198号', title: '恶魔城传说2', genre: '动作冒险', releaseDate: '1991-07-12', publisher: 'Konami', cover: '/gb-player/assets/cartridges/castlevania-2.webp' },
  { id: 'pokemon-gold', number: '908号', title: '宝可梦 金', genre: '角色扮演', releaseDate: '1999-11-21', publisher: 'Nintendo', cover: '/gb-player/assets/cartridges/pokemon-gold.webp' },
  { id: 'pokemon-silver', number: '909号', title: '宝可梦 银', genre: '角色扮演', releaseDate: '1999-11-21', publisher: 'Nintendo', cover: '/gb-player/assets/cartridges/pokemon-silver.webp' },
  { id: 'cyborg-kuro-chan-2', number: '1066号', title: '霹雳酷乐猫2', genre: '动作冒险', releaseDate: '2000-10-19', publisher: 'Konami', cover: '/gb-player/assets/cartridges/cyborg-kuro-chan-2.webp' },
  { id: 'pokemon-crystal', number: '1119号', title: '宝可梦 水晶', genre: '角色扮演', releaseDate: '2000-12-14', publisher: 'Nintendo', cover: '/gb-player/assets/cartridges/pokemon-crystal.webp' },
] as const
const CARTRIDGE_UPDATED_AT: Record<string, string> = {
  'pokemon-silver': '2026-10-08T22:26:28+08:00',
  'pokemon-gold': '2026-10-08T22:27:44+08:00',
  'pokemon-crystal': '2026-10-09T17:23:53+08:00',
  'castlevania-2': '2026-10-10T00:15:26+08:00',
  'cyborg-kuro-chan-2': '2026-10-10T00:15:28+08:00',
}
const VISIBLE_CARTRIDGE_IDS = new Set(CARTRIDGES.map(cartridge => cartridge.id))
const visibleOwned = (ids: string[]) => ids.filter(id => VISIBLE_CARTRIDGE_IDS.has(id as (typeof CARTRIDGES)[number]['id']))
type GbRankings = {
  cartridges: { rank: number; cartridgeId: string; count: number }[]
  collectors: { rank: number; displayName: string; playerNumber: number | null; count: number }[]
}

export function GbCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [rankings, setRankings] = useState<GbRankings>({ cartridges: [], collectors: [] })
  const [rankingsOpen, setRankingsOpen] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'random' | 'updatedAt' | 'releaseDate'>('updatedAt')
  const [reverse, setReverse] = useState(false)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLFormElement>(null)

  const visibleCartridges = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    const filtered = CARTRIDGES.filter((cartridge) => {
      if (!keyword) return true
      const value = searchField === 'genre'
        ? cartridge.genre
        : searchField === 'publisher'
          ? cartridge.publisher
          : `${cartridge.title} ${cartridge.number} ${cartridge.genre} ${cartridge.publisher} ${cartridge.releaseDate}`
      return value.toLocaleLowerCase().includes(keyword)
    })
    const result = [...filtered]
    if (sortField === 'random') result.sort(() => Math.random() - 0.5)
    else if (sortField === 'name') result.sort((a, b) => a.title.localeCompare(b.title, lang))
    else if (sortField === 'updatedAt') result.sort((a, b) => Date.parse(CARTRIDGE_UPDATED_AT[b.id]) - Date.parse(CARTRIDGE_UPDATED_AT[a.id]))
    else result.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
    return reverse ? result.reverse() : result
  }, [lang, query, reverse, sortField, searchField])

  useEffect(() => {
    if (!searchOpen) return
    const close = (event: MouseEvent) => {
      if (event.target instanceof Element && !searchRef.current?.contains(event.target) && !event.target.closest('[data-gb-filter]')) setSearchOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [searchOpen])

  function applyRankings(data: { rankings?: Partial<GbRankings> }) {
    setRankings({
      cartridges: Array.isArray(data.rankings?.cartridges) ? data.rankings.cartridges.slice(0, 5) : [],
      collectors: Array.isArray(data.rankings?.collectors) ? data.rankings.collectors.slice(0, 5) : [],
    })
  }

  useEffect(() => {
    if (isLocalDevelopment()) {
      setOwned(CARTRIDGES.map(cartridge => cartridge.id))
      void fetch('/api/gb-cartridges', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject()).then(applyRankings).catch(() => {})
      return
    }
    if (!member) {
      try { setOwned(visibleOwned(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'))) } catch { setOwned([]) }
      void fetch('/api/gb-cartridges', { credentials: 'same-origin', cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject()).then(applyRankings).catch(() => {})
      return
    }
    let cancelled = false
    void fetch('/api/gb-cartridges', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: { owned?: string[]; rankings?: Partial<GbRankings> }) => { if (!cancelled) { setOwned(visibleOwned(Array.isArray(data.owned) ? data.owned : [])); applyRankings(data) } })
      .catch(() => { try { if (!cancelled) setOwned(visibleOwned(JSON.parse(localStorage.getItem(`${LOCAL_KEY}:${member.id}`) || '[]'))) } catch {} })
    return () => { cancelled = true }
  }, [member?.id])

  function selectCartridge(cartridgeId: string) {
    if (isLocalDevelopment() || owned.includes(cartridgeId)) window.location.assign(`/gb?cartridge=${encodeURIComponent(cartridgeId)}`)
    else if (!member) {
      setNotice(lang === 'en' ? 'Sign in to collect with member coins.' : '请先登录玩家账号，收藏只可使用会员金币')
      window.setTimeout(() => setNotice(''), 2600)
    } else setConfirming(cartridgeId)
  }

  function openCartridge(cartridgeId: string) {
    if (window.matchMedia('(min-width: 1024px)').matches) setPreviewing(cartridgeId)
    else selectCartridge(cartridgeId)
  }

  function playOrCollect(cartridgeId: string) {
    if (owned.includes(cartridgeId) && window.matchMedia('(min-width: 1024px)').matches) setPlaying(cartridgeId)
    else selectCartridge(cartridgeId)
  }

  async function collect() {
    const cartridgeId = confirming
    if (!cartridgeId) return
    setConfirming(null)
    if (!member) { setNotice(lang === 'en' ? 'Sign in to use member coins.' : '请先登录玩家账号'); return }
    if (readMemberCoinBalance() < PRICE || !spendMemberCoinBalance(PRICE)) { setNotice(copy.insufficient); return }
    try {
      const next = [...new Set([...owned, cartridgeId])]
      if (member) {
        const response = await fetch('/api/gb-cartridges', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cartridgeId }) })
        if (!response.ok) throw new Error('save_failed')
        localStorage.setItem(`${LOCAL_KEY}:${member.id}`, JSON.stringify(next))
      } else localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      setOwned(next)
      setNotice(copy.success)
    } catch {
      setNotice(copy.failed)
    }
  }

  return <SiteLayout locale={lang}>
    <main className="min-h-screen bg-[#f0f0ed] px-4 pb-20 pt-8 text-base-content sm:px-6 lg:px-10 lg:pt-10">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1><p className="mt-1 text-sm text-base-content/50">{copy.count(CARTRIDGES.length)}，{copy.hint} <b className="text-amber-500">{copy.owned(owned.length)}</b> <button className="ml-2 font-semibold text-base-content underline underline-offset-2" type="button" onClick={() => setRankingsOpen(true)}>{copy.rankings}</button></p></div>
          <div className="relative flex items-center gap-1 text-sm">
            {([['name', copy.gameName], ['random', copy.random], ['updatedAt', copy.updatedAt], ['genre', copy.genre], ['publisher', copy.publisher], ['releaseDate', copy.releaseDate]] as const).map(([field, label]) => <button
              className={`btn btn-ghost btn-sm ${sortField === field || searchField === field ? 'font-semibold text-error' : ''}`}
              data-gb-filter=""
              key={field}
              type="button"
              onClick={() => {
                if (field === 'genre' || field === 'publisher') {
                  setSearchField(field)
                  setDraftQuery(searchField === field ? query : '')
                  setSearchOpen(true)
                  return
                }
                setSearchOpen(false)
                setSearchField(null)
                setQuery('')
                setReverse(sortField === field && field !== 'random' ? !reverse : false)
                setSortField(field)
              }}
            >{label}{sortField === field && field !== 'random' ? <span aria-hidden="true">{reverse ? '↑' : '↓'}</span> : null}</button>)}
            <button aria-label={copy.search} className="btn btn-ghost btn-sm btn-square" data-gb-filter="" type="button" onClick={() => { setSearchField(null); setDraftQuery(searchField === null ? query : ''); setSearchOpen(true) }}><i className="ri-search-line text-lg" /></button>
            {searchOpen ? <form ref={searchRef} className="absolute right-0 top-full z-40 mt-1 flex h-10 w-72 items-center rounded-lg bg-white p-1 shadow-lg" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery); setSearchOpen(false) }}>
              <input autoFocus className="min-w-0 flex-1 bg-transparent px-2 text-sm text-black outline-none" placeholder={searchField === 'genre' ? copy.genre : searchField === 'publisher' ? copy.publisher : copy.searchPlaceholder} value={draftQuery} onChange={event => setDraftQuery(event.target.value)} />
              <button className="btn btn-neutral btn-sm" type="submit">{copy.confirm}</button>
            </form> : null}
          </div>
        </header>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
          {visibleCartridges.map(cartridge => <article className="psp-library-card group relative" key={cartridge.id}>
            <button aria-label={`${owned.includes(cartridge.id) ? copy.play : copy.collect} ${cartridge.title}`} className="block w-full" type="button" onClick={() => openCartridge(cartridge.id)}>
              <div className="gb-cartridge-cover psp-library-cover aspect-[5/6] w-full overflow-visible rounded-lg bg-transparent">
                <img alt={`${cartridge.title} GB卡带`} className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]" decoding="async" loading="lazy" src={cartridge.cover} />
              </div>
            </button>
            <div className="psp-library-info bg-base-100 p-1.5 sm:p-2"><h2 className="truncate text-center text-sm font-semibold text-base-content sm:text-base" title={cartridge.title}>{cartridge.title}</h2><div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-base-content/60 sm:text-xs"><span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-center">{cartridge.number} · {cartridge.releaseDate} · {cartridge.publisher}</span><button aria-label={`${owned.includes(cartridge.id) ? copy.play : copy.collect} ${cartridge.title}`} className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm transition sm:h-7 sm:w-7 ${owned.includes(cartridge.id) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-300 text-black hover:bg-amber-200'}`} title={owned.includes(cartridge.id) ? copy.play : `50 ${copy.collect}`} type="button" onClick={() => playOrCollect(cartridge.id)}>{owned.includes(cartridge.id) ? <i className="ri-play-fill" /> : <img alt="" className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]" src="/images/coin-rewards/pixel-reward-coin.webp" />}</button></div></div>
            <div className="pointer-events-none absolute inset-x-1 bottom-1 z-30 hidden rounded-lg bg-black/90 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-xl group-hover:block"><strong className="block text-sm font-semibold">{cartridge.title}</strong><span className="block">{cartridge.number} · {cartridge.genre}</span><span className="block">{cartridge.releaseDate} · {cartridge.publisher}</span></div>
          </article>)}
        </div>
      </div>
      {previewing ? (() => {
        const cartridge = CARTRIDGES.find(item => item.id === previewing)
        return cartridge ? <CartridgeControlsDialog actionLabel={owned.includes(cartridge.id) ? copy.play : copy.collect} cover={cartridge.cover} details={`${cartridge.number} · ${cartridge.genre} · ${cartridge.releaseDate} · ${cartridge.publisher}`} onAction={() => { setPreviewing(null); if (owned.includes(cartridge.id)) setPlaying(cartridge.id); else selectCartridge(cartridge.id) }} onClose={() => setPreviewing(null)} title={cartridge.title} /> : null
      })() : null}
      {playing ? <CartridgePlayerDialog onClose={() => setPlaying(null)} src={`/gb-player/index.html?cartridge=${encodeURIComponent(playing)}`} title={CARTRIDGES.find(item => item.id === playing)?.title ?? 'GB游戏机'} /> : null}
      {rankingsOpen ? <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" onClick={() => setRankingsOpen(false)}><section className="w-full max-w-2xl rounded-2xl bg-[#f0f0ed] p-4 text-base-content shadow-2xl sm:p-6" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">{copy.rankings}</h2><button className="btn btn-ghost btn-sm btn-circle text-xl" type="button" onClick={() => setRankingsOpen(false)}>×</button></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.popularRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.cartridges.length ? rankings.cartridges.map(item => { const cartridge = CARTRIDGES.find(entry => entry.id === item.cartridgeId); return cartridge ? <li className="flex items-center gap-2" key={item.cartridgeId}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{cartridge.number} · {cartridge.title}</span><span className="shrink-0 text-base-content/55">{copy.peopleCount(item.count)}</span></li> : null }) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div><div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.collectorRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.collectors.length ? rankings.collectors.map(item => <li className="flex items-center gap-2" key={`${item.playerNumber ?? 'player'}-${item.rank}`}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{item.displayName}{item.playerNumber ? <small className="ml-1 text-base-content/40">ID:{String(item.playerNumber).padStart(5, '0')}</small> : null}</span><span className="shrink-0 text-base-content/55">{copy.cartridgeCount(item.count)}</span></li>) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div></div></section></div> : null}
      {confirming ? <div className="fixed inset-0 z-[240] grid place-items-center bg-black/35 px-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black shadow-2xl"><h2 className="text-lg font-semibold">{copy.confirmTitle}</h2><p className="mt-2 text-sm text-black/65">{copy.confirmMessage(CARTRIDGES.find(item => item.id === confirming)?.title || '')}</p><div className="mt-5 flex justify-center gap-3"><button className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>{copy.cancel}</button><button className="btn btn-warning btn-sm" onClick={collect}>{copy.confirm}</button></div></div></div> : null}
      {notice ? <div className="fixed bottom-8 left-1/2 z-[180] -translate-x-1/2 rounded-full bg-black px-5 py-2 text-sm text-white">{notice}</div> : null}
    </main>
  </SiteLayout>
}

function getCopy(lang: Locale) {
  if (lang === 'en') return { title: 'GB Cartridge Collection', count: (n: number) => `${n} cartridges available`, hint: 'collected cartridges can be played in the mobile GB console', owned: (n: number) => `${n} collected`, gameName: 'Game name', random: 'Random', genre: 'Genre', publisher: 'Publisher', releaseDate: 'Release date', updatedAt: 'Last updated', search: 'Search', searchPlaceholder: 'Game name or keyword', collect: 'Collect', play: 'Collected · Play', rankings: 'GB rankings', popularRanking: 'Most collected cartridges', collectorRanking: 'Top collectors', noRankings: 'No ranking data yet', peopleCount: (n: number) => `${n} players`, cartridgeCount: (n: number) => `${n} cartridges`, confirmTitle: 'Collect cartridge?', confirmMessage: (title: string) => `Spend 50 coins to collect ${title}?`, cancel: 'Cancel', confirm: 'Collect', insufficient: 'Not enough coins. 50 coins required.', success: 'Added to your GB cartridge collection', failed: 'Collection could not be saved' }
  if (lang === 'zh-TW') return { title: 'GB卡帶收藏', count: (n: number) => `目前共有 ${n} 款卡帶`, hint: '收藏後可直接在手機GB遊戲機換卡帶遊玩', owned: (n: number) => `已收藏 ${n} 款`, gameName: '遊戲名稱', random: '隨機', genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', updatedAt: '更新時間', search: '搜尋', searchPlaceholder: '遊戲名稱或關鍵詞', collect: '收藏', play: '已收藏 · 遊玩', rankings: 'GB排行榜', popularRanking: '最多人收藏的卡帶', collectorRanking: '收藏卡帶最多的玩家', noRankings: '暫無排行資料', peopleCount: (n: number) => `${n}人收藏`, cartridgeCount: (n: number) => `${n}款`, confirmTitle: '確認收藏卡帶？', confirmMessage: (title: string) => `將花費50個金幣收藏《${title}》，是否繼續？`, cancel: '取消', confirm: '確認收藏', insufficient: '金幣不足，需要50個金幣', success: '收藏成功，卡帶已加入GB遊戲機', failed: '卡帶收藏記錄保存失敗' }
  return { title: 'GB卡带收藏', count: (n: number) => `目前共有 ${n} 款卡带`, hint: '收藏后可直接在手机GB游戏机换卡带游玩', owned: (n: number) => `已收藏 ${n} 款`, gameName: '游戏名称', random: '随机', genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', updatedAt: '更新时间', search: '搜索', searchPlaceholder: '游戏名称或关键词', collect: '收藏', play: '已收藏 · 游玩', rankings: 'GB排行榜', popularRanking: '最多人收藏的卡带', collectorRanking: '收藏卡带最多的玩家', noRankings: '暂无排行数据', peopleCount: (n: number) => `${n}人收藏`, cartridgeCount: (n: number) => `${n}款`, confirmTitle: '确认收藏卡带？', confirmMessage: (title: string) => `将花费50个金币收藏《${title}》，是否继续？`, cancel: '取消', confirm: '确认收藏', insufficient: '金币不足，需要50个金币', success: '收藏成功，卡带已加入GB游戏机', failed: '卡带收藏记录保存失败' }
}

