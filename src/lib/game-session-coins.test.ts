import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { calculateGameCoinAward } from './game-session-coins.ts'

test('exit keeps the existing five-minute reward threshold', () => {
  assert.equal(calculateGameCoinAward(299_999, 1, 0, 0).additional, 0)
  assert.equal(calculateGameCoinAward(300_000, 1, 0, 0).additional, 5)
})
test('exit and repeated settlement do not re-award periodic rewards', () => {
  const first = calculateGameCoinAward(600_000, 1, 5, 5)
  assert.equal(first.additional, 5)
  assert.equal(calculateGameCoinAward(600_000, 1, first.earned, 10).additional, 0)
})
test('normal and multiplier sessions respect reward caps', () => {
  assert.equal(calculateGameCoinAward(9_000_000, 1, 95, 95).additional, 5)
  assert.equal(calculateGameCoinAward(9_000_000, 2, 95, 95).additional, 5)
  assert.equal(calculateGameCoinAward(9_000_000, 2, 100, 100).additional, 0)
})
