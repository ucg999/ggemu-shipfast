import arenaStyles from '#/components/red-blue-arena.css?url'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoinRewardPopup } from '#/components/home/coin-rewards'
import { SiteLayout } from '#/components/site-layout'
import { addCoinBalance, readCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { ARENA_BET_OPTIONS, ARENA_MAX_BET, ARENA_MAX_HEALTH, ARENA_ROUND_SECONDS, applyArenaShield, arenaPayout, arenaResult, arenaWeaponDamage, healArenaHealth, weaponCollisionDamage } from '#/lib/red-blue-arena'
import type { ArenaResult, ArenaSide } from '#/lib/red-blue-arena'

export const Route = createFileRoute('/$locale/red-blue-arena')({
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === '1' ? ('1' as const) : undefined,
  }),
  head: () => ({ links: [{ rel: 'stylesheet', href: arenaStyles }], meta: [{ title: '红蓝竞技场｜金币竞猜' }] }),
  component: RedBlueArenaPage,
})

type WeaponKind = 'sword' | 'blade' | 'gun' | 'bow' | 'staff'
type Fighter = { side: ArenaSide; x: number; y: number; vx: number; vy: number; radius: number; health: number; angle: number; cooldown: number; weapon: WeaponKind | null; weaponTimer: number; shield: boolean; speedBoost: number; damageBoost: number; stun: number; burnTimer: number; burnDamage: number }
type Pickup = { id: number; x: number; y: number; kind: WeaponKind | 'shield' | 'pillar'; life: number }
type Food = { id: number; x: number; y: number; life: number }
type Projectile = { id: number; owner: ArenaSide; kind: 'arrow' | 'fire'; x: number; y: number; vx: number; vy: number; life: number; damage: number; bounced: boolean }
type Potion = { id: number; x: number; y: number; kind: 'speed' | 'power'; life: number }
type Pillar = { id: number; x: number; y: number; radius: number; hits: number; charged: boolean }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type WallImpact = { angle: number; life: number; strength: number }
type CollisionImpact = { x: number; y: number; life: number; strength: number }
type RoundState = { fighters: [Fighter, Fighter]; pickups: Pickup[]; foods: Food[]; potions: Potion[]; pillars: Pillar[]; projectiles: Projectile[]; particles: Particle[]; wallImpacts: WallImpact[]; collisionImpacts: CollisionImpact[]; time: number; nextPickup: number; nextFood: number; nextPotion: number; running: boolean }

const TWO_PI = Math.PI * 2
const WEAPON_IMAGE_SOURCES: Record<WeaponKind, string> = { sword: '/images/red-blue-arena/weapons/sword.png', blade: '/images/red-blue-arena/weapons/knife.png', gun: '/images/red-blue-arena/weapons/spear.png', bow: '/images/red-blue-arena/weapons/bow.png', staff: '/images/red-blue-arena/weapons/staff.png' }
const weaponImageCache = new Map<WeaponKind, HTMLImageElement>()

function createRound(): RoundState {
  return {
    fighters: [
      { side: 'red', x: .35, y: .63, vx: .36, vy: -.27, radius: .047, health: ARENA_MAX_HEALTH, angle: 0, cooldown: 0, weapon: null, weaponTimer: 0, shield: false, speedBoost: 0, damageBoost: 0, stun: 0, burnTimer: 0, burnDamage: 0 },
      { side: 'blue', x: .65, y: .37, vx: -.34, vy: .3, radius: .047, health: ARENA_MAX_HEALTH, angle: Math.PI, cooldown: 0, weapon: null, weaponTimer: 0, shield: false, speedBoost: 0, damageBoost: 0, stun: 0, burnTimer: 0, burnDamage: 0 },
    ],
    pickups: [], foods: [], potions: [], pillars: [], projectiles: [], particles: [], wallImpacts: [], collisionImpacts: [], time: ARENA_ROUND_SECONDS, nextPickup: .8 + Math.random() * 1.5, nextFood: 9 + Math.random() * 7, nextPotion: 3 + Math.random() * 5, running: true,
  }
}

function RedBlueArenaPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const { embed } = Route.useSearch()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const roundRef = useRef<RoundState | null>(null)
  const settledRef = useRef(false)
  const [betSide, setBetSide] = useState<ArenaSide>('red')
  const [stake, setStake] = useState(0)
  const [balance, setBalance] = useState(0)
  const [health, setHealth] = useState<[number, number]>([ARENA_MAX_HEALTH, ARENA_MAX_HEALTH])
  const [time, setTime] = useState(ARENA_ROUND_SECONDS)
  const [phase, setPhase] = useState<'betting' | 'running' | 'result'>('betting')
  const [result, setResult] = useState<ArenaResult | null>(null)
  const [message, setMessage] = useState('选择阵营和投注额，见证自动对战！')
  const [feedback, setFeedback] = useState<{ amount: number; id: number; prefix: '+' | '×' } | null>(null)

  useEffect(() => setBalance(readCoinBalance()), [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || phase === 'running') return
    resizeCanvas(canvas)
    drawRound(canvas, context, roundRef.current ?? createRound())
  }, [phase])

  const settle = useCallback((finalResult: ArenaResult) => {
    if (settledRef.current) return
    settledRef.current = true
    if (roundRef.current) roundRef.current.running = false
    const payout = arenaPayout(betSide, finalResult, stake)
    const nextBalance = payout > 0 ? addCoinBalance(payout) : readCoinBalance()
    setBalance(nextBalance)
    setResult(finalResult)
    setPhase('result')
    if (finalResult === 'draw') setMessage(`平局，退回 ${stake} 金币`)
    else if (finalResult === betSide) setMessage(`竞猜成功！赢得 ${payout - stake} 金币`)
    else setMessage(`竞猜失败，${finalResult === 'red' ? '红方' : '蓝方'}获胜`)
    if (payout > 0) setFeedback({ amount: payout, id: Date.now(), prefix: '+' })
  }, [betSide, stake])

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
      updateRound(round, dt)
      drawRound(canvas, context, round)
      uiClock += dt
      if (uiClock > .12) {
        uiClock = 0
        setHealth([Math.max(0, round.fighters[0].health), Math.max(0, round.fighters[1].health)])
        setTime(Math.max(0, Math.ceil(round.time)))
      }
      const [red, blue] = round.fighters
      if (red.health <= 0 || blue.health <= 0 || round.time <= 0) {
        const finalRedHealth = Math.max(0, red.health); const finalBlueHealth = Math.max(0, blue.health)
        setHealth([finalRedHealth, finalBlueHealth])
        settle(arenaResult(finalRedHealth, finalBlueHealth))
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
    if (stake < 1) {
      setMessage('请先选择投注金币。')
      return
    }
    if (!spendCoinBalance(stake)) {
      setMessage('金币不足，请先在站内获取金币。')
      return
    }
    settledRef.current = false
    roundRef.current = createRound()
    setBalance(readCoinBalance())
    setHealth([ARENA_MAX_HEALTH, ARENA_MAX_HEALTH])
    setTime(ARENA_ROUND_SECONDS)
    setResult(null)
    setFeedback(null)
    setMessage(`已投注 ${stake} 金币，支持${betSide === 'red' ? '红方' : '蓝方'}！`)
    setPhase('running')
  }

  function resetBetting() {
    roundRef.current = null
    settledRef.current = false
    setPhase('betting')
    setResult(null)
    setHealth([ARENA_MAX_HEALTH, ARENA_MAX_HEALTH])
    setTime(ARENA_ROUND_SECONDS)
    setMessage('选择阵营和投注额，开始下一局。')
  }

  const content = <main className={`arena-page arena-page-${phase}${embed === '1' ? ' arena-page-embed' : ''}`}><section className="arena-shell">
    <div className="arena-header mb-2 flex items-center justify-between gap-3"><div>{embed !== '1' ? <Link to="/$locale/original-games" params={{ locale: lang }} className="arena-back text-xs text-white/55">← 原创游戏（内测版）</Link> : null}<h1 className="arena-title text-xl font-black sm:text-3xl">红蓝竞技场</h1></div><div className="arena-balance rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-sm font-black text-yellow-300">🪙 {balance}</div></div>
    <div className="arena-score"><div className="arena-team"><i className="arena-orb arena-orb-red" />{Array.from({ length: ARENA_MAX_HEALTH }, (_, i) => <span key={i} className="arena-heart">{i < health[0] ? '♥' : '♡'}</span>)}</div><strong className="arena-top-timer rounded-full bg-white/10 px-3 py-1 tabular-nums">{time}s</strong><div className="arena-team">{Array.from({ length: ARENA_MAX_HEALTH }, (_, i) => <span key={i} className="arena-heart arena-heart-blue">{i >= ARENA_MAX_HEALTH - health[1] ? '♥' : '♡'}</span>)}<i className="arena-orb arena-orb-blue" /></div></div>
    <div className="text-center font-mono text-xl font-black uppercase tracking-widest sm:text-2xl"><span className="text-red-400">Red</span><span className="mx-3 text-white/75">VS</span><span className="text-blue-400">Blue</span></div>
    <div className="arena-canvas-wrap"><canvas ref={canvasRef} className="arena-canvas" aria-label="红蓝双方自动战斗的圆形竞技场" />{phase !== 'running' && <div className="arena-overlay"><div className="arena-overlay-card"><div className="arena-result-mark mb-2 text-4xl">{result === 'red' ? '🔴' : result === 'blue' ? '🔵' : result === 'draw' ? '🤝' : '⚔️'}</div><strong className="text-xl">{result ? result === 'draw' ? '平局' : `${result === 'red' ? '红方' : '蓝方'}胜利` : '等待开战'}</strong><p className="mt-2 text-sm text-white/65">{message}</p></div></div>}</div>
    {phase === 'betting' ? <div className="arena-bet-panel"><div className="arena-choice"><button className="arena-red-btn" data-active={betSide === 'red'} onClick={() => setBetSide('red')}>🔴 投小红</button><button className="arena-blue-btn" data-active={betSide === 'blue'} onClick={() => setBetSide('blue')}>🔵 投小蓝</button></div><div className="arena-stakes">{ARENA_BET_OPTIONS.map(value => <button key={value} data-active="false" disabled={stake + value > balance || stake + value > ARENA_MAX_BET} onClick={() => setStake(current => Math.min(ARENA_MAX_BET, current + value))}>+ 🪙 {value}</button>)}</div><div className="arena-bet-total flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-sm"><strong className="text-yellow-300">累计投注：🪙 {stake} / {ARENA_MAX_BET}</strong><button className="text-white/60 underline" disabled={stake === 0} onClick={() => setStake(0)}>清空投注</button></div><button className="arena-start" disabled={stake < 1 || balance < stake} onClick={startRound}>{stake < 1 ? '请选择投注额' : balance < stake ? '金币不足' : `投注 ${stake} 金币并开始`}</button></div> : phase === 'result' ? <div className="arena-bet-panel"><button className="arena-start" onClick={resetBetting}>再来一局</button></div> : null}
    <CoinRewardPopup feedback={feedback} />
  </section></main>

  return embed === '1' ? content : <SiteLayout locale={lang} hideFooter>{content}</SiteLayout>
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const size = canvas.clientWidth < 420 ? 320 : 400
  if (canvas.width !== size) { canvas.width = size; canvas.height = size }
}

