import arenaStyles from '#/components/red-blue-arena.css?url'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoinRewardPopup } from '#/components/home/coin-rewards'
import { SiteLayout } from '#/components/site-layout'
import { addCoinBalance, readCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { ARENA_BET_OPTIONS, ARENA_MAX_BET, ARENA_MAX_HEALTH, ARENA_ROUND_SECONDS, applyArenaShield, arenaPayout, arenaResult, arenaWeaponDamage, healArenaHealth, weaponCollisionDamage } from '#/lib/red-blue-arena'
import type { ArenaResult, ArenaSide } from '#/lib/red-blue-arena'
import type { ArenaAudio } from '#/lib/red-blue-arena-audio'

export const Route = createFileRoute('/$locale/red-blue-arena')({
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === '1' ? ('1' as const) : undefined,
  }),
  head: () => ({ links: [{ rel: 'stylesheet', href: arenaStyles }], meta: [{ title: '红蓝竞技场｜金币竞猜' }] }),
  component: RedBlueArenaPage,
})

type WeaponKind = 'sword' | 'blade' | 'axe' | 'reaper' | 'bow' | 'staff'
type ArenaMode = 'duel' | 'three' | 'four' | 'team'
type Fighter = { id: number; side: ArenaSide; team: ArenaSide; x: number; y: number; vx: number; vy: number; radius: number; health: number; angle: number; cooldown: number; weapon: WeaponKind | null; weaponCount: number; weaponTimer: number; iceArrow: boolean; shield: boolean; armor: boolean; armorBumps: number; speedBoost: number; damageBoost: number; stun: number; iceStun: number; burnTimer: number; burnDamage: number; burnSpread: boolean }
type Pickup = { id: number; x: number; y: number; kind: WeaponKind | 'shield' | 'armor' | 'pillar' | 'ice-arrow'; life: number }
type Food = { id: number; x: number; y: number; life: number }
type Projectile = { id: number; owner: number; ownerTeam: ArenaSide; kind: 'arrow' | 'ice' | 'fire'; x: number; y: number; vx: number; vy: number; life: number; damage: number; bounced: boolean }
type Potion = { id: number; x: number; y: number; kind: 'speed' | 'power'; life: number }
type Pillar = { id: number; x: number; y: number; radius: number; hits: number; charged: boolean }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type WallImpact = { angle: number; life: number; strength: number }
type CollisionImpact = { x: number; y: number; life: number; strength: number }
type ReaperSpin = { owner: number; life: number; startAngle: number }
type RoundState = { mode: ArenaMode; fighters: Fighter[]; pickups: Pickup[]; foods: Food[]; potions: Potion[]; pillars: Pillar[]; projectiles: Projectile[]; particles: Particle[]; wallImpacts: WallImpact[]; collisionImpacts: CollisionImpact[]; reaperSpins: ReaperSpin[]; time: number; nextPickup: number; nextFood: number; nextPotion: number; running: boolean; deathAnimation: number | null; finalRush: boolean }

const TWO_PI = Math.PI * 2
const ARENA_SAFE_MAX_SPEED = 3.2
const ARENA_MAX_PARTICLES = 520
const ARENA_MAX_WALL_IMPACTS = 24
const ARENA_MAX_COLLISION_IMPACTS = 18
const WEAPON_IMAGE_SOURCES: Record<WeaponKind, string> = { sword: '/images/red-blue-arena/weapons/sword.png', blade: '/images/red-blue-arena/weapons/knife.png', axe: '/images/red-blue-arena/weapons/axe.png', reaper: '/images/red-blue-arena/weapons/reaper.png', bow: '/images/red-blue-arena/weapons/bow.png', staff: '/images/red-blue-arena/weapons/staff.png' }
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
const WEAPON_HELP = [
  ['🗡️', '小刀：1伤害，持有时速度×2'], ['⚔️', '剑：2伤害，可组成双剑'],
  ['🪓', '斧头：3伤害'], ['☠️', '死神刀：4伤害，持有时速度减半'],
  ['🏹', '弓：射箭1伤害；冰箭可冰冻2秒'], ['🔥', '法杖：火线1伤害，3秒后再掉1血'],
  ['🛡️', '盾：抵挡一次；火线/冰箭会造成伤害并碎盾'],
  ['🪞', '反伤甲：反弹一次武器伤害'],
] as const
const ITEM_HELP = [
  ['🍊', '果实：回复1格，可突破10血'], ['🟡', '黄药：速度×2，持续3秒'],
  ['🔴', '红药：伤害×2，持续3秒'], ['⚡', '闪电柱：首次触碰掉1血、停顿并减速'],
] as const

