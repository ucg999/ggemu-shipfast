import arenaStyles from '#/components/red-blue-arena.css?url'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoinRewardPopup } from '#/components/home/coin-rewards'
import { SiteLayout } from '#/components/site-layout'
import { addCoinBalance, readCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { ARENA_BET_OPTIONS, ARENA_MAX_HEALTH, applyArenaShield, arenaPayout, arenaWeaponDamage, healArenaHealth } from '#/lib/red-blue-arena'
import type { ArenaResult, ArenaSide } from '#/lib/red-blue-arena'
import type { ArenaAudio } from '#/lib/red-blue-arena-audio'

export const Route = createFileRoute('/$locale/red-blue-arena')({
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === '1' ? ('1' as const) : undefined,
  }),
  head: () => ({ links: [{ rel: 'stylesheet', href: arenaStyles }], meta: [{ title: '红蓝竞技场｜金币竞猜' }] }),
  component: RedBlueArenaPage,
})

type WeaponKind = 'sword' | 'blade' | 'axe' | 'reaper' | 'bow' | 'staff' | 'hammer'
type ElementKind = 'fire' | 'water' | 'electric' | 'poison'
type AmmoKind = ElementKind | 'normal'
type PotionKind = ElementKind | 'normal-ammo' | 'speed-boost' | 'damage-boost'
type ArenaMode = 'duel' | 'three' | 'four' | 'team'
type Fighter = { id: number; side: ArenaSide; team: ArenaSide; x: number; y: number; vx: number; vy: number; radius: number; health: number; angle: number; cooldown: number; weapon: WeaponKind | null; weaponCount: number; weaponTimer: number; rangedFired: boolean; elementAmmo: AmmoKind[]; bowRapidFire: boolean; shield: boolean; armor: boolean; armorBumps: number; speedBoost: number; damageBoost: number; slowTimer: number; stun: number; hammerBouncesRemaining: number; knockoutTimer: number; knockoutBrokeWall: boolean; burnTimer: number; burnDamage: number; burnSpread: boolean; poisonTimer: number; poisonTicks: number }
type Pickup = { id: number; x: number; y: number; kind: WeaponKind | 'shield' | 'armor' | 'pillar'; life: number }
type Food = { id: number; x: number; y: number; life: number }
type Projectile = { id: number; owner: number; ownerTeam: ArenaSide; kind: 'arrow' | 'magic'; element: ElementKind | null; x: number; y: number; vx: number; vy: number; life: number; damage: number; bounced: boolean }
type Potion = { id: number; x: number; y: number; kind: PotionKind; life: number }
type Pillar = { id: number; x: number; y: number; radius: number; hits: number; charged: boolean }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type WallImpact = { angle: number; life: number; strength: number }
type RingBreak = { angle: number; life: number }
type CollisionImpact = { x: number; y: number; life: number; strength: number }
type ReaperSpin = { owner: number; life: number; startAngle: number; kind: 'reaper' | 'hammer' }
type RoundState = { mode: ArenaMode; fighters: Fighter[]; pickups: Pickup[]; foods: Food[]; potions: Potion[]; pillars: Pillar[]; projectiles: Projectile[]; particles: Particle[]; wallImpacts: WallImpact[]; ringBreaks: RingBreak[]; collisionImpacts: CollisionImpact[]; reaperSpins: ReaperSpin[]; time: number; nextPickup: number; nextFood: number; nextPotion: number; running: boolean; deathAnimation: number | null; finalRush: boolean }

const TWO_PI = Math.PI * 2
const ARENA_BASE_SPEED = .44
const ARENA_PRE_RUSH_MAX_SPEED = ARENA_BASE_SPEED * 3
const ARENA_MAX_PARTICLES = 520
const ARENA_MAX_WALL_IMPACTS = 24
const ARENA_MAX_COLLISION_IMPACTS = 18
const WEAPON_IMAGE_SOURCES: Record<WeaponKind, string> = { sword: '/images/red-blue-arena/weapons/sword.png', blade: '/images/red-blue-arena/weapons/knife.png', axe: '/images/red-blue-arena/weapons/axe.png', reaper: '/images/red-blue-arena/weapons/reaper.png', bow: '/images/red-blue-arena/weapons/bow.png', staff: '/images/red-blue-arena/weapons/staff.png', hammer: '/images/red-blue-arena/weapons/hammer.png' }
const weaponImageCache = new Map<WeaponKind, HTMLImageElement>()

const MODE_RULES: Record<ArenaMode, { label: string; minBet: number; maxBet: number; profit: number; seconds: number; itemLimit: number; sides: ArenaSide[] }> = {
  duel: { label: '双球模式', minBet: 1, maxBet: 100, profit: 1, seconds: 60, itemLimit: 2, sides: ['red', 'blue'] },
  three: { label: '三球模式', minBet: 10, maxBet: 200, profit: 2, seconds: 120, itemLimit: 3, sides: ['red', 'blue', 'yellow'] },
  four: { label: '四球模式', minBet: 10, maxBet: 500, profit: 3, seconds: 180, itemLimit: 3, sides: ['red', 'blue', 'yellow', 'green'] },
  team: { label: '2V2 红蓝', minBet: 10, maxBet: 1000, profit: 1, seconds: 120, itemLimit: 3, sides: ['red', 'blue'] },
}
const SIDE_COPY: Record<ArenaSide, { name: string; color: string; emoji: string }> = {
  red: { name: '小红', color: '#ef233c', emoji: '🔴' }, blue: { name: '小蓝', color: '#3987ff', emoji: '🔵' },
  yellow: { name: '小黄', color: '#f5d328', emoji: '🟡' }, green: { name: '小绿', color: '#35c96f', emoji: '🟢' },
}
const ELEMENT_COLORS: Record<ElementKind, string> = { fire: '#ff354d', water: '#38bdf8', electric: '#ffe13b', poison: '#a855f7' }
const AMMO_COLORS: Record<AmmoKind, string> = { ...ELEMENT_COLORS, normal: '#ffffff' }
const POTION_COLORS: Record<PotionKind, string> = { ...ELEMENT_COLORS, 'normal-ammo': '#ffffff', 'speed-boost': '#ffc400', 'damage-boost': '#e51032' }
const WEAPON_HELP = [
  ['🗡️', '小刀：1伤害，持有时速度×2'], ['⚔️', '剑：2伤害，可组成双剑'],
  ['🪓', '斧头：3伤害'], ['☠️', '死神刀：4伤害，持有时速度减半'],
  ['🔨', '晕锤：2伤害，旋转群攻并击飞周围球；10%概率打出圈外秒杀'],
  ['🏹', '弓：快速射箭；累计5发后停在原地完成连射'], ['🔮', '法杖：逐颗缓慢施放魔法球，武器会保留'],
  ['🛡️', '盾（防具）：抵挡一次近战伤害；无限反弹普通远程弹'],
  ['🪞', '反伤甲：近战反伤一次即碎；同伤对拼也碎；普通碰撞3次后消失'],
] as const
const ITEM_HELP = [
  ['🍊', '果实：回复1格，并解除灼伤和中毒'], ['🔴', '红瓶：可预先累计一发火属性弹'],
  ['🔵', '蓝瓶：可预先累计一发水属性弹'], ['🟡', '黄瓶：可预先累计一发电属性弹'],
  ['🟣', '紫瓶：可预先累计一发毒属性弹'], ['💥', '属性弹：基础1伤害；命中反伤甲翻倍，防具会碎掉'],
  ['⚪', '白瓶：普通箭或普通魔法球弹药＋3，可提前累计'],
  ['⚔️', '红色强化瓶：伤害×2，持续3秒'], ['💨', '黄色强化瓶：速度×2，持续3秒'],
  ['⚡', '闪电墙：首次触碰掉1血、停顿并减速'],
] as const

function makeFighter(id: number, side: ArenaSide, x: number, y: number, vx: number, vy: number): Fighter {
  return { id, side, team: side, x, y, vx, vy, radius: .047, health: ARENA_MAX_HEALTH, angle: Math.atan2(vy, vx), cooldown: 0, weapon: null, weaponCount: 0, weaponTimer: 0, rangedFired: false, elementAmmo: [], bowRapidFire: false, shield: false, armor: false, armorBumps: 0, speedBoost: 0, damageBoost: 0, slowTimer: 0, stun: 0, hammerBouncesRemaining: 0, knockoutTimer: 0, knockoutBrokeWall: false, burnTimer: 0, burnDamage: 0, burnSpread: false, poisonTimer: 0, poisonTicks: 0 }
}

function createRound(mode: ArenaMode = 'duel'): RoundState {
  const fighters = mode === 'team'
    ? [makeFighter(0, 'red', .3, .42, .36, -.27), makeFighter(1, 'blue', .7, .36, -.34, .3), makeFighter(2, 'red', .34, .68, .31, .3), makeFighter(3, 'blue', .66, .64, -.32, -.29)]
    : MODE_RULES[mode].sides.map((side, index, sides) => { const angle = index / sides.length * TWO_PI + .35; return makeFighter(index, side, .5 + Math.cos(angle) * .2, .5 + Math.sin(angle) * .2, -Math.sin(angle) * .4, Math.cos(angle) * .4) })
  for (const fighter of fighters) {
    const dx = .5 - fighter.x; const dy = .5 - fighter.y; const distance = Math.hypot(dx, dy) || 1
    fighter.vx = dx / distance * ARENA_BASE_SPEED; fighter.vy = dy / distance * ARENA_BASE_SPEED; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
  }
  return {
    mode, fighters,
    pickups: [], foods: [], potions: [], pillars: [], projectiles: [], particles: [], wallImpacts: [], ringBreaks: [], collisionImpacts: [], reaperSpins: [], time: MODE_RULES[mode].seconds, nextPickup: .8 + Math.random() * 1.5, nextFood: 9 + Math.random() * 7, nextPotion: 3 + Math.random() * 5, running: true, deathAnimation: null, finalRush: false,
  }
}

function RedBlueArenaPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const { embed } = Route.useSearch()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const roundRef = useRef<RoundState | null>(null)
  const audioRef = useRef<ArenaAudio | null>(null)
  const settledRef = useRef(false)
  const [mode, setMode] = useState<ArenaMode>('duel')
  const [betSide, setBetSide] = useState<ArenaSide>('red')
  const [stake, setStake] = useState(0)
  const [balance, setBalance] = useState(0)
  const [health, setHealth] = useState<number[]>([ARENA_MAX_HEALTH, ARENA_MAX_HEALTH])
  const [time, setTime] = useState(MODE_RULES.duel.seconds)
  const [phase, setPhase] = useState<'betting' | 'running' | 'result'>('betting')
  const [result, setResult] = useState<ArenaResult | null>(null)
  const [message, setMessage] = useState('选择阵营和投注额，见证自动对战！')
  const [feedback, setFeedback] = useState<{ amount: number; id: number; prefix: '+' | '×' } | null>(null)

  useEffect(() => setBalance(readCoinBalance()), [])

  useEffect(() => {
    let cancelled = false
    void import('#/lib/red-blue-arena-audio').then(({ createArenaAudio }) => {
      const audio = createArenaAudio()
      if (cancelled) audio.dispose(); else audioRef.current = audio
    }).catch(() => {})
    return () => { cancelled = true; audioRef.current?.dispose(); audioRef.current = null }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || phase === 'running') return
    resizeCanvas(canvas)
    drawRound(canvas, context, roundRef.current ?? createRound(mode))
  }, [mode, phase])

  const settle = useCallback((finalResult: ArenaResult) => {
    if (settledRef.current) return
    settledRef.current = true
    if (roundRef.current) roundRef.current.running = false
    const payout = arenaPayout(betSide, finalResult, stake, MODE_RULES[mode].profit)
    const nextBalance = payout > 0 ? addCoinBalance(payout) : readCoinBalance()
    setBalance(nextBalance)
    setResult(finalResult)
    setPhase('result')
    if (finalResult === 'draw') setMessage(`平局，退回 ${stake} 金币`)
    else if (finalResult === betSide) setMessage(`竞猜成功！赢得 ${payout - stake} 金币`)
    else setMessage(`竞猜失败，${SIDE_COPY[finalResult].name}获胜`)
    if (payout > 0) setFeedback({ amount: payout, id: Date.now(), prefix: '+' })
  }, [betSide, mode, stake])

  useEffect(() => {
    if (phase !== 'running') return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0
    let last = performance.now()
    let uiClock = 0

    const loop = (now: number) => {
      const round = roundRef.current
      if (!round?.running) return
      const dt = Math.min(.025, (now - last) / 1000)
      last = now
      updateRound(round, dt, audioRef.current)
      const aliveTeams = new Set(round.fighters.filter(fighter => fighter.health > 0).map(fighter => fighter.team))
      if (round.deathAnimation === null && round.time > 0 && aliveTeams.size <= 1) startDeathAnimation(round, audioRef.current)
      drawRound(canvas, context, round)
      uiClock += dt
      if (uiClock > .12) {
        uiClock = 0
        setHealth(round.fighters.map(fighter => Math.max(0, fighter.health)))
        setTime(Math.max(0, Math.ceil(round.time)))
      }
      if ((round.deathAnimation !== null && round.deathAnimation <= 0) || (round.deathAnimation === null && round.time <= 0)) {
        setHealth(round.fighters.map(fighter => Math.max(0, fighter.health)))
        settle(getRoundResult(round))
        drawRound(canvas, context, round)
        return
      }
      frame = requestAnimationFrame(loop)
    }
    const handleResize = () => resizeCanvas(canvas)
    resizeCanvas(canvas)
    window.addEventListener('resize', handleResize, { passive: true })
    frame = requestAnimationFrame(loop)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', handleResize) }
  }, [phase, settle])

  function startRound() {
    if (stake < MODE_RULES[mode].minBet) {
      setMessage(`本模式最低投注 ${MODE_RULES[mode].minBet} 金币。`)
      return
    }
    if (!spendCoinBalance(stake)) {
      setMessage('金币不足，请先在站内获取金币。')
      return
    }
    settledRef.current = false
    void audioRef.current?.start().then(() => audioRef.current?.play('start')).catch(() => {})
    roundRef.current = createRound(mode)
    setBalance(readCoinBalance())
    setHealth(MODE_RULES[mode].sides.length === 2 && mode === 'team' ? [10, 10, 10, 10] : MODE_RULES[mode].sides.map(() => 10))
    setTime(MODE_RULES[mode].seconds)
    setResult(null)
    setFeedback(null)
    setMessage(`已投注 ${stake} 金币，支持${SIDE_COPY[betSide].name}！`)
    setPhase('running')
  }

  function resetBetting() {
    roundRef.current = null
    settledRef.current = false
    setPhase('betting')
    setResult(null)
    setHealth(MODE_RULES[mode].sides.length === 2 && mode === 'team' ? [10, 10, 10, 10] : MODE_RULES[mode].sides.map(() => 10))
    setTime(MODE_RULES[mode].seconds)
    setMessage('选择阵营和投注额，开始下一局。')
  }

  const rules = MODE_RULES[mode]
  const displayedSides = rules.sides
  const previewFighters = createRound(mode).fighters
  const healthEntries = previewFighters.map((fighter, index) => ({
    color: SIDE_COPY[fighter.side].color,
    label: mode === 'team' ? `${SIDE_COPY[fighter.side].name}${previewFighters.slice(0, index + 1).filter(item => item.side === fighter.side).length}` : SIDE_COPY[fighter.side].name,
    side: fighter.side,
    value: health[index] ?? ARENA_MAX_HEALTH,
  }))
  const content = <main className={`arena-page arena-page-${phase}${embed === '1' ? ' arena-page-embed' : ''}`}><section className="arena-shell">
    <div className="arena-header mb-2 flex items-center justify-between gap-3"><div>{embed !== '1' ? <Link to="/$locale/original-games" params={{ locale: lang }} className="arena-back text-xs text-white/55">← 原创游戏（内测版）</Link> : null}<h1 className="arena-title text-xl font-black sm:text-3xl">红蓝竞技场</h1></div><div className="arena-balance rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-sm font-black text-yellow-300">🪙 {balance}</div></div>
    <div className="arena-score gap-x-2 gap-y-1" style={{ gridTemplateColumns: `repeat(${mode === 'three' ? 3 : healthEntries.length <= 2 ? healthEntries.length : 2}, minmax(0, 1fr))` }}>{healthEntries.map((entry, index) => { const hearts = Math.max(ARENA_MAX_HEALTH, entry.value); return <div className="arena-team min-w-0 flex-nowrap" key={`${entry.side}-${index}`} style={{ justifyContent: 'flex-start' }} title={`${entry.label} ${entry.value}点血`}><i className={`arena-orb arena-orb-${entry.side} shrink-0 ${mode === 'three' ? '!h-3 !w-3' : '!h-4 !w-4'}`} style={{ background: entry.color }} /><span className={`flex min-w-0 flex-nowrap leading-none ${mode === 'three' ? 'text-[9px] sm:text-[12px]' : 'text-[11px] sm:text-[14px]'}`} style={{ color: entry.color }}>{Array.from({ length: hearts }, (_, heart) => <i className="not-italic drop-shadow-[0_0_3px_currentColor]" key={heart}>{heart < entry.value ? '♥' : '♡'}</i>)}</span></div> })}</div>
    <div className="whitespace-nowrap text-center font-mono text-xs font-black uppercase tracking-tight sm:text-base">{displayedSides.map((side, index) => <span key={side}><span style={{ color: SIDE_COPY[side].color }}>{SIDE_COPY[side].name}</span>{index < displayedSides.length - 1 ? <span className="mx-1 text-white/55">VS</span> : null}</span>)}</div>
    <div className="arena-canvas-wrap"><canvas ref={canvasRef} className="arena-canvas" aria-label="多球自动战斗的圆形竞技场" />{phase !== 'running' && <div className="arena-overlay"><div className="arena-overlay-card"><div className="arena-result-mark mb-2 text-4xl">{result === 'draw' ? '🤝' : result ? SIDE_COPY[result].emoji : '⚔️'}</div><strong className="text-xl">{result ? result === 'draw' ? '平局' : `${SIDE_COPY[result].name}胜利` : '等待开战'}</strong><p className="mt-2 text-sm text-white/65">{message}</p></div></div>}</div>
    {phase === 'running' ? <aside className="mt-2 grid grid-cols-2 gap-2 text-white/70"><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-yellow-300">⚔️ 武器与防具</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{WEAPON_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div></details><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-cyan-300">🎁 道具说明</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{ITEM_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div></details></aside> : null}
    {phase === 'betting' ? <><label className="mb-2 flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white"><span className="shrink-0 text-white/60">模式</span><select className="min-w-0 flex-1 bg-transparent text-right font-black text-yellow-300 outline-none" value={mode} onChange={event => { const value = event.currentTarget.value as ArenaMode; setMode(value); setBetSide(MODE_RULES[value].sides[0]); setStake(0); setHealth(createRound(value).fighters.map(() => 10)); setTime(MODE_RULES[value].seconds) }}>{(Object.keys(MODE_RULES) as ArenaMode[]).map(value => <option className="bg-black text-white" key={value} value={value}>{MODE_RULES[value].label} · {MODE_RULES[value].seconds}秒 · 最低{MODE_RULES[value].minBet} · 上限{MODE_RULES[value].maxBet} · 赔{MODE_RULES[value].profit}</option>)}</select></label><div className="arena-bet-panel arena-bet-layout"><div className="arena-bet-controls"><div className="arena-choice" style={{ gridTemplateColumns: `repeat(${displayedSides.length}, minmax(0, 1fr))` }}>{displayedSides.map(side => <button className="!px-1 text-[10px] sm:text-xs" key={side} style={{ backgroundColor: `${SIDE_COPY[side].color}cc` }} data-active={betSide === side} onClick={() => setBetSide(side)}>{SIDE_COPY[side].emoji} 投{SIDE_COPY[side].name}</button>)}</div><div className="arena-stakes">{ARENA_BET_OPTIONS.filter(value => value >= rules.minBet).map(value => <button key={value} data-active="false" disabled={stake + value > balance || stake + value > rules.maxBet} onClick={() => setStake(current => Math.min(rules.maxBet, current + value))}>+ 🪙 {value}</button>)}</div><div className="arena-bet-total flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-sm"><strong className="text-yellow-300">累计投注：🪙 {stake} / {rules.maxBet}</strong><button className="text-white/60 underline" disabled={stake === 0} onClick={() => setStake(0)}>清空投注</button></div></div><button aria-label={stake < rules.minBet ? `最低投注 ${rules.minBet} 金币` : balance < stake ? '金币不足' : `投注 ${stake} 金币并开战`} className="arena-start arena-start-square" disabled={stake < rules.minBet || balance < stake} onClick={startRound}>开战</button></div></> : phase === 'result' ? <div className="arena-bet-panel"><button className="arena-start" onClick={resetBetting}>再来一局</button></div> : null}
    <CoinRewardPopup feedback={feedback} />
  </section></main>

  return embed === '1' ? content : <SiteLayout locale={lang} hideFooter>{content}</SiteLayout>
}

