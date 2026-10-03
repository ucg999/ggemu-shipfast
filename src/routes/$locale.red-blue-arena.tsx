import arenaStyles from '#/components/red-blue-arena.css?url'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CoinRewardPopup } from '#/components/home/coin-rewards'
import { CoinChallengeCommunity } from '#/components/coin-challenge-community'
import { SiteLayout } from '#/components/site-layout'
import { MemberRequiredNotice } from '#/components/member-required-notice'
import { addCoinBalance, readSpendableCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { ARENA_BET_OPTIONS, ARENA_MAX_HEALTH, arenaPayout, arenaWeaponDamage, healArenaHealth } from '#/lib/red-blue-arena'
import type { ArenaResult, ArenaSide } from '#/lib/red-blue-arena'
import type { ArenaAudio } from '#/lib/red-blue-arena-audio'
import { useRequiredMemberAccess } from '#/lib/member-client'

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
type ArenaMode = 'duel' | 'three' | 'four' | 'team' | 'team3' | 'billiards'
type Fighter = { id: number; side: ArenaSide; team: ArenaSide; active: boolean; reinforcementCalled: boolean; x: number; y: number; vx: number; vy: number; radius: number; health: number; respawnTimer: number; angle: number; cooldown: number; weapon: WeaponKind | null; weaponCount: number; weaponTimer: number; rangedFired: boolean; laserCharging: boolean; elementAmmo: AmmoKind[]; bowRapidFire: boolean; shield: boolean; shieldBumps: number; shieldArrowHits: number; armor: boolean; speedBoost: number; damageBoost: number; slowTimer: number; slowStacks: number; stun: number; clashLaunchTimer: number; hammerBouncesRemaining: number; knockoutTimer: number; knockoutBrokeWall: boolean; burnTimer: number; burnDamage: number; burnSpread: boolean; poisonTimer: number; poisonTicks: number }
type Pickup = { id: number; x: number; y: number; kind: WeaponKind | 'shield' | 'armor' | 'pillar'; life: number; pocketReward?: boolean }
type Food = { id: number; x: number; y: number; life: number; pocketReward?: boolean }
type Projectile = { id: number; owner: number; ownerTeam: ArenaSide; kind: 'arrow' | 'magic'; element: ElementKind | null; x: number; y: number; vx: number; vy: number; life: number; damage: number; bounced: boolean }
type LaserSegment = { x1: number; y1: number; x2: number; y2: number }
type Laser = { id: number; segments: LaserSegment[]; life: number; color: string; width: number }
type Potion = { id: number; x: number; y: number; kind: PotionKind; life: number; pocketReward?: boolean }
type Pillar = { id: number; x: number; y: number; radius: number; hits: number; charged: boolean }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }
type WallImpact = { angle: number; life: number; strength: number }
type RingBreak = { angle: number; life: number }
type CollisionImpact = { x: number; y: number; life: number; strength: number; clash?: boolean }
type ReaperSpin = { owner: number; life: number; startAngle: number; kind: WeaponKind }
type WeaponClash = { firstId: number; secondId: number; winnerId: number; loserId: number; time: number; duration: number; damage: number; shieldCounter: boolean; winnerWeapon: WeaponKind; loserWeapon: WeaponKind; firstVx: number; firstVy: number; secondVx: number; secondVy: number }
type BilliardBall = { id: number; number: number; x: number; y: number; vx: number; vy: number; radius: number; active: boolean; lastHitTeam: ArenaSide | null; lastHitFighterId: number | null; unstoppable: boolean }
type RoundState = { mode: ArenaMode; fighters: Fighter[]; billiards: BilliardBall[]; billiardScores: Record<'red' | 'blue', number>; nextBilliardNumber: number; billiardWinner: ArenaSide | null; pickups: Pickup[]; foods: Food[]; potions: Potion[]; pillars: Pillar[]; projectiles: Projectile[]; lasers: Laser[]; particles: Particle[]; wallImpacts: WallImpact[]; ringBreaks: RingBreak[]; collisionImpacts: CollisionImpact[]; reaperSpins: ReaperSpin[]; weaponClashes: WeaponClash[]; reverseSweepTeams: ArenaSide[]; time: number; nextPickup: number; nextFood: number; nextPotion: number; running: boolean; deathAnimation: number | null; finalRush: boolean }

const TWO_PI = Math.PI * 2
const ARENA_BASE_SPEED = .44
const ARENA_PRE_RUSH_MAX_SPEED = ARENA_BASE_SPEED * 3
const ARENA_RUSH_MAX_SPEED = ARENA_BASE_SPEED * 6
const ARENA_MAX_PARTICLES = 520
const ARENA_MAX_WALL_IMPACTS = 24
const ARENA_MAX_COLLISION_IMPACTS = 18
const TABLE_LEFT = .255
const TABLE_RIGHT = .745
const TABLE_TOP = .01
const TABLE_BOTTOM = .99
const WEAPON_IMAGE_SOURCES: Record<WeaponKind, string> = { sword: '/images/red-blue-arena/weapons/sword.png', blade: '/images/red-blue-arena/weapons/knife.png', axe: '/images/red-blue-arena/weapons/axe.png', reaper: '/images/red-blue-arena/weapons/reaper.png', bow: '/images/red-blue-arena/weapons/bow.png', staff: '/images/red-blue-arena/weapons/staff.png', hammer: '/images/red-blue-arena/weapons/hammer.png' }
const weaponImageCache = new Map<WeaponKind, HTMLImageElement>()

const MODE_RULES: Record<ArenaMode, { label: string; minBet: number; maxBet: number; profit: number; seconds: number; itemLimit: number; sides: ArenaSide[] }> = {
  duel: { label: '双球模式', minBet: 1, maxBet: 100, profit: 1, seconds: 60, itemLimit: 2, sides: ['red', 'blue'] },
  three: { label: '三球模式', minBet: 10, maxBet: 200, profit: 2, seconds: 120, itemLimit: 3, sides: ['red', 'blue', 'yellow'] },
  four: { label: '四球模式', minBet: 10, maxBet: 500, profit: 3, seconds: 180, itemLimit: 3, sides: ['red', 'blue', 'yellow', 'green'] },
  team: { label: '2V2 红蓝', minBet: 10, maxBet: 1000, profit: 1, seconds: 120, itemLimit: 3, sides: ['red', 'blue'] },
  team3: { label: '3V3组队战', minBet: 10, maxBet: 1000, profit: 1, seconds: 60, itemLimit: 3, sides: ['red', 'blue'] },
  billiards: { label: '桌球模式', minBet: 1, maxBet: 100, profit: 1, seconds: 60, itemLimit: 1, sides: ['red', 'blue'] },
}

function settlesAfterBattle(mode: ArenaMode) {
  return mode === 'team' || mode === 'team3' || mode === 'billiards'
}

function requiredStartingBalance(mode: ArenaMode, stake: number) {
  if (mode === 'team') return stake * 2
  if (mode === 'team3') return stake * 3
  if (mode === 'billiards') return stake * 9
  return stake
}
const SIDE_COPY: Record<ArenaSide, { name: string; color: string; emoji: string }> = {
  red: { name: '小红', color: '#ef233c', emoji: '🔴' }, blue: { name: '小蓝', color: '#3987ff', emoji: '🔵' },
  yellow: { name: '小黄', color: '#f5d328', emoji: '🟡' }, green: { name: '小绿', color: '#35c96f', emoji: '🟢' },
  pink: { name: '小粉', color: '#ff69b4', emoji: '🩷' }, orange: { name: '小橙', color: '#ff8a24', emoji: '🟠' },
}
const ELEMENT_COLORS: Record<ElementKind, string> = { fire: '#ff354d', water: '#38bdf8', electric: '#ffe13b', poison: '#a855f7' }
const AMMO_COLORS: Record<AmmoKind, string> = { ...ELEMENT_COLORS, normal: '#ffffff' }
const POTION_COLORS: Record<PotionKind, string> = { ...ELEMENT_COLORS, 'normal-ammo': '#ffffff', 'speed-boost': '#ffc400', 'damage-boost': '#e51032' }
const WEAPON_HELP = [
  ['💥', '近战对拼：计算红药与双持攻击力；持盾必胜并反击；同伤对拼2秒后随机决胜'],
  ['🗡️', '小刀：1伤害，持有时速度×2，可双持或搭配盾'], ['⚔️', '剑：2伤害，可双持或搭配盾'],
  ['🪓', '斧头：3伤害'], ['☠️', '死神刀：4总伤害，旋转群攻并由范围内敌人平分，持有时速度减半'],
  ['🔨', '晕锤：与任何近战武器均为50%胜率；获胜保留眩晕与10%出圈秒杀，失败不会被击退'],
  ['⚔️', '剑可停下挥动，击碎靠近的箭'],
  ['🏹', '弓：快速射箭；累计5发后停在原地完成连射；被近战碰到会碎裂受伤并击退'], ['🔮', '法杖：累计5发释放穿柱激光；被近战碰到会碎裂受伤并击退'],
  ['🛡️', '盾：直接持在手上；近战对拼必胜反击；单手剑/刀可搭配，双持或双手武器会弃盾'],
  ['🪞', '铠甲：挡1次近战；白箭无伤且不碎甲；属性箭碎甲受伤；魔法球双倍伤害'],
] as const
const ITEM_HELP = [
  ['🍊', '果实：回复1格，并解除灼伤和中毒'], ['🔴', '红瓶：可预先累计一发火属性弹'],
  ['🔵', '蓝瓶：可预先累计一发水属性弹'], ['🟡', '黄瓶：可预先累计一发电属性弹'],
  ['🟣', '紫瓶：毒属性弹；每10秒掉1血，吃果实才解毒'], ['💥', '属性弹：基础1伤害；命中反伤甲翻倍，防具会碎掉'],
  ['⚪', '白瓶：普通弹药＋3；白激光可被盾和反伤甲反弹'],
  ['✨', '弹道：箭互撞会碎；魔法给箭叠加属性伤害；白魔法使箭分裂'],
  ['⚔️', '红色强化瓶：伤害×2，持续3秒'], ['💨', '黄色强化瓶：速度×2，持续3秒'],
  ['⚡', '闪电墙：有盾或铠甲时伤害翻倍，并同时粉碎全部防具'],
] as const

function contestantName(mode: ArenaMode, side: ArenaSide) {
  if (mode === 'team3') return side === 'red' ? '红队' : '蓝队'
  return SIDE_COPY[side].name
}

function makeFighter(id: number, side: ArenaSide, x: number, y: number, vx: number, vy: number, team: ArenaSide = side, active = true): Fighter {
  return { id, side, team, active, reinforcementCalled: false, x, y, vx, vy, radius: .047, health: ARENA_MAX_HEALTH, respawnTimer: 0, angle: Math.atan2(vy, vx), cooldown: 0, weapon: null, weaponCount: 0, weaponTimer: 0, rangedFired: false, laserCharging: false, elementAmmo: [], bowRapidFire: false, shield: false, shieldBumps: 0, shieldArrowHits: 0, armor: false, speedBoost: 0, damageBoost: 0, slowTimer: 0, slowStacks: 0, stun: 0, clashLaunchTimer: 0, hammerBouncesRemaining: 0, knockoutTimer: 0, knockoutBrokeWall: false, burnTimer: 0, burnDamage: 0, burnSpread: false, poisonTimer: 0, poisonTicks: 0 }
}

function createNineBallRack(): BilliardBall[] {
  const positions = [
    [.5, .24], [.472, .292], [.528, .292], [.444, .344], [.5, .344], [.556, .344], [.472, .396], [.528, .396], [.5, .448],
  ]
  return positions.map(([x, y], index) => ({ id: index + 1, number: index + 1, x, y, vx: 0, vy: 0, radius: .024, active: true, lastHitTeam: null, lastHitFighterId: null, unstoppable: false }))
}

function BilliardScoreBall({ number }: { number: number }) {
  return <i className="grid h-6 w-6 place-items-center rounded-full border border-white bg-white text-[9px] font-black not-italic text-black shadow-[0_0_5px_currentColor]" style={{ color: billiardColor(number), background: `radial-gradient(circle at center, #fff 0 38%, ${billiardColor(number)} 40% 100%)` }}>{number}</i>
}

