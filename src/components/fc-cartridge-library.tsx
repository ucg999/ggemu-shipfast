import { useEffect, useMemo, useRef, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { SiteLayout } from '#/components/site-layout'
import { CartridgeControlsDialog, CartridgePlayerDialog } from '#/components/cartridge-controls-dialog'
import { readMemberCoinBalance, spendMemberCoinBalance } from '#/lib/coin-wallet'
import { useMemberSession } from '#/lib/member-client'

const OWNED_CARTRIDGES_KEY = 'ucg999-fc-owned-cartridges'
const OWNED_CARTRIDGES_MIGRATION_KEY = 'ucg999-fc-owned-cartridges-migrated'
const CARTRIDGE_PRICE = 50

function isLocalDevelopment() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
}

const PRISON_BREAK_GUIDE = {
  title: '这次的脱狱，有什么不同？',
  introduction: [
    '保留原作的横版格斗节奏，九名人物都能成为主角。除了拳脚和拾取武器，还能跑步、翻滚、二段跳、连招和抓摔；每个人物也有自己的出场、过关和通关对白与立绘。',
  ],
  highlights: [
    ['六种语言', '英文、日文、繁体中文、广东话、简体中文、韩文。'],
    ['单人或双人', '两个人一起出击。双人共用所选人物，体力与武器库存各自记录。'],
    ['九人任选', '开局、过关后和接关时选人；关卡途中及首领战不换人。'],
    ['更多动作', '冲刺、滑铲、蹲下、翻滚、空中攻击、五连击与抓摔。'],
    ['随身武器', '小刀、枪、手榴弹分别保存库存，捡到武器不会自动换装。'],
    ['普通与困难', '默认困难。困难模式敌人血量三倍，进攻、躲避更积极；可持械敌兵带武器，能投手榴弹的普通敌兵每次出场带两颗。'],
    ['新的演出', '片头动作场面、人物对白、插画、音乐和音效。'],
  ],
  sections: [
    {
      title: '九名角色，各有拿手好戏',
      items: [
        ['巴特、斯内库', '拳脚均衡，能用小刀、枪和手榴弹。'],
        ['绿衣兵', '三种武器都能用，上+A+B 空翻高跳，落地扎刀。'],
        ['格斗兵', '使用小刀、手榴弹；不能选枪。'],
        ['持刀兵', '空手也能上+B 扔库存小刀，上+A+B 空翻高跳并落地扎刀。'],
        ['唐·詹姆斯', '散弹枪扇形射击。Select 切换枪、手榴弹和空手；持手榴弹 B 投掷，持枪 B 先举枪再向下砸，上+B 为枪托攻击。'],
        ['安吉尔', '只用拳脚。跑步中 B 肩撞，A+B 蓄力起跳并飞身重压。'],
        ['斯尼维尔', '手枪快速两连射，B 先举枪再向下砸。'],
        ['雷克斯', '只用拳脚。跑步中 A 团身冲撞，上+A+B 空翻高跳。'],
      ],
    },
    {
      title: '基本操作',
      items: [
        ['方向键', '移动。'], ['A', '空手踢腿，持枪射击。'], ['B', '空手出拳、持刀挥刀、持枪近身攻击、持手榴弹投掷。'],
        ['A+B', '普通低跳；安吉尔为蓄力跳跃攻击。'], ['上+A+B', '绿衣兵、持刀兵、雷克斯空翻高跳。'],
        ['下+B', '蹲下；蹲着按左／右翻滚，新按其他按键起身。'], ['Select', '空手→小刀→枪→手榴弹循环换装；跳过不能用或已经耗尽的武器。'],
        ['Start', '暂停／继续；有提示的剧情画面可跳过。'],
      ],
    },
    {
      title: '进阶招式',
      items: [
        ['跑步', '快速连按两次同一方向，再按一次相同方向停跑。跑步中 A 前冲踢，B 前冲攻击，下+A 滑铲，A+B 助跑跳；人物专属招式优先。'],
        ['翻滚攻击', '翻滚中 A 旋风腿、B 攻击、A+B 起跳。持刀按 B，会滚完再向前刺；从翻滚中使出的攻击是同类普通攻击的两倍伤害。'],
        ['空中', '普通跳跃中 B 飞踢，持刀为旋风刀；A 踢腿，接近最高点按 A 旋风腿。再按 A+B 二段跳。空翻高跳不接受这些普通跳跃的追加招式。'],
        ['连击', '后→前+B 五连拳，持刀时为五连砍；“前”是人物面朝的方向。'],
        ['抓摔', '普通敌兵血量够低并闪光，或仍活着但已倒地时，向前走近可抓住。B 或前+B 向前扔，后+B 向后扔。抓住后敌人会在 1–5 秒内挣脱；已经开始的投掷会完成。'],
        ['首领近身技', '贴近敌方首领按前+B 扣血，首领不会像普通敌兵那样被扔出去。'],
        ['倒地起身', '落地且仍活着时，新按 A 或 B 前冲攻击。'],
        ['暂停跳关', '暂停后上+A 前一关，第一关无效；下+A 下一关，最多到结局。每次需重新按 A。'],
      ],
    },
    {
      title: '武器与库存',
      items: [
        ['开局库存', '可持械人物开局有五把小刀、一把枪、三颗手榴弹库存，只能使用自己支持的武器。开局均为空手，唐·詹姆斯和斯尼维尔也要按 Select 拿出枪。'],
        ['库存规则', '库存过关、死亡后保留，最多 99。枪另有子弹数量，有备用枪时打空后换下一把；最后一把打空仍能近身攻击。来回切换不会补子弹。'],
        ['使用方式', '持刀上+B 扔刀，持手榴弹 B 投掷，每次消耗一件库存。唐·詹姆斯用 Select 切换到手榴弹，再按 B 投掷；安吉尔、雷克斯始终空手。'],
      ],
    },
  ],
  credit: '白河愁',
} as const

