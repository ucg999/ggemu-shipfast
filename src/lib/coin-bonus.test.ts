import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseBonusKind, makeBonusPlan, bonusPayout, BONUS_CELLS } from './coin-bonus.ts'

test('lucky and gold gates unlock at 3, 5 and 8 hits', () => {
  for (const mode of ['lucky','gold'] as const) {
    const locked = mode==='lucky'?['fruit-double','all-bar','five']:['big-three','big-four','all-stars']
    for (const [gate,index] of [[3,0],[5,1],[8,2]]) {
      const before = Array.from({length:1000},(_,i)=>chooseBonusKind(mode,gate-1,()=>i/1000))
      const after = Array.from({length:1000},(_,i)=>chooseBonusKind(mode,gate,()=>i/1000))
      assert.equal(before.includes(locked[index] as never),false)
      assert.equal(after.includes(locked[index] as never),true)
    }
  }
})
test('named jackpots stop on the specified distinct cells', () => {
  assert.deepEqual(makeBonusPlan('small-three').targets,[11,17,23])
  assert.deepEqual(makeBonusPlan('all-bar').targets.map(i=>BONUS_CELLS[i][1]),[25,100,50])
  assert.deepEqual(makeBonusPlan('big-three').targets.map(i=>BONUS_CELLS[i]),[[6,20],[4,20],[5,20]])
  assert.equal(makeBonusPlan('big-four').targets.length,4)
  const five=makeBonusPlan('five',()=>0)
  assert.equal(new Set(five.targets.map(i=>BONUS_CELLS[i][0])).size,5)
  assert.equal(makeBonusPlan('all-stars').targets.length,24)
  assert.equal(makeBonusPlan('random-lights',()=>0).targets.length,2)
  assert.equal(makeBonusPlan('random-lights',()=>0.99).targets.length,3)
})
test('only wagered symbols pay; fruits alone double; gold has no blanket multiplier', () => {
  assert.equal(bonusPayout(makeBonusPlan('all-bar'),[0,0,0,0,0,0,0,2]),350)
  assert.equal(bonusPayout(makeBonusPlan('big-three'),[0,0,0,0,1,2,3,0]),120)
  assert.equal(bonusPayout(makeBonusPlan('small-three'),[0,1,2,3,0,0,0,0]),12)
  assert.equal(bonusPayout(makeBonusPlan('all-stars'),[1,0,0,0,0,0,0,2]),205)
  const doubled=makeBonusPlan('fruit-double')
  for (const [index,expected] of [[0,20],[1,10],[3,100],[7,40],[15,20],[19,20]]) {
    assert.equal(bonusPayout({...doubled,targets:[index]},Array(8).fill(1)),expected)
  }
  assert.equal(bonusPayout(makeBonusPlan('five'),Array(8).fill(0)),0)
})


test('small four stops on four distinct apples sequentially and pays only apple bets', () => {
  const plan=makeBonusPlan('small-four')
  assert.equal(plan.simultaneous,false)
  assert.deepEqual(plan.targets,[5,10,16,22])
  assert.equal(new Set(plan.targets).size,4)
  assert.ok(plan.targets.every(index=>BONUS_CELLS[index][0]===0))
  assert.equal(bonusPayout(plan,[2,0,0,0,0,0,0,0]),40)
  assert.equal(bonusPayout(plan,[0,3,3,3,3,3,3,3]),0)
})