function createRound(mode: ArenaMode = 'duel'): RoundState {
  const fighters = mode === 'team'
    ? [makeFighter(0, 'red', .3, .42, .36, -.27), makeFighter(1, 'blue', .7, .36, -.34, .3), makeFighter(2, 'red', .34, .68, .31, .3), makeFighter(3, 'blue', .66, .64, -.32, -.29)]
    : mode === 'team3'
      ? [makeFighter(0, 'red', .28, .5, .4, 0, 'red'), makeFighter(1, 'blue', .72, .5, -.4, 0, 'blue'), makeFighter(2, 'yellow', -.2, .42, 0, 0, 'red', false), makeFighter(3, 'green', 1.2, .42, 0, 0, 'blue', false), makeFighter(4, 'pink', -.2, .62, 0, 0, 'red', false), makeFighter(5, 'orange', 1.2, .62, 0, 0, 'blue', false)]
    : mode === 'billiards'
      ? [makeFighter(0, 'red', .43, .78, .12, -.4), makeFighter(1, 'blue', .57, .78, -.12, -.4)]
      : MODE_RULES[mode].sides.map((side, index, sides) => { const angle = index / sides.length * TWO_PI + .35; return makeFighter(index, side, .5 + Math.cos(angle) * .2, .5 + Math.sin(angle) * .2, -Math.sin(angle) * .4, Math.cos(angle) * .4) })
  for (const fighter of fighters) {
    if (!fighter.active) continue
    if (mode === 'billiards') { fighter.health = 5; fighter.radius = .036 }
    const dx = .5 - fighter.x; const dy = .5 - fighter.y; const distance = Math.hypot(dx, dy) || 1
    const openingSpeed = mode === 'billiards' ? ARENA_BASE_SPEED * 2.65 : ARENA_BASE_SPEED * 2
    fighter.vx = mode === 'billiards' ? 0 : dx / distance * openingSpeed
    fighter.vy = mode === 'billiards' ? -openingSpeed : dy / distance * openingSpeed
    fighter.angle = Math.atan2(fighter.vy, fighter.vx)
  }
  return {
    mode, fighters, billiards: mode === 'billiards' ? createNineBallRack() : [], billiardScores: { red: 0, blue: 0 }, nextBilliardNumber: 1, billiardWinner: null,
    pickups: [], foods: [], potions: [], pillars: [], projectiles: [], lasers: [], particles: [], wallImpacts: [], ringBreaks: [], collisionImpacts: [], reaperSpins: [], weaponClashes: [], reverseSweepTeams: [], time: MODE_RULES[mode].seconds, nextPickup: .8 + Math.random() * 1.5, nextFood: 9 + Math.random() * 7, nextPotion: 3 + Math.random() * 5, running: true, deathAnimation: null, finalRush: false,
  }
}

function RedBlueArenaPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const { embed } = Route.useSearch()
  const { checked: memberChecked, member } = useRequiredMemberAccess(embed !== '1')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const roundRef = useRef<RoundState | null>(null)
  const audioRef = useRef<ArenaAudio | null>(null)
  const settledRef = useRef(false)
  const roundStartBalanceRef = useRef(0)
  const chargedDeathIdsRef = useRef(new Set<number>())
  const rewardedEnemyDeathIdsRef = useRef(new Set<number>())
  const [mode, setMode] = useState<ArenaMode>('duel')
  const [betSide, setBetSide] = useState<ArenaSide>('red')
  const [stake, setStake] = useState(0)
  const [balance, setBalance] = useState(0)
  const [health, setHealth] = useState<number[]>([ARENA_MAX_HEALTH, ARENA_MAX_HEALTH])
  const [pocketedBilliards, setPocketedBilliards] = useState<Record<'red' | 'blue', number[]>>({ red: [], blue: [] })
  const [, setTime] = useState(MODE_RULES.duel.seconds)
  const [phase, setPhase] = useState<'betting' | 'running' | 'result'>('betting')
  const [result, setResult] = useState<ArenaResult | null>(null)
  const [message, setMessage] = useState('选择阵营和投注额，见证自动对战！')
  const [feedback, setFeedback] = useState<{ amount: number; id: number; prefix: '+' | '×' } | null>(null)
  const [rankSubmission, setRankSubmission] = useState<{ id: string; score: number; outcome: 'win' | 'loss' | 'draw'; wonCoins: number; lostCoins: number } | null>(null)

  useEffect(() => setBalance(readSpendableCoinBalance()), [member?.coinBalance])

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
    const round = roundRef.current
    const isTeamMode = mode === 'team' || mode === 'team3'
    const bonusMultiplier = mode === 'team3' && round && finalResult === betSide ? getTeam3BonusMultiplier(round, finalResult) : 0
    const billiardsMultiplier = mode === 'billiards' && round && finalResult !== 'draw' ? longestBilliardsRun(round, finalResult) : 1
    let coinDelta = 0
    if (isTeamMode) {
      const ownDeaths = chargedDeathIdsRef.current.size
      const enemyDeaths = rewardedEnemyDeathIdsRef.current.size
      coinDelta = (enemyDeaths - ownDeaths + bonusMultiplier) * stake
    } else if (mode === 'billiards') {
      coinDelta = finalResult === 'draw' ? 0 : (finalResult === betSide ? 1 : -1) * billiardsMultiplier * stake
    } else {
      const payout = arenaPayout(betSide, finalResult, stake, MODE_RULES[mode].profit)
      if (payout > 0) addCoinBalance(payout)
      coinDelta = readSpendableCoinBalance() - roundStartBalanceRef.current
    }
    if (settlesAfterBattle(mode)) {
      if (coinDelta > 0) addCoinBalance(coinDelta)
      else if (coinDelta < 0) spendCoinBalance(-coinDelta)
    }
    const nextBalance = readSpendableCoinBalance()
    setBalance(nextBalance)
    setResult(finalResult)
    setPhase('result')
    setRankSubmission({ id: `${mode}-${Date.now()}`, score: 1, outcome: finalResult === 'draw' ? 'draw' : finalResult === betSide ? 'win' : 'loss', wonCoins: Math.max(0, coinDelta), lostCoins: Math.max(0, -coinDelta) })
    if (isTeamMode && finalResult === 'draw') setMessage('平局，本局按双方阵亡数完成奖扣。')
    else if (isTeamMode && finalResult === betSide) setMessage(`竞猜成功！${bonusMultiplier > 0 ? `含 ${bonusMultiplier}倍额外奖励` : '已按双方阵亡数结算'}，本局${coinDelta >= 0 ? '获得' : '扣除'} ${Math.abs(coinDelta)} 金币。`)
    else if (isTeamMode && finalResult !== 'draw') setMessage(`竞猜失败，${contestantName(mode, finalResult)}获胜；本局已按双方阵亡数完成奖扣。`)
    else if (finalResult === 'draw') setMessage(mode === 'billiards' ? '平局，本局不扣金币。' : `平局，退回 ${stake} 金币`)
    else if (finalResult === betSide) setMessage(mode === 'billiards' ? `竞猜成功！最长连号 ${billiardsMultiplier} 个，赢得 ${coinDelta} 金币` : `竞猜成功！赢得 ${coinDelta} 金币`)
    else setMessage(mode === 'billiards' ? `竞猜失败，${contestantName(mode, finalResult)}最长连号 ${billiardsMultiplier} 个，扣除 ${Math.abs(coinDelta)} 金币` : `竞猜失败，${contestantName(mode, finalResult)}获胜`)
    if (coinDelta > 0) setFeedback({ amount: coinDelta, id: Date.now(), prefix: '+' })
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
      if (round.mode === 'team3' && round.time <= 0) activateTimedTeam3Reinforcements(round)
      if (round.mode === 'team' || round.mode === 'team3') {
        for (const fighter of round.fighters) {
          if (!fighter.active || fighter.health > 0) continue
          if (fighter.team === betSide && !chargedDeathIdsRef.current.has(fighter.id)) {
            chargedDeathIdsRef.current.add(fighter.id)
          } else if (fighter.team !== betSide && !rewardedEnemyDeathIdsRef.current.has(fighter.id)) {
            rewardedEnemyDeathIdsRef.current.add(fighter.id)
          }
        }
      }
      const aliveTeams = new Set(round.fighters.filter(fighter => fighter.active && fighter.health > 0).map(fighter => fighter.team))
      if (round.mode !== 'billiards' && round.deathAnimation === null && round.time > 0 && aliveTeams.size <= 1) startDeathAnimation(round, audioRef.current)
      drawRound(canvas, context, round)
      uiClock += dt
      if (uiClock > .12) {
        uiClock = 0
        setHealth(round.fighters.map(fighter => Math.max(0, fighter.health)))
        if (round.mode === 'billiards') {
          setPocketedBilliards({
            red: round.billiards.filter(ball => !ball.active && ball.lastHitTeam === 'red').map(ball => ball.number),
            blue: round.billiards.filter(ball => !ball.active && ball.lastHitTeam === 'blue').map(ball => ball.number),
          })
        }
        setTime(Math.max(0, Math.ceil(round.time)))
      }
      if ((round.deathAnimation !== null && round.deathAnimation <= 0) || (round.deathAnimation === null && round.time <= 0)) {
        setHealth(round.fighters.map(fighter => Math.max(0, fighter.health)))
        if (round.mode === 'billiards') setPocketedBilliards({
          red: round.billiards.filter(ball => !ball.active && ball.lastHitTeam === 'red').map(ball => ball.number),
          blue: round.billiards.filter(ball => !ball.active && ball.lastHitTeam === 'blue').map(ball => ball.number),
        })
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
  }, [betSide, phase, settle, stake])

  function startRound() {
    if (stake < MODE_RULES[mode].minBet) {
      setMessage(`本模式最低投注 ${MODE_RULES[mode].minBet} 金币。`)
      return
    }
    const requiredBalance = requiredStartingBalance(mode, stake)
    roundStartBalanceRef.current = readSpendableCoinBalance()
    if (roundStartBalanceRef.current < requiredBalance || (!settlesAfterBattle(mode) && !spendCoinBalance(stake))) {
      setMessage(`开战需要至少 ${requiredBalance} 金币可用余额。`)
      return
    }
    settledRef.current = false
    chargedDeathIdsRef.current.clear()
    rewardedEnemyDeathIdsRef.current.clear()
    void audioRef.current?.start().then(() => audioRef.current?.play('start')).catch(() => {})
    roundRef.current = createRound(mode)
    setBalance(readSpendableCoinBalance())
    setHealth(createRound(mode).fighters.map(fighter => fighter.health))
    setPocketedBilliards({ red: [], blue: [] })
    setTime(MODE_RULES[mode].seconds)
    setResult(null)
    setFeedback(null)
    setMessage(`已投注 ${stake} 金币，支持${contestantName(mode, betSide)}！`)
    setPhase('running')
  }

  function resetBetting() {
    roundRef.current = null
    settledRef.current = false
    chargedDeathIdsRef.current.clear()
    rewardedEnemyDeathIdsRef.current.clear()
    setPhase('betting')
    setResult(null)
    setHealth(createRound(mode).fighters.map(fighter => fighter.health))
    setPocketedBilliards({ red: [], blue: [] })
    setTime(MODE_RULES[mode].seconds)
    setMessage('选择阵营和投注额，开始下一局。')
  }

  const rules = MODE_RULES[mode]
  const requiredBalance = requiredStartingBalance(mode, stake)
  const displayedSides = rules.sides
  const previewFighters = createRound(mode).fighters
  const healthEntries = previewFighters.map((fighter, index) => ({
    color: SIDE_COPY[fighter.side].color,
    label: mode === 'team' ? `${SIDE_COPY[fighter.side].name}${previewFighters.slice(0, index + 1).filter(item => item.side === fighter.side).length}` : SIDE_COPY[fighter.side].name,
    side: fighter.side,
    alignRight: mode !== 'three' && (fighter.team === 'blue' || fighter.side === 'green' || fighter.side === 'orange'),
    value: mode === 'billiards' && phase === 'betting' ? 5 : health[index] ?? ARENA_MAX_HEALTH,
  }))
  const content = <main className={`arena-page arena-page-${phase} arena-mode-${mode}${embed === '1' ? ' arena-page-embed' : ''}`}><section className="arena-shell">
    <div className="arena-header mb-2 flex items-center justify-between gap-3"><div>{embed !== '1' ? <Link to="/$locale/original-games" params={{ locale: lang }} className="arena-back text-xs text-white/55">← 原创游戏（内测版）</Link> : null}<h1 className="arena-title text-xl font-black sm:text-3xl">红蓝竞技场</h1></div><div className="flex items-center gap-2"><CoinChallengeCommunity channel="red-blue-arena" standalone inlineLauncher leaderboardMode={mode} leaderboardTitle={`${MODE_RULES[mode].label} · 胜利次数`} recentWins={[]} scoreSubmission={rankSubmission} /><div className="arena-balance rounded-full border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-sm font-black text-yellow-300">🪙 {balance}</div></div></div>
    {phase === 'betting' ? <div className="arena-mode-cards">{(Object.keys(MODE_RULES) as ArenaMode[]).map(value => <button type="button" key={value} data-active={mode === value} onClick={() => { const preview = createRound(value); setMode(value); setBetSide(MODE_RULES[value].sides[0]); setStake(0); setHealth(preview.fighters.map(fighter => fighter.health)); setPocketedBilliards({ red: [], blue: [] }); setTime(MODE_RULES[value].seconds) }}><span>{MODE_RULES[value].label}</span><small>{value === 'billiards' ? '1→9' : `${MODE_RULES[value].seconds}秒`}</small></button>)}</div> : null}
    <div className="arena-score gap-x-2 gap-y-1" style={{ gridTemplateColumns: `repeat(${mode === 'three' ? 3 : healthEntries.length <= 2 ? healthEntries.length : 2}, minmax(0, 1fr))` }}>{healthEntries.map((entry, index) => { const hearts = mode === 'billiards' ? Math.max(5, entry.value) : Math.max(ARENA_MAX_HEALTH, entry.value); return <div className={`arena-team min-w-0 flex-nowrap ${entry.alignRight ? 'flex-row-reverse' : ''}`} key={`${entry.side}-${index}`} style={{ justifyContent: 'flex-start' }} title={`${entry.label} ${entry.value}点血`}><i className={`arena-orb arena-orb-${entry.side} shrink-0 ${mode === 'three' ? '!h-3 !w-3' : '!h-4 !w-4'}`} style={{ background: entry.color }} /><span className={`flex min-w-0 flex-nowrap leading-none ${mode === 'three' ? 'text-[9px] sm:text-[24px]' : 'text-[11px] sm:text-[28px]'}`} style={{ color: entry.color }}>{Array.from({ length: hearts }, (_, heart) => <i className="not-italic drop-shadow-[0_0_3px_currentColor]" key={heart}>{entry.alignRight ? heart >= hearts - entry.value ? '♥' : '♡' : heart < entry.value ? '♥' : '♡'}</i>)}</span></div> })}</div>
    {mode === 'billiards' ? <div className="mb-1 grid min-h-7 grid-cols-2 gap-2 px-2"><div className="flex flex-wrap justify-start gap-1">{pocketedBilliards.red.map(number => <BilliardScoreBall key={number} number={number} />)}</div><div className="flex flex-wrap justify-end gap-1">{pocketedBilliards.blue.map(number => <BilliardScoreBall key={number} number={number} />)}</div></div> : null}
    <div className="whitespace-nowrap text-center font-mono text-xs font-black uppercase tracking-tight sm:text-base">{displayedSides.map((side, index) => <span key={side}><span style={{ color: SIDE_COPY[side].color }}>{contestantName(mode, side)}</span>{index < displayedSides.length - 1 ? <span className="mx-1 text-white/55">VS</span> : null}</span>)}</div>
    <div className="arena-canvas-wrap"><canvas ref={canvasRef} className="arena-canvas" aria-label="多球自动战斗的圆形竞技场" />{phase !== 'running' && <div className="arena-overlay"><div className="arena-overlay-card"><div className="arena-result-mark mb-2 text-4xl">{result === 'draw' ? '🤝' : result ? SIDE_COPY[result].emoji : '⚔️'}</div><strong className="text-xl">{result ? result === 'draw' ? '平局' : `${contestantName(mode, result)}胜利` : '等待开战'}</strong><p className="mt-2 text-sm text-white/65">{message}</p></div></div>}</div>
    {phase === 'running' ? <aside className="mt-2 grid grid-cols-2 gap-2 text-white/70"><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-yellow-300">⚔️ 武器与防具</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{WEAPON_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div></details><details className="rounded-lg border border-white/10 bg-white/[.04] p-2"><summary className="cursor-pointer select-none text-[11px] font-black text-cyan-300">🎁 道具说明</summary><div className="mt-2 grid gap-y-1 text-[9px] leading-tight sm:text-[10px]">{ITEM_HELP.map(([icon, text]) => <span key={text}><b className="mr-1">{icon}</b>{text}</span>)}</div></details></aside> : null}
    {phase === 'betting' ? <><label className="mb-2 flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white"><span className="shrink-0 text-white/60">模式</span><select className="min-w-0 flex-1 bg-transparent text-right font-black text-yellow-300 outline-none" value={mode} onChange={event => { const value = event.currentTarget.value as ArenaMode; setMode(value); setBetSide(MODE_RULES[value].sides[0]); setStake(0); setHealth(createRound(value).fighters.map(() => 10)); setPocketedBilliards({ red: [], blue: [] }); setTime(MODE_RULES[value].seconds) }}>{(Object.keys(MODE_RULES) as ArenaMode[]).map(value => <option className="bg-black text-white" key={value} value={value}>{MODE_RULES[value].label}</option>)}</select></label><div className="arena-bet-panel arena-bet-layout"><div className="arena-bet-controls"><div className="arena-choice" style={{ gridTemplateColumns: `repeat(${displayedSides.length}, minmax(0, 1fr))` }}>{displayedSides.map(side => <button className="!px-1 text-[10px] sm:text-xs" key={side} style={{ backgroundColor: `${SIDE_COPY[side].color}cc` }} data-active={betSide === side} onClick={() => setBetSide(side)}>{SIDE_COPY[side].emoji} 投{contestantName(mode, side)}</button>)}</div><div className="arena-stakes">{ARENA_BET_OPTIONS.filter(value => value >= rules.minBet).map(value => <button key={value} data-active="false" disabled={requiredStartingBalance(mode, stake + value) > balance || stake + value > rules.maxBet} onClick={() => setStake(current => Math.min(rules.maxBet, current + value))}>+ 🪙 {value}</button>)}</div><div className="arena-bet-total flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-sm"><strong className="text-yellow-300">累计投注：🪙 {stake} / {rules.maxBet}　赔率：{mode === 'team3' ? '击败+1倍，阵亡-1倍；一挑三另+2倍，一反三另+3倍' : mode === 'team' ? '击败+1倍，阵亡-1倍' : mode === 'billiards' ? '胜负均按胜方最长连号倍数' : `1赔${rules.profit}`}</strong><button className="text-white/60 underline" disabled={stake === 0} onClick={() => setStake(0)}>清空投注</button></div></div><button aria-label={stake < rules.minBet ? `最低投注 ${rules.minBet} 金币` : balance < requiredBalance ? '金币不足' : `投注 ${stake} 金币并开战`} className="arena-start arena-start-square" disabled={stake < rules.minBet || balance < requiredBalance} onClick={startRound}>开战</button></div></> : phase === 'result' ? <div className="arena-bet-panel"><button className="arena-start" onClick={resetBetting}>再来一局</button></div> : null}
    <CoinRewardPopup feedback={feedback} />
  </section></main>

  if (embed !== '1' && (!memberChecked || !member)) return <MemberRequiredNotice checked={memberChecked} locale={lang} />
  return embed === '1' ? content : <SiteLayout locale={lang} hideFooter>{content}</SiteLayout>
}