function getRoundResult(round: RoundState): ArenaResult {
  const totals = new Map<ArenaSide, number>()
  for (const fighter of round.fighters) totals.set(fighter.team, (totals.get(fighter.team) ?? 0) + Math.max(0, fighter.health))
  const ranked = [...totals.entries()].sort((left, right) => right[1] - left[1])
  if (!ranked.length || (ranked[1] && ranked[0][1] === ranked[1][1])) return 'draw'
  return ranked[0][0]
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const size = canvas.clientWidth < 420 ? 320 : 400
  if (canvas.width !== size) { canvas.width = size; canvas.height = size }
}

function equipWeapon(fighter: Fighter, weapon: WeaponKind) {
  if (fighter.weapon === weapon && (weapon === 'sword' || weapon === 'blade')) {
    fighter.weaponCount = 2
    return
  }
  removeWeaponSpeedEffect(fighter)
  fighter.weapon = weapon
  fighter.weaponCount = 1
  fighter.rangedFired = false
  fighter.bowRapidFire = weapon === 'bow' && fighter.elementAmmo.length >= 5
  applyWeaponSpeedEffect(fighter)
  fighter.weaponTimer = weapon === 'bow' ? .35 : weapon === 'staff' ? .85 : 0
}

function consumeWeapon(fighter: Fighter) {
  removeWeaponSpeedEffect(fighter)
  fighter.weapon = null
  fighter.weaponCount = 0
  fighter.weaponTimer = 0
  fighter.rangedFired = false
}

function applyWeaponSpeedEffect(fighter: Fighter) {
  if (fighter.weapon === 'blade') { fighter.vx *= 2; fighter.vy *= 2 }
  if (fighter.weapon === 'reaper' || fighter.weapon === 'hammer') { fighter.vx *= .5; fighter.vy *= .5 }
}

function removeWeaponSpeedEffect(fighter: Fighter) {
  if (fighter.weapon === 'blade') { fighter.vx *= .5; fighter.vy *= .5 }
  if (fighter.weapon === 'reaper' || fighter.weapon === 'hammer') { fighter.vx *= 2; fighter.vy *= 2 }
}

