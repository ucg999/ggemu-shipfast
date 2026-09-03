const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
const source = fs.readFileSync('src/routes/$locale.coin-challenge.tsx', 'utf8')
const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let cashOut, emptyEffect
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'cashOutOnExit') cashOut = node.initializer.getText(ast)
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes("machine.credits + machine.bonusWin + collectibleWin <= 0")) emptyEffect = node.arguments[0].getText(ast)
  ts.forEachChild(node, visit)
}
visit(ast)
assert.ok(cashOut && emptyEffect)
const compile = value => ts.transpileModule(`(${value})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
for (const mode of ['normal', 'gold', 'ghost']) {
  let refunded = 0
  const context = { gameModeRef: { current: mode }, machineRef: { current: { credits: 30, bonusWin: 20 } }, collectibleWinRef: { current: 10 }, stopCreditHold() {}, addCoinBalance(amount) { refunded += amount }, createEmptyChallengeState: () => ({ credits: 0, bonusWin: 0, bets: Array(8).fill(0) }), saveCoinChallengeState() {} }
  for (const match of source.matchAll(/const (\w+Ref) = useRef/g)) if (!(match[1] in context)) context[match[1]] = { current: null }
  for (const match of source.matchAll(/\b(set[A-Z]\w+)\(/g)) context[match[1]] = () => {}
  vm.runInNewContext(compile(cashOut), context)
  assert.equal(refunded, mode === 'ghost' ? 0 : 60)
  assert.equal(context.machineRef.current.credits + context.machineRef.current.bonusWin + context.collectibleWinRef.current, 0)
}
for (const pools of [[0,0,0], [1,0,0], [0,1,0], [0,0,1]]) {
  let mode = 'ghost'
  vm.runInNewContext(compile(emptyEffect), { gameMode: mode, isSpinning: false, machine: { credits: pools[0], bonusWin: pools[1] }, collectibleWin: pools[2], setGameMode(value) { mode = value }, setModeRounds() {} })
  assert.equal(mode, pools.some(Boolean) ? 'ghost' : 'normal')
}
console.log('PASS: ghost page exit forfeits pools; normal/gold refund; only all-empty pools auto-exit')