function equipWeapon(fighter: Fighter, weapon: WeaponKind) {
  if (fighter.weapon === 'blade' && weapon !== 'blade') { fighter.vx *= .5; fighter.vy *= .5 }
  if (fighter.weapon !== 'blade' && weapon === 'blade') { fighter.vx *= 2; fighter.vy *= 2 }
  fighter.weapon = weapon
  fighter.weaponTimer = weapon === 'bow' ? .55 : weapon === 'staff' ? .7 : 0
}

function consumeWeapon(fighter: Fighter) {
  if (fighter.weapon === 'blade') { fighter.vx *= .5; fighter.vy *= .5 }
  fighter.weapon = null
  fighter.weaponTimer = 0
}

function updateRound(round: RoundState, dt: number) {
  round.time -= dt
  round.nextPickup -= dt
  round.nextFood -= dt
  round.nextPotion -= dt
  const [a, b] = round.fighters
  for (const [index, fighter] of round.fighters.entries()) {
    fighter.cooldown = Math.max(0, fighter.cooldown - dt)
    fighter.weaponTimer = Math.max(0, fighter.weaponTimer - dt)
    fighter.stun = Math.max(0, fighter.stun - dt)
    const previousBurnTimer = fighter.burnTimer
    fighter.burnTimer = Math.max(0, fighter.burnTimer - dt)
    if (previousBurnTimer > 0 && fighter.burnTimer === 0 && fighter.burnDamage > 0) {
      fighter.health = Math.max(0, fighter.health - fighter.burnDamage); fighter.burnDamage = 0
      burst(round, fighter.x, fighter.y, fighter.side === 'red' ? '#ff294d' : '#4590ff', 16)
    }
    const previousSpeedBoost = fighter.speedBoost
    fighter.speedBoost = Math.max(0, fighter.speedBoost - dt)
    fighter.damageBoost = Math.max(0, fighter.damageBoost - dt)
    if (previousSpeedBoost > 0 && fighter.speedBoost === 0) { fighter.vx *= .5; fighter.vy *= .5 }
    if ((fighter.weapon === 'bow' || fighter.weapon === 'staff') && fighter.weaponTimer <= 0) {
      const target = round.fighters[index === 0 ? 1 : 0]
      const dx = target.x - fighter.x; const dy = target.y - fighter.y; const distance = Math.hypot(dx, dy) || 1
      const projectileKind = fighter.weapon === 'staff' ? 'fire' : 'arrow'; const speed = projectileKind === 'fire' ? .82 : .95
      round.projectiles.push({ id: Date.now() + Math.random(), owner: fighter.side, kind: projectileKind, x: fighter.x, y: fighter.y, vx: dx / distance * speed, vy: dy / distance * speed, life: ARENA_ROUND_SECONDS, damage: arenaWeaponDamage(projectileKind === 'fire' ? 'staff' : 'bow') * (fighter.damageBoost > 0 ? 2 : 1), bounced: false })
      consumeWeapon(fighter)
      burst(round, fighter.x, fighter.y, '#ffffff', 6)
    }
    if (fighter.stun > 0) continue
    // Marble movement stays on one straight vector until a collision changes it.
    const speed = Math.hypot(fighter.vx, fighter.vy)
    const maxSpeed = fighter.speedBoost > 0 ? 2.25 : 1.25
    const minSpeed = fighter.speedBoost > 0 ? .24 : .12
    if (speed > maxSpeed) { fighter.vx *= maxSpeed / speed; fighter.vy *= maxSpeed / speed }
    else if (speed < minSpeed && speed > 0) { fighter.vx *= minSpeed / speed; fighter.vy *= minSpeed / speed }
    fighter.x += fighter.vx * dt; fighter.y += fighter.vy * dt; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
    const cx = fighter.x - .5; const cy = fighter.y - .5; const edge = Math.hypot(cx, cy)
    if (edge > .43) {
      const nx = cx / edge; const ny = cy / edge
      fighter.x = .5 + nx * .43; fighter.y = .5 + ny * .43
      const dot = fighter.vx * nx + fighter.vy * ny
      fighter.vx -= 2 * dot * nx; fighter.vy -= 2 * dot * ny
      fighter.vx *= 1.05; fighter.vy *= 1.05
      round.wallImpacts.push({ angle: Math.atan2(ny, nx), life: 1.05, strength: .01 + Math.abs(dot) * .02 })
      burst(round, fighter.x, fighter.y, '#ffffff', 9)
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
        if (pillar.charged) {
          const hit = applyArenaShield(1, fighter.shield)
          fighter.shield = hit.shield; fighter.health = Math.max(0, fighter.health - hit.damage)
          fighter.vx *= .5; fighter.vy *= .5; fighter.stun = .35; pillar.charged = false
          burst(round, fighter.x, fighter.y, '#ffe54d', 24)
        }
        pillar.hits -= 1
        burst(round, pillar.x + nx * pillar.radius, pillar.y + ny * pillar.radius, '#d7e0e5', pillar.hits > 0 ? 10 : 28)
        if (pillar.hits <= 0) brokenPillars.add(pillar.id)
      }
    }
  }
  round.pillars = round.pillars.filter(pillar => !brokenPillars.has(pillar.id))
  const dx = b.x - a.x; const dy = b.y - a.y; const distance = Math.hypot(dx, dy) || .001
  if (distance < a.radius + b.radius) {
    const nx = dx / distance; const ny = dy / distance; const overlap = a.radius + b.radius - distance
    a.x -= nx * overlap / 2; a.y -= ny * overlap / 2; b.x += nx * overlap / 2; b.y += ny * overlap / 2
    const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
    if (relative < 0) {
      a.vx += relative * nx; a.vy += relative * ny
      b.vx -= relative * nx; b.vy -= relative * ny
      const strength = Math.min(1, Math.abs(relative) / 1.4)
      const impactX = (a.x + b.x) / 2; const impactY = (a.y + b.y) / 2
      round.collisionImpacts.push({ x: impactX, y: impactY, life: .38, strength })
      if (!a.weapon && !b.weapon) {
        burst(round, impactX - nx * .01, impactY - ny * .01, '#ff3655', 4 + Math.round(strength * 6))
        burst(round, impactX + nx * .01, impactY + ny * .01, '#4695ff', 4 + Math.round(strength * 6))
      }
    }
    if (a.cooldown <= 0 && b.cooldown <= 0) {
      const baseDamage = weaponCollisionDamage(a.weapon, b.weapon)
      const damage = { red: baseDamage.red * (b.damageBoost > 0 ? 2 : 1), blue: baseDamage.blue * (a.damageBoost > 0 ? 2 : 1) }
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
        if (damage.blue) consumeWeapon(a)
        if (damage.red) consumeWeapon(b)
      }
    }
  }
  if (round.nextPickup <= 0 && arenaItemCount(round) < 2) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .29
    const kinds: Pickup['kind'][] = ['sword', 'blade', 'gun', 'bow', 'staff', 'sword', 'blade', 'gun', 'bow', 'staff', 'shield', 'pillar']
    round.pickups.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 12 + Math.random() * 8 })
    round.nextPickup = 1.2 + Math.random() * 3.8
  }
  const collected = new Set<number>()
  for (const pickup of round.pickups) {
    pickup.life -= dt
    for (const fighter of round.fighters) if (Math.hypot(fighter.x - pickup.x, fighter.y - pickup.y) < .08 && (pickup.kind !== 'shield' || !fighter.shield)) {
      if (pickup.kind === 'shield') fighter.shield = true
      else if (pickup.kind === 'pillar') {
        const angle = Math.random() * TWO_PI; const radius = .1 + Math.random() * .2
        round.pillars.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, radius: .038, hits: 3, charged: true })
      }
      else equipWeapon(fighter, pickup.kind)
      collected.add(pickup.id); burst(round, pickup.x, pickup.y, pickup.kind === 'shield' ? '#8fe7ff' : pickup.kind === 'pillar' ? '#d7e0e5' : '#fde047', 14); break
    }
  }
  round.pickups = round.pickups.filter(pickup => pickup.life > 0 && !collected.has(pickup.id))
  if (round.nextFood <= 0 && arenaItemCount(round) < 2) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .27
    round.foods.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, life: 14 })
    round.nextFood = 12 + Math.random() * 10
  }
  const eaten = new Set<number>()
  for (const food of round.foods) {
    food.life -= dt
    for (const fighter of round.fighters) if (fighter.health < ARENA_MAX_HEALTH && Math.hypot(fighter.x - food.x, fighter.y - food.y) < .075) {
      fighter.health = healArenaHealth(fighter.health); eaten.add(food.id); burst(round, food.x, food.y, '#ff5a24', 16); break
    }
  }
  round.foods = round.foods.filter(food => food.life > 0 && !eaten.has(food.id))
  if (round.nextPotion <= 0 && arenaItemCount(round) < 2) {
    const angle = Math.random() * TWO_PI; const radius = Math.sqrt(Math.random()) * .27
    round.potions.push({ id: Date.now() + Math.random(), x: .5 + Math.cos(angle) * radius, y: .5 + Math.sin(angle) * radius, kind: Math.random() < .5 ? 'speed' : 'power', life: 14 })
    round.nextPotion = 5 + Math.random() * 8
  }
  const usedPotions = new Set<number>()
  for (const potion of round.potions) {
    potion.life -= dt
    for (const fighter of round.fighters) if (Math.hypot(fighter.x - potion.x, fighter.y - potion.y) < .075) {
      if (potion.kind === 'speed') {
        if (fighter.speedBoost <= 0) { fighter.vx *= 2; fighter.vy *= 2 }
        fighter.speedBoost = 6
      } else fighter.damageBoost = 7
      usedPotions.add(potion.id); burst(round, potion.x, potion.y, potion.kind === 'speed' ? '#ffd84a' : '#ff4b55', 18); break
    }
  }
  round.potions = round.potions.filter(potion => potion.life > 0 && !usedPotions.has(potion.id))
  const spentProjectiles = new Set<number>()
  for (const arrow of round.projectiles) {
    arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt
    const cx = arrow.x - .5; const cy = arrow.y - .5; const edge = Math.hypot(cx, cy)
    if (edge > .43) {
      const nx = cx / edge; const ny = cy / edge; arrow.x = .5 + nx * .43; arrow.y = .5 + ny * .43
      const dot = arrow.vx * nx + arrow.vy * ny; arrow.vx -= 2 * dot * nx; arrow.vy -= 2 * dot * ny
      arrow.bounced = true
      round.wallImpacts.push({ angle: Math.atan2(ny, nx), life: .65, strength: .01 })
    }
    const targets = arrow.bounced ? round.fighters : round.fighters.filter(fighter => fighter.side !== arrow.owner)
    for (const target of targets) {
      if (Math.hypot(arrow.x - target.x, arrow.y - target.y) < target.radius + (arrow.kind === 'fire' ? .026 : .018)) {
        const hit = applyArenaShield(arrow.damage, target.shield); target.shield = hit.shield; target.health = Math.max(0, target.health - hit.damage)
        if (hit.damage > 0) { target.vx *= .82; target.vy *= .82 }
        if (hit.damage > 0 && arrow.kind === 'fire') { target.burnTimer = 3; target.burnDamage = arrow.damage }
        burst(round, target.x, target.y, hit.damage ? (target.side === 'red' ? '#ff294d' : '#4590ff') : '#8fe7ff', 18)
        spentProjectiles.add(arrow.id); break
      }
    }
  }
  round.projectiles = round.projectiles.filter(arrow => !spentProjectiles.has(arrow.id))
  round.particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vy += .12 * dt })
  round.particles = round.particles.filter(p => p.life > 0)
  round.wallImpacts.forEach(impact => { impact.life -= dt })
  round.wallImpacts = round.wallImpacts.filter(impact => impact.life > 0)
  round.collisionImpacts.forEach(impact => { impact.life -= dt })
  round.collisionImpacts = round.collisionImpacts.filter(impact => impact.life > 0)
}