function getRoundResult(round: RoundState): ArenaResult {
  if (round.mode === 'billiards') {
    if (round.billiardWinner) return round.billiardWinner
    if (round.billiardScores.red === round.billiardScores.blue) return 'draw'
    return round.billiardScores.red > round.billiardScores.blue ? 'red' : 'blue'
  }
  const totals = new Map<ArenaSide, number>()
  for (const fighter of round.fighters) totals.set(fighter.team, (totals.get(fighter.team) ?? 0) + Math.max(0, fighter.health))
  const ranked = [...totals.entries()].sort((left, right) => right[1] - left[1])
  if (!ranked.length || (ranked[1] && ranked[0][1] === ranked[1][1])) return 'draw'
  return ranked[0][0]
}

function longestBilliardsRun(round: RoundState, side: ArenaSide) {
  const numbers = round.billiards.filter(ball => !ball.active && ball.lastHitTeam === side).map(ball => ball.number).sort((a, b) => a - b)
  let longest = 0; let current = 0; let previous = -2
  for (const number of numbers) {
    current = number === previous + 1 ? current + 1 : 1
    longest = Math.max(longest, current); previous = number
  }
  return Math.max(1, longest)
}

function getTeam3BonusMultiplier(round: RoundState, result: ArenaResult) {
  if (result === 'draw') return 0
  const winner = result
  const loser = winner === 'red' ? 'blue' : 'red'
  const winnerMembers = round.fighters.filter(fighter => fighter.team === winner)
  const loserMembers = round.fighters.filter(fighter => fighter.team === loser)
  const isReverseSweep = round.reverseSweepTeams.includes(winner) && loserMembers.every(fighter => fighter.health <= 0)
  if (isReverseSweep) return 3
  const isOneAgainstThree = winnerMembers.filter(fighter => fighter.active).length === 1
    && loserMembers.filter(fighter => fighter.active).length === 3
    && loserMembers.every(fighter => fighter.health <= 0)
  if (isOneAgainstThree) return 2
  return 0
}

function resizeCanvas(canvas: HTMLCanvasElement) {
  const size = canvas.clientWidth < 420 ? 320 : 400
  if (canvas.width !== size) { canvas.width = size; canvas.height = size }
}

function equipWeapon(fighter: Fighter, weapon: WeaponKind) {
  if (fighter.weapon === weapon && (weapon === 'sword' || weapon === 'blade')) {
    fighter.weaponCount = 2
    fighter.shield = false; fighter.shieldBumps = 0; fighter.shieldArrowHits = 0
    return
  }
  removeWeaponSpeedEffect(fighter)
  fighter.weapon = weapon
  fighter.weaponCount = 1
  if (weapon !== 'sword' && weapon !== 'blade') { fighter.shield = false; fighter.shieldBumps = 0; fighter.shieldArrowHits = 0 }
  fighter.rangedFired = false
  fighter.laserCharging = weapon === 'staff' && fighter.elementAmmo.length >= 5
  fighter.bowRapidFire = weapon === 'bow' && fighter.elementAmmo.length >= 5
  applyWeaponSpeedEffect(fighter)
  fighter.weaponTimer = fighter.laserCharging ? 1 : weapon === 'bow' ? .35 : weapon === 'staff' ? .85 : 0
}

