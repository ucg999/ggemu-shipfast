const LIBRARY_DETAIL_KEY = 'ucg999-guest-library-detail'
const MAHJONG_TRIAL_KEY = 'ucg999-guest-mahjong-trial'

function todayKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function claimGuestLibraryDetail(platform: 'psp' | 'switch', gameId: string) {
  if (typeof window === 'undefined') return false
  const selection = `${platform}:${gameId}`
  try {
    const stored = JSON.parse(window.localStorage.getItem(LIBRARY_DETAIL_KEY) || 'null') as { date?: string; selection?: string } | null
    if (stored?.date === todayKey()) return stored.selection === selection
    window.localStorage.setItem(LIBRARY_DETAIL_KEY, JSON.stringify({ date: todayKey(), selection }))
    return true
  } catch {
    return false
  }
}

export function readGuestMahjongTrialMs() {
  if (typeof window === 'undefined') return 0
  try {
    const stored = JSON.parse(window.localStorage.getItem(MAHJONG_TRIAL_KEY) || 'null') as { date?: string; usedMs?: number } | null
    return stored?.date === todayKey() && Number.isFinite(stored.usedMs) ? Math.max(0, Number(stored.usedMs)) : 0
  } catch {
    return 0
  }
}

export function addGuestMahjongTrialMs(milliseconds: number) {
  const usedMs = Math.min(10 * 60_000, readGuestMahjongTrialMs() + Math.max(0, milliseconds))
  try {
    window.localStorage.setItem(MAHJONG_TRIAL_KEY, JSON.stringify({ date: todayKey(), usedMs }))
  } catch {}
  return usedMs
}
