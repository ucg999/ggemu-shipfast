import { useEffect, useMemo, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { SiteLayout } from '#/components/site-layout'
import { readSpendableCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { requestMemberLogin, useMemberSession } from '#/lib/member-client'

const OWNED_CARTRIDGES_KEY = 'ucg999-fc-owned-cartridges'
const CARTRIDGE_PRICE = 50

const FC_CARTRIDGES = [
  {
    id: 'urban-champion',
    number: '026号',
    title: '街头格斗',
    cover: '/fc-player/assets/cartridges/urban-champion.min.webp',
    genre: '格斗',
    releaseDate: '1984.11.14',
    publisher: '任天堂',
  },
  {
    id: 'happy-cat',
    number: '027号',
    title: '快乐猫',
    cover: '/fc-player/assets/cartridges/happy-cat.min.webp',
    genre: '动作',
    releaseDate: '1984.11.14',
    publisher: 'NAMCO',
  },
] as const

export function FcCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'random' | 'popular' | 'updatedAt' | 'releaseDate'>('releaseDate')
  const [reverse, setReverse] = useState(false)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
      setOwned(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : [])
    } catch {
      setOwned([])
    }
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    const close = (event: PointerEvent) => {
      if (event.target instanceof Element && !searchRef.current?.contains(event.target) && !event.target.closest('[data-fc-filter]')) setSearchOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [searchOpen])

  const cartridges = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    const filtered = FC_CARTRIDGES.filter((cartridge) => {
      const values = searchField ? [cartridge[searchField]] : [cartridge.title, cartridge.number, cartridge.genre, cartridge.publisher, cartridge.releaseDate]
      return !keyword || values.some(value => value.toLocaleLowerCase().includes(keyword))
    })
    const result = [...filtered]
    if (sortField === 'random') result.sort(() => Math.random() - 0.5)
    else if (sortField === 'name') result.sort((a, b) => a.title.localeCompare(b.title, lang))
    else if (sortField === 'popular') result.sort((a, b) => Number(owned.includes(b.id)) - Number(owned.includes(a.id)) || a.number.localeCompare(b.number))
    else result.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.number.localeCompare(b.number))
    return reverse ? result.reverse() : result
  }, [lang, owned, query, reverse, searchField, sortField])

  const filters = [
    ['name', copy.gameName], ['random', copy.random], ['popular', copy.popular], ['updatedAt', copy.updatedAt],
    ['genre', copy.genre], ['publisher', copy.publisher], ['releaseDate', copy.releaseDate],
  ] as const

  function handleCartridge(cartridgeId: string) {
    if (!member) {
      setNotice(copy.loginRequired)
      requestMemberLogin()
      return
    }
    if (owned.includes(cartridgeId)) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    setPendingPurchase(cartridgeId)
  }

  function confirmPurchase() {
    const cartridgeId = pendingPurchase
    if (!cartridgeId) return
    setPendingPurchase(null)
    if (readSpendableCoinBalance() < CARTRIDGE_PRICE) {
      setNotice(copy.insufficient)
      return
    }
    const next = [...new Set([...owned, cartridgeId])]
    try {
      window.localStorage.setItem(OWNED_CARTRIDGES_KEY, JSON.stringify(next))
      if (!spendCoinBalance(CARTRIDGE_PRICE)) {
        window.localStorage.setItem(OWNED_CARTRIDGES_KEY, JSON.stringify(owned))
        setNotice(copy.failed)
        return
      }
      setOwned(next)
      setNotice(copy.purchased)
    } catch {
      setNotice(copy.failed)
    }
  }
  return (
    <SiteLayout locale={lang}>
      <main className="min-h-screen bg-[#f0f0ed] px-4 pb-20 pt-8 text-base-content sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-[1500px]">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/50">
                <span>{copy.count(FC_CARTRIDGES.length)}，{copy.collectionHint}</span>
                <span className="font-semibold text-amber-500">{copy.ownedCount(owned.length)}</span>
              </div>
            </div>
            <div className="relative flex w-full max-w-full flex-nowrap items-center justify-start gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:w-auto sm:justify-end">
              {filters.map(([field, label]) => (
                <button
                  className={`btn btn-ghost btn-sm shrink-0 whitespace-nowrap px-2 text-sm font-medium ${(sortField === field || (searchField === field && query)) ? 'text-error' : ''}`}
                  data-fc-filter=""
                  key={field}
                  type="button"
                  onClick={() => {
                    if (field === 'genre' || field === 'publisher') {
                      setSearchField(field)
                      setDraftQuery(searchField === field ? query : '')
                      setSearchOpen(true)
                      return
                    }
                    setReverse(sortField === field && field !== 'random' ? !reverse : false)
                    setSortField(field)
                  }}
                >
                  {label}{sortField === field && field !== 'random' ? <span aria-hidden="true">{reverse ? '↑' : '↓'}</span> : null}
                </button>
              ))}
              <button aria-label={copy.search} className="btn btn-ghost btn-sm btn-square shrink-0" data-fc-filter="" type="button" onClick={() => { setSearchField(null); setDraftQuery(searchField === null ? query : ''); setSearchOpen(true) }}><i className="ri-search-line text-lg" /></button>
              {searchOpen ? <form ref={searchRef} className="absolute right-0 top-full z-30 mt-1 flex h-9 w-64 items-center rounded-lg bg-white p-1 shadow-lg" onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery); setSearchOpen(false) }}>
                <input autoFocus className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" placeholder={searchField ? `${copy.search} · ${copy[searchField]}` : copy.searchPlaceholder} type="search" value={draftQuery} onChange={event => setDraftQuery(event.target.value)} />
                <button className="btn btn-error btn-xs text-white" type="submit">{copy.confirm}</button>
              </form> : null}
            </div>
          </header>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {cartridges.map((cartridge) => (
              <article className="psp-library-card group relative" key={cartridge.id}>
                <button aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`} className="block w-full" onClick={() => handleCartridge(cartridge.id)} type="button">
                  <div className="psp-library-cover aspect-[3/2] w-full overflow-hidden rounded-lg bg-transparent">
                    <img
                      alt={`${cartridge.title} FC卡带`}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
                      decoding="async"
                      loading="lazy"
                      src={cartridge.cover}
                    />
                  </div>
                </button>
                <div className="psp-library-info bg-base-100 p-2 sm:py-2.5">
                  <h2 className="truncate text-center text-base font-semibold text-base-content sm:text-lg" title={cartridge.title}>{cartridge.title}</h2>
                  <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] text-base-content/60 sm:text-[13px]">
                    <span>{cartridge.number}</span>{' · '}<span>{copy.chinese}</span>{' · '}<time>{cartridge.releaseDate}</time>{' · '}<span>{cartridge.publisher}</span>
                  </div>
                  <button className={`mt-2 flex h-7 w-full items-center justify-center gap-1 rounded-md text-[10px] font-semibold transition ${owned.includes(cartridge.id) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-300 text-black hover:bg-amber-200'}`} onClick={() => handleCartridge(cartridge.id)} type="button">
                    {owned.includes(cartridge.id) ? copy.play : <><img alt="" className="h-3.5 w-3.5" src="/images/coin-rewards/pixel-reward-coin.webp" />{CARTRIDGE_PRICE} · {copy.buyLabel}</>}
                  </button>
                </div>
              </article>
            ))}
          </div>
          {pendingPurchase ? <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="fc-purchase-title">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black shadow-2xl">
              <h2 className="text-lg font-semibold" id="fc-purchase-title">{copy.confirmTitle}</h2>
              <p className="mt-2 text-sm text-black/65">{copy.confirmMessage(FC_CARTRIDGES.find(item => item.id === pendingPurchase)?.title ?? '', CARTRIDGE_PRICE)}</p>
              <div className="mt-5 flex justify-center gap-3">
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPendingPurchase(null)}>{copy.cancel}</button>
                <button className="btn btn-warning btn-sm" type="button" onClick={confirmPurchase}>{copy.confirmCollect}</button>
              </div>
            </div>
          </div> : null}
          {notice ? <div className="fixed bottom-8 left-1/2 z-[180] -translate-x-1/2 rounded-full bg-black px-5 py-2 text-sm text-white shadow-xl" role="status">{notice}</div> : null}
        </div>
      </main>
    </SiteLayout>
  )
}

