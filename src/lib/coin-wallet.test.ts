import test from 'node:test'
import assert from 'node:assert/strict'

import { getCoinRank } from './coin-wallet.ts'

test('coin ranks cover every balance without gaps', () => {
  const cases = [
    [0, 'bronze', 1],
    [99, 'bronze', 1],
    [100, 'silver', 2],
    [500, 'gold', 3],
    [1_000, 'platinum', 4],
    [2_000, 'diamond', 5],
    [5_000, 'master', 6],
    [10_000, 'king', 10],
    [50_000, 'legend', 20],
    [99_999, 'legend', 20],
  ] as const

  for (const [balance, id, multiplier] of cases) {
    const rank = getCoinRank(balance)
    assert.equal(rank.id, id)
    assert.equal(rank.multiplier, multiplier)
  }
})