function updateRound(round: RoundState, dt: number, audio?: ArenaAudio | null) {
  if (round.deathAnimation !== null) {
    round.deathAnimation = Math.max(0, round.deathAnimation - dt)
    updateArenaParticles(round, dt)
    return
  }
  round.time -= dt
  if (!round.finalRush && round.time <= 10) {
    round.finalRush = true
    for (const fighter of round.fighters) { fighter.vx *= 2; fighter.vy *= 2 }
  }
  round.nextPickup -= dt
  round.nextFood -= dt
  round.nextPotion -= dt
  const [a, b] = round.fighters
  for (const [index, fighter] of round.fighters.entries()) {
    if (fighter.health <= 0) { fighter.vx = 0; fighter.vy = 0; continue }
    if (fighter.knockoutTimer > 0) {
      const previousEdge = Math.hypot(fighter.x - .5, fighter.y - .5)
      fighter.knockoutTimer = Math.max(0, fighter.knockoutTimer - dt); fighter.x += fighter.vx * dt; fighter.y += fighter.vy * dt; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
      const edge = Math.hypot(fighter.x - .5, fighter.y - .5)
      if (!fighter.knockoutBrokeWall && previousEdge <= .455 && edge > .455) {
        const angle = Math.atan2(fighter.y - .5, fighter.x - .5); fighter.knockoutBrokeWall = true
        round.ringBreaks.push({ angle, life: .75 }); round.wallImpacts.push({ angle, life: 1.05, strength: .12 })
        burst(round, .5 + Math.cos(angle) * .455, .5 + Math.sin(angle) * .455, '#f1f5f2', 36); audio?.play('wall')
      }
      if (fighter.knockoutTimer === 0) { fighter.health = 0; burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 64) }
      continue
    }
    fighter.cooldown = Math.max(0, fighter.cooldown - dt)
    fighter.weaponTimer = Math.max(0, fighter.weaponTimer - dt)
    fighter.stun = Math.max(0, fighter.stun - dt)
    const previousSlowTimer = fighter.slowTimer
    fighter.slowTimer = Math.max(0, fighter.slowTimer - dt)
    if (previousSlowTimer > 0 && fighter.slowTimer === 0) { fighter.vx *= 2; fighter.vy *= 2 }
    const previousBurnTimer = fighter.burnTimer
    fighter.burnTimer = Math.max(0, fighter.burnTimer - dt)
    if (previousBurnTimer > 0 && fighter.burnTimer === 0 && fighter.burnDamage > 0) {
      fighter.health = Math.max(0, fighter.health - fighter.burnDamage); fighter.burnDamage = 0; fighter.burnSpread = false
      burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 16)
    }
    if (fighter.poisonTicks > 0) {
      fighter.poisonTimer -= dt
      if (fighter.poisonTimer <= 0) {
        fighter.health = Math.max(0, fighter.health - 1); fighter.poisonTicks -= 1; fighter.poisonTimer = fighter.poisonTicks > 0 ? 5 : 0
        burst(round, fighter.x, fighter.y, '#a855f7', 18)
      }
    }
    const previousSpeedBoost = fighter.speedBoost
    fighter.speedBoost = Math.max(0, fighter.speedBoost - dt)
    fighter.damageBoost = Math.max(0, fighter.damageBoost - dt)
    if (previousSpeedBoost > 0 && fighter.speedBoost === 0) { fighter.vx *= .5; fighter.vy *= .5 }
    if (fighter.stun <= 0 && (fighter.weapon === 'bow' || fighter.weapon === 'staff') && (!fighter.rangedFired || fighter.elementAmmo.length > 0) && fighter.weaponTimer <= 0) {
      const target = round.fighters.filter(candidate => candidate.team !== fighter.team && candidate.health > 0).sort((left, right) => Math.hypot(left.x - fighter.x, left.y - fighter.y) - Math.hypot(right.x - fighter.x, right.y - fighter.y))[0]
      if (!target) continue
      const dx = target.x - fighter.x; const dy = target.y - fighter.y; const distance = Math.hypot(dx, dy) || 1
      const projectileKind: Projectile['kind'] = fighter.weapon === 'staff' ? 'magic' : 'arrow'; const speed = projectileKind === 'magic' ? .82 : .95
      const queuedAmmo = fighter.rangedFired ? fighter.elementAmmo.shift() ?? null : null
      const projectileElement = queuedAmmo && queuedAmmo !== 'normal' ? queuedAmmo : null
      round.projectiles.push({ id: Date.now() + Math.random(), owner: fighter.id, ownerTeam: fighter.team, kind: projectileKind, element: projectileElement, x: fighter.x, y: fighter.y, vx: dx / distance * speed, vy: dy / distance * speed, life: 8, damage: arenaWeaponDamage(fighter.weapon) * (fighter.damageBoost > 0 ? 2 : 1), bounced: false })
      if (round.projectiles.length > 24) round.projectiles.splice(0, round.projectiles.length - 24)
      fighter.rangedFired = true
      fighter.weaponTimer = fighter.elementAmmo.length > 0 ? fighter.weapon === 'bow' ? fighter.bowRapidFire ? .2 : .28 : .9 : 0
      if (fighter.elementAmmo.length === 0) fighter.bowRapidFire = false
      burst(round, fighter.x, fighter.y, '#ffffff', 6)
    }
    if (fighter.weapon === 'bow' && fighter.bowRapidFire) continue
    if (fighter.stun > 0) continue
    // Marble movement stays on one straight vector until a collision changes it.
    const speed = Math.hypot(fighter.vx, fighter.vy)
    const minSpeed = fighter.speedBoost > 0 ? .24 : .12
    if (!round.finalRush && speed > ARENA_PRE_RUSH_MAX_SPEED) { fighter.vx *= ARENA_PRE_RUSH_MAX_SPEED / speed; fighter.vy *= ARENA_PRE_RUSH_MAX_SPEED / speed }
    else if (speed < minSpeed && speed > 0) { fighter.vx *= minSpeed / speed; fighter.vy *= minSpeed / speed }
    fighter.x += fighter.vx * dt; fighter.y += fighter.vy * dt; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
    const cx = fighter.x - .5; const cy = fighter.y - .5; const edge = Math.hypot(cx, cy)
    if (edge > .43) {
      const nx = cx / edge; const ny = cy / edge
      fighter.x = .5 + nx * .43; fighter.y = .5 + ny * .43
      const dot = fighter.vx * nx + fighter.vy * ny
      fighter.vx -= 2 * dot * nx; fighter.vy -= 2 * dot * ny
      const wallTurn = (.012 + Math.min(.045, Math.abs(dot) * .035)) * (Math.random() < .5 ? -1 : 1)
      fighter.vx += -ny * wallTurn; fighter.vy += nx * wallTurn
      fighter.vx *= 1.05; fighter.vy *= 1.05
      if (fighter.hammerBouncesRemaining > 0) {
        fighter.hammerBouncesRemaining -= 1
        if (fighter.hammerBouncesRemaining === 0) fighter.stun = Math.max(fighter.stun, 2)
      }
      round.wallImpacts.push({ angle: Math.atan2(ny, nx), life: 1.05, strength: .01 + Math.abs(dot) * .02 })
      if (round.wallImpacts.length > ARENA_MAX_WALL_IMPACTS) round.wallImpacts.splice(0, round.wallImpacts.length - ARENA_MAX_WALL_IMPACTS)
      burst(round, fighter.x, fighter.y, '#ffffff', 9)
      audio?.play('wall')
    }
  }
  const brokenPillars = new Set<number>()
  for (const fighter of round.fighters) {
    for (const pillar of round.pillars) {
      const collision = squareWallCollision(fighter.x, fighter.y, fighter.radius, pillar)
      if (!collision) continue
      const { nx, ny } = collision
      fighter.x = collision.x; fighter.y = collision.y
      const dot = fighter.vx * nx + fighter.vy * ny
      if (dot < 0) {
        fighter.vx -= 2 * dot * nx; fighter.vy -= 2 * dot * ny
        const pillarTurn = (.015 + Math.min(.04, Math.abs(dot) * .03)) * (Math.random() < .5 ? -1 : 1)
        fighter.vx += -ny * pillarTurn; fighter.vy += nx * pillarTurn
        if (pillar.charged) {
          const hit = applyArenaShield(1, fighter.shield)
          fighter.shield = hit.shield; fighter.health = Math.max(0, fighter.health - hit.damage)
          fighter.vx *= .5; fighter.vy *= .5; fighter.stun = 1; pillar.charged = false
          burst(round, fighter.x, fighter.y, '#ffe54d', 24)
          audio?.play('shock')
        }
        pillar.hits -= 1
        burst(round, pillar.x + nx * pillar.radius, pillar.y + ny * pillar.radius, '#d7e0e5', pillar.hits > 0 ? 10 : 28)
        if (pillar.hits <= 0) brokenPillars.add(pillar.id)
      }
    }
  }
  round.pillars = round.pillars.filter(pillar => !brokenPillars.has(pillar.id))
  const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.hypot(dx, dy) || .001
  if (a.health > 0 && b.health > 0 && distance < a.radius + b.radius) {
    spreadBurnOnCollision(round, a, b)
    const nx = dx / distance; const ny = dy / distance; const overlap = a.radius + b.radius - distance
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2
    const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    if (relative < 0) {
      a.vx += relative * nx; a.vy += relative * ny
      b.vx -= relative * nx; b.vy -= relative * ny
      addNaturalCollisionDeflection(a, b, nx, ny, relative)
      const strength = Math.min(1, Math.abs(relative) / 1.4)
      const impactX = (a.x + b.x) / 2; const impactY = (a.y + b.y) / 2
      round.collisionImpacts.push({ x: impactX, y: impactY, life: .38, strength })
      if (round.collisionImpacts.length > ARENA_MAX_COLLISION_IMPACTS) round.collisionImpacts.splice(0, round.collisionImpacts.length - ARENA_MAX_COLLISION_IMPACTS)
      audio?.play(a.weapon && b.weapon && a.stun <= 0 && b.stun <= 0 ? 'clash' : 'collision')
      if (!a.weapon && !b.weapon) {
        burst(round, impactX - nx * .01, impactY - ny * .01, '#ff3655', 4 + Math.round(strength * 6))
        burst(round, impactX + nx * .01, impactY + ny * .01, '#4695ff', 4 + Math.round(strength * 6))
        bumpArmorOnNormalCollision(round, a)
        bumpArmorOnNormalCollision(round, b)
      }
    }
    if (a.cooldown <= 0 && b.cooldown <= 0) {
      const aRangedBreaks = isRangedWeapon(a.weapon) && isMeleeWeapon(b.weapon) && b.stun <= 0
      const bRangedBreaks = isRangedWeapon(b.weapon) && isMeleeWeapon(a.weapon) && a.stun <= 0
      if (aRangedBreaks || bRangedBreaks) {
        if (aRangedBreaks) consumeWeapon(a)
        if (bRangedBreaks) consumeWeapon(b)
        a.cooldown = .7; b.cooldown = .7
        burst(round, (a.x + b.x) / 2, (a.y + b.y) / 2, '#eaf4ff', 24)
        audio?.play('clash')
      } else {
      const contactDamage = meleeCollisionDamage(a, b)
      const incomingRed = contactDamage.first
      const incomingBlue = contactDamage.second
      const equalMeleeClash = meleePower(a) > 0 && meleePower(a) === meleePower(b)
      if (equalMeleeClash) { shatterArmor(round, a); shatterArmor(round, b) }
      if (incomingBlue && a.weapon === 'reaper') { round.reaperSpins.push({ owner: a.id, life: .26, startAngle: a.angle, kind: 'reaper' }); audio?.play('reaper') }
      else if (incomingBlue) audio?.play('weapon')
      if (incomingRed && b.weapon === 'reaper') { round.reaperSpins.push({ owner: b.id, life: .26, startAngle: b.angle, kind: 'reaper' }); audio?.play('reaper') }
      else if (incomingRed) audio?.play('weapon')
      const redReflects = a.armor && incomingRed > 0; const blueReflects = b.armor && incomingBlue > 0
      const damage = {
        red: (redReflects ? 0 : incomingRed) + (blueReflects ? incomingBlue : 0),
        blue: (blueReflects ? 0 : incomingBlue) + (redReflects ? incomingRed : 0),
      }
      if (redReflects) useReflectArmor(round, a)
      if (blueReflects) useReflectArmor(round, b)
      if (damage.red || damage.blue) {
        const redHit = applyArenaShield(damage.red, a.shield); const blueHit = applyArenaShield(damage.blue, b.shield)
        a.shield = redHit.shield; b.shield = blueHit.shield
        a.health = Math.max(0, a.health - redHit.damage); b.health = Math.max(0, b.health - blueHit.damage)
        if (redHit.damage > 0) { a.vx *= .82; a.vy *= .82 }
        if (blueHit.damage > 0) { b.vx *= .82; b.vy *= .82 }
        if (redHit.damage > 0 && b.weapon === 'hammer') applyHammerHit(round, b, a)
        if (blueHit.damage > 0 && a.weapon === 'hammer') applyHammerHit(round, a, b)
        a.cooldown = .7; b.cooldown = .7
        if (damage.red) burst(round, a.x, a.y, redHit.damage ? '#ff294d' : '#8fe7ff', 16)
        if (damage.blue) burst(round, b.x, b.y, blueHit.damage ? '#4590ff' : '#8fe7ff', 16)
      }
      if ((isMeleeWeapon(a.weapon) && a.stun <= 0) || (isMeleeWeapon(b.weapon) && b.stun <= 0)) {
        if (isMeleeWeapon(a.weapon) && a.stun <= 0) consumeWeapon(a)
        if (isMeleeWeapon(b.weapon) && b.stun <= 0) consumeWeapon(b)
        a.cooldown = .7; b.cooldown = .7
      }
      }
    }
  }
  // Additional fighters use the same marble collision rules. Team-mates bounce but never hurt each other.
  for (let leftIndex = 0; leftIndex < round.fighters.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < round.fighters.length; rightIndex++) {
    if (leftIndex === 0 && rightIndex === 1) continue
    const left = round.fighters[leftIndex]; const right = round.fighters[rightIndex]
    if (left.health <= 0 || right.health <= 0) continue
    const pairDx = right.x - left.x; const pairDy = right.y - left.y; const pairDistance = Math.hypot(pairDx, pairDy) || .001
    if (pairDistance >= left.radius + right.radius) continue
    spreadBurnOnCollision(round, left, right)
    const nx = pairDx / pairDistance; const ny = pairDy / pairDistance; const overlap = left.radius + right.radius - pairDistance
    left.x -= nx * overlap / 2; left.y -= ny * overlap / 2; right.x += nx * overlap / 2; right.y += ny * overlap / 2
    const relative = (right.vx - left.vx) * nx + (right.vy - left.vy) * ny
    if (relative < 0) {
      left.vx += relative * nx; left.vy += relative * ny; right.vx -= relative * nx; right.vy -= relative * ny
      addNaturalCollisionDeflection(left, right, nx, ny, relative)
      round.collisionImpacts.push({ x: (left.x + right.x) / 2, y: (left.y + right.y) / 2, life: .38, strength: Math.min(1, Math.abs(relative) / 1.4) })
      audio?.play(left.weapon && right.weapon && left.stun <= 0 && right.stun <= 0 ? 'clash' : 'collision')
      if (!left.weapon && !right.weapon) { bumpArmorOnNormalCollision(round, left); bumpArmorOnNormalCollision(round, right) }
    }
    if (left.team === right.team || left.cooldown > 0 || right.cooldown > 0) continue
    const leftRangedBreaks = isRangedWeapon(left.weapon) && isMeleeWeapon(right.weapon) && right.stun <= 0
    const rightRangedBreaks = isRangedWeapon(right.weapon) && isMeleeWeapon(left.weapon) && left.stun <= 0
    if (leftRangedBreaks || rightRangedBreaks) {
      if (leftRangedBreaks) consumeWeapon(left)
      if (rightRangedBreaks) consumeWeapon(right)
      left.cooldown = .7; right.cooldown = .7
      burst(round, (left.x + right.x) / 2, (left.y + right.y) / 2, '#eaf4ff', 24)
      audio?.play('clash')
      continue
    }
    const contactDamage = meleeCollisionDamage(left, right)
    const leftDamage = contactDamage.first
    const rightDamage = contactDamage.second
    const equalMeleeClash = meleePower(left) > 0 && meleePower(left) === meleePower(right)
    if (equalMeleeClash) { shatterArmor(round, left); shatterArmor(round, right) }
    const leftReflects = left.armor && leftDamage > 0; const rightReflects = right.armor && rightDamage > 0
    const resolvedLeftDamage = (leftReflects ? 0 : leftDamage) + (rightReflects ? rightDamage : 0)
    const resolvedRightDamage = (rightReflects ? 0 : rightDamage) + (leftReflects ? leftDamage : 0)
    if (leftReflects) useReflectArmor(round, left)
    if (rightReflects) useReflectArmor(round, right)
    const leftHit = applyArenaShield(resolvedLeftDamage, left.shield); const rightHit = applyArenaShield(resolvedRightDamage, right.shield)
    left.shield = leftHit.shield; right.shield = rightHit.shield
    left.health = Math.max(0, left.health - leftHit.damage); right.health = Math.max(0, right.health - rightHit.damage)
    if (leftHit.damage && right.weapon === 'hammer') applyHammerHit(round, right, left)
    if (rightHit.damage && left.weapon === 'hammer') applyHammerHit(round, left, right)
    if (leftHit.damage) { left.vx *= .82; left.vy *= .82; burst(round, left.x, left.y, SIDE_COPY[left.side].color, 16) }
    if (rightHit.damage) { right.vx *= .82; right.vy *= .82; burst(round, right.x, right.y, SIDE_COPY[right.side].color, 16) }
    if (isMeleeWeapon(left.weapon) && left.stun <= 0) consumeWeapon(left)
    if (isMeleeWeapon(right.weapon) && right.stun <= 0) consumeWeapon(right)
    left.cooldown = .7; right.cooldown = .7
  }
  if (round.nextPickup <= 0 && groundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .29
    const kinds: Pickup['kind'][] = ['sword', 'blade', 'axe', 'reaper', 'hammer', 'bow', 'staff', 'sword', 'blade', 'axe', 'hammer', 'bow', 'staff', 'shield', 'armor', 'pillar']
    round.pickups.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 12 + Math.random() * 8 })
    round.nextPickup = 1.2 + Math.random() * 3.8
  }
  const collected = new Set<number>()
  for (const pickup of round.pickups) {
    pickup.life -= dt
    for (const fighter of round.fighters) if (fighter.health > 0 && Math.hypot(fighter.x - pickup.x, fighter.y - pickup.y) < .08) {
      if (pickup.kind === 'shield') fighter.shield = true
      else if (pickup.kind === 'armor') { fighter.armor = true; fighter.armorBumps = 0 }
      else if (pickup.kind === 'pillar') {
        const angle = Math.random() * TWO_PI; const radius = .1 + Math.random() * .2
        round.pillars.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, radius: .038, hits: 3, charged: true })
      }
      else equipWeapon(fighter, pickup.kind)
      collected.add(pickup.id); burst(round, pickup.x, pickup.y, pickup.kind === 'shield' ? '#8fe7ff' : pickup.kind === 'armor' ? '#ffb82e' : pickup.kind === 'pillar' ? '#d7e0e5' : '#fde047', 14); break
    }
  }
  round.pickups = round.pickups.filter(pickup => pickup.life > 0 && !collected.has(pickup.id))
  if (collected.size > 0) { round.nextPickup = Math.min(round.nextPickup, .45); audio?.play('pickup') }
  if (round.nextFood <= 0 && groundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .27
    round.foods.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, life: 14 })
    round.nextFood = 12 + Math.random() * 10
  }
  const eaten = new Set<number>()
  for (const food of round.foods) {
    food.life -= dt
    for (const fighter of round.fighters) if (fighter.health > 0 && Math.hypot(fighter.x - food.x, fighter.y - food.y) < .075) {
      fighter.health = healArenaHealth(fighter.health); fighter.burnTimer = 0; fighter.burnDamage = 0; fighter.burnSpread = false; fighter.poisonTimer = 0; fighter.poisonTicks = 0
      eaten.add(food.id); burst(round, food.x, food.y, '#ff5a24', 16); break
    }
  }
  round.foods = round.foods.filter(food => food.life > 0 && !eaten.has(food.id))
  if (eaten.size > 0) { round.nextFood = Math.min(round.nextFood, 1.5); audio?.play('pickup') }
  if (round.nextPotion <= 0 && groundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .27
    const potionKinds: PotionKind[] = ['fire', 'water', 'electric', 'poison', 'normal-ammo', 'speed-boost', 'damage-boost']
    round.potions.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: potionKinds[Math.floor(Math.random() * potionKinds.length)], life: 14 })
    round.nextPotion = 5 + Math.random() * 8
  }
  const usedPotions = new Set<number>()
  for (const potion of round.potions) {
    potion.life -= dt
    for (const fighter of round.fighters) if (fighter.health > 0 && Math.hypot(fighter.x - potion.x, fighter.y - potion.y) < .075) {
      if (potion.kind === 'speed-boost') {
        if (fighter.speedBoost <= 0) { fighter.vx *= 2; fighter.vy *= 2 }
        fighter.speedBoost = 3
      } else if (potion.kind === 'damage-boost') fighter.damageBoost = 3
      else {
        if (potion.kind === 'normal-ammo') fighter.elementAmmo.push('normal', 'normal', 'normal')
        else fighter.elementAmmo.push(potion.kind)
        if (fighter.weapon === 'bow' && fighter.elementAmmo.length >= 5) fighter.bowRapidFire = true
        if (isRangedWeapon(fighter.weapon) && fighter.rangedFired) {
          const pickupDelay = fighter.weapon === 'bow' ? .18 : .7
          fighter.weaponTimer = Math.min(fighter.weaponTimer || pickupDelay, pickupDelay)
        }
      }
      usedPotions.add(potion.id); burst(round, potion.x, potion.y, POTION_COLORS[potion.kind], 18); break
    }
  }
  round.potions = round.potions.filter(potion => potion.life > 0 && !usedPotions.has(potion.id))
  if (usedPotions.size > 0) { round.nextPotion = Math.min(round.nextPotion, 1.2); audio?.play('pickup') }
  const spentProjectiles = new Set<number>()
  const projectileBrokenPillars = new Set<number>()
  for (const arrow of round.projectiles) {
    arrow.life -= dt
    if (arrow.life <= 0) { spentProjectiles.add(arrow.id); continue }
    arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt
    const cx = arrow.x - .5; const cy = arrow.y - .5; const edge = Math.hypot(cx, cy)
    if (edge > .43) {
      const nx = cx / edge; const ny = cy / edge; arrow.x = .5 + nx * .43; arrow.y = .5 + ny * .43
      const dot = arrow.vx * nx + arrow.vy * ny; arrow.vx -= 2 * dot * nx; arrow.vy -= 2 * dot * ny
      arrow.bounced = true
      round.wallImpacts.push({ angle: Math.atan2(ny, nx), life: .65, strength: .01 })
    }
    for (const pillar of round.pillars) {
      if (projectileBrokenPillars.has(pillar.id)) continue
      const projectileRadius = arrow.kind === 'magic' ? .018 : .011
      const collision = squareWallCollision(arrow.x, arrow.y, projectileRadius, pillar)
      if (!collision) continue
      const { nx, ny } = collision
      arrow.x = collision.x; arrow.y = collision.y
      const dot = arrow.vx * nx + arrow.vy * ny
      if (dot < 0) { arrow.vx -= 2 * dot * nx; arrow.vy -= 2 * dot * ny }
      arrow.bounced = true; pillar.hits -= 1
      burst(round, pillar.x + nx * pillar.radius, pillar.y + ny * pillar.radius, '#eaf4ff', pillar.hits > 0 ? 12 : 28)
      audio?.play('wall')
      if (pillar.hits <= 0) projectileBrokenPillars.add(pillar.id)
      break
    }
    const targets = (arrow.bounced ? round.fighters : round.fighters.filter(fighter => fighter.team !== arrow.ownerTeam)).filter(fighter => fighter.health > 0)
    for (const target of targets) {
      if (Math.hypot(arrow.x - target.x, arrow.y - target.y) < target.radius + (arrow.kind === 'magic' ? .026 : .018)) {
        const hasDefense = target.shield || target.armor
        if (hasDefense && arrow.element) {
          const hitsReflectArmor = target.armor
          breakAllDefenses(target)
          target.health = Math.max(0, target.health - arrow.damage * (hitsReflectArmor ? 2 : 1))
          applyElementEffect(round, arrow.element, target)
          burst(round, target.x, target.y, ELEMENT_COLORS[arrow.element], 30)
          audio?.play('weapon'); spentProjectiles.add(arrow.id); break
        }
        if (hasDefense) {
          reflectProjectileFromFighter(arrow, target)
          burst(round, target.x, target.y, '#eaf4ff', 26)
          audio?.play('clash'); break
        }
        const hit = applyArenaShield(arrow.damage, target.shield)
        target.shield = hit.shield; target.health = Math.max(0, target.health - hit.damage)
        if (hit.damage > 0) { target.vx *= .82; target.vy *= .82 }
        if (hit.damage > 0 && arrow.element) applyElementEffect(round, arrow.element, target)
        burst(round, target.x, target.y, hit.damage ? SIDE_COPY[target.side].color : '#8fe7ff', 18)
        audio?.play(arrow.kind === 'magic' ? 'weapon' : 'collision')
        spentProjectiles.add(arrow.id); break
      }
    }
  }
  round.projectiles = round.projectiles.filter(arrow => arrow.life > 0 && !spentProjectiles.has(arrow.id))
  round.pillars = round.pillars.filter(pillar => !projectileBrokenPillars.has(pillar.id))
  if (!round.finalRush) for (const fighter of round.fighters) {
    const speed = Math.hypot(fighter.vx, fighter.vy)
    if (speed > ARENA_PRE_RUSH_MAX_SPEED) { fighter.vx *= ARENA_PRE_RUSH_MAX_SPEED / speed; fighter.vy *= ARENA_PRE_RUSH_MAX_SPEED / speed }
  }
  updateArenaParticles(round, dt)
  round.wallImpacts.forEach(impact => { impact.life -= dt })
  round.wallImpacts = round.wallImpacts.filter(impact => impact.life > 0)
  round.ringBreaks.forEach(impact => { impact.life -= dt })
  round.ringBreaks = round.ringBreaks.filter(impact => impact.life > 0)
  round.collisionImpacts.forEach(impact => { impact.life -= dt })
  round.collisionImpacts = round.collisionImpacts.filter(impact => impact.life > 0)
  round.reaperSpins.forEach(spin => { spin.life -= dt })
  round.reaperSpins = round.reaperSpins.filter(spin => spin.life > 0)
}

