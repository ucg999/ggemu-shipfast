const assert = require('node:assert/strict')
const fs = require('node:fs')
const { createRouter, createRootRoute, createRoute, createMemoryHistory } = require('@tanstack/react-router')

// Use the production reload policy with a deterministic catalogue.
const source = fs.readFileSync('src/routes/$locale.tsx', 'utf8')
const policy = source.match(/shouldReload: (\([^\n]+),\r?\n/)[1]
const shouldReload = Function(`return (${policy})`)()
async function main() {
  let requests = 0
  let failed = false
  const root = createRootRoute()
  const parent = createRoute({
    getParentRoute: () => root, path: '$locale', staleTime: 0,
    staleReloadMode: 'blocking', shouldReload,
    loader: ({ location, params }) => {
      if (location.pathname.replace(/\/$/, '') !== `/${params.locale}`) return { games: [] }
      requests++
      return failed ? { games: [], loadFailed: true } : { games: ['game'] }
    },
  })
  const home = createRoute({ getParentRoute: () => parent, path: '/' })
  const game = createRoute({ getParentRoute: () => parent, path: 'coin-challenge' })
  const router = createRouter({
    routeTree: root.addChildren([parent.addChildren([home, game])]),
    history: createMemoryHistory({ initialEntries: ['/zh-CN/coin-challenge'] }),
    isServer: false,
  })
  await router.load()
  assert.equal(requests, 0, 'inner route should not load catalogue')
  await router.navigate({ to: '/zh-CN' })
  const data = () => router.state.matches.find(m => m.routeId === '/$locale').loaderData
  assert.equal(data().games.length, 1, 'return from direct inner entry must load games')
  for (let i = 0; i < 5; i++) {
    await router.navigate({ to: '/zh-CN/coin-challenge' })
    await router.navigate({ to: '/zh-CN' })
    assert.equal(data().games.length, 1, 'repeated return must retain games')
  }
  failed = true
  await router.invalidate({ sync: true })
  assert.equal(data().loadFailed, true)
  failed = false
  await router.invalidate({ sync: true })
  assert.equal(data().games.length, 1, 'retry must recover without waiting for cache expiry')
  console.log('PASS: direct inner entry, 5 return cycles, failed load and retry')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
