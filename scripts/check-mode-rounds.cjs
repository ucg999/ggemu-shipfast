const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const source = fs.readFileSync('src/routes/$locale.coin-challenge.tsx', 'utf8')
const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['createTrackLights', 'chooseModeTarget'].includes(node.name?.text)).map(node => node.getText(ast))
const constants = source.slice(source.indexOf('const COIN_CHALLENGE_STORAGE_KEY'), source.indexOf('export const Route'))
const code = ts.transpileModule(constants + '\n' + functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const context = vm.createContext({})
vm.runInContext(code, context)
const choose = vm.runInContext('chooseModeTarget', context)
const lights = vm.runInContext('TRACK_LIGHTS', context)
const exits = [2, 4, 9, 21]
let cases = 0
for (const mode of ['gold', 'ghost']) {
  for (let mask = 1; mask < 256; mask++) {
    const bets = Array.from({ length: 8 }, (_, index) => mask & (1 << index) ? 1 : 0)
    for (let suggested = 0; suggested < 24; suggested++) {
      for (let rounds = 0; rounds <= 4; rounds++) {
        const target = choose(mode, rounds, suggested, bets, () => rounds === 0 ? 0 : 0.999999)
        if (rounds >= 3) assert.ok(exits.includes(target), 'fourth spin must exit')
        else {
          assert.ok(!exits.includes(target), 'continuing round must not exit early')
          assert.ok(lights[target].option !== null)
          if (!exits.includes(suggested)) assert.equal(target, suggested, 'unwagered landings must remain possible')
        }
        cases++
      }
    }
  }
}

for (const mode of ['gold', 'ghost']) {
  const expected = mode === 'gold' ? [0.6, 0.3, 0.1] : [0.1, 0.3, 0.6]
  let survival = 1
  for (let rounds = 1; rounds <= 3; rounds++) {
    let exitCount = 0
    for (let i = 0; i < 10000; i++) {
      if (exits.includes(choose(mode, rounds, 0, Array(8).fill(1), () => (i + 0.5) / 10000))) exitCount++
    }
    const conditional = exitCount / 10000
    assert.ok(Math.abs(survival * conditional - expected[rounds - 1]) < 0.0001)
    survival *= 1 - conditional
  }
}
console.log(`PASS: ${cases} mode/round/bet/target cases; gold 60/30/10, ghost 10/30/60; fourth spin exits`)