// Only objects still lying on the arena floor count toward the mode limit.
// Equipped weapons, shields and armor live on Fighter and never count here.
function groundItemCount(round: RoundState) {
  return round.pickups.length + round.foods.length + round.potions.length
}

function isRangedWeapon(weapon: WeaponKind | null) {
  return weapon === 'bow' || weapon === 'staff'
}

function isMeleeWeapon(weapon: WeaponKind | null): weapon is Exclude<WeaponKind, 'bow' | 'staff'> {
  return weapon !== null && !isRangedWeapon(weapon)
}

function meleePower(fighter: Fighter) {
  if (!isMeleeWeapon(fighter.weapon) || fighter.stun > 0) return 0
  return arenaWeaponDamage(fighter.weapon) * Math.max(1, fighter.weaponCount) * (fighter.damageBoost > 0 ? 2 : 1)
}

function meleeCollisionDamage(first: Fighter, second: Fighter) {
  const firstPower = meleePower(first); const secondPower = meleePower(second)
  return { first: Math.max(0, secondPower - firstPower), second: Math.max(0, firstPower - secondPower) }
}

function squareWallCollision(x: number, y: number, radius: number, pillar: Pillar) {
  const left = pillar.x - pillar.radius; const right = pillar.x + pillar.radius
  const top = pillar.y - pillar.radius; const bottom = pillar.y + pillar.radius
  const closestX = Math.max(left, Math.min(right, x)); const closestY = Math.max(top, Math.min(bottom, y))
  const dx = x - closestX; const dy = y - closestY; const distance = Math.hypot(dx, dy)
  if (distance >= radius) return null
  if (distance > .0001) {
    const nx = dx / distance; const ny = dy / distance; const overlap = radius - distance
    return { nx, ny, x: x + nx * overlap, y: y + ny * overlap }
  }
  const faces = [
    { distance: Math.abs(x - left), nx: -1, ny: 0, x: left - radius, y },
    { distance: Math.abs(right - x), nx: 1, ny: 0, x: right + radius, y },
    { distance: Math.abs(y - top), nx: 0, ny: -1, x, y: top - radius },
    { distance: Math.abs(bottom - y), nx: 0, ny: 1, x, y: bottom + radius },
  ]
  return faces.sort((first, second) => first.distance - second.distance)[0]
}

