import test from 'node:test'
import assert from 'node:assert/strict'

import { ARENA_MAX_HEALTH, applyArenaShield, arenaPayout, arenaResult, arenaWeaponDamage, healArenaHealth, weaponCollisionDamage } from './red-blue-arena.ts'

test('winning bet returns the stake and an equal profit', () => {
  assert.equal(arenaPayout('red', 'red', 50), 100)
  assert.equal(arenaPayout('blue', 'red', 50), 0)
})

test('draw refunds the original stake', () => {
  assert.equal(arenaPayout('red', 'draw', 25), 25)
})

test('result uses remaining health', () => {
  assert.equal(arenaResult(4, 2), 'red')
  assert.equal(arenaResult(0, 0), 'draw')
})

test('body collisions only hurt a fighter when the opponent has a weapon', () => {
  assert.deepEqual(weaponCollisionDamage(null, null), { red: 0, blue: 0 })
  assert.deepEqual(weaponCollisionDamage('sword', null), { red: 0, blue: 2 })
  assert.deepEqual(weaponCollisionDamage('gun', 'blade'), { red: 1, blue: 3 })
  assert.deepEqual(weaponCollisionDamage('staff', null), { red: 0, blue: 0 })
})

test('weapons use their configured base damage', () => {
  assert.equal(arenaWeaponDamage('gun'), 3)
  assert.equal(arenaWeaponDamage('sword'), 2)
  assert.equal(arenaWeaponDamage('blade'), 1)
  assert.equal(arenaWeaponDamage('bow'), 1)
  assert.equal(arenaWeaponDamage('staff'), 1)
})

test('food heals exactly one heart without exceeding the maximum', () => {
  assert.equal(healArenaHealth(4), 5)
  assert.equal(healArenaHealth(ARENA_MAX_HEALTH), ARENA_MAX_HEALTH)
})

test('shield blocks one hit and is then consumed', () => {
  assert.deepEqual(applyArenaShield(2, true), { damage: 0, shield: false })
  assert.deepEqual(applyArenaShield(2, false), { damage: 2, shield: false })
})
