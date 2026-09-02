const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')

// Exercise actual round handlers with deterministic landing cells and fake timers.
const source = fs.readFileSync('src/routes/$locale.coin-challenge.tsx', 'utf8')
const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const names = new Set(['createTrackLights', 'pickWeightedWinningTarget', 'safelyRunAudio', 'handleStart', 'playMainSpinAudio', 'celebrateWin', 'playTrackTick', 'playLuckyAudio', 'playPenaltyAudio', 'playJackpotAudio', 'playPoolAudio'])
const functions = []
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.push(node.getText(ast))
  ts.forEachChild(node, visit)
}
visit(ast)
const constants = source.slice(source.indexOf('const COIN_CHALLENGE_STORAGE_KEY'), source.indexOf('export const Route'))
let code = constants + '\n' + functions.join('\n')
code = code.replace(/const target = forceModeExit[\s\S]*?(?=const outcome =)/, 'const target = forcedTarget;\n')
code = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

let checks = 0
// Cover every non-empty subset, with different stake sizes (1–9).
for (let mask = 1; mask < 256; mask++) {
const bets = Array.from({ length: 8 }, (_, index) => mask & (1 << index) ? (mask + index) % 9 + 1 : 0)
for (const mode of ['normal', 'gold', 'ghost']) {
  for (const fault of mask === 255 ? ['none', 'missingSpeech', 'seekThrows', 'playThrows', 'playRejects'] : ['none']) {
    for (let cell = 0; cell < 24; cell++) {
      const timers = []
      const audio = {
        duration: 5, pause() {},
        set currentTime(value) { if (fault === 'seekThrows') throw Error('seek blocked') },
        play() {
          if (fault === 'playThrows') throw Error('play failed')
          return fault === 'playRejects' ? Promise.reject(Error('autoplay blocked')) : Promise.resolve()
        },
      }
      const context = {
        forcedTarget: cell, gameMode: mode, modeRounds: 0,
        Math: Object.assign(Object.create(Math), { random: () => 0.99 }),
        machine: { bets: [...bets], credits: 1000, bonusWin: 1000 },
        collectibleWin: 0, roundWin: 0, activeLight: 0,
        shouldResetAllBets: true, isSpinning: false, compareMode: false,
        poolTransferDisplay: null, creditTransferDisplay: null,
        collectibleWinRef: { current: 0 }, spinTimerRef: { current: null },
        luckyLitLights: [], copy: { creditEmpty: 'empty' },
        window: { setTimeout: fn => { timers.push(fn); return timers.length }, speechSynthesis: fault === 'missingSpeech' ? undefined : { cancel() {} }, alert: message => { throw Error(message) } },
        readRtpLedger: () => ({ paid: 10000, wagered: 10000 }), saveRtpLedger() {},
      }
      for (const ref of source.matchAll(/const (\w+Ref) = useRef/g)) {
        if (!(ref[1] in context)) context[ref[1]] = { current: ref[1].includes('AudioRef') ? audio : null }
      }
      for (const setter of source.matchAll(/\b(set[A-Z]\w+)\(/g)) {
        const key = setter[1][3].toLowerCase() + setter[1].slice(4)
        context[setter[1]] = value => { context[key] = typeof value === 'function' ? value(context[key]) : value }
      }
      context.updateMachine = updater => { context.machine = updater(context.machine) }
      vm.createContext(context)
      vm.runInContext(code + '\nhandleStart()', context)
      let steps = 0
      while (timers.length) {
        assert.ok(++steps < 2000, 'timer loop did not finish')
        timers.shift()()
      }
      const label = `bets=${mask}/${mode}/${fault}/cell ${cell + 1}`
      assert.equal(context.isSpinning, false, label + ' locked')
      assert.equal(context.shouldResetAllBets, true, label + ' repeat bet not ready')
      assert.ok(Number.isFinite(context.machine.credits) && context.machine.credits >= 0, label + ' invalid credits')
      assert.ok(Number.isFinite(context.collectibleWin), label + ' invalid payout')
      if (![2, 4, 9, 21].includes(cell)) {
        const payout = vm.runInContext(`machine.bets[TRACK_LIGHTS[${cell}].option] * TRACK_LIGHTS[${cell}].multiplier`, context)
        assert.equal(context.collectibleWin, mode === 'ghost' ? 0 : payout * (mode === 'gold' ? 2 : 1), label + ' payout')
        if (mode === 'ghost') assert.equal(context.machine.bonusWin, 1000 - payout, label + ' deduction')
      } else if (mode !== 'normal') {
        assert.equal(context.gameMode, 'normal', label + ' exit failed')
        assert.equal(context.collectibleWin, 0, label + ' exit paid unexpectedly')
      } else if (cell === 2 || cell === 4) {
        assert.equal(context.gameMode, cell === 2 ? 'gold' : 'ghost', label + ' entry failed')
      } else if (cell === 21 || cell === 9) {
        const selectedPayout = vm.runInContext(`(() => {
          const candidates = TRACK_LIGHTS.filter(light => light.option !== null)
          const selected = candidates[Math.floor(0.99 * candidates.length)]
          return machine.bets[selected.option] * selected.multiplier
        })()`, context)
        if (cell === 21) {
          assert.equal(context.collectibleWin, selectedPayout * 3, label + ' lucky total')
        } else {
          assert.equal(context.collectibleWin, 0, label + ' bomb must not award coins')
          assert.equal(context.machine.bonusWin, 1000 - selectedPayout, label + ' bomb deduction')
        }
      }
      checks++
    }
  }
}
}
console.log(`PASS: ${checks} cases; all 255 bet subsets, 24 cells, 3 modes and audio failures`)
