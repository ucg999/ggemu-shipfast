import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { SiteLayout } from '#/components/site-layout'
import { normalizeLocale } from '#/lib/i18n'
import { FishingWater } from '#/components/fishing-water'
import './lakeside-fishing.css'

type Fish = { name: string; icon: string; image?: string; rarity: string; weight: number; description: string }
type Catch = { count: number; bestCm: number }
type Collection = Record<string, Catch>
type Phase = 'ready' | 'waiting' | 'bite' | 'result'

const FISH: Fish[] = [
  { name: '溪石鱼', icon: '🐟', rarity: '常见', weight: 24, description: '喜欢躲在清澈的浅水里。' },
  { name: '银鲫', icon: '🐠', rarity: '常见', weight: 21, description: '阳光照在鳞片上会闪闪发亮。' },
  { name: '花纹鲤', icon: '🐡', rarity: '常见', weight: 17, description: '慢悠悠地游过湖心。' },
  { name: '月影鳟', icon: '🐟', rarity: '少见', weight: 13, description: '傍晚时最容易看到它的影子。' },
  { name: '翡翠鲈', icon: '🐠', rarity: '少见', weight: 10, description: '背上的颜色像湖边的青草。' },
  { name: '彩鳍鲯鳅', icon: '🐟', image: '/lakeside-fishing-mahi.webp', rarity: '珍稀', weight: 8, description: '翠绿的背鳍和金黄的尾鳍会在水下闪光。' },
  { name: '彩虹鳗', icon: '🐍', rarity: '珍稀', weight: 7, description: '游动时仿佛拖着一道彩虹。' },
  { name: '星光鱼', icon: '✨', rarity: '珍稀', weight: 5, description: '据说只会出现在安静的湖面。' },
  { name: '湖之王', icon: '🐉', rarity: '传说', weight: 3, description: '湖里最神秘的大鱼。' },
]

const STORAGE_KEY = 'retro-games-lakeside-fishing-collection-v1'

