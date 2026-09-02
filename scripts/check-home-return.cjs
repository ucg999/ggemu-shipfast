const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRouter, createRootRoute, createRoute, createMemoryHistory } = require('@tanstack/react-router')
const parentSource = fs.readFileSync('src/routes/$locale.tsx', 'utf8')
const homeSource = fs.readFileSync('src/routes/$locale.index.tsx', 'utf8')
assert.ok(!/loader:\s*async/.test(parentSource), 'parent must not own homepage data')
assert.ok(homeSource.includes("createFileRoute('/$locale/')"))
assert.ok(!homeSource.includes("staleReloadMode: 'blocking'"))
async function main() {
  let requests = 0
  let release
  let delay = false
  const root = createRootRoute()
  const parent = createRoute({ getParentRoute: () => root, path: '$locale' })
  const home = createRoute({
    getParentRoute: () => parent, path: '/', staleTime: 0,
    loader: async () => {
      requests++
      if (delay) await new Promise(resolve => { release = resolve })
      return { games: ['recommendation'], mostPlayedGames: ['video'] }
    },
  })
  const game = createRoute({ getParentRoute: () => parent, path: 'coin-challenge' })
  const router = createRouter({
    routeTree: root.addChildren([parent.addChildren([home, game])]),
    history: createMemoryHistory({ initialEntries: ['/zh-CN/coin-challenge'] }),
    isServer: false, defaultPreload: 'intent', defaultPreloadStaleTime: 0,
  })
  const data = () => router.state.matches.find(m => m.routeId === '/$locale/').loaderData
  await router.load()
  assert.equal(requests, 0)
  await router.navigate({ to: '/zh-CN' })
  assert.equal(data().games.length, 1)
  for (let i = 0; i < 5; i++) {
    await router.preloadRoute({ to: '/zh-CN/coin-challenge' })
    await router.navigate({ to: '/zh-CN/coin-challenge' })
    delay = true
    await router.navigate({ to: '/zh-CN' })
    assert.deepEqual(data(), { games: ['recommendation'], mostPlayedGames: ['video'] },
      'cached recommendations and videos must remain visible during delayed reload')
    delay = false
    if (release) release()
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  console.log('PASS: isolated index loader, direct inner entry, 5 preload/return cycles with delayed reload')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