function makeFighter(id: number, side: ArenaSide, x: number, y: number, vx: number, vy: number): Fighter {
  return { id, side, team: side, x, y, vx, vy, radius: .047, health: ARENA_MAX_HEALTH, angle: Math.atan2(vy, vx), cooldown: 0, weapon: null, weaponCount: 0, weaponTimer: 0, iceArrow: false, shield: false, armor: false, armorBumps: 0, speedBoost: 0, damageBoost: 0, stun: 0, iceStun: 0, burnTimer: 0, burnDamage: 0, burnSpread: false }
}

function createRound(mode: ArenaMode = 'duel'): RoundState {
  const fighters = mode === 'team'
    ? [makeFighter(0, 'red', .3, .42, .36, -.27), makeFighter(1, 'blue', .7, .36, -.34, .3), makeFighter(2, 'red', .34, .68, .31, .3), makeFighter(3, 'blue', .66, .64, -.32, -.29)]
    : MODE_RULES[mode].sides.map((side, index, sides) => { const angle = index / sides.length * TWO_PI + .35; return makeFighter(index, side, .5 + Math.cos(angle) * .2, .5 + Math.sin(angle) * .2, -Math.sin(angle) * .4, Math.cos(angle) * .4) })
  for (const fighter of fighters) {
    const dx = .5 - fighter.x; const dy = .5 - fighter.y; const distance = Math.hypot(dx, dy) || 1
    fighter.vx = dx / distance * .44; fighter.vy = dy / distance * .44; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
  }
  return {
    mode, fighters,
    pickups: [], foods: [], potions: [], pillars: [], projectiles: [], particles: [], wallImpacts: [], collisionImpacts: [], reaperSpins: [], time: MODE_RULES[mode].seconds, nextPickup: .8 + Math.random() * 1.5, nextFood: 9 + Math.random() * 7, nextPotion: 3 + Math.random() * 5, running: true, deathAnimation: null, finalRush: false,
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
    {phase === 'running' ? <aside className="mt-2 grid grid-cols-2 gap-2 text-white/70"><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-yellow-300">⚔️ 武器说明</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{WEAPON_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div>{mode !== 'duel' ? <p className="mt-1 text-[9px] text-orange-300/80">🔥 火线烫伤可在碰撞时额外传给一个球。</p> : null}</details><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-cyan-300">🎁 道具说明</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{ITEM_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div></details></aside> : null}
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
  applyWeaponSpeedEffect(fighter)
  fighter.weaponTimer = weapon === 'bow' ? .55 : weapon === 'staff' ? .7 : 0
}

function consumeWeapon(fighter: Fighter) {
  removeWeaponSpeedEffect(fighter)
  if (fighter.weapon === 'bow') fighter.iceArrow = false
  fighter.weapon = null
  fighter.weaponCount = 0
  fighter.weaponTimer = 0
}

function applyWeaponSpeedEffect(fighter: Fighter) {
  if (fighter.weapon === 'blade') { fighter.vx *= 2; fighter.vy *= 2 }
  if (fighter.weapon === 'reaper') { fighter.vx *= .5; fighter.vy *= .5 }
}

function removeWeaponSpeedEffect(fighter: Fighter) {
  if (fighter.weapon === 'blade') { fighter.vx *= .5; fighter.vy *= .5 }
  if (fighter.weapon === 'reaper') { fighter.vx *= 2; fighter.vy *= 2 }
}

function updateRound(round: RoundState, dt: number, audio?: ArenaAudio | null) {
  if (round.deathAnimation !== null) {
    round.deathAnimation = Math.max(0, round.deathAnimation - dt)
    updateArenaParticles(round, dt)
    return
  }
  round.time -= dt
  if (!round.finalRush && round.time <= 30) {
    round.finalRush = true
    for (const fighter of round.fighters) { fighter.vx *= 2; fighter.vy *= 2 }
  }
  round.nextPickup -= dt
  round.nextFood -= dt
  round.nextPotion -= dt
  const [a, b] = round.fighters
  for (const [index, fighter] of round.fighters.entries()) {
    if (fighter.health <= 0) { fighter.vx = 0; fighter.vy = 0; continue }
    fighter.cooldown = Math.max(0, fighter.cooldown - dt)
    fighter.weaponTimer = Math.max(0, fighter.weaponTimer - dt)
    fighter.stun = Math.max(0, fighter.stun - dt)
    fighter.iceStun = Math.max(0, fighter.iceStun - dt)
    const previousBurnTimer = fighter.burnTimer
    fighter.burnTimer = Math.max(0, fighter.burnTimer - dt)
    if (previousBurnTimer > 0 && fighter.burnTimer === 0 && fighter.burnDamage > 0) {
      fighter.health = Math.max(0, fighter.health - fighter.burnDamage); fighter.burnDamage = 0; fighter.burnSpread = false
      burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 16)
    }
    const previousSpeedBoost = fighter.speedBoost
    fighter.speedBoost = Math.max(0, fighter.speedBoost - dt)
    fighter.damageBoost = Math.max(0, fighter.damageBoost - dt)
    if (previousSpeedBoost > 0 && fighter.speedBoost === 0) { fighter.vx *= .5; fighter.vy *= .5 }
    if ((fighter.weapon === 'bow' || fighter.weapon === 'staff') && fighter.weaponTimer <= 0) {
      const target = round.fighters.filter(candidate => candidate.team !== fighter.team && candidate.health > 0).sort((left, right) => Math.hypot(left.x - fighter.x, left.y - fighter.y) - Math.hypot(right.x - fighter.x, right.y - fighter.y))[0]
      if (!target) continue
      const dx = target.x - fighter.x; const dy = target.y - fighter.y; const distance = Math.hypot(dx, dy) || 1
      const projectileKind: Projectile['kind'] = fighter.weapon === 'staff' ? 'fire' : fighter.iceArrow ? 'ice' : 'arrow'; const speed = projectileKind === 'fire' ? .82 : .95
      round.projectiles.push({ id: Date.now() + Math.random(), owner: fighter.id, ownerTeam: fighter.team, kind: projectileKind, x: fighter.x, y: fighter.y, vx: dx / distance * speed, vy: dy / distance * speed, life: ARENA_ROUND_SECONDS, damage: arenaWeaponDamage(projectileKind === 'fire' ? 'staff' : 'bow') * (fighter.damageBoost > 0 ? 2 : 1), bounced: false })
      consumeWeapon(fighter)
      burst(round, fighter.x, fighter.y, '#ffffff', 6)
    }
    if (fighter.stun > 0 || fighter.iceStun > 0) continue
    // Marble movement stays on one straight vector until a collision changes it.
    const speed = Math.hypot(fighter.vx, fighter.vy)
    const minSpeed = fighter.speedBoost > 0 ? .24 : .12
    if (speed > ARENA_SAFE_MAX_SPEED) { fighter.vx *= ARENA_SAFE_MAX_SPEED / speed; fighter.vy *= ARENA_SAFE_MAX_SPEED / speed }
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
      round.wallImpacts.push({ angle: Math.atan2(ny, nx), life: 1.05, strength: .01 + Math.abs(dot) * .02 })
      if (round.wallImpacts.length > ARENA_MAX_WALL_IMPACTS) round.wallImpacts.splice(0, round.wallImpacts.length - ARENA_MAX_WALL_IMPACTS)
      burst(round, fighter.x, fighter.y, '#ffffff', 9)
      audio?.play('wall')
    }
  }
  const brokenPillars = new Set<number>()
  for (const fighter of round.fighters) {
    for (const pillar of round.pillars) {
      const dx = fighter.x - pillar.x; const dy = fighter.y - pillar.y
      const distance = Math.hypot(dx, dy) || .001; const minDistance = fighter.radius + pillar.radius
      if (distance >= minDistance) continue
      const nx = dx / distance; const ny = dy / distance
      fighter.x = pillar.x + nx * minDistance; fighter.y = pillar.y + ny * minDistance
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
      audio?.play(a.weapon && b.weapon ? 'clash' : 'collision')
      if (!a.weapon && !b.weapon) {
        burst(round, impactX - nx * .01, impactY - ny * .01, '#ff3655', 4 + Math.round(strength * 6))
        burst(round, impactX + nx * .01, impactY + ny * .01, '#4695ff', 4 + Math.round(strength * 6))
        bumpReflectArmor(round, a)
        bumpReflectArmor(round, b)
      }
    }
    if (a.cooldown <= 0 && b.cooldown <= 0) {
      const isRanged = (weapon: WeaponKind | null) => weapon === 'bow' || weapon === 'staff'
      const isSwordOrKnife = (weapon: WeaponKind | null) => weapon === 'sword' || weapon === 'blade'
      const aRangedBreaks = isRanged(a.weapon) && isSwordOrKnife(b.weapon)
      const bRangedBreaks = isRanged(b.weapon) && isSwordOrKnife(a.weapon)
      if (aRangedBreaks || bRangedBreaks) {
        if (aRangedBreaks) consumeWeapon(a)
        if (bRangedBreaks) consumeWeapon(b)
        a.cooldown = .7; b.cooldown = .7
        burst(round, (a.x + b.x) / 2, (a.y + b.y) / 2, '#eaf4ff', 24)
        audio?.play('clash')
      } else {
      const baseDamage = weaponCollisionDamage(a.weapon, b.weapon)
      const incomingRed = baseDamage.red * Math.max(1, b.weaponCount) * (b.damageBoost > 0 ? 2 : 1)
      const incomingBlue = baseDamage.blue * Math.max(1, a.weaponCount) * (a.damageBoost > 0 ? 2 : 1)
      if (incomingBlue && a.weapon === 'reaper') { round.reaperSpins.push({ owner: a.id, life: .26, startAngle: a.angle }); audio?.play('reaper') }
      else if (incomingBlue) audio?.play('weapon')
      if (incomingRed && b.weapon === 'reaper') { round.reaperSpins.push({ owner: b.id, life: .26, startAngle: b.angle }); audio?.play('reaper') }
      else if (incomingRed) audio?.play('weapon')
      const redReflects = a.armor && incomingRed > 0; const blueReflects = b.armor && incomingBlue > 0
      const damage = {
        red: (redReflects ? 0 : incomingRed) + (blueReflects ? incomingBlue : 0),
        blue: (blueReflects ? 0 : incomingBlue) + (redReflects ? incomingRed : 0),
      }
      if (redReflects) { a.armor = false; a.armorBumps = 0; burst(round, a.x, a.y, '#ffb82e', 26) }
      if (blueReflects) { b.armor = false; b.armorBumps = 0; burst(round, b.x, b.y, '#ffb82e', 26) }
      if (damage.red || damage.blue) {
        const redHit = applyArenaShield(damage.red, a.shield); const blueHit = applyArenaShield(damage.blue, b.shield)
        a.shield = redHit.shield; b.shield = blueHit.shield
        a.health = Math.max(0, a.health - redHit.damage); b.health = Math.max(0, b.health - blueHit.damage)
        if (redHit.damage > 0) { a.vx *= .82; a.vy *= .82 }
        if (blueHit.damage > 0) { b.vx *= .82; b.vy *= .82 }
        if (redHit.damage > 0 && b.weapon === 'staff') { a.burnTimer = 3; a.burnDamage = 1 }
        if (blueHit.damage > 0 && a.weapon === 'staff') { b.burnTimer = 3; b.burnDamage = 1 }
        a.cooldown = .7; b.cooldown = .7
        if (damage.red) burst(round, a.x, a.y, redHit.damage ? '#ff294d' : '#8fe7ff', 16)
        if (damage.blue) burst(round, b.x, b.y, blueHit.damage ? '#4590ff' : '#8fe7ff', 16)
        // Every weapon is single-use and disappears after its first damaging hit.
        if (incomingBlue) consumeWeapon(a)
        if (incomingRed) consumeWeapon(b)
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
      audio?.play(left.weapon && right.weapon ? 'clash' : 'collision')
    }
    if (left.team === right.team || left.cooldown > 0 || right.cooldown > 0) continue
    const leftDamage = arenaWeaponDamage(right.weapon) * Math.max(1, right.weaponCount) * (right.damageBoost > 0 ? 2 : 1)
    const rightDamage = arenaWeaponDamage(left.weapon) * Math.max(1, left.weaponCount) * (left.damageBoost > 0 ? 2 : 1)
    const leftHit = applyArenaShield(leftDamage, left.shield); const rightHit = applyArenaShield(rightDamage, right.shield)
    left.shield = leftHit.shield; right.shield = rightHit.shield
    left.health = Math.max(0, left.health - leftHit.damage); right.health = Math.max(0, right.health - rightHit.damage)
    if (leftHit.damage) { left.vx *= .82; left.vy *= .82; burst(round, left.x, left.y, SIDE_COPY[left.side].color, 16); consumeWeapon(right) }
    if (rightHit.damage) { right.vx *= .82; right.vy *= .82; burst(round, right.x, right.y, SIDE_COPY[right.side].color, 16); consumeWeapon(left) }
    left.cooldown = .7; right.cooldown = .7
  }
  if (round.nextPickup <= 0 && groundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .29
    const kinds: Pickup['kind'][] = ['sword', 'blade', 'axe', 'reaper', 'bow', 'staff', 'sword', 'blade', 'axe', 'bow', 'staff', 'ice-arrow', 'shield', 'armor', 'pillar']
    round.pickups.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 12 + Math.random() * 8 })
    round.nextPickup = 1.2 + Math.random() * 3.8
  }
  const collected = new Set<number>()
  for (const pickup of round.pickups) {
    pickup.life -= dt
    for (const fighter of round.fighters) if (fighter.health > 0 && Math.hypot(fighter.x - pickup.x, fighter.y - pickup.y) < .08 && (pickup.kind !== 'shield' || !fighter.shield) && (pickup.kind !== 'armor' || !fighter.armor) && (pickup.kind !== 'ice-arrow' || !fighter.iceArrow)) {
      if (pickup.kind === 'shield') fighter.shield = true
      else if (pickup.kind === 'armor') { fighter.armor = true; fighter.armorBumps = 0 }
      else if (pickup.kind === 'ice-arrow') fighter.iceArrow = true
      else if (pickup.kind === 'pillar') {
        const angle = Math.random() * TWO_PI; const radius = .1 + Math.random() * .2
        round.pillars.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, radius: .038, hits: 3, charged: true })
      }
      else equipWeapon(fighter, pickup.kind)
      collected.add(pickup.id); burst(round, pickup.x, pickup.y, pickup.kind === 'shield' || pickup.kind === 'ice-arrow' ? '#8fe7ff' : pickup.kind === 'armor' ? '#ffb82e' : pickup.kind === 'pillar' ? '#d7e0e5' : '#fde047', 14); break
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
      fighter.health = healArenaHealth(fighter.health); eaten.add(food.id); burst(round, food.x, food.y, '#ff5a24', 16); break
    }
  }
  round.foods = round.foods.filter(food => food.life > 0 && !eaten.has(food.id))
  if (eaten.size > 0) { round.nextFood = Math.min(round.nextFood, 1.5); audio?.play('pickup') }
  if (round.nextPotion <= 0 && groundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .27
    round.potions.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: Math.random() < .5 ? 'speed' : 'power', life: 14 })
    round.nextPotion = 5 + Math.random() * 8
  }
  const usedPotions = new Set<number>()
  for (const potion of round.potions) {
    potion.life -= dt
    for (const fighter of round.fighters) if (fighter.health > 0 && Math.hypot(fighter.x - potion.x, fighter.y - potion.y) < .075) {
      if (potion.kind === 'speed') {
        if (fighter.speedBoost <= 0) { fighter.vx *= 2; fighter.vy *= 2 }
        fighter.speedBoost = 3
      } else fighter.damageBoost = 3
      usedPotions.add(potion.id); burst(round, potion.x, potion.y, potion.kind === 'speed' ? '#ffd84a' : '#ff4b55', 18); break
    }
  }
  round.potions = round.potions.filter(potion => potion.life > 0 && !usedPotions.has(potion.id))
  if (usedPotions.size > 0) { round.nextPotion = Math.min(round.nextPotion, 1.2); audio?.play('pickup') }
  const spentProjectiles = new Set<number>()
  const projectileBrokenPillars = new Set<number>()
  for (const arrow of round.projectiles) {
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
      const px = arrow.x - pillar.x; const py = arrow.y - pillar.y
      const pillarDistance = Math.hypot(px, py) || .001; const projectileRadius = arrow.kind === 'fire' ? .018 : .011
      const minPillarDistance = pillar.radius + projectileRadius
      if (pillarDistance >= minPillarDistance) continue
      const nx = px / pillarDistance; const ny = py / pillarDistance
      arrow.x = pillar.x + nx * minPillarDistance; arrow.y = pillar.y + ny * minPillarDistance
      const dot = arrow.vx * nx + arrow.vy * ny
      if (dot < 0) { arrow.vx -= 2 * dot * nx; arrow.vy -= 2 * dot * ny }
      arrow.bounced = true; pillar.hits -= 1
      burst(round, pillar.x + nx * pillar.radius, pillar.y + ny * pillar.radius, arrow.kind === 'fire' ? '#ff681d' : arrow.kind === 'ice' ? '#70dcff' : '#eaf4ff', pillar.hits > 0 ? 12 : 28)
      audio?.play('wall')
      if (pillar.hits <= 0) projectileBrokenPillars.add(pillar.id)
      break
    }
    const targets = (arrow.bounced ? round.fighters : round.fighters.filter(fighter => fighter.team !== arrow.ownerTeam)).filter(fighter => fighter.health > 0)
    for (const target of targets) {
      if (Math.hypot(arrow.x - target.x, arrow.y - target.y) < target.radius + (arrow.kind === 'fire' ? .026 : .018)) {
        const owner = round.fighters.find(fighter => fighter.id === arrow.owner)
        const reflected = target.armor && arrow.damage > 0
        if (reflected) { target.armor = false; target.armorBumps = 0; if (owner) owner.health = Math.max(0, owner.health - arrow.damage); burst(round, target.x, target.y, '#ffb82e', 26) }
        const bypassesShield = arrow.kind === 'fire' || arrow.kind === 'ice'
        const breaksShield = bypassesShield && !reflected && target.shield
        const hit = bypassesShield ? { damage: reflected ? 0 : arrow.damage, shield: breaksShield ? false : target.shield } : applyArenaShield(reflected ? 0 : arrow.damage, target.shield)
        target.shield = hit.shield; target.health = Math.max(0, target.health - hit.damage)
        if (breaksShield) burst(round, target.x, target.y, '#b9f3ff', 24)
        if (hit.damage > 0) { target.vx *= .82; target.vy *= .82 }
        if (hit.damage > 0 && arrow.kind === 'fire') { target.burnTimer = 3; target.burnDamage = arrow.damage; target.burnSpread = round.mode !== 'duel' }
        if (hit.damage > 0 && arrow.kind === 'ice') target.iceStun = Math.max(target.iceStun, 2)
        burst(round, target.x, target.y, arrow.kind === 'ice' && hit.damage ? '#70dcff' : hit.damage ? SIDE_COPY[target.side].color : '#8fe7ff', 18)
        audio?.play(arrow.kind === 'fire' ? 'weapon' : arrow.kind === 'ice' ? 'shock' : 'collision')
        spentProjectiles.add(arrow.id); break
      }
    }
  }
  round.projectiles = round.projectiles.filter(arrow => !spentProjectiles.has(arrow.id))
  round.pillars = round.pillars.filter(pillar => !projectileBrokenPillars.has(pillar.id))
  updateArenaParticles(round, dt)
  round.wallImpacts.forEach(impact => { impact.life -= dt })
  round.wallImpacts = round.wallImpacts.filter(impact => impact.life > 0)
  round.collisionImpacts.forEach(impact => { impact.life -= dt })
  round.collisionImpacts = round.collisionImpacts.filter(impact => impact.life > 0)
  round.reaperSpins.forEach(spin => { spin.life -= dt })
  round.reaperSpins = round.reaperSpins.filter(spin => spin.life > 0)
}

