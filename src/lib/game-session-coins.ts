export function calculateGameCoinAward(activeTime: number, multiplier: number, awarded: number, sessionCoins: number) {
  const earned = Math.floor(Math.max(0, activeTime) / 300_000) * 5 * multiplier
  const cap = 100
  return {
    earned,
    additional: Math.min(Math.max(0, earned - awarded), Math.max(0, cap - sessionCoins)),
  }
}