function readCollection(): Collection {
  if (typeof window === 'undefined') return {}
  try {
    const data = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Collection
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

function pickFish(): Fish {
  const total = FISH.reduce((sum, fish) => sum + fish.weight, 0)
  let roll = Math.random() * total
  return FISH.find(fish => (roll -= fish.weight) < 0) ?? FISH[0]
}

export const Route = createFileRoute('/$locale/lakeside-fishing')({
  head: () => ({ meta: [{ title: '湖畔钓鱼｜原创游戏｜怀旧游戏厅' }] }),
  component: LakesideFishingPage,
})

function LakesideFishingPage() {
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const [phase, setPhase] = useState<Phase>('ready')
  const [collection, setCollection] = useState<Collection>({})
  const [lastFish, setLastFish] = useState<Fish | null>(null)
  const [lastSize, setLastSize] = useState(0)
  const [message, setMessage] = useState('湖面很安静。抛竿试试看！')
  const [showBook, setShowBook] = useState(false)
  const [castPoint, setCastPoint] = useState({ x: .49, y: .48 })
  const biteTimer = useRef<number | null>(null)
  const escapeTimer = useRef<number | null>(null)

  useEffect(() => { setCollection(readCollection()) }, [])
  useEffect(() => () => {
    if (biteTimer.current !== null) window.clearTimeout(biteTimer.current)
    if (escapeTimer.current !== null) window.clearTimeout(escapeTimer.current)
  }, [])

  function cast() {
    if (phase !== 'ready' && phase !== 'result') return
    setLastFish(null)
    setPhase('waiting')
    setMessage('鱼漂落入水中……留意水面的动静。')
    biteTimer.current = window.setTimeout(() => {
      setPhase('bite')
      setMessage('鱼咬钩了！快收竿！')
      escapeTimer.current = window.setTimeout(() => {
        setPhase('result')
        setMessage('鱼游走了。再试一次吧！')
      }, 1700)
    }, 1800 + Math.random() * 3000)
  }

  function reelIn() {
    if (phase === 'waiting') {
      if (biteTimer.current !== null) window.clearTimeout(biteTimer.current)
      setPhase('result')
      setMessage('收竿太早了，鱼还没咬钩。')
      return
    }
    if (phase !== 'bite') return
    if (escapeTimer.current !== null) window.clearTimeout(escapeTimer.current)
    const fish = pickFish()
    const size = 12 + Math.floor(Math.random() * (fish.rarity === '传说' ? 89 : 53))
    setLastFish(fish)
    setLastSize(size)
    setPhase('result')
    setMessage(`钓到了${fish.name}，长 ${size} 厘米！`)
    setCollection(current => {
      const previous = current[fish.name]
      const next = { ...current, [fish.name]: { count: (previous?.count ?? 0) + 1, bestCm: Math.max(previous?.bestCm ?? 0, size) } }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const discovered = FISH.filter(fish => collection[fish.name]).length
  return (
    <SiteLayout locale={lang}>
      <main className="fishing-page">
        <div className="fishing-heading">
          <div>
            <Link to="/$locale/original-games" params={{ locale: lang }} className="fishing-back">← 原创游戏</Link>
            <h1>湖畔钓鱼</h1>
            <p>看鱼影在水里游动，选好位置抛竿，等待咬钩并及时收竿。</p>
          </div>
          <button className="fishing-book-button" onClick={() => setShowBook(value => !value)} type="button">📖 鱼类图鉴 {discovered}/{FISH.length}</button>
        </div>
        <div className="fishing-scene" aria-label="湖畔钓鱼场景">
          <FishingWater phase={phase} castPoint={castPoint} onChoosePoint={setCastPoint} />
          <div className="fishing-water-glow" aria-hidden="true" />
          <div className="fishing-bank fishing-bank-top" aria-hidden="true" />
          <div className="fishing-bank fishing-bank-bottom" aria-hidden="true" />
          <div className="fishing-lilypad fishing-lilypad-one" aria-hidden="true" />
          <div className="fishing-lilypad fishing-lilypad-two" aria-hidden="true" />
          <div className="fishing-lilypad fishing-lilypad-three" aria-hidden="true" />
          <svg className="fishing-rod-art" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="fishing-rod-wood" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6e3823"/><stop offset=".42" stopColor="#dca05b"/><stop offset="1" stopColor="#4d2b24"/></linearGradient>
              <linearGradient id="fishing-rod-reel" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9f0e0"/><stop offset="1" stopColor="#758c86"/></linearGradient>
            </defs>
            <path d="M1045 607 Q760 410 605 275" fill="none" stroke="#224650" strokeWidth="16" strokeLinecap="round" opacity=".35"/>
            <path d="M1045 607 Q760 410 605 275" fill="none" stroke="url(#fishing-rod-wood)" strokeWidth="9" strokeLinecap="round"/>
            <path d="M1045 607 Q760 410 605 275" fill="none" stroke="#ffe3ac" strokeWidth="2" strokeLinecap="round" opacity=".75"/>
            <path d="M1034 592 L933 522" fill="none" stroke="#304948" strokeWidth="17" strokeLinecap="round"/>
            <path d="M985 560 L955 542 M1002 572 L972 554" stroke="#d5b46e" strokeWidth="4"/>
            <ellipse cx="927" cy="508" rx="28" ry="21" fill="url(#fishing-rod-reel)" stroke="#415c59" strokeWidth="6" transform="rotate(35 927 508)"/>
            <circle cx="925" cy="508" r="9" fill="#dec895"/>
            <circle cx="845" cy="442" r="6" fill="none" stroke="#e5d5a4" strokeWidth="3"/>
            <circle cx="744" cy="355" r="5" fill="none" stroke="#e5d5a4" strokeWidth="3"/>
            {(phase === 'waiting' || phase === 'bite') && <path d={`M605 275 Q${540 + castPoint.x * 150} ${205 + castPoint.y * 150} ${castPoint.x * 1000} ${castPoint.y * 560}`} fill="none" stroke="#e9f4ec" strokeWidth="1.4" opacity=".9"/>}
          </svg>
          <div className="fishing-scene-caption">点击水面选择落点 · 观察鱼影</div>
          {lastFish && phase === 'result' && (
            <div
              className="fishing-catch-showcase"
              style={{ '--catch-x': `${castPoint.x * 100}%`, '--catch-y': `${castPoint.y * 100}%` } as CSSProperties}
              aria-label={`钓到了${lastFish.name}，长${lastSize}厘米`}
            >
              <div className="fishing-catch-splash" aria-hidden="true"><span /><span /><span /><span /></div>
              <div className="fishing-catch-stage">
                <div className="fishing-catch-swim">
                  {lastFish.image
                    ? <img className="fishing-catch-fish" src={lastFish.image} alt={lastFish.name} />
                    : <span className="fishing-catch-fallback" role="img" aria-label={lastFish.name}>{lastFish.icon}</span>}
                </div>
              </div>
              <div className="fishing-catch-label"><span>新鲜上钩！</span><strong>{lastFish.name}</strong><small>{lastSize} cm · {lastFish.rarity}</small></div>
            </div>
          )}
        </div>
        <div className="fishing-controls">
          <div className="fishing-message" role="status">{lastFish ? <span className="fishing-catch-icon">{lastFish.image ? <img alt="" src={lastFish.image} /> : lastFish.icon}</span> : null}{message}</div>
          <button className={phase === 'bite' ? 'fishing-action fishing-action-bite' : 'fishing-action'} onClick={phase === 'waiting' || phase === 'bite' ? reelIn : cast} type="button">
            {phase === 'waiting' || phase === 'bite' ? '收竿！' : '抛竿钓鱼'}
          </button>
        </div>
        {lastFish && <p className="fishing-result">本次收获：{lastFish.name} · {lastSize} cm · {lastFish.rarity}</p>}
        {showBook && <section className="fishing-collection" aria-label="鱼类图鉴"><h2>鱼类图鉴</h2><div className="fishing-fish-grid">{FISH.map(fish => {
          const catchInfo = collection[fish.name]
          return <article className={catchInfo ? 'fishing-fish-card' : 'fishing-fish-card fishing-fish-unknown'} key={fish.name}>
            <span className="fishing-fish-icon">{catchInfo ? (fish.image ? <img src={fish.image} alt="" /> : fish.icon) : '❔'}</span>
            <strong>{catchInfo ? fish.name : '未发现'}</strong>
            <small>{catchInfo ? `${fish.rarity} · 已钓 ${catchInfo.count} 条 · 最大 ${catchInfo.bestCm} cm` : '等待你来发现'}</small>
            {catchInfo && <p>{fish.description}</p>}
          </article>
        })}</div></section>}
      </main>
    </SiteLayout>
  )
}