function arenaItemCount(round: RoundState) {
  return round.pickups.length + round.foods.length + round.potions.length
}

function burst(round: RoundState, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) { const angle = Math.random() * TWO_PI; const speed = .06 + Math.random() * .22; round.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .35 + Math.random() * .5, color }) }
}

function drawRound(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, round: RoundState) {
  const s = canvas.width; ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s)
  const segments = 144
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#f1f5f2'; ctx.lineWidth = Math.max(2, s * .006); ctx.lineJoin = 'miter'; ctx.beginPath()
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * TWO_PI
    let radius = .455 + (Math.sin(i * 2.37) + Math.sin(i * 5.13)) * .0015
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
    else if (pickup.kind === 'pillar') drawPixelLightning(ctx, pickup.x * s, pickup.y * s, s * .052)
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
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * .005); ctx.beginPath(); ctx.moveTo(-s * .025, 0); ctx.lineTo(s * .025, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, -s * .01); ctx.moveTo(s * .025, 0); ctx.lineTo(s * .012, s * .01); ctx.stroke()
    }
    ctx.restore()
  }
  for (const fighter of round.fighters) drawFighter(ctx, fighter, s)
  for (const impact of round.collisionImpacts) drawCollisionImpact(ctx, impact, s)
  for (const p of round.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; const size = Math.max(2, Math.round(s * .009)); ctx.fillRect(Math.round(p.x * s), Math.round(p.y * s), size, size) } ctx.globalAlpha = 1
}

