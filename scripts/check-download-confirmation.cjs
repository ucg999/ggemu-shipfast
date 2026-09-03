const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')
for (const [path, name, mobile] of [
  ['src/components/site-layout.tsx', 'handlePaidResourceClick', false],
  ['src/components/home/default-template.tsx', 'paidLink', true],
]) {
  const source = fs.readFileSync(path, 'utf8')
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let handler
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) handler = node.getText(ast)
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) handler = `const ${node.getText(ast)}`
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(handler)
  for (const confirmed of [false, true]) {
    for (const unlocked of [false, true]) {
      let prevented = false, unlockCalls = 0, alerts = 0
      const context = { locale: 'zh-CN', lang: 'zh-CN', event: { preventDefault() { prevented = true } },
        confirmResourceDownload: () => confirmed,
        unlockPaidResource: () => { unlockCalls++; return unlocked },
        window: { alert() { alerts++ } },
        getResourceCoinCopy: () => ({ insufficient: '余额不足' }),
        getMobileResourceCoinCopy: () => '余额不足',
      }
      const invocation = mobile ? `${name}('psp-library', 20)(event)` : `${name}(event, 'psp-library', 20)`
      vm.runInNewContext(ts.transpileModule(handler + '\n' + invocation, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context)
      assert.equal(unlockCalls, confirmed ? 1 : 0)
      assert.equal(prevented, !confirmed || !unlocked)
      assert.equal(alerts, confirmed && !unlocked ? 1 : 0)
    }
  }
}
console.log('PASS: desktop/mobile cancel never unlocks; confirmed links follow existing balance checks')
