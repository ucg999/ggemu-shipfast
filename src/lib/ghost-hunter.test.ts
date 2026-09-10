import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { canPlace, geometry, isLevelComplete, litGhosts, LEVELS, MODULES } from './ghost-hunter.ts'
import type { Placement } from './ghost-hunter.ts'

test('rotation preserves footprints and rotates both lights together', () => {
  assert.deepEqual(geometry(4, 1).cells, [[1, 0], [0, 0]])
  assert.deepEqual(geometry(3, 1).lights, [[1, 0], [0, 1]])
  MODULES.forEach((m, id) => assert.deepEqual(geometry(id, 4).cells, m.cells))
})

test('blue-border footprints reject overlap and edges but accept cutouts', () => {
  const placed: (Placement | null)[] = Array(6).fill(null)
  placed[0] = { x: 0, y: 0, rotation: 0 }
  assert.equal(canPlace(4, { x: 0, y: 0, rotation: 0 }, placed), false)
  assert.equal(canPlace(4, { x: 1, y: 1, rotation: 0 }, placed), true)
  assert.equal(canPlace(4, { x: 3, y: 3, rotation: 0 }, placed), false)
  assert.equal(canPlace(0, placed[0]!, placed), true)
})

test('all three levels have a non-overlapping solution using all six modules', () => {
  for (const level of LEVELS) {
    const placed: (Placement | null)[] = Array(6).fill(null)
  function solve(id: number): boolean {
    if (id === 6) return litGhosts(placed, level.ghosts).length === level.ghosts.length
    for (let rotation = 0; rotation < 4; rotation++) {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const p = { x, y, rotation }
        if (!canPlace(id, p, placed)) continue
        const before = litGhosts(placed, level.ghosts).length
        placed[id] = p
        if (litGhosts(placed, level.ghosts).length === before + MODULES[id].lights.length && solve(id + 1)) return true
        placed[id] = null
      }
    }
    return false
  }
    assert.equal(solve(0), true, `level ${level.id} should be solvable`)
    assert.equal(litGhosts(placed, level.ghosts).length, level.ghosts.length)
    assert.equal(isLevelComplete(placed, level.ghosts), true)
    placed[5] = null
    assert.equal(isLevelComplete(placed, level.ghosts), false, 'the empty module is still required')
  }
})