type FcRankings = {
  cartridges: { rank: number; cartridgeId: string; count: number }[]
  collectors: { rank: number; displayName: string; playerNumber: number | null; count: number }[]
}

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
    number: '1054号',
    title: '空手道 街霸版',
    cover: '/fc-player/assets/cartridges/karateka-street-fighter.min.webp',
    genre: '格斗',
    releaseDate: '1985-12-05',
    publisher: 'Soft Pro',
    initial: 'K',
    edition: '改版',
  },
  {
    id: 'baoxiao-sanguo',
    number: '1055号',
    title: '爆笑三国',
    cover: '/fc-player/assets/cartridges/baoxiao-sanguo.min.webp',
    genre: '角色扮演',
    releaseDate: '1996-01-01',
    publisher: '外星科技',
    initial: 'B',
    edition: '改版',
  },
  {
    id: 'prison-break-nine-characters',
    number: '1056号',
    title: '脱狱 9人版',
    cover: '/fc-player/assets/cartridges/prison-break-nine-characters.min.webp',
    genre: '动作',
    releaseDate: '1989-06-30',
    publisher: 'SNK',
    initial: 'T',
    edition: '改版',
  },
] as const

const FC_CARTRIDGE_UPDATED_AT: Record<string, string> = {
  'donkey-kong': '2026-10-05T18:17:37+08:00',
  'donkey-kong-jr': '2026-10-05T18:17:36+08:00',
  'popeye': '2026-10-05T18:17:43+08:00',
  'gomoku-narabe': '2026-10-05T18:17:40+08:00',
  'mahjong': '2026-10-05T19:53:18+08:00',
  'mario-bros': '2026-10-05T18:17:40+08:00',
  'popeye-english': '2026-10-05T18:17:40+08:00',
  baseball: '2026-10-05T18:17:36+08:00',
  'donkey-kong-jr-math': '2026-10-05T18:17:36+08:00',
  'urban-champion': '2026-10-05T18:17:43+08:00',
  'happy-cat': '2026-10-05T18:17:43+08:00',
  'karateka-street-fighter': '2026-10-05T18:17:44+08:00',
  'baoxiao-sanguo': '2026-10-07T11:24:38+08:00',
  'prison-break-nine-characters': '2026-10-11T12:14:55+08:00',
}