function getCopy(lang: Locale) {
  if (lang === 'en') return { title: 'FC Cartridge Collection', chinese: 'Chinese', gameName: 'Game name', random: 'Random', popular: 'Most popular', updatedAt: 'Last updated', genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', search: 'Search', searchPlaceholder: 'Game name or keyword', confirm: 'Confirm', confirmTitle: 'Collect cartridge?', confirmMessage: (title: string, price: number) => `Spend ${price} coins to collect ${title}?`, cancel: 'Cancel', confirmCollect: 'Collect', open: 'Play ', buy: 'Collect ', buyLabel: 'Collect', play: 'Collected · Play', loginRequired: 'Sign in before collecting cartridges', insufficient: 'Not enough coins. 50 coins required.', purchased: 'Cartridge added to FC Collection', failed: 'Collection could not be saved', count: (count: number) => `${count} cartridges available`, collectionHint: 'collected cartridges can be switched and played directly in the mobile FC Collection', ownedCount: (count: number) => `${count} collected` }
  if (lang === 'zh-TW') return { title: 'FC卡帶收藏', chinese: '中文', gameName: '遊戲名稱', random: '隨機', popular: '最受歡迎', updatedAt: '更新時間', genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', search: '搜尋', searchPlaceholder: '遊戲名稱或關鍵詞', confirm: '確認', confirmTitle: '確認收藏卡帶？', confirmMessage: (title: string, price: number) => `將花費 ${price} 個金幣收藏《${title}》，是否繼續？`, cancel: '取消', confirmCollect: '確認收藏', open: '遊玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 遊玩', loginRequired: '請先登入玩家帳號再收藏卡帶', insufficient: '金幣不足，需要50個金幣', purchased: '收藏成功，卡帶已加入FC時光機', failed: '卡帶收藏記錄保存失敗', count: (count: number) => `目前共有 ${count} 款卡帶`, collectionHint: '收藏後可直接在手機FC時光機換卡帶遊玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
  if (lang === 'ja') return { title: 'FCカセットコレクション', chinese: '中国語', gameName: 'ゲーム名', random: 'ランダム', popular: '人気順', updatedAt: '更新日時', genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', search: '検索', searchPlaceholder: 'ゲーム名またはキーワード', confirm: '確認', confirmTitle: 'カセットをコレクションしますか？', confirmMessage: (title: string, price: number) => `${price}コインで「${title}」をコレクションしますか？`, cancel: 'キャンセル', confirmCollect: 'コレクション', open: 'プレイ：', buy: 'コレクション：', buyLabel: 'コレクション', play: '収集済み・プレイ', loginRequired: 'カセットのコレクションにはログインが必要です', insufficient: 'コインが不足しています（50枚必要）', purchased: 'FCコレクションに追加しました', failed: 'コレクション情報を保存できませんでした', count: (count: number) => `${count}本のカセット`, collectionHint: 'コレクション後はスマホのFCコレクションで交換して遊べます', ownedCount: (count: number) => `${count}本収集済み` }
  return { title: 'FC卡带收藏', chinese: '中文', gameName: '游戏名称', random: '随机', popular: '最受欢迎', updatedAt: '更新时间', genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', search: '搜索', searchPlaceholder: '游戏名称或关键词', confirm: '确认', confirmTitle: '确认收藏卡带？', confirmMessage: (title: string, price: number) => `将花费 ${price} 个金币收藏《${title}》，是否继续？`, cancel: '取消', confirmCollect: '确认收藏', open: '游玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 游玩', loginRequired: '请先登录玩家账号再收藏卡带', insufficient: '金币不足，需要50个金币', purchased: '收藏成功，卡带已加入FC时光机', failed: '卡带收藏记录保存失败', count: (count: number) => `目前共有 ${count} 款卡带`, collectionHint: '收藏可直接在手机FC时光机换卡带游玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
}