function drawCollisionImpact(ctx: CanvasRenderingContext2D, impact: CollisionImpact, s: number) {
  const progress = 1 - impact.life / .38; const x = impact.x * s; const y = impact.y * s; const radius = s * (.018 + progress * .045) * (.55 + impact.strength)
  ctx.save(); ctx.globalAlpha = (1 - progress) * (.45 + impact.strength * .55); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, s * .006 * impact.strength); ctx.beginPath(); ctx.arc(x, y, radius, 0, TWO_PI); ctx.stroke()
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
  const x = Math.round(potion.x * s); const y = Math.round(potion.y * s); const unit = Math.max(1.8, s * .006); const color = potion.kind === 'speed' ? '#ffd32f' : '#ff354d'
  ctx.fillStyle = '#e8f4ff'; ctx.fillRect(x - unit, y - unit * 4, unit * 3, unit * 2)
  ctx.fillStyle = color; ctx.fillRect(x - unit * 3, y - unit * 2, unit * 7, unit * 5); ctx.fillRect(x - unit * 2, y + unit * 3, unit * 5, unit)
  ctx.fillStyle = '#ffffffaa'; ctx.fillRect(x - unit * 2, y - unit, unit, unit * 2)
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
  const x = f.x * s; const y = f.y * s; const r = f.radius * s; const color = f.side === 'red' ? '#ef233c' : '#3987ff'
  ctx.save(); ctx.fillStyle = '#090c0c'; ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * .18); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(r), 0, TWO_PI); ctx.fill(); ctx.stroke()
  const eyeSize = Math.max(2, Math.round(r * .18)); const eyeShift = Math.sin(performance.now() / 260 + (f.side === 'red' ? 0 : .8)) * r * .1
  ctx.fillStyle = color; ctx.fillRect(Math.round(x - r * .35 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize); ctx.fillRect(Math.round(x + r * .18 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize)
  if (f.speedBoost > 0 || f.damageBoost > 0) { ctx.strokeStyle = f.damageBoost > 0 ? '#ff354d' : '#ffd32f'; ctx.lineWidth = Math.max(2, r * .1); ctx.globalAlpha = .65 + Math.sin(performance.now() / 100) * .25; ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, TWO_PI); ctx.stroke(); ctx.globalAlpha = 1 }
  if (f.stun > 0) { ctx.strokeStyle = '#ffe54d'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = r * .2; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); for (let i = 0; i <= 14; i++) { const angle = i / 14 * TWO_PI; const radius = r * (i % 2 ? 1.12 : 1.25); const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) } ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0 }
  if (f.burnTimer > 0) drawFireRing(ctx, x, y, r, 2, 1.12)
  if (f.shield) { ctx.strokeStyle = '#b9f3ff'; ctx.lineWidth = Math.max(2, r * .12); ctx.setLineDash([r * .35, r * .18]); ctx.beginPath(); ctx.arc(x, y, r * 1.35, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (f.weapon) drawPixelWeapon(ctx, f.weapon, x + Math.cos(f.angle) * r * 1.3, y + Math.sin(f.angle) * r * 1.3, f.angle, r * 1.5)
  ctx.restore()
}