function addNaturalCollisionDeflection(first: Fighter, second: Fighter, nx: number, ny: number, relativeSpeed: number) {
  const impact = Math.min(1, Math.abs(relativeSpeed) / 1.4)
  const tangentDifference = (second.vx - first.vx) * -ny + (second.vy - first.vy) * nx
  const direction = Math.abs(tangentDifference) > .002 ? Math.sign(tangentDifference) : Math.random() < .5 ? -1 : 1
  const turn = direction * (.025 + impact * .07)
  const rotate = (fighter: Fighter, angle: number) => {
    const cos = Math.cos(angle); const sin = Math.sin(angle); const vx = fighter.vx; const vy = fighter.vy
    fighter.vx = vx * cos - vy * sin; fighter.vy = vx * sin + vy * cos
  }
  rotate(first, turn)
  rotate(second, -turn)
}

function applyHammerHit(round: RoundState, attacker: Fighter, target: Fighter) {
  round.reaperSpins.push({ owner: attacker.id, life: .26, startAngle: attacker.angle, kind: 'hammer' })
  for (const candidate of round.fighters) {
    if (candidate.id === attacker.id || candidate.health <= 0 || Math.hypot(candidate.x - attacker.x, candidate.y - attacker.y) > .24) continue
    const isPrimary = candidate.id === target.id
    if (!isPrimary && candidate.team !== attacker.team) {
      if (candidate.armor) { attacker.health = Math.max(0, attacker.health - 2); useReflectArmor(round, candidate) }
      else {
        const hit = applyArenaShield(2, candidate.shield); candidate.shield = hit.shield; candidate.health = Math.max(0, candidate.health - hit.damage)
      }
    }
    launchHammerTarget(round, attacker, candidate, candidate.team !== attacker.team)
  }
}

function launchHammerTarget(round: RoundState, attacker: Fighter, target: Fighter, canKnockOut: boolean) {
  const dx = target.x - attacker.x; const dy = target.y - attacker.y; const distance = Math.hypot(dx, dy) || 1
  const nx = dx / distance; const ny = dy / distance
  if (canKnockOut && Math.random() < .1) {
    const centerDx = target.x - .5; const centerDy = target.y - .5; const centerDistance = Math.hypot(centerDx, centerDy)
    const outwardX = centerDistance > .02 ? centerDx / centerDistance : nx; const outwardY = centerDistance > .02 ? centerDy / centerDistance : ny
    target.vx = outwardX * .72; target.vy = outwardY * .72; target.stun = 0; target.hammerBouncesRemaining = 0; target.knockoutTimer = .85; target.knockoutBrokeWall = false
    burst(round, target.x, target.y, SIDE_COPY[target.side].color, 48)
    return
  }
  target.x += nx * .12; target.y += ny * .12
  const edgeX = target.x - .5; const edgeY = target.y - .5; const edge = Math.hypot(edgeX, edgeY)
  if (edge > .4) { target.x = .5 + edgeX / edge * .4; target.y = .5 + edgeY / edge * .4 }
  target.vx = nx * 1.45; target.vy = ny * 1.45; target.stun = 0; target.hammerBouncesRemaining = 3
  burst(round, target.x, target.y, '#ffe56b', 28)
}

function breakAllDefenses(fighter: Fighter) {
  fighter.shield = false
  fighter.armor = false
  fighter.armorBumps = 0
}

function reflectProjectileFromFighter(projectile: Projectile, fighter: Fighter) {
  const dx = projectile.x - fighter.x; const dy = projectile.y - fighter.y; const distance = Math.hypot(dx, dy)
  const nx = distance > .0001 ? dx / distance : -projectile.vx / (Math.hypot(projectile.vx, projectile.vy) || 1)
  const ny = distance > .0001 ? dy / distance : -projectile.vy / (Math.hypot(projectile.vx, projectile.vy) || 1)
  const dot = projectile.vx * nx + projectile.vy * ny
  if (dot < 0) { projectile.vx -= 2 * dot * nx; projectile.vy -= 2 * dot * ny }
  else { projectile.vx *= -1; projectile.vy *= -1 }
  const projectileRadius = projectile.kind === 'magic' ? .026 : .018
  projectile.x = fighter.x + nx * (fighter.radius + projectileRadius + .008)
  projectile.y = fighter.y + ny * (fighter.radius + projectileRadius + .008)
  projectile.bounced = true
}

function applyElementEffect(round: RoundState, element: ElementKind, target: Fighter) {
  if (element === 'fire') { target.burnTimer = 3; target.burnDamage = 1; target.burnSpread = false }
  else if (element === 'water') {
    if (target.slowTimer <= 0) { target.vx *= .5; target.vy *= .5 }
    target.slowTimer = 3
  } else if (element === 'electric') target.stun = Math.max(target.stun, 1)
  else { target.poisonTicks = 3; target.poisonTimer = 5 }
  burst(round, target.x, target.y, ELEMENT_COLORS[element], 22)
}

function spreadBurnOnCollision(round: RoundState, first: Fighter, second: Fighter) {
  if (round.mode === 'duel') return
  const spread = (source: Fighter, target: Fighter) => {
    if (!source.burnSpread || source.burnTimer <= 0 || target.burnTimer > 0 || target.health <= 0) return false
    source.burnSpread = false
    target.burnTimer = 3
    target.burnDamage = Math.max(1, source.burnDamage)
    target.burnSpread = false
    burst(round, target.x, target.y, '#ff681d', 18)
    return true
  }
  const firstSpread = spread(first, second)
  if (!firstSpread) spread(second, first)
}

function burst(round: RoundState, x: number, y: number, color: string, count: number) {
  const available = Math.max(0, ARENA_MAX_PARTICLES - round.particles.length)
  for (let i = 0; i < Math.min(count, available); i++) { const angle = Math.random() * TWO_PI; const speed = .06 + Math.random() * .22; round.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .5, color }) }
}

function useReflectArmor(round: RoundState, fighter: Fighter) {
  if (!fighter.armor) return
  shatterArmor(round, fighter)
}

function bumpArmorOnNormalCollision(round: RoundState, fighter: Fighter) {
  if (!fighter.armor) return
  fighter.armorBumps += 1
  if (fighter.armorBumps >= 3) shatterArmor(round, fighter)
}

function shatterArmor(round: RoundState, fighter: Fighter) {
  if (!fighter.armor) return
  fighter.armor = false; fighter.armorBumps = 0
  burst(round, fighter.x, fighter.y, '#ffb82e', 24)
}

