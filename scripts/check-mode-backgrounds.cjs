const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const React = require('react')
const { JSDOM } = require('jsdom')
const { createRoot } = require('react-dom/client')

const dom = new JSDOM('<div id="root"></div>')
global.window = dom.window
global.document = dom.window.document
global.IS_REACT_ACT_ENVIRONMENT = true
const source = fs.readFileSync('src/routes/$locale.coin-challenge.tsx', 'utf8')
const ast = ts.createSourceFile('game.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ModeBackground')
const code = ts.transpileModule(component.getText(ast), {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText
const context = { React, useState: React.useState, useEffect: React.useEffect }
vm.createContext(context)
const Background = vm.runInContext(code + ';ModeBackground', context)
const root = createRoot(document.getElementById('root'))
function render(mode) {
  React.act(() => root.render(React.createElement(React.Fragment, null,
    ...['gold', 'ghost'].map(name => React.createElement(Background, {
      key: name, active: mode === name, src: `/coin-challenge-${name}.jpg`,
    })),
  )))
}
render('normal')
assert.equal(document.querySelectorAll('img').length, 0)
render('gold')
assert.equal(document.querySelectorAll('img').length, 1)
assert.ok(document.querySelector('img').src.endsWith('gold.jpg'))
assert.ok(document.querySelector('img').className.includes('opacity-0'))
React.act(() => document.querySelector('img').dispatchEvent(new window.Event('load')))
assert.ok(document.querySelector('img').className.includes('opacity-100'))
render('normal')
assert.ok(document.querySelector('img').className.includes('opacity-0'))
render('ghost')
assert.equal(document.querySelectorAll('img').length, 2)
assert.ok(!source.includes('src="/coin-challenge-position-map.jpg"'))
React.act(() => root.unmount())
console.log('PASS: no initial mode images, on-demand gold/ghost, load-gated fade and cached exit')