// Only objects still lying on the arena floor count toward the mode limit.
// Equipped weapons, shields, armor and stored ice arrows live on Fighter and never count here.
function groundItemCount(round: RoundState) {
  return round.pickups.length + round.foods.length + round.potions.length
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

function bumpReflectArmor(round: RoundState, fighter: Fighter) {
  if (!fighter.armor) return
  fighter.armorBumps += 1
  if (fighter.armorBumps < 3) return
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
  drawPixelNumber(ctx, String(Math.max(0, Math.ceil(round.time))).padStart(2, '0'), s * .5, s * .5, s)
  for (const pickup of round.pickups) {
    if (pickup.kind === 'shield') drawPixelShield(ctx, pickup.x * s, pickup.y * s, s * .065)
    else if (pickup.kind === 'armor') drawPixelArmor(ctx, pickup.x * s, pickup.y * s, s * .07)
    else if (pickup.kind === 'pillar') drawPixelLightning(ctx, pickup.x * s, pickup.y * s, s * .052)
    else if (pickup.kind === 'ice-arrow') drawPixelIceArrow(ctx, pickup.x * s, pickup.y * s, s * .075)
    else drawPixelWeapon(ctx, pickup.kind, pickup.x * s, pickup.y * s, -.7, s * .07)
  }
  for (const food of round.foods) drawPixelFood(ctx, food, s)
  for (const potion of round.potions) drawPixelPotion(ctx, potion, s)
  for (const pillar of round.pillars) drawPixelPillar(ctx, pillar, s)
  for (const arrow of round.projectiles) {
    ctx.save(); ctx.translate(arrow.x * s, arrow.y * s); ctx.rotate(Math.atan2(arrow.vy, arrow.vx))
    if (arrow.kind === 'fire') {
      ctx.shadowColor = '#ff210d'; ctx.shadowBlur = s * .025; ctx.lineCap = 'round'; ctx.strokeStyle = '#ff2d17'; ctx.lineWidth = Math.max(5, s * .018); ctx.beginPath(); ctx.moveTo(-s * .105, 0); ctx.lineTo(s * .035, 0); ctx.stroke()
      ctx.shadowBlur = 0; ctx.strokeStyle = '#ffb125'; ctx.lineWidth = Math.max(2, s * .007); ctx.beginPath(); ctx.moveTo(-s * .095, 0); ctx.lineTo(s * .04, 0); ctx.stroke()
    } else {
      ctx.strokeStyle = arrow.kind === 'ice' ? '#7de3ff' : '#fff'; ctx.shadowColor = arrow.kind === 'ice' ? '#32c9ff' : 'transparent'; ctx.shadowBlur = arrow.kind === 'ice' ? s * .018 : 0; ctx.lineWidth = Math.max(2, s * .005); ctx.beginPath(); ctx.moveTo(-s * .025, 0); ctx.lineTo(s * .025, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, -s * .01); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, s * .01); ctx.stroke(); ctx.shadowBlur = 0
    }
    ctx.restore()
  }
  for (const fighter of round.fighters) if (fighter.health > 0) drawFighter(ctx, fighter, s)
  for (const spin of round.reaperSpins) drawReaperSpin(ctx, spin, round, s)
  for (const impact of round.collisionImpacts) drawCollisionImpact(ctx, impact, s)
  for (const p of round.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; const size = Math.max(2, Math.round(s * .009)); ctx.fillRect(Math.round(p.x * s), Math.round(p.y * s), size, size) } ctx.globalAlpha = 1
}