function updateArenaParticles(round: RoundState, dt: number) {
  round.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += .12 * dt })
  round.particles = round.particles.filter(p => p.life > 0)
}

function startDeathAnimation(round: RoundState, audio?: ArenaAudio | null) {
  round.deathAnimation = .9
  audio?.play('shatter')
  for (const fighter of round.fighters) {
    if (fighter.health > 0) continue
    fighter.vx = 0; fighter.vy = 0
    const color = SIDE_COPY[fighter.side].color
    const fragmentCount = Math.min(72, Math.max(0, ARENA_MAX_PARTICLES - round.particles.length))
    for (let i = 0; i < fragmentCount; i++) {
      const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * fighter.radius
      const speed = .08 + Math.random() * .34
      round.particles.push({ x: fighter.x + Math.cos(angle) * radius, y: fighter.y + Math.sin(angle) * radius, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .55 + Math.random() * .42, color: Math.random() < .18 ? '#101414' : color })
    }
  }
}

function drawRound(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, round: RoundState) {
  const s = canvas.width; ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s)
  const segments = 144
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#f1f5f2'; ctx.lineWidth = Math.max(2, s * .006); ctx.lineJoin = 'miter'; ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * TWO_PI
    let radius = .455
    for (const impact of round.wallImpacts) {
      const delta = Math.atan2(Math.sin(angle - impact.angle), Math.cos(angle - impact.angle))
      const progress = 1 - impact.life / 1.05
      const dentWidth = Math.max(.05, .2 * (1 - progress))
      if (Math.abs(delta) < dentWidth) radius -= impact.strength * (1 - progress) * (1 - Math.abs(delta) / dentWidth)
      const frontDistance = .08 + progress * .9
      for (const direction of [-1, 1]) {
        const fromFront = delta - direction * frontDistance
        const packetWidth = .26 + progress * .08
        if (Math.abs(fromFront) < packetWidth) {
          const envelope = .5 + .5 * Math.cos(Math.PI * fromFront / packetWidth)
          radius += Math.sin(TWO_PI * fromFront / packetWidth) * impact.strength * .14 * envelope * (1 - progress * .78)
        }
      }
    }
    const x = (.5 + Math.cos(angle) * radius) * s; const y = (.5 + Math.sin(angle) * radius) * s
    if (i === 0) ctx.moveTo(Math.round(x), Math.round(y)); else ctx.lineTo(Math.round(x), Math.round(y))
  }
  ctx.closePath(); ctx.fill(); ctx.stroke()
  for (const ringBreak of round.ringBreaks) {
    const fade = Math.min(1, ringBreak.life * 3); const radius = .455 * s
    ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(7, s * .02); ctx.beginPath(); ctx.arc(s * .5, s * .5, radius, ringBreak.angle - .09, ringBreak.angle + .09); ctx.stroke()
    ctx.strokeStyle = '#f1f5f2'; ctx.lineWidth = Math.max(2, s * .006)
    for (const side of [-1, 1]) { const angle = ringBreak.angle + side * .1; const x = s * (.5 + Math.cos(angle) * .455); const y = s * (.5 + Math.sin(angle) * .455); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle + side * .7) * s * .025, y + Math.sin(angle + side * .7) * s * .025); ctx.stroke() }
    ctx.restore()
  }
  drawPixelNumber(ctx, String(Math.max(0, Math.ceil(round.time))).padStart(2, '0'), s * .5, s * .5, s)
  for (const pickup of round.pickups) {
    if (pickup.kind === 'shield') drawPixelShield(ctx, pickup.x * s, pickup.y * s, s * .065)
    else if (pickup.kind === 'armor') drawPixelArmor(ctx, pickup.x * s, pickup.y * s, s * .07)
    else if (pickup.kind === 'pillar') drawPixelLightning(ctx, pickup.x * s, pickup.y * s, s * .052)
    else drawPixelWeapon(ctx, pickup.kind, pickup.x * s, pickup.y * s, -.7, s * .07)
  }
  for (const food of round.foods) drawPixelFood(ctx, food, s)
  for (const potion of round.potions) drawPixelPotion(ctx, potion, s)
  for (const pillar of round.pillars) drawPixelPillar(ctx, pillar, s)
  for (const arrow of round.projectiles) {
    ctx.save(); ctx.translate(arrow.x * s, arrow.y * s); ctx.rotate(Math.atan2(arrow.vy, arrow.vx))
    if (arrow.kind === 'magic') {
      const color = arrow.element ? ELEMENT_COLORS[arrow.element] : '#ffffff'; const radius = Math.max(3, s * .012); ctx.shadowColor = color; ctx.shadowBlur = radius * 1.4; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TWO_PI); ctx.fill(); ctx.shadowBlur = 0
    } else {
      ctx.strokeStyle = arrow.element ? ELEMENT_COLORS[arrow.element] : '#fff'; ctx.lineWidth = Math.max(2, s * .005); ctx.beginPath(); ctx.moveTo(-s * .025, 0); ctx.lineTo(s * .025, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, -s * .01); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, s * .01); ctx.stroke()
    }
    ctx.restore()
  }
  for (const fighter of round.fighters) if (fighter.health > 0) drawFighter(ctx, fighter, s)
  for (const spin of round.reaperSpins) drawReaperSpin(ctx, spin, round, s)
  for (const p of round.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; const size = Math.max(2, Math.round(s * .009)); ctx.fillRect(Math.round(p.x * s), Math.round(p.y * s), size, size) } ctx.globalAlpha = 1
}

function drawReaperSpin(ctx: CanvasRenderingContext2D, spin: ReaperSpin, round: RoundState, s: number) {
  const fighter = round.fighters.find(item => item.id === spin.owner)
  if (!fighter) return
  const progress = 1 - spin.life / .26
  const angle = spin.startAngle + progress * TWO_PI
  const radius = fighter.radius * s * 1.75
  const x = fighter.x * s + Math.cos(angle) * radius
  const y = fighter.y * s + Math.sin(angle) * radius
  ctx.save(); ctx.globalAlpha = Math.min(1, spin.life * 8)
  ctx.strokeStyle = SIDE_COPY[fighter.side].color; ctx.lineWidth = Math.max(2, s * .006); ctx.beginPath(); ctx.arc(fighter.x * s, fighter.y * s, radius, spin.startAngle, angle); ctx.stroke()
  drawPixelWeapon(ctx, spin.kind, x, y, angle + Math.PI / 2, fighter.radius * s * 1.5)
  ctx.restore()
}

function drawPixelWeapon(ctx: CanvasRenderingContext2D, kind: WeaponKind, x: number, y: number, angle: number, size: number) {
  let image = weaponImageCache.get(kind)
  if (!image && typeof Image !== 'undefined') { image = new Image(); image.src = WEAPON_IMAGE_SOURCES[kind]; weaponImageCache.set(kind, image) }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle + Math.PI / 4); ctx.imageSmoothingEnabled = false
  const renderSize = size * (kind === 'blade' ? .92 : 1.55)
  if (image?.complete && image.naturalWidth > 0) ctx.drawImage(image, -renderSize / 2, -renderSize / 2, renderSize, renderSize)
  else { ctx.fillStyle = kind === 'staff' ? '#a855f7' : '#f8fafc'; ctx.fillRect(-size * .35, -size * .08, size * .7, size * .16) }
  ctx.restore()
}

const PIXEL_DIGITS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'], '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '111'],
}

function drawPixelNumber(ctx: CanvasRenderingContext2D, value: string, centerX: number, centerY: number, s: number) {
  const pixel = Math.max(3, Math.round(s * .013)); const digitWidth = pixel * 3; const gap = pixel
  const width = value.length * digitWidth + (value.length - 1) * gap; const startX = Math.round(centerX - width / 2); const startY = Math.round(centerY - pixel * 2.5)
  ctx.fillStyle = '#6570e8'
  for (let digit = 0; digit < value.length; digit++) for (let row = 0; row < 5; row++) for (let column = 0; column < 3; column++) if (PIXEL_DIGITS[value[digit]]?.[row]?.[column] === '1') ctx.fillRect(startX + digit * (digitWidth + gap) + column * pixel, startY + row * pixel, pixel - 1, pixel - 1)
}

function drawPixelFood(ctx: CanvasRenderingContext2D, food: Food, s: number) {
  const x = Math.round(food.x * s); const y = Math.round(food.y * s); const unit = Math.max(1.8, s * .0065)
  ctx.fillStyle = '#ff5722'; ctx.fillRect(x - unit * 2, y - unit, unit * 5, unit * 4); ctx.fillRect(x - unit, y - unit * 2, unit * 3, unit * 6)
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y - unit * 4, unit, unit * 2)
  ctx.fillStyle = '#65d94f'; ctx.fillRect(x + unit, y - unit * 4, unit * 2, unit)
  ctx.fillStyle = '#fff'; ctx.fillRect(x - unit, y - unit, unit, unit)
}

function drawPixelShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.strokeStyle = '#b9f3ff'; ctx.fillStyle = '#4ac8e933'; ctx.lineWidth = Math.max(2, size * .1); ctx.beginPath(); ctx.moveTo(0, -size * .45); ctx.lineTo(size * .36, -size * .25); ctx.lineTo(size * .28, size * .25); ctx.lineTo(0, size * .48); ctx.lineTo(-size * .28, size * .25); ctx.lineTo(-size * .36, -size * .25); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
}

