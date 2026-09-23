export const GAME_SESSION_COIN_CAP = 100

export function calculateGameCoinAward(activeTime: number, multiplier: number, awarded: number, sessionCoins: number) {
  const earned = Math.floor(Math.max(0, activeTime) / 300_000) * 5 * multiplier
  return {
    earned,
    additional: Math.min(
      Math.max(0, earned - awarded),
      Math.max(0, GAME_SESSION_COIN_CAP - sessionCoins),
    ),
  }
}