export function FcCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [pendingPurchase, setPendingPurchase] = useState<string | null>(null)
  const [sortField, setSortField] = useState<'name' | 'random' | 'updatedAt' | 'releaseDate'>('updatedAt')
  const [reverse, setReverse] = useState(false)
  const [searchField, setSearchField] = useState<'genre' | 'publisher' | null>(null)
  const [query, setQuery] = useState('')
  const [draftQuery, setDraftQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [letterOpen, setLetterOpen] = useState(false)
  const [selectedInitial, setSelectedInitial] = useState('')
  const [modifiedOnly, setModifiedOnly] = useState(false)
  const [rankings, setRankings] = useState<FcRankings>({ cartridges: [], collectors: [] })
  const [rankingsOpen, setRankingsOpen] = useState(false)
  const [previewing, setPreviewing] = useState<string | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const searchRef = useRef<HTMLFormElement>(null)

  function applyRankings(result: { rankings?: Partial<FcRankings> }) {
    setRankings({
      cartridges: Array.isArray(result.rankings?.cartridges) ? result.rankings.cartridges.slice(0, 5) : [],
      collectors: Array.isArray(result.rankings?.collectors) ? result.rankings.collectors.slice(0, 5) : [],
    })
  }

  async function refreshRankings() {
    try {
      const response = await fetch('/api/fc-cartridges', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) return
      applyRankings(await response.json() as { rankings?: Partial<FcRankings> })
    } catch {}
  }

  useEffect(() => {
    if (isLocalDevelopment()) {
      setOwned(FC_CARTRIDGES.map(cartridge => cartridge.id))
      void refreshRankings()
      return
    }
    if (!member) {
      try {
        const stored = JSON.parse(window.localStorage.getItem(OWNED_CARTRIDGES_KEY) || '[]')
        setOwned(Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string').slice(0, 2) : [])
      } catch { setOwned([]) }
      void refreshRankings()
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
        const result = await response.json() as { owned?: string[]; rankings?: Partial<FcRankings> }
        const next = Array.isArray(result.owned) ? result.owned : []
        if (cancelled) return
        setOwned(next)
        applyRankings(result)
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
    else if (sortField === 'updatedAt') result.sort((a, b) => Date.parse(FC_CARTRIDGE_UPDATED_AT[b.id]) - Date.parse(FC_CARTRIDGE_UPDATED_AT[a.id]))
    else result.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate) || a.number.localeCompare(b.number))
    return reverse ? result.reverse() : result
  }, [lang, modifiedOnly, query, reverse, searchField, selectedInitial, sortField])

  const filters = [
    ['name', copy.gameName], ['random', copy.random], ['updatedAt', copy.updatedAt], ['genre', copy.genre], ['publisher', copy.publisher],
    ['releaseDate', copy.releaseDate], ['modified', copy.modified],
  ] as const

  function handleCartridge(cartridgeId: string) {
    if (isLocalDevelopment()) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    if (owned.includes(cartridgeId)) {
      window.location.assign(`/fc?cartridge=${encodeURIComponent(cartridgeId)}`)
      return
    }
    if (!member) {
      setNotice(lang === 'en' ? 'Sign in to collect cartridges with member coins.' : '请先登录玩家账号，收藏只可使用会员金币')
      window.setTimeout(() => setNotice(''), 2800)
      return
    }
    setPendingPurchase(cartridgeId)
  }

  function openCartridge(cartridgeId: string) {
    if (window.matchMedia('(min-width: 1024px)').matches) setPreviewing(cartridgeId)
    else handleCartridge(cartridgeId)
  }

  function playOrCollect(cartridgeId: string) {
    if (owned.includes(cartridgeId) && window.matchMedia('(min-width: 1024px)').matches) setPlaying(cartridgeId)
    else handleCartridge(cartridgeId)
  }

  async function confirmPurchase() {
    const cartridgeId = pendingPurchase
    if (!cartridgeId) return
    setPendingPurchase(null)
    if (!member) {
      setNotice(lang === 'en' ? 'Sign in to use member coins.' : '请先登录玩家账号')
      return
    }
    if (readMemberCoinBalance() < CARTRIDGE_PRICE || !spendMemberCoinBalance(CARTRIDGE_PRICE)) {
      setNotice(copy.insufficient)
      return
    }
    const previous = owned
    try {
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
      void refreshRankings()
    } catch {
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
                <button className="font-semibold text-base-content underline underline-offset-2" type="button" onClick={() => setRankingsOpen(true)}>{copy.rankings}</button>
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
                <button aria-label={`${owned.includes(cartridge.id) ? copy.open : copy.buy}${cartridge.title}`} className="block w-full" onClick={() => openCartridge(cartridge.id)} type="button">
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
                      onClick={() => playOrCollect(cartridge.id)}
                      type="button"
                    >
                      {owned.includes(cartridge.id)
                        ? <i className="ri-play-fill" />
                        : <img alt="" className="h-4 w-4 object-contain sm:h-[18px] sm:w-[18px]" src="/images/coin-rewards/pixel-reward-coin.webp" />}
                    </button>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-x-1 bottom-1 z-30 hidden rounded-lg bg-black/90 px-3 py-2 text-left text-xs leading-relaxed text-white shadow-xl group-hover:block">
                  <strong className="block text-sm font-semibold">{cartridge.title}</strong>
                  <span className="block">{cartridge.number} · {cartridge.genre} · {cartridge.edition}</span>
                  <span className="block">{cartridge.releaseDate} · {cartridge.publisher}</span>
                </div>
              </article>
            ))}
          </div>
          {previewing ? (() => {
            const cartridge = FC_CARTRIDGES.find(item => item.id === previewing)
            return cartridge ? <CartridgeControlsDialog actionLabel={owned.includes(cartridge.id) ? copy.play : copy.buyLabel} cover={cartridge.cover} details={`${cartridge.number} · ${cartridge.genre} · ${cartridge.releaseDate} · ${cartridge.publisher}`} guide={cartridge.id === 'prison-break-nine-characters' ? PRISON_BREAK_GUIDE : undefined} onAction={() => { setPreviewing(null); if (owned.includes(cartridge.id)) setPlaying(cartridge.id); else handleCartridge(cartridge.id) }} onClose={() => setPreviewing(null)} title={cartridge.title} /> : null
          })() : null}
          {playing ? <CartridgePlayerDialog onClose={() => setPlaying(null)} src={`/fc-player/index.html?cartridge=${encodeURIComponent(playing)}`} title={FC_CARTRIDGES.find(item => item.id === playing)?.title ?? 'FC游戏机'} /> : null}
          {rankingsOpen ? <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/35 px-4" role="dialog" aria-modal="true" aria-labelledby="fc-rankings-title" onClick={() => setRankingsOpen(false)}>
            <section className="w-full max-w-2xl rounded-2xl bg-[#f0f0ed] p-4 text-base-content shadow-2xl sm:p-6" onClick={event => event.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold" id="fc-rankings-title">{copy.rankings}</h2><button aria-label={copy.cancel} className="btn btn-ghost btn-sm btn-circle text-xl" type="button" onClick={() => setRankingsOpen(false)}>×</button></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.popularRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.cartridges.length ? rankings.cartridges.map(item => { const cartridge = FC_CARTRIDGES.find(entry => entry.id === item.cartridgeId); return cartridge ? <li className="flex items-center gap-2" key={item.cartridgeId}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{cartridge.number} · {cartridge.title}</span><span className="shrink-0 text-base-content/55">{copy.peopleCount(item.count)}</span></li> : null }) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div>
                <div className="rounded-xl bg-white p-3 shadow-sm"><h3 className="mb-2 text-sm font-semibold">{copy.collectorRanking}</h3><ol className="space-y-1.5 text-xs sm:text-sm">{rankings.collectors.length ? rankings.collectors.map(item => <li className="flex items-center gap-2" key={`${item.playerNumber ?? 'player'}-${item.rank}`}><b className="w-5 text-center text-amber-600">{item.rank}</b><span className="min-w-0 flex-1 truncate">{item.displayName}{item.playerNumber ? <small className="ml-1 text-base-content/40">ID:{String(item.playerNumber).padStart(5, '0')}</small> : null}</span><span className="shrink-0 text-base-content/55">{copy.cartridgeCount(item.count)}</span></li>) : <li className="text-base-content/45">{copy.noRankings}</li>}</ol></div>
              </div>
            </section>
          </div> : null}
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
  if (lang === 'en') return { title: 'FC Cartridge Collection', chinese: 'Chinese', gameName: 'Game name', random: 'Random', genre: 'Game genre', publisher: 'Publisher', releaseDate: 'Release date', updatedAt: 'Last updated', modified: 'Modified', allLetters: 'All', rankings: 'FC rankings', popularRanking: 'Most collected cartridges', collectorRanking: 'Top collectors', noRankings: 'No ranking data yet', peopleCount: (count: number) => `${count} players`, cartridgeCount: (count: number) => `${count} cartridges`, search: 'Search', searchPlaceholder: 'Game name or keyword', confirm: 'Confirm', confirmTitle: 'Collect cartridge?', confirmMessage: (title: string, price: number) => `Spend ${price} coins to collect ${title}?`, cancel: 'Cancel', confirmCollect: 'Collect', open: 'Play ', buy: 'Collect ', buyLabel: 'Collect', play: 'Collected · Play', loginRequired: 'Sign in before collecting cartridges', insufficient: 'Not enough coins. 50 coins required.', purchased: 'Cartridge added to FC Collection', failed: 'Collection could not be saved', count: (count: number) => `${count} cartridges available`, collectionHint: 'collected cartridges can be switched and played directly in the mobile FC Collection', ownedCount: (count: number) => `${count} collected` }
  if (lang === 'zh-TW') return { title: 'FC卡帶收藏', chinese: '中文', gameName: '遊戲名稱', random: '隨機', genre: '遊戲類型', publisher: '遊戲廠商', releaseDate: '發行日期', updatedAt: '更新時間', modified: '改版', allLetters: '全部', rankings: 'FC排行榜', popularRanking: '最多人收藏的卡帶', collectorRanking: '收藏卡帶最多的玩家', noRankings: '暫無排行資料', peopleCount: (count: number) => `${count}人收藏`, cartridgeCount: (count: number) => `${count}款`, search: '搜尋', searchPlaceholder: '遊戲名稱或關鍵詞', confirm: '確認', confirmTitle: '確認收藏卡帶？', confirmMessage: (title: string, price: number) => `將花費 ${price} 個金幣收藏《${title}》，是否繼續？`, cancel: '取消', confirmCollect: '確認收藏', open: '遊玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 遊玩', loginRequired: '請先登入玩家帳號再收藏卡帶', insufficient: '金幣不足，需要50個金幣', purchased: '收藏成功，卡帶已加入FC遊戲機', failed: '卡帶收藏記錄保存失敗', count: (count: number) => `目前共有 ${count} 款卡帶`, collectionHint: '收藏後可直接在手機FC遊戲機換卡帶遊玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
  if (lang === 'ja') return { title: 'FCカセットコレクション', chinese: '中国語', gameName: 'ゲーム名', random: 'ランダム', genre: 'ジャンル', publisher: 'メーカー', releaseDate: '発売日', updatedAt: '更新日時', modified: '改造版', allLetters: 'すべて', rankings: 'FCランキング', popularRanking: '人気カセット', collectorRanking: 'トップコレクター', noRankings: 'ランキングデータはまだありません', peopleCount: (count: number) => `${count}人`, cartridgeCount: (count: number) => `${count}本`, search: '検索', searchPlaceholder: 'ゲーム名またはキーワード', confirm: '確認', confirmTitle: 'カセットをコレクションしますか？', confirmMessage: (title: string, price: number) => `${price}コインで「${title}」をコレクションしますか？`, cancel: 'キャンセル', confirmCollect: 'コレクション', open: 'プレイ：', buy: 'コレクション：', buyLabel: 'コレクション', play: '収集済み・プレイ', loginRequired: 'カセットのコレクションにはログインが必要です', insufficient: 'コインが不足しています（50枚必要）', purchased: 'FCコレクションに追加しました', failed: 'コレクション情報を保存できませんでした', count: (count: number) => `${count}本のカセット`, collectionHint: 'コレクション後はスマホのFCコレクションで交換して遊べます', ownedCount: (count: number) => `${count}本収集済み` }
  return { title: 'FC卡带收藏', chinese: '中文', gameName: '游戏名称', random: '随机', genre: '游戏类型', publisher: '游戏厂商', releaseDate: '发行日期', updatedAt: '更新时间', modified: '改版', allLetters: '全部', rankings: 'FC排行榜', popularRanking: '最多人收藏的卡带', collectorRanking: '收藏卡带最多的玩家', noRankings: '暂无排行数据', peopleCount: (count: number) => `${count}人收藏`, cartridgeCount: (count: number) => `${count}款`, search: '搜索', searchPlaceholder: '游戏名称或关键词', confirm: '确认', confirmTitle: '确认收藏卡带？', confirmMessage: (title: string, price: number) => `将花费 ${price} 个金币收藏《${title}》，是否继续？`, cancel: '取消', confirmCollect: '确认收藏', open: '游玩', buy: '收藏', buyLabel: '收藏', play: '已收藏 · 游玩', loginRequired: '请先登录玩家账号再收藏卡带', insufficient: '金币不足，需要50个金币', purchased: '收藏成功，卡带已加入FC游戏机', failed: '卡带收藏记录保存失败', count: (count: number) => `目前共有 ${count} 款卡带`, collectionHint: '收藏可直接在手机FC游戏机换卡带游玩', ownedCount: (count: number) => `已收藏 ${count} 款` }
}