function drawPixelArmor(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const unit = Math.max(2, Math.round(size * .12)); const cx = Math.round(x); const cy = Math.round(y)
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#2b1b19'; ctx.fillRect(cx - unit * 3, cy - unit * 3, unit * 6, unit * 6)
  ctx.fillStyle = '#ffb82e'; ctx.fillRect(cx - unit * 2, cy - unit * 3, unit * 4, unit); ctx.fillRect(cx - unit * 3, cy - unit * 2, unit * 2, unit * 3); ctx.fillRect(cx + unit, cy - unit * 2, unit * 2, unit * 3); ctx.fillRect(cx - unit * 2, cy + unit, unit * 4, unit * 3)
  ctx.fillStyle = '#fff09a'; ctx.fillRect(cx - unit, cy - unit * 2, unit * 2, unit * 3)
  ctx.fillStyle = '#b7422d'; ctx.fillRect(cx - unit, cy + unit, unit * 2, unit * 2)
  ctx.restore()
}

function drawPixelLightning(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.fillStyle = '#ffe13b'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = size * .42
  ctx.beginPath(); ctx.moveTo(size * .08, -size * .5); ctx.lineTo(-size * .34, size * .04); ctx.lineTo(-size * .05, size * .04); ctx.lineTo(-size * .18, size * .5); ctx.lineTo(size * .38, -size * .13); ctx.lineTo(size * .08, -size * .13); ctx.closePath(); ctx.fill()
  ctx.shadowBlur = 0; ctx.strokeStyle = '#fff4a8'; ctx.lineWidth = Math.max(1, size * .08); ctx.stroke(); ctx.restore()
}

function drawPixelPillar(ctx: CanvasRenderingContext2D, pillar: Pillar, s: number, isPickup = false) {
  const x = Math.round(pillar.x * s); const y = Math.round(pillar.y * s)
  const radius = Math.max(5, Math.round(pillar.radius * s))
  ctx.save(); ctx.translate(x, y)
  if (isPickup) { ctx.globalAlpha = .28 + Math.sin(Date.now() / 130) * .1; ctx.fillStyle = '#fff'; ctx.fillRect(-radius * 1.45, -radius * 1.45, radius * 2.9, radius * 2.9); ctx.globalAlpha = 1 }
  ctx.fillStyle = '#68747b'; ctx.fillRect(-radius, -radius, radius * 2, radius * 2)
  ctx.fillStyle = '#c6d0d4'; ctx.fillRect(-radius * .72, -radius * .72, radius * .62, radius * .62)
  ctx.strokeStyle = '#f4f7f8'; ctx.lineWidth = Math.max(2, s * .005); ctx.strokeRect(-radius, -radius, radius * 2, radius * 2)
  if (pillar.charged) {
    const phase = Math.floor(performance.now() / 75) % 2
    ctx.strokeStyle = '#ffe54d'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = radius * .8; ctx.lineWidth = Math.max(2, s * .006)
    ctx.beginPath()
    for (let i = 0; i <= 12; i++) {
      const angle = i / 12 * TWO_PI; const jag = radius * (i % 2 === phase ? 1.35 : 1.72)
      const px = Math.cos(angle) * jag; const py = Math.sin(angle) * jag
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0
  }
  if (!isPickup && pillar.hits < 3) {
    ctx.strokeStyle = '#20272b'; ctx.lineWidth = Math.max(2, s * .004); ctx.beginPath(); ctx.moveTo(0, -radius * .72); ctx.lineTo(-radius * .2, -radius * .12); ctx.lineTo(radius * .18, radius * .12)
    if (pillar.hits < 2) { ctx.lineTo(-radius * .42, radius * .58); ctx.moveTo(radius * .18, radius * .12); ctx.lineTo(radius * .58, radius * .48) }
    ctx.stroke()
  }
  ctx.restore()
}

function drawPixelPotion(ctx: CanvasRenderingContext2D, potion: Potion, s: number) {
  const x = Math.round(potion.x * s); const y = Math.round(potion.y * s); const unit = Math.max(2, Math.round(s * .005)); const color = POTION_COLORS[potion.kind]; const isBoost = potion.kind === 'speed-boost' || potion.kind === 'damage-boost'
  ctx.save(); ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#11151d'
  ctx.fillRect(x - unit * 2, y - unit * 6, unit * 4, unit)
  ctx.fillRect(x - unit * 3, y - unit * 5, unit * 6, unit)
  ctx.fillRect(x - unit * 2, y - unit * 4, unit * 4, unit * 2)
  ctx.fillRect(x - unit * 3, y - unit * 2, unit * 6, unit)
  ctx.fillRect(x - unit * 4, y - unit, unit * 8, unit * 6)
  ctx.fillRect(x - unit * 3, y + unit * 5, unit * 6, unit)
  ctx.fillStyle = '#dce7ee'; ctx.fillRect(x - unit, y - unit * 6, unit * 2, unit); ctx.fillRect(x - unit * 2, y - unit * 5, unit * 4, unit)
  ctx.fillStyle = '#568cff'; ctx.fillRect(x - unit, y - unit * 4, unit * 2, unit * 2)
  ctx.fillStyle = '#b9d8ff'; ctx.fillRect(x - unit * 2, y - unit, unit * 4, unit)
  ctx.fillStyle = color; ctx.fillRect(x - unit * 3, y, unit * 6, unit * 5)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - unit * 2, y, unit, unit * 2)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - unit * 2, y - unit, unit, unit)
  if (isBoost) {
    ctx.fillStyle = '#11151d'; ctx.fillRect(x - unit * 2, y + unit, unit * 4, unit)
    ctx.fillStyle = '#fff7c2'; ctx.fillRect(x - unit, y - unit * 2, unit * 2, unit); ctx.fillRect(x, y - unit * 3, unit, unit * 4)
  } else {
    ctx.fillStyle = '#11151d'; ctx.fillRect(x - unit, y + unit, unit * 2, unit * 2)
  }
  ctx.restore()
}

function drawFireRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, layers: number, baseRadius: number) {
  const phase = performance.now() / 110
  ctx.save(); ctx.shadowColor = '#ff3d00'; ctx.shadowBlur = radius * .35; ctx.lineWidth = Math.max(2, radius * .075)
  for (let layer = 0; layer < layers; layer++) {
    ctx.globalAlpha = Math.max(.3, .95 - layer * .16); ctx.strokeStyle = layer === 0 ? '#ffd43b' : '#ff681d'; ctx.beginPath()
    for (let i = 0; i <= 20; i++) { const angle = i / 20 * TWO_PI; const base = baseRadius + layer * .2; const flame = radius * (base + Math.sin(i * 2.5 + phase + layer * 1.7) * .08); const px = x + Math.cos(angle) * flame; const py = y + Math.sin(angle) * flame; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) }
    ctx.closePath(); ctx.stroke()
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.restore()
}

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, s: number) {
  const x = f.x * s; const y = f.y * s; const r = f.radius * s; const color = SIDE_COPY[f.side].color
  ctx.save(); ctx.fillStyle = '#090c0c'; ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * .18); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(r), 0, TWO_PI); ctx.fill(); ctx.stroke()
  const eyeSize = Math.max(2, Math.round(r * .18)); const eyeShift = Math.sin(performance.now() / 260 + (f.side === 'red' ? 0 : .8)) * r * .1
  ctx.fillStyle = color; ctx.fillRect(Math.round(x - r * .35 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize); ctx.fillRect(Math.round(x + r * .18 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize)
  if (f.speedBoost > 0 || f.damageBoost > 0) { ctx.strokeStyle = f.damageBoost > 0 ? '#ff354d' : '#ffd32f'; ctx.lineWidth = Math.max(2, r * .1); ctx.globalAlpha = .65 + Math.sin(performance.now() / 100) * .25; ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, TWO_PI); ctx.stroke(); ctx.globalAlpha = 1 }
  if (f.elementAmmo.length > 0) { const nextElement = f.elementAmmo[0]; ctx.strokeStyle = AMMO_COLORS[nextElement]; ctx.shadowColor = AMMO_COLORS[nextElement]; ctx.shadowBlur = r * .28; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); ctx.arc(x, y, r * 1.16, 0, TWO_PI); ctx.stroke(); ctx.shadowBlur = 0; if (f.elementAmmo.length > 1) { ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, Math.round(r * .55))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`×${f.elementAmmo.length}`, x, y - r * 1.55) } }
  if (f.slowTimer > 0) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = Math.max(2, r * .08); ctx.beginPath(); ctx.arc(x, y, r * 1.24, 0, TWO_PI); ctx.stroke() }
  if (f.stun > 0) { ctx.strokeStyle = '#ffe54d'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = r * .2; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); for (let i = 0; i <= 14; i++) { const angle = i / 14 * TWO_PI; const radius = r * (i % 2 ? 1.12 : 1.25); const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) } ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0 }
  if (f.burnTimer > 0) drawFireRing(ctx, x, y, r, 2, 1.12)
  if (f.poisonTicks > 0) { ctx.strokeStyle = '#a855f7'; ctx.setLineDash([r * .16, r * .22]); ctx.lineWidth = Math.max(2, r * .1); ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (f.shield) { ctx.strokeStyle = '#b9f3ff'; ctx.lineWidth = Math.max(2, r * .12); ctx.setLineDash([r * .35, r * .18]); ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (f.armor) { ctx.strokeStyle = '#ffb82e'; ctx.lineWidth = Math.max(3, r * .15); ctx.setLineDash([r * .42, r * .16]); ctx.beginPath(); ctx.arc(x, y, r * 1.3, -.4, Math.PI + .4); ctx.stroke(); ctx.setLineDash([]) }
  if (f.weapon && f.weaponCount > 1 && (f.weapon === 'sword' || f.weapon === 'blade')) {
    const forward = r * 1.2; const side = r * .62; const cos = Math.cos(f.angle); const sin = Math.sin(f.angle)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward - sin * side, y + sin * forward + cos * side, f.angle + .14, r * 1.5)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward + sin * side, y + sin * forward - cos * side, f.angle - .14, r * 1.5)
  } else if (f.weapon) drawPixelWeapon(ctx, f.weapon, x + Math.cos(f.angle) * r * 1.3, y + Math.sin(f.angle) * r * 1.3, f.angle, r * 1.5)
  ctx.restore()
}
