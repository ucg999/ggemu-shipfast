const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const assert = require('node:assert/strict')

function extract(path, names) {
  const source = fs.readFileSync(path, 'utf8')
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(ast))
  return ts.transpileModule(declarations.join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
const selection = extract('src/components/home/default-template.tsx', ['selectDailyVideoGames', 'dailyGameScore', 'getGameId', 'getLocalDateKey'])
let cases = 0
for (let count = 0; count <= 50; count++) {
  for (let day = 0; day < 7; day++) {
    class TestDate extends Date {
      constructor(...args) { super(...(args.length ? args : [2026, 7, 31 + day])) }
    }
    const games = Array.from({ length: count }, (_, index) => ({ _id: String(index), game_video: 'video.mp4' }))
    const context = { Date: TestDate, games }
    vm.createContext(context)
    const result = vm.runInContext(selection + ';selectDailyVideoGames(games, 5)', context)
    assert.equal(result.length, Math.min(5, count), `count=${count}, day=${day}`)
    assert.equal(new Set(result.map(game => game._id)).size, result.length)
    cases++
  }
}
async function checkFailures() {
  const loader = extract('src/routes/$locale.tsx', ['loadMostPlayedVideoGames'])
  for (const failures of [0, 1, 2]) {
    let calls = 0
    const context = { searchGames: async () => {
      if (calls++ < failures) throw Error('timeout')
      return { games: [{ _id: 'video', game_video: 'video.mp4' }, { _id: 'no-video' }] }
    } }
    vm.createContext(context)
    const result = await vm.runInContext(loader + ';loadMostPlayedVideoGames("zh-CN")', context)
    assert.equal(result.loadFailed, failures > 0)
    assert.equal(result.games.length, failures === 2 ? 0 : 1)
  }
  console.log(`PASS: ${cases} daily selection cases; success, partial failure and total failure`)
}
checkFailures().catch(error => { console.error(error); process.exitCode = 1 })
