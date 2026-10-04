export const GAME_SESSION_COIN_CAP = 100
export const PRO_GAME_SESSION_COIN_CAP = 500

export function resolveGameSessionMultiplier(multiplier: number, isProGame: boolean) {
  const safeMultiplier = Math.max(1, Math.floor(Number(multiplier) || 1))
  return safeMultiplier * (isProGame ? 2 : 1)
}

export function calculateGameCoinAward(activeTime: number, multiplier: number, awarded: number, sessionCoins: number, sessionCap = GAME_SESSION_COIN_CAP) {
  const earned = Math.floor(Math.max(0, activeTime) / 300_000) * 5 * multiplier
  return {
    earned,
    additional: Math.min(
      Math.max(0, earned - awarded),
      Math.max(0, sessionCap - sessionCoins),
    ),
  }
}
