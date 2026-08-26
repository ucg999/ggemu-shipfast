export const COIN_BALANCE_STORAGE_KEY = 'game-adventure-coin-balance'
export const COIN_BALANCE_EVENT = 'game-adventure-coin-balance-change'

const DAILY_GAME_MULTIPLIER_STORAGE_KEY = 'game-adventure-daily-game-multipliers'

type DailyGameMultipliers = {
  date: string
  games: Record<string, number>
}

export function readCoinBalance() {
  try {
    return Math.max(0, Number(window.localStorage.getItem(COIN_BALANCE_STORAGE_KEY)) || 0)
  } catch {
    return 0
  }
}

export function addCoinBalance(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return readCoinBalance()
  const next = readCoinBalance() + Math.floor(amount)

  try {
    window.localStorage.setItem(COIN_BALANCE_STORAGE_KEY, String(next))
    window.dispatchEvent(new CustomEvent(COIN_BALANCE_EVENT, { detail: next }))
  } catch {
    // Rewards remain available for the current visit when storage is unavailable.
  }

  return next
}

export function setDailyGameCoinMultiplier(gameId: string, multiplier: number) {
  if (!gameId || multiplier < 2) return
  const today = getLocalDateKey(new Date())
  const current = readDailyGameMultipliers()
  const games = current.date === today ? current.games : {}

  try {
    window.localStorage.setItem(
      DAILY_GAME_MULTIPLIER_STORAGE_KEY,
      JSON.stringify({ date: today, games: { ...games, [gameId]: multiplier } }),
    )
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

export function getDailyGameCoinMultiplier(gameId: string) {
  const current = readDailyGameMultipliers()
  if (current.date !== getLocalDateKey(new Date())) return 1
  return Math.max(1, Math.min(3, Number(current.games[gameId]) || 1))
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