function drawCollisionImpact(ctx: CanvasRenderingContext2D, impact: CollisionImpact, s: number) {
  const progress = 1 - impact.life / .38; const x = impact.x * s; const y = impact.y * s; const radius = s * (.018 + progress * .045) * (.55 + impact.strength)
  ctx.save(); ctx.globalAlpha = (1 - progress) * (.45 + impact.strength * .55); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * .006 * impact.strength); ctx.beginPath(); ctx.arc(x, y, radius, 0, TWO_PI); ctx.stroke()
  ctx.restore()
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
  drawPixelWeapon(ctx, 'reaper', x, y, angle + Math.PI / 2, fighter.radius * s * 1.5)
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

function drawPixelIceArrow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(-Math.PI / 4); ctx.shadowColor = '#32c9ff'; ctx.shadowBlur = size * .35
  ctx.strokeStyle = '#8be7ff'; ctx.lineWidth = Math.max(2, size * .1); ctx.beginPath(); ctx.moveTo(-size * .42, 0); ctx.lineTo(size * .34, 0); ctx.stroke()
  ctx.fillStyle = '#d9f8ff'; ctx.beginPath(); ctx.moveTo(size * .48, 0); ctx.lineTo(size * .2, -size * .18); ctx.lineTo(size * .25, 0); ctx.lineTo(size * .2, size * .18); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = '#62d8ff'; ctx.beginPath(); ctx.moveTo(-size * .3, 0); ctx.lineTo(-size * .44, -size * .16); ctx.moveTo(-size * .3, 0); ctx.lineTo(-size * .44, size * .16); ctx.stroke(); ctx.restore()
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
  const radius = Math.max(5, Math.round(pillar.radius * s * (isPickup ? .68 : .76)))
  ctx.save(); ctx.translate(x, y)
  if (isPickup) { ctx.globalAlpha = .28 + Math.sin(Date.now() / 130) * .1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, radius * 1.5, 0, TWO_PI); ctx.fill(); ctx.globalAlpha = 1 }
  ctx.fillStyle = '#68747b'; ctx.beginPath(); ctx.arc(0, 0, radius, 0, TWO_PI); ctx.fill()
  ctx.fillStyle = '#c6d0d4'; ctx.beginPath(); ctx.arc(-radius * .28, -radius * .28, radius * .3, 0, TWO_PI); ctx.fill()
  ctx.strokeStyle = '#f4f7f8'; ctx.lineWidth = Math.max(2, s * .005); ctx.beginPath(); ctx.arc(0, 0, radius, 0, TWO_PI); ctx.stroke()
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
  const x = Math.round(potion.x * s); const y = Math.round(potion.y * s); const unit = Math.max(2, Math.round(s * .005)); const color = potion.kind === 'speed' ? '#ffd21f' : '#ef123c'
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
  ctx.fillStyle = potion.kind === 'speed' ? '#fff06a' : '#ff4965'; ctx.fillRect(x - unit * 2, y, unit, unit * 2)
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - unit * 2, y - unit, unit, unit)
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
  if (f.stun > 0) { ctx.strokeStyle = '#ffe54d'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = r * .2; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); for (let i = 0; i <= 14; i++) { const angle = i / 14 * TWO_PI; const radius = r * (i % 2 ? 1.12 : 1.25); const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) } ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0 }
  if (f.iceStun > 0) { ctx.fillStyle = '#70dcff33'; ctx.strokeStyle = '#8be7ff'; ctx.shadowColor = '#32c9ff'; ctx.shadowBlur = r * .35; ctx.lineWidth = Math.max(2, r * .1); ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, TWO_PI); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0 }
  if (f.burnTimer > 0) drawFireRing(ctx, x, y, r, 2, 1.12)
  if (f.shield) { ctx.strokeStyle = '#b9f3ff'; ctx.lineWidth = Math.max(2, r * .12); ctx.setLineDash([r * .35, r * .18]); ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (f.armor) { ctx.strokeStyle = '#ffb82e'; ctx.lineWidth = Math.max(3, r * .15); ctx.setLineDash([r * .42, r * .16]); ctx.beginPath(); ctx.arc(x, y, r * 1.3, -.4, Math.PI + .4); ctx.stroke(); ctx.setLineDash([]) }
  if (f.weapon && f.weaponCount > 1 && (f.weapon === 'sword' || f.weapon === 'blade')) {
    const forward = r * 1.2; const side = r * .62; const cos = Math.cos(f.angle); const sin = Math.sin(f.angle)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward - sin * side, y + sin * forward + cos * side, f.angle + .14, r * 1.5)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward + sin * side, y + sin * forward - cos * side, f.angle - .14, r * 1.5)
  } else if (f.weapon) drawPixelWeapon(ctx, f.weapon, x + Math.cos(f.angle) * r * 1.3, y + Math.sin(f.angle) * r * 1.3, f.angle, r * 1.5)
  if (f.weapon === 'bow' && f.iceArrow) drawPixelIceArrow(ctx, x + Math.cos(f.angle) * r * 1.55, y + Math.sin(f.angle) * r * 1.55, r * .8)
  else if (f.iceArrow) drawPixelIceArrow(ctx, x, y - r * 1.55, r * .68)
  ctx.restore()
}
