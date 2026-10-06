import { useEffect, useMemo, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { SiteLayout } from '#/components/site-layout'
import { addCoinBalance, readSpendableCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { useMemberSession } from '#/lib/member-client'

const OWNED_CARTRIDGES_KEY = 'ucg999-fc-owned-cartridges'
const OWNED_CARTRIDGES_MIGRATION_KEY = 'ucg999-fc-owned-cartridges-migrated'
const CARTRIDGE_PRICE = 50

const FC_CARTRIDGES = [
  {
    id: 'donkey-kong', number: '001号', title: '森喜刚', cover: '/fc-player/assets/cartridges/donkey-kong.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'donkey-kong-jr', number: '002号', title: '森喜刚JR.', cover: '/fc-player/assets/cartridges/donkey-kong-jr.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'popeye', number: '003号', title: '大力水手', cover: '/fc-player/assets/cartridges/popeye.min.webp',
    genre: '动作', releaseDate: '1983-07-15', publisher: '任天堂', initial: 'D', edition: '原版',
  },
  {
    id: 'gomoku-narabe', number: '004号', title: '五子棋', cover: '/fc-player/assets/cartridges/gomoku-narabe.min.webp',
    genre: '益智', releaseDate: '1983-08-27', publisher: '任天堂', initial: 'W', edition: '原版',
  },
  {
    id: 'mahjong', number: '005号', title: '麻将', cover: '/fc-player/assets/cartridges/mahjong.min.webp',
    genre: '益智', releaseDate: '1983-08-27', publisher: '任天堂', initial: 'M', edition: '原版',
  },
  {
    id: 'mario-bros', number: '006号', title: '水管玛丽', cover: '/fc-player/assets/cartridges/mario-bros.min.webp',
    genre: '动作', releaseDate: '1983-09-09', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'popeye-english', number: '007号', title: '大力水手学英语', cover: '/fc-player/assets/cartridges/popeye-english.min.webp',
    genre: '教育', releaseDate: '1983-11-22', publisher: '任天堂', initial: 'D', edition: '原版',
  },
  {
    id: 'baseball', number: '008号', title: '棒球', cover: '/fc-player/assets/cartridges/baseball.min.webp',
    genre: '体育', releaseDate: '1983-12-07', publisher: '任天堂', initial: 'B', edition: '原版',
  },
  {
    id: 'donkey-kong-jr-math', number: '009号', title: '森喜刚学算数', cover: '/fc-player/assets/cartridges/donkey-kong-jr-math.min.webp',
    genre: '教育', releaseDate: '1983-12-12', publisher: '任天堂', initial: 'S', edition: '原版',
  },
  {
    id: 'urban-champion',
    number: '026号',
    title: '街头格斗',
    cover: '/fc-player/assets/cartridges/urban-champion.min.webp',
    genre: '格斗',
    releaseDate: '1984-11-14',
    publisher: '任天堂',
    initial: 'J',
    edition: '原版',
  },
  {
    id: 'happy-cat',
    number: '027号',
    title: '快乐猫',
    cover: '/fc-player/assets/cartridges/happy-cat.min.webp',
    genre: '动作',
    releaseDate: '1984-11-14',
    publisher: 'NAMCO',
    initial: 'K',
    edition: '原版',
  },
  {
    id: 'karateka-street-fighter',
    number: '082号',
    title: '空手道 街霸版',
    cover: '/fc-player/assets/cartridges/karateka-street-fighter.min.webp',
    genre: '格斗',
    releaseDate: '1985-12-05',
    publisher: 'Soft Pro',
    initial: 'K',
    edition: '改版',
  },
] as const

export function FcCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'random' | 'releaseDate'>('releaseDate')
  const [reverse, setReverse] = useState(false)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [letterOpen, setLetterOpen] = useState(false)
  const [selectedInitial, setSelectedInitial] = useState('')
  const [modifiedOnly, setModifiedOnly] = useState(false)
  const searchRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!member) {
      try {
        const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
        setOwned(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string').slice(0, 2) : [])
      } catch { setOwned([]) }
      return
    }
    let cancelled = false
    void (async () => {
      let legacyOwned: string[] = []
      let cachedOwned: string[] = []
      const accountCacheKey = `${OWNED_CARTRIDGES_KEY}:${member.id}`
      try {
        const cached = JSON.parse(window.localStorage.getItem(accountCacheKey) || '[]')
        cachedOwned = Array.isArray(cached) ? cached.filter((value): value is string => typeof value === 'string') : []
        if (window.localStorage.getItem(`${OWNED_CARTRIDGES_MIGRATION_KEY}:${member.id}`) !== 'yes') {
          const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
          legacyOwned = Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string') : []
        }
      } catch {}
      try {
        if (legacyOwned.length) {
          const migrationResponse = await fetch('/api/fc-cartridges', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cartridgeIds: legacyOwned }),
          })
          if (migrationResponse.ok) window.localStorage.setItem(`${OWNED_CARTRIDGES_MIGRATION_KEY}:${member.id}`, 'yes')
        }
        const response = await fetch('/api/fc-cartridges', { credentials: 'same-origin', cache: 'no-store' })
        if (!response.ok) throw new Error('collection_load_failed')
        const result = await response.json() as { owned?: string[] }
        const next = Array.isArray(result.owned) ? result.owned : []
        if (cancelled) return
        setOwned(next)
        window.localStorage.setItem(accountCacheKey, JSON.stringify(next))
      } catch {
        if (!cancelled) setOwned(cachedOwned.length ? cachedOwned : legacyOwned)
      }
    })()
    return () => { cancelled = true }
  }, [member?.id])

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
      return (!selectedInitial || cartridge.initial === selectedInitial)
        && (!modifiedOnly || cartridge.edition === '改版')
        && (!keyword || values.some(value => value.toLocaleLowerCase().includes(keyword)))
    })
    const result = [...filtered]
    if (sortField === 'random') result.sort(() => Math.random() - 0.5)
    else if (sortField === 'name') result.sort((a, b) => a.title.localeCompare(b.title, lang))
    else result.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.number.localeCompare(b.number))
    return reverse ? result.reverse() : result
  }, [lang, modifiedOnly, query, reverse, searchField, selectedInitial, sortField])

  const filters = [
    ['name', copy.gameName], ['random', copy.random], ['genre', copy.genre], ['publisher', copy.publisher],
    ['releaseDate', copy.releaseDate], ['modified', copy.modified],
  ] as const

  function handleCartridge(cartridgeId: string) {
    if (owned.includes(cartridgeId)) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    if (!member && owned.length >= 2) {
      setNotice(lang === 'en' ? 'Guests can collect up to 2 cartridges. Sign in for unlimited collections.' : '游客最多只能收藏2款卡带，登录后可继续收藏')
      window.setTimeout(() => setNotice(''), 2800)
      return
    }
    setPendingPurchase(cartridgeId)
  }

  async function confirmPurchase() {
    const cartridgeId = pendingPurchase
    if (!cartridgeId) return
    setPendingPurchase(null)
    if (readSpendableCoinBalance() < CARTRIDGE_PRICE) {
      setNotice(copy.insufficient)
      return
    }
    const previous = owned
    try {
      if (!spendCoinBalance(CARTRIDGE_PRICE)) {
        setNotice(copy.failed)
        return
      }
      let next = [...new Set([...owned, cartridgeId])]
      if (member) {
        const response = await fetch('/api/fc-cartridges', {
          method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cartridgeId }),
        })
        if (!response.ok) throw new Error('collection_save_failed')
        const result = await response.json() as { owned?: string[] }
        next = Array.isArray(result.owned) ? result.owned : next
        window.localStorage.setItem(`${OWNED_CARTRIDGES_KEY}:${member.id}`, JSON.stringify(next))
      } else {
        window.localStorage.setItem(OWNED_CARTRIDGES_KEY, JSON.stringify(next.slice(0, 2)))
        next = next.slice(0, 2)
      }
      setOwned(next)
      setNotice(copy.purchased)
    } catch {
      addCoinBalance(CARTRIDGE_PRICE)
      setOwned(previous)
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
                  className={`btn btn-ghost btn-sm shrink-0 whitespace-nowrap px-2 text-sm font-medium ${(sortField === field || (field === 'modified' && modifiedOnly) || (searchField === field && query)) ? 'text-error' : ''}`}
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
                    if (field === 'name') {
                      setSortField('name')
                      setReverse(false)
                      setLetterOpen(value => !value)
                      return
                    }
                    if (field === 'modified') {
                      setModifiedOnly(value => !value)
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
            {letterOpen ? <div className="mt-2 flex w-full flex-wrap items-center gap-1 sm:justify-end">
              <button className={`btn btn-xs ${!selectedInitial ? 'btn-neutral' : 'btn-ghost'}`} type="button" onClick={() => setSelectedInitial('')}>{copy.allLetters}</button>
              {[...new Set(FC_CARTRIDGES.map(item => item.initial))].sort().map(letter => <button className={`btn btn-xs ${selectedInitial === letter ? 'btn-neutral' : 'btn-ghost'}`} key={letter} type="button" onClick={() => setSelectedInitial(letter)}>{letter}</button>)}
            </div> : null}
          </header>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
            {cartridges.map((cartridge) => (
              <article className="psp-library-card group relative" key={cartridge.id}>
                <button aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`} className="block w-full" onClick={() => handleCartridge(cartridge.id)} type="button">
                  <div className="fc-cartridge-cover psp-library-cover aspect-[3/2] w-full overflow-hidden rounded-lg bg-transparent">
                    <img
                      alt={`${cartridge.title} FC卡带`}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.025]"
                      decoding="async"
                      loading="lazy"
                      src={cartridge.cover}
                    />
                  </div>
                </button>
                <div className="psp-library-info bg-base-100 p-1.5 sm:p-2">
                  <h2 className="truncate text-center text-sm font-semibold text-base-content sm:text-base" title={cartridge.title}>{cartridge.title}</h2>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[10px] text-base-content/60 sm:text-xs">
                    <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-center">
                      <span>{cartridge.number}</span>{cartridge.edition === '改版' ? <> · <span className="font-semibold text-error">{copy.modified}</span></> : null}{' · '}<time>{cartridge.releaseDate}</time>{' · '}<span>{cartridge.publisher}</span>
                    </div>
                    <button
                      aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`}
                      className={`ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm transition sm:h-7 sm:w-7 ${owned.includes(cartridge.id) ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-300 text-black hover:bg-amber-200'}`}
                      title={owned.includes(cartridge.id) ? copy.play : `${CARTRIDGE_PRICE} ${copy.buyLabel}`}
                      onClick={() => handleCartridge(cartridge.id)}
                      type="button"
                    >
                      {owned.includes(cartridge.id)
                        ? <i className="ri-play-fill" />
                        : <img alt="" className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]" src="/images/coin-rewards/pixel-reward-coin.webp" />}
                    </button>
                  </div>
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
  if (lang === 'en') return { title: 'FC Cartridge Collection', chinese: 'Chinese', gameName: 'Game name', random: 'Random', genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', modified: 'Modified', allLetters: 'All', search: 'Search', searchPlaceholder: 'Game name or keyword', confirm: 'Confirm', confirmTitle: 'Collect cartridge?', confirmMessage: (title: string, price: number) => `Spend ${price} coins to collect ${title}?`, cancel: 'Cancel', confirmCollect: 'Collect', open: 'Play ', buy: 'Collect ', buyLabel: 'Collect', play: 'Collected · Play', loginRequired: 'Sign in before collecting cartridges', insufficient: 'Not enough coins. 50 coins required.', purchased: 'Cartridge added to FC Collection', failed: 'Collection could not be saved', count: (count: number) => `${count} cartridges available`, collectionHint: 'collected cartridges can be switched and played directly in the mobile FC Collection', ownedCount: (count: number) => `${count} collected` }
  if (lang === 'zh-TW') return { title: 'FC卡帶收藏', chinese: '中文', gameName: '遊戲名稱', random: '隨機', genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', modified: '改版', allLetters: '全部', search: '搜尋', searchPlaceholder: '遊戲名稱或關鍵詞', confirm: '確認', confirmTitle: '確認收藏卡帶？', confirmMessage: (title: string, price: number) => `將花費 ${price} 個金幣收藏《${title}》，是否繼續？`, cancel: '取消', confirmCollect: '確認收藏', open: '遊玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 遊玩', loginRequired: '請先登入玩家帳號再收藏卡帶', insufficient: '金幣不足，需要50個金幣', purchased: '收藏成功，卡帶已加入FC時光機', failed: '卡帶收藏記錄保存失敗', count: (count: number) => `目前共有 ${count} 款卡帶`, collectionHint: '收藏後可直接在手機FC時光機換卡帶遊玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
  if (lang === 'ja') return { title: 'FCカセットコレクション', chinese: '中国語', gameName: 'ゲーム名', random: 'ランダム', genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', modified: '改造版', allLetters: 'すべて', search: '検索', searchPlaceholder: 'ゲーム名またはキーワード', confirm: '確認', confirmTitle: 'カセットをコレクションしますか？', confirmMessage: (title: string, price: number) => `${price}コインで「${title}」をコレクションしますか？`, cancel: 'キャンセル', confirmCollect: 'コレクション', open: 'プレイ：', buy: 'コレクション：', buyLabel: 'コレクション', play: '収集済み・プレイ', loginRequired: 'カセットのコレクションにはログインが必要です', insufficient: 'コインが不足しています（50枚必要）', purchased: 'FCコレクションに追加しました', failed: 'コレクション情報を保存できませんでした', count: (count: number) => `${count}本のカセット`, collectionHint: 'コレクション後はスマホのFCコレクションで交換して遊べます', ownedCount: (count: number) => `${count}本収集済み` }
  return { title: 'FC卡带收藏', chinese: '中文', gameName: '游戏名称', random: '随机', genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', modified: '改版', allLetters: '全部', search: '搜索', searchPlaceholder: '游戏名称或关键词', confirm: '确认', confirmTitle: '确认收藏卡带？', confirmMessage: (title: string, price: number) => `将花费 ${price} 个金币收藏《${title}》，是否继续？`, cancel: '取消', confirmCollect: '确认收藏', open: '游玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 游玩', loginRequired: '请先登录玩家账号再收藏卡带', insufficient: '金币不足，需要50个金币', purchased: '收藏成功，卡带已加入FC时光机', failed: '卡带收藏记录保存失败', count: (count: number) => `目前共有 ${count} 款卡带`, collectionHint: '收藏可直接在手机FC时光机换卡带游玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
}
