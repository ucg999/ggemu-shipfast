const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const source = fs.readFileSync('src/routes/$locale.coin-challenge.tsx', 'utf8')
const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ['createTrackLights', 'chooseStandardTarget'].includes(node.name?.text)).map(node => node.getText(ast))
const constants = source.slice(source.indexOf('const COIN_CHALLENGE_STORAGE_KEY'), source.indexOf('export const Route'))
const context = vm.createContext({})
vm.runInContext(ts.transpileModule(constants + '\n' + functions.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
const groups = vm.runInContext('LANDING_GROUPS', context)
const lights = vm.runInContext('TRACK_LIGHTS', context)
const choose = vm.runInContext('chooseStandardTarget', context)
assert.deepEqual(Array.from(groups, group => group.weight), [16.25,16.25,20,15,5,9,8,6,2.5,2])
assert.equal(Array.from(groups).reduce((sum, group) => sum + group.weight, 0), 100)
const weights = Object.fromEntries(Array.from(groups, group => [group.name, group.weight]))
assert.deepEqual([weights.x2 + weights.x3, weights.five, weights.ten, weights.bomb + weights.ghost, weights.twenty, weights.gold + weights.lucky, weights.hundred], [32.5,20,15,14,8,8.5,2])
const cells = Array.from(groups).flatMap(group => Array.from(group.cells))
assert.equal(cells.length, 24)
assert.equal(new Set(cells).size, 24)
const multipliers = { x2: 2, x3: 3, five: 5, ten: 10, twenty: 20, hundred: 100 }
for (const group of groups) {
  for (const cell of group.cells) {
    if (multipliers[group.name]) assert.equal(lights[cell].multiplier, multipliers[group.name])
  }
}
const counts = Array(24).fill(0)
// Stratified rolls check category weights and equal shares within each category.
for (let i = 0; i < 10000; i++) {
  for (let j = 0; j < 60; j++) {
    let call = 0
    counts[choose(() => call++ === 0 ? (i + 0.5) / 10000 : (j + 0.5) / 60)]++
  }
}
for (const group of groups) {
  for (const cell of group.cells) assert.equal(counts[cell], 600000 * group.weight / 100 / group.cells.length)
}
assert.ok(!source.includes('payoutBudget'))
assert.ok(!source.includes('scaledWinRate'))
console.log('PASS: 600000 stratified rolls; exact category weights, equal cell shares, all 24 cells covered')
