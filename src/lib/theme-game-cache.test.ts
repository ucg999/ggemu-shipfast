import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createThemeGameCache } from './theme-game-cache.ts'

test('concurrent loads share one request and completed results survive subsequent loads', async () => {
  const cache = createThemeGameCache<string[]>()
  let calls = 0
  const fetcher = async () => { calls++; return ['game'] }
  const [first, second] = await Promise.all([cache.load('platform', fetcher), cache.load('platform', fetcher)])
  assert.deepEqual(first, ['game'])
  assert.strictEqual(first, second)
  assert.strictEqual(await cache.load('platform', fetcher), first)
  assert.equal(calls, 1)
})

test('failed and expired requests can be retried, and locales remain separate', async () => {
  const cache = createThemeGameCache<string[]>(0)
  await assert.rejects(cache.load('zh:arcade', async () => { throw Error('offline') }))
  assert.deepEqual(await cache.load('zh:arcade', async () => ['first']), ['first'])
  assert.deepEqual(await cache.load('zh:arcade', async () => ['updated']), ['updated'])
  assert.deepEqual(await cache.load('en:arcade', async () => ['english']), ['english'])
})
