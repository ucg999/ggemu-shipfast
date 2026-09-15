export const COIN_BALANCE_STORAGE_KEY = 'game-adventure-coin-balance'
export const COIN_BALANCE_EVENT = 'game-adventure-coin-balance-change'
export const MAX_COIN_BALANCE = 99_999

export type CoinRankId = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master' | 'king' | 'legend'

export type CoinRank = {
  id: CoinRankId
  name: string
  icon: string
  min: number
  max: number
  multiplier: number
}

export const COIN_RANKS: ReadonlyArray<CoinRank> = [
  { id: 'bronze', name: '青铜', icon: '/images/ranks/青铜.png', min: 0, max: 99, multiplier: 1 },
  { id: 'silver', name: '白银', icon: '/images/ranks/白银.png', min: 100, max: 499, multiplier: 2 },
  { id: 'gold', name: '黄金', icon: '/images/ranks/黄金.png', min: 500, max: 999, multiplier: 3 },
  { id: 'platinum', name: '铂金', icon: '/images/ranks/铂金.png', min: 1_000, max: 1_999, multiplier: 4 },
  { id: 'diamond', name: '钻石', icon: '/images/ranks/钻石.png', min: 2_000, max: 4_999, multiplier: 5 },
  { id: 'master', name: '大师', icon: '/images/ranks/大师.png', min: 5_000, max: 9_999, multiplier: 6 },
  { id: 'king', name: '王者', icon: '/images/ranks/王者.png', min: 10_000, max: 49_999, multiplier: 10 },
  { id: 'legend', name: '传奇', icon: '/images/ranks/传奇.png', min: 50_000, max: MAX_COIN_BALANCE, multiplier: 20 },
]

const DAILY_GAME_MULTIPLIER_STORAGE_KEY = 'game-adventure-daily-game-multipliers'
const GAME_PLAY_STARTED_STORAGE_PREFIX = 'game-adventure-play-started:'

type DailyGameMultipliers = {
  date: string
  games: Record<string, number>
}

export function readCoinBalance() {
  try {
    return Math.min(
      MAX_COIN_BALANCE,
      Math.max(0, Math.floor(Number(window.localStorage.getItem(COIN_BALANCE_STORAGE_KEY)) || 0)),
    )
  } catch {
    return 0
  }
}

export function addCoinBalance(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return readCoinBalance()
  const next = Math.min(MAX_COIN_BALANCE, readCoinBalance() + Math.floor(amount))

  try {
    window.localStorage.setItem(COIN_BALANCE_STORAGE_KEY, String(next))
    window.dispatchEvent(new CustomEvent(COIN_BALANCE_EVENT, { detail: next }))
  } catch {
    // Rewards remain available for the current visit when storage is unavailable.
  }

  return next
}

export function getCoinRank(balance = readCoinBalance()) {
  const safeBalance = Math.min(MAX_COIN_BALANCE, Math.max(0, Math.floor(balance)))
  return [...COIN_RANKS].reverse().find(rank => safeBalance >= rank.min) ?? COIN_RANKS[0]
}

export function hasCoinRank(requiredRank: CoinRankId, balance = readCoinBalance()) {
  const currentIndex = COIN_RANKS.findIndex(rank => rank.id === getCoinRank(balance).id)
  const requiredIndex = COIN_RANKS.findIndex(rank => rank.id === requiredRank)
  return requiredIndex >= 0 && currentIndex >= requiredIndex
}

export function addCoinReward(amount: number) {
  const current = readCoinBalance()
  const multiplier = getCoinRank(current).multiplier
  const requested = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) * multiplier : 0
  const balance = requested > 0 ? addCoinBalance(requested) : current
  return { awarded: Math.max(0, balance - current), balance, multiplier }
}

export function spendCoinBalance(amount: number) {
  const cost = Math.max(0, Math.floor(amount))
  const current = readCoinBalance()
  if (cost === 0 || current < cost) return false

  const next = current - cost
  try {
    window.localStorage.setItem(COIN_BALANCE_STORAGE_KEY, String(next))
    window.dispatchEvent(new CustomEvent(COIN_BALANCE_EVENT, { detail: next }))
    return true
  } catch {
    return false
  }
}

export function setDailyGameCoinMultiplier(gameId: string, multiplier: number) {
  if (!gameId || multiplier < 2) return
  const safeMultiplier = Math.max(2, Math.min(20, Math.floor(multiplier)))
  const today = getLocalDateKey(new Date())
  const current = readDailyGameMultipliers()
  const games = current.date === today ? current.games : {}

  try {
    window.localStorage.setItem(
      DAILY_GAME_MULTIPLIER_STORAGE_KEY,
      JSON.stringify({ date: today, games: { ...games, [gameId]: safeMultiplier } }),
    )
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

export function getDailyGameCoinMultiplier(gameId: string) {
  const current = readDailyGameMultipliers()
  if (current.date !== getLocalDateKey(new Date())) return 1
  return Math.max(1, Math.min(20, Math.floor(Number(current.games[gameId])) || 1))
}

export function markGamePlayStarted(gameId: string) {
  if (!gameId) return
  try {
    window.localStorage.setItem(
      `${GAME_PLAY_STARTED_STORAGE_PREFIX}${gameId}`,
      String(Date.now()),
    )
  } catch {
    // The timer falls back to the game screen load time.
  }
}

export function consumeGamePlayStartedAt(gameId: string) {
  const key = `${GAME_PLAY_STARTED_STORAGE_PREFIX}${gameId}`
  try {
    const startedAt = Number(window.localStorage.getItem(key))
    window.localStorage.removeItem(key)
    return Number.isFinite(startedAt) && startedAt > Date.now() - 60_000
      ? startedAt
      : Date.now()
  } catch {
    return Date.now()
  }
}

function readDailyGameMultipliers(): DailyGameMultipliers {
  try {
    const stored = window.localStorage.getItem(DAILY_GAME_MULTIPLIER_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as Partial<DailyGameMultipliers>) : null
    return {
      date: typeof parsed?.date === 'string' ? parsed.date : '',
      games: parsed?.games && typeof parsed.games === 'object' ? parsed.games : {},
    }
  } catch {
    return { date: '', games: {} }
  }
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