function consumeWeapon(fighter: Fighter) {
  removeWeaponSpeedEffect(fighter)
  fighter.weapon = null
  fighter.weaponCount = 0
  fighter.weaponTimer = 0
  fighter.rangedFired = false
  fighter.laserCharging = false
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
  if (round.mode !== 'billiards') round.time -= dt
  updateWeaponClashes(round, dt, audio)
  if (!round.finalRush && round.time <= 10) {
    round.finalRush = true
    for (const fighter of round.fighters) if (fighter.active) { fighter.vx *= 2; fighter.vy *= 2 }
  }
  round.nextPickup -= dt
  round.nextFood -= dt
  round.nextPotion -= dt
  const [a, b] = round.fighters
  for (const fighter of round.fighters) {
    if (!fighter.active) continue
    if (fighter.health <= 0) {
      fighter.vx = 0; fighter.vy = 0
      if (round.mode === 'billiards') {
        if (fighter.respawnTimer <= 0) fighter.respawnTimer = 5
        fighter.respawnTimer = Math.max(0, fighter.respawnTimer - dt)
        if (fighter.respawnTimer === 0) respawnBilliardsFighter(fighter)
      }
      continue
    }
    if (fighterInWeaponClash(round, fighter.id)) { fighter.vx = 0; fighter.vy = 0; continue }
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
    fighter.clashLaunchTimer = Math.max(0, fighter.clashLaunchTimer - dt)
    fighter.weaponTimer = Math.max(0, fighter.weaponTimer - dt)
    if (fighter.weapon === 'staff' && fighter.elementAmmo.length >= 5 && !fighter.laserCharging) {
      fighter.laserCharging = true
      fighter.weaponTimer = Math.max(fighter.weaponTimer, 1)
    }
    fighter.stun = Math.max(0, fighter.stun - dt)
    const previousSlowTimer = fighter.slowTimer
    fighter.slowTimer = Math.max(0, fighter.slowTimer - dt)
    if (previousSlowTimer > 0 && fighter.slowTimer === 0) {
      const recovery = 2 ** fighter.slowStacks
      fighter.vx *= recovery; fighter.vy *= recovery; fighter.slowStacks = 0
    }
    const previousBurnTimer = fighter.burnTimer
    fighter.burnTimer = Math.max(0, fighter.burnTimer - dt)
    if (previousBurnTimer > 0 && fighter.burnTimer === 0 && fighter.burnDamage > 0) {
      fighter.health = Math.max(0, fighter.health - fighter.burnDamage); fighter.burnDamage = 0; fighter.burnSpread = false
      burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 16)
    }
    if (fighter.poisonTicks !== 0) {
      fighter.poisonTimer -= dt
      if (fighter.poisonTimer <= 0) {
        fighter.health = Math.max(0, fighter.health - 1); fighter.poisonTimer = 10
        burst(round, fighter.x, fighter.y, '#a855f7', 18)
      }
    }
    const previousSpeedBoost = fighter.speedBoost
    fighter.speedBoost = Math.max(0, fighter.speedBoost - dt)
    fighter.damageBoost = Math.max(0, fighter.damageBoost - dt)
    if (previousSpeedBoost > 0 && fighter.speedBoost === 0) { fighter.vx *= .5; fighter.vy *= .5 }
    if (fighter.stun <= 0 && (fighter.weapon === 'bow' || fighter.weapon === 'staff') && (!fighter.rangedFired || fighter.elementAmmo.length > 0) && fighter.weaponTimer <= 0) {
      const fighterTargets: Array<{ x: number; y: number }> = round.fighters.filter(candidate => candidate.active && candidate.team !== fighter.team && candidate.health > 0)
      const nineBallTarget = round.mode === 'billiards' ? round.billiards.find(ball => ball.active && ball.number === 9) : undefined
      const target = [...fighterTargets, ...(nineBallTarget ? [nineBallTarget] : [])].sort((left, right) => Math.hypot(left.x - fighter.x, left.y - fighter.y) - Math.hypot(right.x - fighter.x, right.y - fighter.y))[0]
      if (!target) continue
      const dx = target.x - fighter.x; const dy = target.y - fighter.y; const distance = Math.hypot(dx, dy) || 1
      if (fighter.weapon === 'staff' && fighter.elementAmmo.length >= 5) {
        fireStaffLaser(round, fighter, dx / distance, dy / distance)
        audio?.play('weapon')
      } else {
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
    }
    if (fighter.weapon === 'bow' && fighter.bowRapidFire) continue
    if (fighter.weapon === 'staff' && fighter.elementAmmo.length >= 5) continue
    if (fighter.stun > 0) continue
    // Marble movement stays on one straight vector until a collision changes it.
    const speed = Math.hypot(fighter.vx, fighter.vy)
    const minSpeed = (fighter.speedBoost > 0 ? .24 : .12) / 2 ** fighter.slowStacks
    const maximumSpeed = round.mode === 'billiards' ? ARENA_BASE_SPEED * (round.finalRush ? 7 : 5) : round.finalRush ? ARENA_RUSH_MAX_SPEED : ARENA_PRE_RUSH_MAX_SPEED
    if (fighter.clashLaunchTimer <= 0 && speed > maximumSpeed) { fighter.vx *= maximumSpeed / speed; fighter.vy *= maximumSpeed / speed }
    else if (speed < minSpeed && speed > .0001) { fighter.vx *= minSpeed / speed; fighter.vy *= minSpeed / speed }
    else if (speed <= .0001) {
      const restartAngle = Number.isFinite(fighter.angle) ? fighter.angle + (fighter.id % 2 ? .18 : -.18) : Math.random() * TWO_PI
      fighter.vx = Math.cos(restartAngle) * minSpeed; fighter.vy = Math.sin(restartAngle) * minSpeed
    }
    fighter.x += fighter.vx * dt; fighter.y += fighter.vy * dt; fighter.angle = Math.atan2(fighter.vy, fighter.vx)
    if (fighter.clashLaunchTimer > 0 && Math.random() < dt * 30) burst(round, fighter.x - fighter.vx * .018, fighter.y - fighter.vy * .018, SIDE_COPY[fighter.side].color, 2)
    const cx = fighter.x - .5; const cy = fighter.y - .5; const edge = Math.hypot(cx, cy)
    if (round.mode === 'billiards') {
      let hitRail = false
      if (fighter.x < TABLE_LEFT + fighter.radius) { fighter.x = TABLE_LEFT + fighter.radius; fighter.vx = Math.abs(fighter.vx); hitRail = true }
      else if (fighter.x > TABLE_RIGHT - fighter.radius) { fighter.x = TABLE_RIGHT - fighter.radius; fighter.vx = -Math.abs(fighter.vx); hitRail = true }
      if (fighter.y < TABLE_TOP + fighter.radius) { fighter.y = TABLE_TOP + fighter.radius; fighter.vy = Math.abs(fighter.vy); hitRail = true }
      else if (fighter.y > TABLE_BOTTOM - fighter.radius) { fighter.y = TABLE_BOTTOM - fighter.radius; fighter.vy = -Math.abs(fighter.vy); hitRail = true }
      if (hitRail) { fighter.vx *= 1.07; fighter.vy *= 1.07; fighter.clashLaunchTimer = Math.min(fighter.clashLaunchTimer, .18); burst(round, fighter.x, fighter.y, '#f8fafc', 7); audio?.play('wall') }
    } else if (edge > .43) {
      const nx = cx / edge; const ny = cy / edge
      fighter.x = .5 + nx * .43; fighter.y = .5 + ny * .43
      const dot = fighter.vx * nx + fighter.vy * ny
      fighter.vx -= 2 * dot * nx; fighter.vy -= 2 * dot * ny
      const wallTurn = (.012 + Math.min(.045, Math.abs(dot) * .035)) * (Math.random() < .5 ? -1 : 1)
      fighter.vx += -ny * wallTurn; fighter.vy += nx * wallTurn
      fighter.vx *= 1.05; fighter.vy *= 1.05
      fighter.clashLaunchTimer = Math.min(fighter.clashLaunchTimer, .18)
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
  if (round.mode === 'billiards') updateBilliards(round, dt, audio)
  const brokenPillars = new Set<number>()
  for (const fighter of round.fighters) {
    if (!fighter.active) continue
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
          const hasDefense = fighter.shield || fighter.armor
          if (hasDefense) breakAllDefenses(fighter)
          fighter.health = Math.max(0, fighter.health - (hasDefense ? 2 : 1))
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
  if (a.active && b.active && a.health > 0 && b.health > 0 && distance < a.radius + b.radius) {
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
        bumpShieldOnNormalCollision(round, a)
        bumpShieldOnNormalCollision(round, b)
      }
    }
    if (a.cooldown <= 0 && b.cooldown <= 0) handleArmedCollision(round, a, b, audio)
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
      let incomingRed = contactDamage.first
      let incomingBlue = contactDamage.second
      if (incomingBlue && a.weapon === 'reaper') { round.reaperSpins.push({ owner: a.id, life: .26, startAngle: a.angle, kind: 'reaper' }); applyReaperGroupHit(round, a, incomingBlue); incomingBlue = 0; audio?.play('reaper') }
      else if (incomingBlue) audio?.play('weapon')
      if (incomingRed && b.weapon === 'reaper') { round.reaperSpins.push({ owner: b.id, life: .26, startAngle: b.angle, kind: 'reaper' }); applyReaperGroupHit(round, b, incomingRed); incomingRed = 0; audio?.play('reaper') }
      else if (incomingRed) audio?.play('weapon')
      const redDefense = resolveMeleeDefense(round, a, incomingRed)
      const blueDefense = resolveMeleeDefense(round, b, incomingBlue)
      const redDamage = redDefense.damage + blueDefense.reflected
      const blueDamage = blueDefense.damage + redDefense.reflected
      if (redDamage || blueDamage || incomingRed || incomingBlue) {
        a.health = Math.max(0, a.health - redDamage); b.health = Math.max(0, b.health - blueDamage)
        if (redDamage > 0) { a.vx *= .82; a.vy *= .82 }
        if (blueDamage > 0) { b.vx *= .82; b.vy *= .82 }
        if (redDamage > 0 && b.weapon === 'hammer') applyHammerHit(round, b, a)
        if (blueDamage > 0 && a.weapon === 'hammer') applyHammerHit(round, a, b)
        a.cooldown = .7; b.cooldown = .7
        if (incomingRed) burst(round, a.x, a.y, redDamage ? '#ff294d' : '#8fe7ff', 16)
        if (incomingBlue) burst(round, b.x, b.y, blueDamage ? '#4590ff' : '#8fe7ff', 16)
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
    if (!left.active || !right.active || left.health <= 0 || right.health <= 0) continue
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
      if (!left.weapon && !right.weapon) { bumpShieldOnNormalCollision(round, left); bumpShieldOnNormalCollision(round, right) }
    }
    if (left.team === right.team || left.cooldown > 0 || right.cooldown > 0) continue
    if (handleArmedCollision(round, left, right, audio)) continue
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
    let leftDamage = contactDamage.first
    let rightDamage = contactDamage.second
    if (rightDamage && left.weapon === 'reaper') { round.reaperSpins.push({ owner: left.id, life: .26, startAngle: left.angle, kind: 'reaper' }); applyReaperGroupHit(round, left, rightDamage); rightDamage = 0; audio?.play('reaper') }
    if (leftDamage && right.weapon === 'reaper') { round.reaperSpins.push({ owner: right.id, life: .26, startAngle: right.angle, kind: 'reaper' }); applyReaperGroupHit(round, right, leftDamage); leftDamage = 0; audio?.play('reaper') }
    const leftDefense = resolveMeleeDefense(round, left, leftDamage)
    const rightDefense = resolveMeleeDefense(round, right, rightDamage)
    const resolvedLeftDamage = leftDefense.damage + rightDefense.reflected
    const resolvedRightDamage = rightDefense.damage + leftDefense.reflected
    left.health = Math.max(0, left.health - resolvedLeftDamage); right.health = Math.max(0, right.health - resolvedRightDamage)
    if (resolvedLeftDamage && right.weapon === 'hammer') applyHammerHit(round, right, left)
    if (resolvedRightDamage && left.weapon === 'hammer') applyHammerHit(round, left, right)
    if (resolvedLeftDamage) { left.vx *= .82; left.vy *= .82; burst(round, left.x, left.y, SIDE_COPY[left.side].color, 16) }
    if (resolvedRightDamage) { right.vx *= .82; right.vy *= .82; burst(round, right.x, right.y, SIDE_COPY[right.side].color, 16) }
    if (isMeleeWeapon(left.weapon) && left.stun <= 0) consumeWeapon(left)
    if (isMeleeWeapon(right.weapon) && right.stun <= 0) consumeWeapon(right)
    left.cooldown = .7; right.cooldown = .7
  }
  if (round.nextPickup <= 0 && autoGroundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const position = randomGroundItemPosition(round, .29)
    const kinds: Pickup['kind'][] = ['sword', 'blade', 'axe', 'reaper', 'hammer', 'bow', 'staff', 'sword', 'blade', 'axe', 'hammer', 'bow', 'staff', 'shield', 'armor', 'pillar']
    round.pickups.push({ id: Date.now() + Math.random(), ...position, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 12 + Math.random() * 8 })
    round.nextPickup = 1.2 + Math.random() * 3.8
  }
  const collected = new Set<number>()
  for (const pickup of round.pickups) {
    pickup.life -= dt
    for (const fighter of round.fighters) if (fighter.active && fighter.health > 0 && Math.hypot(fighter.x - pickup.x, fighter.y - pickup.y) < .08) {
      if (pickup.kind === 'shield') {
        const canHoldShield = !fighter.weapon || ((fighter.weapon === 'sword' || fighter.weapon === 'blade') && fighter.weaponCount === 1)
        fighter.shield = canHoldShield; fighter.shieldBumps = 0; fighter.shieldArrowHits = 0
      }
      else if (pickup.kind === 'armor') fighter.armor = true
      else if (pickup.kind === 'pillar') {
        const position = randomGroundItemPosition(round, .2)
        round.pillars.push({ id: Date.now() + Math.random(), ...position, radius: round.mode === 'billiards' ? .024 : .038, hits: 3, charged: true })
      }
      else equipWeapon(fighter, pickup.kind)
      collected.add(pickup.id); burst(round, pickup.x, pickup.y, pickup.kind === 'shield' ? '#8fe7ff' : pickup.kind === 'armor' ? '#ffb82e' : pickup.kind === 'pillar' ? '#d7e0e5' : '#fde047', 14); break
    }
  }
  round.pickups = round.pickups.filter(pickup => pickup.life > 0 && !collected.has(pickup.id))
  if (collected.size > 0) { round.nextPickup = Math.min(round.nextPickup, .45); audio?.play('pickup') }
  if (round.nextFood <= 0 && autoGroundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const position = randomGroundItemPosition(round, .27)
    round.foods.push({ id: Date.now() + Math.random(), ...position, life: 14 })
    round.nextFood = 12 + Math.random() * 10
  }
  const eaten = new Set<number>()
  for (const food of round.foods) {
    food.life -= dt
    for (const fighter of round.fighters) if (fighter.active && fighter.health > 0 && Math.hypot(fighter.x - food.x, fighter.y - food.y) < .075) {
      fighter.health = healArenaHealth(fighter.health); fighter.burnTimer = 0; fighter.burnDamage = 0; fighter.burnSpread = false; fighter.poisonTimer = 0; fighter.poisonTicks = 0
      eaten.add(food.id); burst(round, food.x, food.y, '#ff5a24', 16); break
    }
  }
  round.foods = round.foods.filter(food => food.life > 0 && !eaten.has(food.id))
  if (eaten.size > 0) { round.nextFood = Math.min(round.nextFood, 1.5); audio?.play('pickup') }
  if (round.nextPotion <= 0 && autoGroundItemCount(round) < MODE_RULES[round.mode].itemLimit) {
    const position = randomGroundItemPosition(round, .27)
    const potionKinds: PotionKind[] = ['fire', 'water', 'electric', 'poison', 'normal-ammo', 'speed-boost', 'damage-boost']
    round.potions.push({ id: Date.now() + Math.random(), ...position, kind: potionKinds[Math.floor(Math.random() * potionKinds.length)], life: 14 })
    round.nextPotion = 5 + Math.random() * 8
  }
  const usedPotions = new Set<number>()
  for (const potion of round.potions) {
    potion.life -= dt
    for (const fighter of round.fighters) if (fighter.active && fighter.health > 0 && Math.hypot(fighter.x - potion.x, fighter.y - potion.y) < .075) {
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
    if (round.mode === 'billiards') {
      let hitRail = false
      if (arrow.x < TABLE_LEFT) { arrow.x = TABLE_LEFT; arrow.vx = Math.abs(arrow.vx); hitRail = true }
      else if (arrow.x > TABLE_RIGHT) { arrow.x = TABLE_RIGHT; arrow.vx = -Math.abs(arrow.vx); hitRail = true }
      if (arrow.y < TABLE_TOP) { arrow.y = TABLE_TOP; arrow.vy = Math.abs(arrow.vy); hitRail = true }
      else if (arrow.y > TABLE_BOTTOM) { arrow.y = TABLE_BOTTOM; arrow.vy = -Math.abs(arrow.vy); hitRail = true }
      if (hitRail) { arrow.bounced = true; audio?.play('wall') }
    } else if (edge > .43) {
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
    if (round.mode === 'billiards') {
      const hitBall = round.billiards.find(ball => ball.active && (arrow.kind === 'arrow' || ball.number === 9) && Math.hypot(arrow.x - ball.x, arrow.y - ball.y) < ball.radius + (arrow.kind === 'magic' ? .018 : .011))
      if (hitBall) {
        const owner = round.fighters.find(fighter => fighter.id === arrow.owner)
        if (owner) { hitBall.lastHitTeam = owner.team; hitBall.lastHitFighterId = owner.id }
        if (hitBall.number === 9 && arrow.element === 'electric') hitBall.unstoppable = false
        else {
          const speed = Math.hypot(arrow.vx, arrow.vy) || 1
          const multiplier = hitBall.number === 9 ? 4 : 2.8
          hitBall.vx = arrow.vx / speed * ARENA_BASE_SPEED * multiplier; hitBall.vy = arrow.vy / speed * ARENA_BASE_SPEED * multiplier
          if (hitBall.number === 9) hitBall.unstoppable = true
        }
        spentProjectiles.add(arrow.id)
        burst(round, hitBall.x, hitBall.y, arrow.element ? ELEMENT_COLORS[arrow.element] : '#ffffff', 24); audio?.play(arrow.element === 'electric' ? 'shock' : 'weapon')
        continue
      }
    }
    if (arrow.kind === 'arrow' && round.lasers.some(laser => laser.segments.some(segment => pointToSegmentDistance(arrow.x, arrow.y, segment) <= .012 + laser.width * .01))) {
      spentProjectiles.add(arrow.id)
      burst(round, arrow.x, arrow.y, arrow.element ? ELEMENT_COLORS[arrow.element] : '#ffffff', 16)
      audio?.play('clash')
      continue
    }
    if (arrow.kind === 'arrow') {
      const swordsman = round.fighters.find(fighter => fighter.active && fighter.health > 0 && fighter.weapon === 'sword' && fighter.stun <= 0 && fighter.cooldown <= 0 && Math.hypot(arrow.x - fighter.x, arrow.y - fighter.y) <= fighter.radius + .075)
      if (swordsman) {
        const swingAngle = Math.atan2(arrow.y - swordsman.y, arrow.x - swordsman.x) - Math.PI * .6
        swordsman.angle = swingAngle; swordsman.stun = .28; swordsman.cooldown = .38
        round.reaperSpins.push({ owner: swordsman.id, life: .26, startAngle: swingAngle, kind: 'sword' })
        spentProjectiles.add(arrow.id)
        burst(round, arrow.x, arrow.y, arrow.element ? ELEMENT_COLORS[arrow.element] : '#ffffff', 22)
        audio?.play('clash')
        continue
      }
    }
    for (const other of round.projectiles) {
      if (other.id === arrow.id || spentProjectiles.has(arrow.id) || spentProjectiles.has(other.id) || Math.hypot(arrow.x - other.x, arrow.y - other.y) > .032) continue
      if (arrow.kind === 'arrow' && other.kind === 'arrow') {
        spentProjectiles.add(arrow.id); spentProjectiles.add(other.id)
        burst(round, (arrow.x + other.x) / 2, (arrow.y + other.y) / 2, '#ffffff', 18)
        audio?.play('clash'); break
      }
      if (arrow.kind === other.kind) continue
      const targetArrow = arrow.kind === 'arrow' ? arrow : other
      const magic = arrow.kind === 'magic' ? arrow : other
      spentProjectiles.add(magic.id)
      targetArrow.damage += magic.damage
      targetArrow.element = magic.element
      const angle = Math.atan2(targetArrow.vy, targetArrow.vx) + (Math.random() - .5) * Math.PI * .8
      const speed = Math.max(ARENA_BASE_SPEED * 1.8, Math.hypot(targetArrow.vx, targetArrow.vy) * 1.45)
      targetArrow.vx = Math.cos(angle) * speed; targetArrow.vy = Math.sin(angle) * speed
      burst(round, targetArrow.x, targetArrow.y, magic.element ? ELEMENT_COLORS[magic.element] : '#ffffff', 20)
      audio?.play('weapon')
      if (spentProjectiles.has(arrow.id)) break
    }
    if (spentProjectiles.has(arrow.id)) continue
    const targets = (arrow.bounced ? round.fighters : round.fighters.filter(fighter => fighter.team !== arrow.ownerTeam)).filter(fighter => fighter.active && fighter.health > 0)
    for (const target of targets) {
      if (Math.hypot(arrow.x - target.x, arrow.y - target.y) < target.radius + (arrow.kind === 'magic' ? .026 : .018)) {
        if (arrow.kind === 'magic' && target.shield) {
          reflectProjectileFromFighter(arrow, target)
          burst(round, target.x, target.y, '#eaf4ff', 26)
          audio?.play('clash'); break
        }
        if (arrow.kind === 'arrow' && target.shield) {
          target.shieldArrowHits += 1
          if (target.shieldArrowHits >= 3) shatterShield(round, target)
          burst(round, target.x, target.y, '#8fe7ff', 22)
          audio?.play('clash'); spentProjectiles.add(arrow.id); break
        }
        if (arrow.kind === 'arrow' && target.armor && !arrow.element) {
          burst(round, target.x, target.y, '#ffd071', 22)
          audio?.play('clash'); spentProjectiles.add(arrow.id); break
        }
        let damage = arrow.damage
        if (target.armor && arrow.kind === 'magic') damage *= 2
        else if (target.armor && arrow.element) shatterArmor(round, target)
        target.health = Math.max(0, target.health - damage)
        if (damage > 0) { target.vx *= .82; target.vy *= .82 }
        if (damage > 0 && arrow.element) applyElementEffect(round, arrow.element, target)
        burst(round, target.x, target.y, arrow.element ? ELEMENT_COLORS[arrow.element] : SIDE_COPY[target.side].color, 18)
        audio?.play(arrow.kind === 'magic' ? 'weapon' : 'collision')
        spentProjectiles.add(arrow.id); break
      }
    }
  }
  round.projectiles = round.projectiles.filter(arrow => arrow.life > 0 && !spentProjectiles.has(arrow.id)).slice(-30)
  round.lasers.forEach(laser => { laser.life -= dt })
  round.lasers = round.lasers.filter(laser => laser.life > 0)
  round.pillars = round.pillars.filter(pillar => !projectileBrokenPillars.has(pillar.id))
  activateTeam3Reinforcements(round)
  for (const fighter of round.fighters) {
    if (!fighter.active) continue
    const speed = Math.hypot(fighter.vx, fighter.vy)
    const maximumSpeed = round.finalRush ? ARENA_RUSH_MAX_SPEED : ARENA_PRE_RUSH_MAX_SPEED
    if (speed > maximumSpeed) { fighter.vx *= maximumSpeed / speed; fighter.vy *= maximumSpeed / speed }
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
function autoGroundItemCount(round: RoundState) {
  return round.pickups.filter(item => !item.pocketReward).length + round.foods.filter(item => !item.pocketReward).length + round.potions.filter(item => !item.pocketReward).length
}

function randomGroundItemPosition(round: RoundState, radius: number) {
  if (round.mode === 'billiards') return { x: .33 + Math.random() * .34, y: .11 + Math.random() * .78 }
  const angle = Math.random() * TWO_PI; const distance = Math.sqrt(Math.random()) * radius
  return { x: .5 + Math.cos(angle) * distance, y: .5 + Math.sin(angle) * distance }
}

const TABLE_POCKETS = [[.278, .034], [.722, .034], [TABLE_LEFT, .5], [TABLE_RIGHT, .5], [.278, .966], [.722, .966]] as const

function updateBilliards(round: RoundState, dt: number, audio?: ArenaAudio | null) {
  const activeBalls = round.billiards.filter(ball => ball.active)
  for (const ball of activeBalls) {
    ball.x += ball.vx * dt; ball.y += ball.vy * dt
    if (!ball.unstoppable) {
      const drag = Math.exp(-.18 * dt); ball.vx *= drag; ball.vy *= drag
      if (Math.hypot(ball.vx, ball.vy) < .008) { ball.vx = 0; ball.vy = 0 }
    }
    const pocket = TABLE_POCKETS.find(([x, y]) => Math.hypot(ball.x - x, ball.y - y) < .045)
    if (pocket) {
      ball.vx = 0; ball.vy = 0
      const validPocket = ball.number === round.nextBilliardNumber && (ball.lastHitTeam === 'red' || ball.lastHitTeam === 'blue')
      if (validPocket) {
        ball.active = false
        round.billiardScores[ball.lastHitTeam as 'red' | 'blue'] += 1
        round.nextBilliardNumber += 1
        if (ball.number === 9) {
          const scorer = round.fighters.find(fighter => fighter.id === ball.lastHitFighterId)
            ?? round.fighters.find(fighter => fighter.active && fighter.team === ball.lastHitTeam)
          if (scorer) {
            scorer.elementAmmo.push('normal')
            burst(round, scorer.x, scorer.y, AMMO_COLORS.normal, 24)
          }
          round.billiardWinner = ball.lastHitTeam; round.time = 0
        }
        audio?.play('pickup')
      } else {
        respotBilliardBall(round, ball)
        audio?.play('wall')
      }
      if (ball.number !== 9) spawnPocketReward(round, .5 + (Math.random() - .5) * .3, .5 + (Math.random() - .5) * .7)
      burst(round, pocket[0], pocket[1], billiardColor(ball.number), 28)
      continue
    }
    const railBounce = ball.unstoppable ? 1 : .985
    if (ball.x < TABLE_LEFT + ball.radius) { ball.x = TABLE_LEFT + ball.radius; ball.vx = Math.abs(ball.vx) * railBounce }
    else if (ball.x > TABLE_RIGHT - ball.radius) { ball.x = TABLE_RIGHT - ball.radius; ball.vx = -Math.abs(ball.vx) * railBounce }
    if (ball.y < TABLE_TOP + ball.radius) { ball.y = TABLE_TOP + ball.radius; ball.vy = Math.abs(ball.vy) * railBounce }
    else if (ball.y > TABLE_BOTTOM - ball.radius) { ball.y = TABLE_BOTTOM - ball.radius; ball.vy = -Math.abs(ball.vy) * railBounce }
  }
  for (let i = 0; i < activeBalls.length; i++) for (let j = i + 1; j < activeBalls.length; j++) {
    const first = activeBalls[i]; const second = activeBalls[j]
    if (!first.active || !second.active) continue
    const dx = second.x - first.x; const dy = second.y - first.y; const distance = Math.hypot(dx, dy) || .001
    if (distance >= first.radius + second.radius) continue
    const nx = dx / distance; const ny = dy / distance; const overlap = first.radius + second.radius - distance
    first.x -= nx * overlap / 2; first.y -= ny * overlap / 2; second.x += nx * overlap / 2; second.y += ny * overlap / 2
    const relative = (second.vx - first.vx) * nx + (second.vy - first.vy) * ny
    const firstLockedSpeed = first.number === 9 && first.unstoppable ? Math.hypot(first.vx, first.vy) : 0
    const secondLockedSpeed = second.number === 9 && second.unstoppable ? Math.hypot(second.vx, second.vy) : 0
    const firstDirection = Math.atan2(first.vy, first.vx); const secondDirection = Math.atan2(second.vy, second.vx)
    if (relative < 0) {
      const firstTowardSecond = first.vx * nx + first.vy * ny
      const secondTowardFirst = -(second.vx * nx + second.vy * ny)
      if (firstTowardSecond >= secondTowardFirst && first.lastHitTeam) { second.lastHitTeam = first.lastHitTeam; second.lastHitFighterId = first.lastHitFighterId }
      else if (second.lastHitTeam) { first.lastHitTeam = second.lastHitTeam; first.lastHitFighterId = second.lastHitFighterId }
      first.vx += relative * nx; first.vy += relative * ny; second.vx -= relative * nx; second.vy -= relative * ny
    }
    if (firstLockedSpeed > 0) preserveBilliardSpeed(first, firstLockedSpeed, firstDirection)
    if (secondLockedSpeed > 0) preserveBilliardSpeed(second, secondLockedSpeed, secondDirection)
  }
  const onlyNineRemains = activeBalls.length === 1 && activeBalls[0].number === 9
  for (const fighter of round.fighters) for (const ball of activeBalls) {
    if (!fighter.active || fighter.health <= 0 || !ball.active) continue
    const dx = ball.x - fighter.x; const dy = ball.y - fighter.y; const distance = Math.hypot(dx, dy) || .001
    if (distance >= fighter.radius + ball.radius) continue
    const highSpeedNine = ball.number === 9 && ball.unstoppable
    const nx = dx / distance; const ny = dy / distance; const overlap = fighter.radius + ball.radius - distance
    fighter.x -= nx * overlap * .35; fighter.y -= ny * overlap * .35; ball.x += nx * overlap * .65; ball.y += ny * overlap * .65
    const fighterSpeed = Math.hypot(fighter.vx, fighter.vy)
    const strike = Math.max(.25, fighter.vx * nx + fighter.vy * ny)
    const force = 1.3 + Math.min(.65, fighterSpeed * .22)
    ball.vx += nx * strike * force; ball.vy += ny * strike * force
    ball.lastHitTeam = fighter.team; ball.lastHitFighterId = fighter.id
    if (onlyNineRemains && ball.number === 9) {
      const boostedSpeed = Math.max(ARENA_BASE_SPEED, fighterSpeed) * 1.15
      const fighterDirection = Math.atan2(fighter.vy, fighter.vx)
      fighter.vx = Math.cos(fighterDirection) * boostedSpeed; fighter.vy = Math.sin(fighterDirection) * boostedSpeed
      burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 18)
    }
    const weaponStrike = fighter.weapon && (ball.number === round.nextBilliardNumber || ball.number === 9) && fighter.cooldown <= 0
    if (weaponStrike && fighter.weapon) {
      fighter.angle = Math.atan2(dy, dx)
      round.reaperSpins.push({ owner: fighter.id, life: .26, startAngle: fighter.angle - .6, kind: fighter.weapon })
      const attackSpeed = ARENA_BASE_SPEED * (ball.number === 9 ? 3.6 : 3.15)
      ball.vx = nx * attackSpeed; ball.vy = ny * attackSpeed
      fighter.vx -= nx * .18; fighter.vy -= ny * .18; fighter.cooldown = .42
      round.collisionImpacts.push({ x: ball.x, y: ball.y, life: .48, strength: .8 })
      burst(round, ball.x, ball.y, billiardColor(ball.number), 28); audio?.play('weapon')
    }
    if (ball.number === 9) {
      ball.unstoppable = true
      const speed = Math.hypot(ball.vx, ball.vy) || 1
      const multiplier = fighter.weapon ? 3 : 2
      ball.vx = ball.vx / speed * ARENA_BASE_SPEED * multiplier; ball.vy = ball.vy / speed * ARENA_BASE_SPEED * multiplier
    }
    if (highSpeedNine && fighter.cooldown <= 0) {
      if (fighter.shield) shatterShield(round, fighter)
      else if (fighter.armor) shatterArmor(round, fighter)
      else {
        fighter.health = Math.max(0, fighter.health - 1)
        burst(round, fighter.x, fighter.y, SIDE_COPY[fighter.side].color, 18)
      }
      fighter.cooldown = .65
    }
    fighter.vx -= nx * strike * .18; fighter.vy -= ny * strike * .18
    burst(round, ball.x, ball.y, billiardColor(ball.number), weaponStrike ? 18 : 8); audio?.play(weaponStrike ? 'weapon' : 'collision')
  }
  const brokenPillars = new Set<number>()
  for (const ball of activeBalls) for (const pillar of round.pillars) {
    if (!ball.active) continue
    const dx = ball.x - pillar.x; const dy = ball.y - pillar.y; const distance = Math.hypot(dx, dy)
    if (distance >= ball.radius + pillar.radius) continue
    const nx = distance > .0001 ? dx / distance : 1; const ny = distance > .0001 ? dy / distance : 0
    const dot = ball.vx * nx + ball.vy * ny
    if (dot < 0) { ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny }
    ball.x = pillar.x + nx * (ball.radius + pillar.radius + .004); ball.y = pillar.y + ny * (ball.radius + pillar.radius + .004)
    if (pillar.charged) { ball.unstoppable = false; pillar.charged = false }
    pillar.hits -= 1
    burst(round, pillar.x, pillar.y, pillar.charged ? '#ffe54d' : '#d7e0e5', 14); audio?.play('wall')
    if (pillar.hits <= 0) brokenPillars.add(pillar.id)
  }
  round.pillars = round.pillars.filter(pillar => !brokenPillars.has(pillar.id))
}

function preserveBilliardSpeed(ball: BilliardBall, speed: number, fallbackAngle: number) {
  const currentSpeed = Math.hypot(ball.vx, ball.vy)
  if (currentSpeed > .0001) { ball.vx = ball.vx / currentSpeed * speed; ball.vy = ball.vy / currentSpeed * speed }
  else { ball.vx = Math.cos(fallbackAngle) * speed; ball.vy = Math.sin(fallbackAngle) * speed }
}

function respotBilliardBall(round: RoundState, ball: BilliardBall) {
  const candidates = [[.5, .18], [.44, .18], [.56, .18], [.5, .13], [.5, .23]] as const
  const spot = candidates.find(([x, y]) => round.billiards.every(other => other === ball || !other.active || Math.hypot(other.x - x, other.y - y) > ball.radius + other.radius + .012)) ?? [.5, .18]
  ball.x = spot[0]; ball.y = spot[1]; ball.vx = 0; ball.vy = 0; ball.active = true; ball.lastHitTeam = null; ball.lastHitFighterId = null; ball.unstoppable = false
}

function respawnBilliardsFighter(fighter: Fighter) {
  fighter.health = 5; fighter.respawnTimer = 0
  fighter.x = fighter.team === 'red' ? .43 : .57; fighter.y = .78
  const dx = .5 - fighter.x; const dy = .5 - fighter.y; const distance = Math.hypot(dx, dy) || 1
  fighter.vx = dx / distance * ARENA_BASE_SPEED * 2.65; fighter.vy = dy / distance * ARENA_BASE_SPEED * 2.65
  fighter.angle = Math.atan2(fighter.vy, fighter.vx); fighter.cooldown = .6; fighter.stun = 0
  fighter.weapon = null; fighter.weaponCount = 0; fighter.weaponTimer = 0; fighter.rangedFired = false; fighter.laserCharging = false; fighter.elementAmmo = []; fighter.bowRapidFire = false
  fighter.shield = false; fighter.shieldBumps = 0; fighter.shieldArrowHits = 0; fighter.armor = false
  fighter.speedBoost = 0; fighter.damageBoost = 0; fighter.slowTimer = 0; fighter.slowStacks = 0
  fighter.burnTimer = 0; fighter.burnDamage = 0; fighter.burnSpread = false; fighter.poisonTimer = 0; fighter.poisonTicks = 0
}

function spawnPocketReward(round: RoundState, x: number, y: number) {
  // Keep the entire reward sprite comfortably inside the narrow table rails.
  x = Math.max(.32, Math.min(.68, x)); y = Math.max(.1, Math.min(.9, y))
  const roll = Math.random()
  if (roll < .68) {
    const kinds: Pickup['kind'][] = ['sword', 'blade', 'axe', 'reaper', 'hammer', 'bow', 'staff', 'shield', 'armor', 'pillar']
    round.pickups.push({ id: Date.now() + Math.random(), x, y, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 18, pocketReward: true })
  } else if (roll < .82) round.foods.push({ id: Date.now() + Math.random(), x, y, life: 16, pocketReward: true })
  else {
    const kinds: PotionKind[] = ['fire', 'water', 'electric', 'poison', 'normal-ammo', 'speed-boost', 'damage-boost']
    round.potions.push({ id: Date.now() + Math.random(), x, y, kind: kinds[Math.floor(Math.random() * kinds.length)], life: 16, pocketReward: true })
  }
}

function billiardColor(number: number) {
  return ['#f3d21b', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d', '#111827', '#f3d21b'][number - 1] ?? '#ffffff'
}

function activateTeam3Reinforcements(round: RoundState) {
  if (round.mode !== 'team3') return
  for (const team of ['red', 'blue'] as const) {
    const activeMembers = round.fighters.filter(fighter => fighter.team === team && fighter.active)
    const reinforcement = round.fighters.find(fighter => fighter.team === team && !fighter.active)
    if (!reinforcement) continue
    const readyForReinforcement = activeMembers.length === 1
      ? activeMembers[0].health <= 1
      : activeMembers.every(fighter => fighter.health <= 1)
    if (!readyForReinforcement) continue
    activeMembers.forEach(fighter => { fighter.reinforcementCalled = true })
    reinforcement.active = true
    reinforcement.x = team === 'red' ? .22 : .78
    reinforcement.y = reinforcement.id >= 4 ? .66 : .34
    const dx = .5 - reinforcement.x; const dy = .5 - reinforcement.y; const distance = Math.hypot(dx, dy) || 1
    reinforcement.vx = dx / distance * ARENA_BASE_SPEED; reinforcement.vy = dy / distance * ARENA_BASE_SPEED; reinforcement.angle = Math.atan2(reinforcement.vy, reinforcement.vx)
    round.time = MODE_RULES.team3.seconds; round.finalRush = false
    burst(round, reinforcement.x, reinforcement.y, SIDE_COPY[reinforcement.side].color, 32)
  }
  for (const team of ['red', 'blue'] as const) {
    if (round.reverseSweepTeams.includes(team)) continue
    const members = round.fighters.filter(fighter => fighter.team === team)
    const opposingTeam = team === 'red' ? 'blue' : 'red'
    const opponents = round.fighters.filter(fighter => fighter.team === opposingTeam)
    if (members.length === 3 && members[2].active && members[2].health > 0 && members[0].health <= 0 && members[1].health <= 0
      && opponents.length === 3 && opponents.every(fighter => fighter.health > 0)) round.reverseSweepTeams.push(team)
  }
}

function activateTimedTeam3Reinforcements(round: RoundState) {
  let activated = false
  for (const team of ['red', 'blue'] as const) {
    const reinforcement = round.fighters.find(fighter => fighter.team === team && !fighter.active)
    if (!reinforcement) continue
    reinforcement.active = true
    reinforcement.x = team === 'red' ? .22 : .78
    reinforcement.y = reinforcement.id >= 4 ? .66 : .34
    const dx = .5 - reinforcement.x; const dy = .5 - reinforcement.y; const distance = Math.hypot(dx, dy) || 1
    reinforcement.vx = dx / distance * ARENA_BASE_SPEED; reinforcement.vy = dy / distance * ARENA_BASE_SPEED; reinforcement.angle = Math.atan2(reinforcement.vy, reinforcement.vx)
    burst(round, reinforcement.x, reinforcement.y, SIDE_COPY[reinforcement.side].color, 32)
    activated = true
  }
  if (activated) { round.time = MODE_RULES.team3.seconds; round.finalRush = false }
}

function isRangedWeapon(weapon: WeaponKind | null) {
  return weapon === 'bow' || weapon === 'staff'
}

function fighterInWeaponClash(round: RoundState, fighterId: number) {
  return round.weaponClashes.some(clash => clash.firstId === fighterId || clash.secondId === fighterId)
}

function handleArmedCollision(round: RoundState, first: Fighter, second: Fighter, audio?: ArenaAudio | null) {
  if (fighterInWeaponClash(round, first.id) || fighterInWeaponClash(round, second.id) || first.stun > 0 || second.stun > 0) return false
  const firstMelee = isMeleeWeapon(first.weapon); const secondMelee = isMeleeWeapon(second.weapon)
  const firstRanged = isRangedWeapon(first.weapon); const secondRanged = isRangedWeapon(second.weapon)
  if ((firstRanged && secondMelee) || (secondRanged && firstMelee)) {
    const ranged = firstRanged ? first : second; const melee = firstRanged ? second : first
    const damage = meleePower(melee)
    const defense = resolveMeleeDefense(round, ranged, damage)
    ranged.health = Math.max(0, ranged.health - defense.damage); melee.health = Math.max(0, melee.health - defense.reflected)
    const dx = ranged.x - melee.x; const dy = ranged.y - melee.y; const distance = Math.hypot(dx, dy) || 1; const nx = dx / distance; const ny = dy / distance
    ranged.x += nx * .045; ranged.y += ny * .045
    ranged.vx = nx * 2.2; ranged.vy = ny * 2.2; ranged.clashLaunchTimer = .8
    melee.vx = 0; melee.vy = 0; melee.clashLaunchTimer = 0
    if (melee.weapon === 'hammer' && defense.damage > 0) applyHammerHit(round, melee, ranged)
    melee.stun = Math.max(melee.stun, .5)
    consumeWeapon(ranged); first.cooldown = .75; second.cooldown = .75
    round.collisionImpacts.push({ x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, life: .55, strength: 1, clash: true })
    burst(round, (first.x + second.x) / 2, (first.y + second.y) / 2, '#ffffff', 52); audio?.play('clash')
    return true
  }
  if (!firstMelee || !secondMelee || !first.weapon || !second.weapon) return false
  const firstPower = meleePower(first); const secondPower = meleePower(second)
  const hammerContest = first.weapon === 'hammer' || second.weapon === 'hammer'
  const equalPower = firstPower === secondPower
  const shieldCounter = first.shield !== second.shield
  const firstWins = shieldCounter ? first.shield : hammerContest || equalPower ? Math.random() < .5 : firstPower > secondPower
  const winner = firstWins ? first : second; const loser = firstWins ? second : first
  const duration = !shieldCounter && equalPower && !hammerContest ? 2 : 1
  const damage = shieldCounter || hammerContest || equalPower ? meleePower(winner) : Math.abs(firstPower - secondPower)
  round.weaponClashes.push({ firstId: first.id, secondId: second.id, winnerId: winner.id, loserId: loser.id, time: duration, duration, damage, shieldCounter, winnerWeapon: winner.weapon, loserWeapon: loser.weapon, firstVx: first.vx, firstVy: first.vy, secondVx: second.vx, secondVy: second.vy })
  first.vx = 0; first.vy = 0; second.vx = 0; second.vy = 0; first.cooldown = duration + .35; second.cooldown = duration + .35
  burst(round, (first.x + second.x) / 2, (first.y + second.y) / 2, '#fff4b8', 24); audio?.play('clash')
  return true
}

function updateWeaponClashes(round: RoundState, dt: number, audio?: ArenaAudio | null) {
  const remaining: WeaponClash[] = []
  for (const clash of round.weaponClashes) {
    const first = round.fighters.find(fighter => fighter.id === clash.firstId); const second = round.fighters.find(fighter => fighter.id === clash.secondId)
    const winner = round.fighters.find(fighter => fighter.id === clash.winnerId); const loser = round.fighters.find(fighter => fighter.id === clash.loserId)
    if (!first || !second || !winner || !loser || first.health <= 0 || second.health <= 0) continue
    clash.time = Math.max(0, clash.time - dt)
    first.vx = 0; first.vy = 0; second.vx = 0; second.vy = 0
    first.angle = Math.atan2(second.y - first.y, second.x - first.x)
    second.angle = Math.atan2(first.y - second.y, first.x - second.x)
    if (Math.random() < dt * 12) burst(round, (first.x + second.x) / 2, (first.y + second.y) / 2, Math.random() < .5 ? '#ffffff' : '#ffd84a', 3)
    if (clash.time > 0) { remaining.push(clash); continue }
    const dx = loser.x - winner.x; const dy = loser.y - winner.y; const distance = Math.hypot(dx, dy) || 1; const nx = dx / distance; const ny = dy / distance
    const defense = resolveMeleeDefense(round, loser, clash.damage)
    loser.health = Math.max(0, loser.health - defense.damage); winner.health = Math.max(0, winner.health - defense.reflected)
    loser.x += nx * .045; loser.y += ny * .045
    const winnerStoredVx = winner.id === clash.firstId ? clash.firstVx : clash.secondVx; const winnerStoredVy = winner.id === clash.firstId ? clash.firstVy : clash.secondVy
    const winnerStoredSpeed = Math.hypot(winnerStoredVx, winnerStoredVy) || 1
    winner.vx = winnerStoredVx / winnerStoredSpeed * ARENA_BASE_SPEED; winner.vy = winnerStoredVy / winnerStoredSpeed * ARENA_BASE_SPEED; winner.clashLaunchTimer = 0
    if (clash.loserWeapon !== 'hammer') { loser.vx = nx * 2.35; loser.vy = ny * 2.35; loser.clashLaunchTimer = .9 }
    else {
      const loserStoredVx = loser.id === clash.firstId ? clash.firstVx : clash.secondVx; const loserStoredVy = loser.id === clash.firstId ? clash.firstVy : clash.secondVy
      const loserStoredSpeed = Math.hypot(loserStoredVx, loserStoredVy) || 1
      loser.vx = loserStoredVx / loserStoredSpeed * ARENA_BASE_SPEED; loser.vy = loserStoredVy / loserStoredSpeed * ARENA_BASE_SPEED; loser.clashLaunchTimer = 0
    }
    if (clash.winnerWeapon === 'hammer' && clash.loserWeapon !== 'hammer' && defense.damage > 0) applyHammerHit(round, winner, loser)
    if (clash.shieldCounter) shatterShield(round, winner)
    winner.stun = Math.max(winner.stun, .5)
    consumeWeapon(winner); consumeWeapon(loser)
    round.collisionImpacts.push({ x: (winner.x + loser.x) / 2, y: (winner.y + loser.y) / 2, life: .62, strength: 1, clash: true })
    if (round.collisionImpacts.length > ARENA_MAX_COLLISION_IMPACTS) round.collisionImpacts.splice(0, round.collisionImpacts.length - ARENA_MAX_COLLISION_IMPACTS)
    burst(round, loser.x, loser.y, defense.damage > 0 ? SIDE_COPY[loser.side].color : '#8fe7ff', 58)
    burst(round, (winner.x + loser.x) / 2, (winner.y + loser.y) / 2, '#fff4b8', 36); audio?.play('weapon')
  }
  round.weaponClashes = remaining
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

function fireStaffLaser(round: RoundState, attacker: Fighter, directionX: number, directionY: number) {
  const ammoCount = attacker.elementAmmo.length
  const lastAmmo = attacker.elementAmmo[ammoCount - 1] ?? 'normal'
  const element = lastAmmo === 'normal' ? null : lastAmmo
  const widthTier = Math.floor(ammoCount / 5)
  const widthMultiplier = 2 ** widthTier
  const laserWidth = Math.min(28, (.7 + ammoCount * .16) * widthMultiplier)
  const hitRadius = Math.min(.18, (.008 + ammoCount * .003) * widthMultiplier)
  // The arena boundary, rather than ammo count, limits laser reach.
  let remaining = 10
  let x = attacker.x; let y = attacker.y; let dx = directionX; let dy = directionY; let reflected = false
  const segments: LaserSegment[] = []; const hitFighters = new Set<number>()
  for (let step = 0; step < 18 && remaining > .002; step++) {
    const wallDistance = round.mode === 'billiards' ? rayRectangleExitDistance(x, y, dx, dy, TABLE_LEFT, TABLE_RIGHT, TABLE_TOP, TABLE_BOTTOM) : rayCircleExitDistance(x, y, dx, dy, .455)
    let eventDistance = Math.min(remaining, wallDistance); let hitTarget: Fighter | null = null
    for (const target of round.fighters) {
      if (!target.active || target.health <= 0 || hitFighters.has(target.id) || (!reflected && target.id === attacker.id)) continue
      const hitDistance = rayCircleEntryDistance(x, y, dx, dy, target.x, target.y, target.radius + hitRadius)
      if (hitDistance !== null && hitDistance < eventDistance) { eventDistance = hitDistance; hitTarget = target }
    }
    const endX = x + dx * eventDistance; const endY = y + dy * eventDistance
    segments.push({ x1: x, y1: y, x2: endX, y2: endY }); remaining -= eventDistance
    if (hitTarget) {
      hitFighters.add(hitTarget.id)
      const hasDefense = hitTarget.shield || hitTarget.armor
      const canReflect = hitTarget.shield || (hitTarget.armor && !element)
      if (canReflect) {
        if (hitTarget.shield) shatterShield(round, hitTarget)
        burst(round, hitTarget.x, hitTarget.y, '#eaf4ff', 24); dx *= -1; dy *= -1; reflected = true
      } else {
        if (hasDefense && element) breakAllDefenses(hitTarget)
        hitTarget.health = Math.max(0, hitTarget.health - ammoCount)
        if (element) applyElementEffect(round, element, hitTarget)
        burst(round, hitTarget.x, hitTarget.y, element ? ELEMENT_COLORS[element] : SIDE_COPY[hitTarget.side].color, 28)
      }
      x = endX + dx * .002; y = endY + dy * .002; remaining -= .002; continue
    }
    break
  }
  if (round.mode === 'billiards') {
    const nineBall = round.billiards.find(ball => ball.active && ball.number === 9 && segments.some(segment => pointToSegmentDistance(ball.x, ball.y, segment) <= ball.radius + hitRadius))
    if (nineBall) {
      if (element === 'electric') nineBall.unstoppable = false
      else { nineBall.vx = directionX * ARENA_BASE_SPEED * 4; nineBall.vy = directionY * ARENA_BASE_SPEED * 4; nineBall.unstoppable = true }
      burst(round, nineBall.x, nineBall.y, element ? ELEMENT_COLORS[element] : '#ffffff', 26)
    }
  }
  round.lasers.push({ id: Date.now() + Math.random(), segments, life: .38, color: AMMO_COLORS[lastAmmo], width: laserWidth })
  attacker.elementAmmo = []
  attacker.rangedFired = true
  attacker.laserCharging = false
  attacker.weaponTimer = 0
  burst(round, attacker.x, attacker.y, AMMO_COLORS[lastAmmo], 18)
}

function rayCircleExitDistance(x: number, y: number, dx: number, dy: number, radius: number) {
  const ox = x - .5; const oy = y - .5; const projection = ox * dx + oy * dy
  const discriminant = projection * projection - (ox * ox + oy * oy - radius * radius)
  if (discriminant <= 0) return Number.POSITIVE_INFINITY
  const first = -projection - Math.sqrt(discriminant); const second = -projection + Math.sqrt(discriminant)
  return first > .001 ? first : second > .001 ? second : Number.POSITIVE_INFINITY
}

function rayRectangleExitDistance(x: number, y: number, dx: number, dy: number, left: number, right: number, top: number, bottom: number) {
  const distances = [
    dx < 0 ? (left - x) / dx : dx > 0 ? (right - x) / dx : Number.POSITIVE_INFINITY,
    dy < 0 ? (top - y) / dy : dy > 0 ? (bottom - y) / dy : Number.POSITIVE_INFINITY,
  ].filter(distance => distance > .001)
  return distances.length ? Math.min(...distances) : Number.POSITIVE_INFINITY
}

function rayCircleEntryDistance(x: number, y: number, dx: number, dy: number, cx: number, cy: number, radius: number) {
  const ox = x - cx; const oy = y - cy; const projection = ox * dx + oy * dy
  const discriminant = projection * projection - (ox * ox + oy * oy - radius * radius)
  if (discriminant < 0) return null
  const distance = -projection - Math.sqrt(discriminant)
  return distance > .003 ? distance : null
}

function pointToSegmentDistance(x: number, y: number, segment: LaserSegment) {
  const dx = segment.x2 - segment.x1; const dy = segment.y2 - segment.y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= .000001) return Math.hypot(x - segment.x1, y - segment.y1)
  const progress = Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared))
  return Math.hypot(x - (segment.x1 + dx * progress), y - (segment.y1 + dy * progress))
}

function applyReaperGroupHit(round: RoundState, attacker: Fighter, totalDamage: number) {
  const targets = round.fighters.filter(candidate => candidate.active && candidate.health > 0 && candidate.team !== attacker.team && Math.hypot(candidate.x - attacker.x, candidate.y - attacker.y) <= .24)
  if (!targets.length) return
  const sharedDamage = totalDamage / targets.length
  for (const target of targets) {
    const defense = resolveMeleeDefense(round, target, sharedDamage)
    target.health = Math.max(0, target.health - defense.damage)
    attacker.health = Math.max(0, attacker.health - defense.reflected)
    if (defense.damage > 0) { target.vx *= .82; target.vy *= .82 }
    burst(round, target.x, target.y, defense.damage > 0 ? SIDE_COPY[target.side].color : '#8fe7ff', 18)
  }
}

function applyHammerHit(round: RoundState, attacker: Fighter, target: Fighter) {
  round.reaperSpins.push({ owner: attacker.id, life: .26, startAngle: attacker.angle, kind: 'hammer' })
  const nearby = round.fighters.filter(candidate => candidate.active && candidate.id !== attacker.id && candidate.health > 0 && Math.hypot(candidate.x - attacker.x, candidate.y - attacker.y) <= .24)
  const enemies = nearby.filter(candidate => candidate.team !== attacker.team)
  const knockoutTarget = enemies.length > 0 && Math.random() < .1 ? enemies[Math.floor(Math.random() * enemies.length)] : null
  for (const candidate of nearby) {
    const isPrimary = candidate.id === target.id
    if (!isPrimary && candidate.team !== attacker.team) {
      const defense = resolveMeleeDefense(round, candidate, 1)
      candidate.health = Math.max(0, candidate.health - defense.damage)
      attacker.health = Math.max(0, attacker.health - defense.reflected)
    }
    launchHammerTarget(round, attacker, candidate, candidate.id === knockoutTarget?.id)
  }
}

function launchHammerTarget(round: RoundState, attacker: Fighter, target: Fighter, knockOut: boolean) {
  const dx = target.x - attacker.x; const dy = target.y - attacker.y; const distance = Math.hypot(dx, dy) || 1
  const nx = dx / distance; const ny = dy / distance
  if (knockOut) {
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
  fighter.shieldBumps = 0
  fighter.shieldArrowHits = 0
  fighter.armor = false
}

function resolveMeleeDefense(round: RoundState, defender: Fighter, damage: number) {
  if (damage <= 0) return { damage: 0, reflected: 0 }
  if (defender.shield) { shatterShield(round, defender); return { damage: 0, reflected: damage } }
  if (defender.armor) { shatterArmor(round, defender); return { damage: 0, reflected: 0 } }
  return { damage, reflected: 0 }
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
    target.vx *= .5; target.vy *= .5; target.slowStacks += 1
    target.slowTimer = 3
  } else if (element === 'electric') target.stun = Math.max(target.stun, 1)
  else { target.poisonTicks = -1; target.poisonTimer = 10 }
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

function bumpShieldOnNormalCollision(round: RoundState, fighter: Fighter) {
  if (!fighter.shield) return
  fighter.shieldBumps += 1
  if (fighter.shieldBumps >= 3) shatterShield(round, fighter)
}

function shatterShield(round: RoundState, fighter: Fighter) {
  if (!fighter.shield) return
  fighter.shield = false; fighter.shieldBumps = 0; fighter.shieldArrowHits = 0
  burst(round, fighter.x, fighter.y, '#8fe7ff', 24)
}

function shatterArmor(round: RoundState, fighter: Fighter) {
  if (!fighter.armor) return
  fighter.armor = false
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

function drawBilliardsTable(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save()
  const left = s * TABLE_LEFT; const top = s * TABLE_TOP; const right = s * TABLE_RIGHT; const bottom = s * TABLE_BOTTOM
  ctx.fillStyle = '#000'; ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = Math.max(3, s * .009)
  ctx.beginPath(); ctx.roundRect(left, top, right - left, bottom - top, s * .045); ctx.fill(); ctx.stroke()
  // Pockets sit inside the uninterrupted outer rail as inward-facing half circles.
  ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = Math.max(2, s * .006)
  for (const [x, y] of TABLE_POCKETS) {
    const px = x * s; const py = y * s; const radius = s * .032
    const inwardAngle = Math.atan2(.5 - y, .5 - x)
    ctx.beginPath(); ctx.arc(px, py, radius, inwardAngle - Math.PI / 2, inwardAngle + Math.PI / 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawBilliardBall(ctx: CanvasRenderingContext2D, ball: BilliardBall, s: number) {
  const x = ball.x * s; const y = ball.y * s; const radius = ball.radius * s; const color = billiardColor(ball.number)
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = Math.max(1, s * .003); ctx.beginPath(); ctx.arc(x, y, radius, 0, TWO_PI); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, radius * .48, 0, TWO_PI); ctx.fill()
  ctx.fillStyle = '#111827'; ctx.font = `bold ${Math.max(7, Math.round(radius * .72))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(ball.number), x, y + .5)
  ctx.restore()
}

function drawRound(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, round: RoundState) {
  const s = canvas.width; ctx.clearRect(0, 0, s, s); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, s, s)
  if (round.mode === 'billiards') drawBilliardsTable(ctx, s)
  else {
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
  }
  if (round.mode === 'billiards') {
    const respawnCountdown = Math.max(0, ...round.fighters.filter(fighter => fighter.health <= 0).map(fighter => fighter.respawnTimer))
    if (respawnCountdown > 0) drawPixelNumber(ctx, String(Math.ceil(respawnCountdown)), s * .5, s * .5, s)
  } else drawPixelNumber(ctx, String(Math.max(0, Math.ceil(round.time))).padStart(2, '0'), s * .5, s * .5, s)
  if (round.mode === 'billiards') for (const ball of round.billiards) if (ball.active) drawBilliardBall(ctx, ball, s)
  const billiardsItemScale = round.mode === 'billiards' ? .58 : 1
  for (const pickup of round.pickups) {
    if (pickup.kind === 'shield') drawPixelShield(ctx, pickup.x * s, pickup.y * s, s * .065 * billiardsItemScale)
    else if (pickup.kind === 'armor') drawPixelArmor(ctx, pickup.x * s, pickup.y * s, s * .07 * billiardsItemScale)
    else if (pickup.kind === 'pillar') drawPixelLightning(ctx, pickup.x * s, pickup.y * s, s * .052 * billiardsItemScale)
    else drawPixelWeapon(ctx, pickup.kind, pickup.x * s, pickup.y * s, -.7, s * .07 * billiardsItemScale)
  }
  for (const food of round.foods) drawPixelFood(ctx, food, s, billiardsItemScale)
  for (const potion of round.potions) drawPixelPotion(ctx, potion, s, billiardsItemScale)
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
  for (const laser of round.lasers) {
    const fade = Math.min(1, laser.life * 6)
    ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'butt'; ctx.shadowColor = laser.color; ctx.shadowBlur = s * .035 * laser.width; ctx.strokeStyle = laser.color; ctx.lineWidth = Math.max(7, s * .02) * laser.width; ctx.beginPath()
    for (const segment of laser.segments) { ctx.moveTo(segment.x1 * s, segment.y1 * s); ctx.lineTo(segment.x2 * s, segment.y2 * s) }
    ctx.stroke(); ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, s * .006) * Math.min(1.8, .75 + laser.width * .35); ctx.beginPath()
    for (const segment of laser.segments) { ctx.moveTo(segment.x1 * s, segment.y1 * s); ctx.lineTo(segment.x2 * s, segment.y2 * s) }
    ctx.stroke(); ctx.restore()
  }
  for (const impact of round.collisionImpacts) if (impact.clash) {
    const fade = Math.min(1, impact.life * 3); const progress = 1 - impact.life / .62; const radius = s * (.025 + progress * .095)
    ctx.save(); ctx.translate(impact.x * s, impact.y * s); ctx.globalAlpha = fade; ctx.strokeStyle = '#ffd84a'; ctx.shadowColor = '#ff7a18'; ctx.shadowBlur = s * .025; ctx.lineWidth = Math.max(3, s * .011)
    for (let ray = 0; ray < 8; ray++) { const angle = ray / 8 * TWO_PI + progress * .4; ctx.beginPath(); ctx.moveTo(Math.cos(angle) * radius * .35, Math.sin(angle) * radius * .35); ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); ctx.stroke() }
    ctx.restore()
  }
  for (const fighter of round.fighters) if (fighter.active && fighter.health > 0) drawFighter(ctx, fighter, s, !fighterInWeaponClash(round, fighter.id))
  drawWeaponClashes(ctx, round, s)
  for (const spin of round.reaperSpins) drawReaperSpin(ctx, spin, round, s)
  for (const p of round.particles) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; const size = Math.max(2, Math.round(s * .009)); ctx.fillRect(Math.round(p.x * s), Math.round(p.y * s), size, size) } ctx.globalAlpha = 1
}

function drawWeaponClashes(ctx: CanvasRenderingContext2D, round: RoundState, s: number) {
  for (const clash of round.weaponClashes) {
    const first = round.fighters.find(fighter => fighter.id === clash.firstId); const second = round.fighters.find(fighter => fighter.id === clash.secondId)
    if (!first || !second) continue
    const progress = 1 - clash.time / clash.duration
    const pulse = Math.sin(progress * Math.PI * 8)
    const firstBase = Math.atan2(second.y - first.y, second.x - first.x)
    const secondBase = firstBase + Math.PI
    drawClashSwing(ctx, first, clash.firstId === clash.winnerId ? clash.winnerWeapon : clash.loserWeapon, firstBase, pulse * .42, SIDE_COPY[first.side].color, s)
    drawClashSwing(ctx, second, clash.secondId === clash.winnerId ? clash.winnerWeapon : clash.loserWeapon, secondBase, -pulse * .42, SIDE_COPY[second.side].color, s)
    const centerX = (first.x + second.x) * s / 2; const centerY = (first.y + second.y) * s / 2
    ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(progress * Math.PI * 5); ctx.globalAlpha = .65 + Math.abs(pulse) * .35; ctx.strokeStyle = '#fff7c2'; ctx.lineWidth = Math.max(2, s * .006)
    ctx.beginPath(); ctx.moveTo(-s * .022, 0); ctx.lineTo(s * .022, 0); ctx.moveTo(0, -s * .022); ctx.lineTo(0, s * .022); ctx.stroke(); ctx.restore()
  }
}

function drawClashSwing(ctx: CanvasRenderingContext2D, fighter: Fighter, weapon: WeaponKind, baseAngle: number, swing: number, color: string, s: number) {
  const radius = fighter.radius * s * 1.35; const angle = baseAngle + swing
  const x = fighter.x * s + Math.cos(angle) * radius; const y = fighter.y * s + Math.sin(angle) * radius
  ctx.save(); ctx.globalAlpha = .78; ctx.strokeStyle = color; ctx.shadowColor = color; ctx.shadowBlur = s * .018; ctx.lineWidth = Math.max(2, s * .009); ctx.beginPath(); ctx.arc(fighter.x * s, fighter.y * s, radius * 1.18, baseAngle - .52, baseAngle + .52); ctx.stroke(); ctx.shadowBlur = 0
  ctx.globalAlpha = .34; ctx.lineWidth = Math.max(2, s * .004); ctx.beginPath(); ctx.arc(fighter.x * s, fighter.y * s, radius * 1.48, baseAngle - .42, baseAngle + .42); ctx.stroke(); ctx.restore()
  drawPixelWeapon(ctx, weapon, x, y, angle, fighter.radius * s * 1.38)
}

function drawReaperSpin(ctx: CanvasRenderingContext2D, spin: ReaperSpin, round: RoundState, s: number) {
  const fighter = round.fighters.find(item => item.id === spin.owner)
  if (!fighter) return
  const progress = 1 - spin.life / .26
  const angle = spin.startAngle + progress * (spin.kind === 'sword' ? Math.PI * 1.2 : TWO_PI)
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

function drawPixelFood(ctx: CanvasRenderingContext2D, food: Food, s: number, scale = 1) {
  const x = Math.round(food.x * s); const y = Math.round(food.y * s); const unit = Math.max(1, s * .0065 * scale)
  ctx.fillStyle = '#ff5722'; ctx.fillRect(x - unit * 2, y - unit, unit * 5, unit * 4); ctx.fillRect(x - unit, y - unit * 2, unit * 3, unit * 6)
  ctx.fillStyle = '#8b5a2b'; ctx.fillRect(x, y - unit * 4, unit, unit * 2)
  ctx.fillStyle = '#65d94f'; ctx.fillRect(x + unit, y - unit * 4, unit * 2, unit)
  ctx.fillStyle = '#fff'; ctx.fillRect(x - unit, y - unit, unit, unit)
}

function drawPixelShield(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, angle = 0) {
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(angle + Math.PI / 2); ctx.strokeStyle = '#b9f3ff'; ctx.fillStyle = '#4ac8e9aa'; ctx.lineWidth = Math.max(2, size * .1); ctx.beginPath(); ctx.moveTo(0, -size * .45); ctx.lineTo(size * .36, -size * .25); ctx.lineTo(size * .28, size * .25); ctx.lineTo(0, size * .48); ctx.lineTo(-size * .28, size * .25); ctx.lineTo(-size * .36, -size * .25); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore()
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

function drawPixelPotion(ctx: CanvasRenderingContext2D, potion: Potion, s: number, scale = 1) {
  const x = Math.round(potion.x * s); const y = Math.round(potion.y * s); const unit = Math.max(1, Math.round(s * .005 * scale)); const color = POTION_COLORS[potion.kind]; const isBoost = potion.kind === 'speed-boost' || potion.kind === 'damage-boost'
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

function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, s: number, showWeapon = true) {
  const x = f.x * s; const y = f.y * s; const r = f.radius * s; const color = SIDE_COPY[f.side].color
  ctx.save(); ctx.fillStyle = '#090c0c'; ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, r * .18); ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(r), 0, TWO_PI); ctx.fill(); ctx.stroke()
  const eyeSize = Math.max(2, Math.round(r * .18)); const eyeShift = Math.sin(performance.now() / 260 + (f.side === 'red' ? 0 : .8)) * r * .1
  ctx.fillStyle = color; ctx.fillRect(Math.round(x - r * .35 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize); ctx.fillRect(Math.round(x + r * .18 + eyeShift), Math.round(y - r * .14), eyeSize, eyeSize)
  if (f.speedBoost > 0 || f.damageBoost > 0) { ctx.strokeStyle = f.damageBoost > 0 ? '#ff354d' : '#ffd32f'; ctx.lineWidth = Math.max(2, r * .1); ctx.globalAlpha = .65 + Math.sin(performance.now() / 100) * .25; ctx.beginPath(); ctx.arc(x, y, r * 1.18, 0, TWO_PI); ctx.stroke(); ctx.globalAlpha = 1 }
  if (f.elementAmmo.length > 0) { const nextElement = f.elementAmmo[0]; ctx.strokeStyle = AMMO_COLORS[nextElement]; ctx.shadowColor = AMMO_COLORS[nextElement]; ctx.shadowBlur = r * .28; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); ctx.arc(x, y, r * 1.16, 0, TWO_PI); ctx.stroke(); ctx.shadowBlur = 0; if (f.elementAmmo.length > 1) { ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(8, Math.round(r * .55))}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`×${f.elementAmmo.length}`, x, y - r * 1.55) } }
  if (f.slowTimer > 0) { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = Math.max(2, r * .08); ctx.beginPath(); ctx.arc(x, y, r * 1.24, 0, TWO_PI); ctx.stroke() }
  if (f.stun > 0) { ctx.strokeStyle = '#ffe54d'; ctx.shadowColor = '#ffd400'; ctx.shadowBlur = r * .2; ctx.lineWidth = Math.max(2, r * .09); ctx.beginPath(); for (let i = 0; i <= 14; i++) { const angle = i / 14 * TWO_PI; const radius = r * (i % 2 ? 1.12 : 1.25); const px = x + Math.cos(angle) * radius; const py = y + Math.sin(angle) * radius; if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py) } ctx.closePath(); ctx.stroke(); ctx.shadowBlur = 0 }
  if (f.burnTimer > 0) drawFireRing(ctx, x, y, r, 2, 1.12)
  if (f.poisonTicks !== 0) { ctx.strokeStyle = '#a855f7'; ctx.setLineDash([r * .16, r * .22]); ctx.lineWidth = Math.max(2, r * .1); ctx.beginPath(); ctx.arc(x, y, r * 1.22, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (f.armor) { ctx.strokeStyle = '#ffb82e'; ctx.lineWidth = Math.max(2, r * .12); ctx.setLineDash([r * .35, r * .18]); ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, TWO_PI); ctx.stroke(); ctx.setLineDash([]) }
  if (showWeapon && f.weapon && f.weaponCount > 1 && (f.weapon === 'sword' || f.weapon === 'blade')) {
    const forward = r * 1.28; const side = r * .88; const cos = Math.cos(f.angle); const sin = Math.sin(f.angle)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward - sin * side, y + sin * forward + cos * side, f.angle + .14, r * 1.5)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward + sin * side, y + sin * forward - cos * side, f.angle - .14, r * 1.5)
  } else if (showWeapon && f.weapon && f.shield && (f.weapon === 'sword' || f.weapon === 'blade')) {
    const forward = r * 1.25; const side = r * .62; const cos = Math.cos(f.angle); const sin = Math.sin(f.angle)
    drawPixelWeapon(ctx, f.weapon, x + cos * forward - sin * side, y + sin * forward + cos * side, f.angle, r * 1.5)
    drawPixelShield(ctx, x + cos * forward + sin * side, y + sin * forward - cos * side, r * 1.32, f.angle)
  } else if (showWeapon && f.weapon) {
    const distance = f.weapon === 'sword' || f.weapon === 'blade' ? 1.3 : 1.7
    drawPixelWeapon(ctx, f.weapon, x + Math.cos(f.angle) * r * distance, y + Math.sin(f.angle) * r * distance, f.angle, r * 1.5)
  } else if (f.shield) drawPixelShield(ctx, x + Math.cos(f.angle) * r * 1.35, y + Math.sin(f.angle) * r * 1.35, r * 1.4, f.angle)
  ctx.restore()
}