import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import ts from 'typescript'
import { optimizeLibraryImages } from './optimize-library-images.mjs'

const manifestPath = new URL('../src/lib/library-updates.json', import.meta.url)
const root = new URL('../', import.meta.url)

export async function syncLibraryUpdates() {
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const next = {}
  for (const platform of ['switch', 'psp']) {
    const source = readFileSync(new URL(`src/lib/${platform}-library.ts`, root), 'utf8')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
    const data = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    const games = data[`${platform.toUpperCase()}_LIBRARY_GAMES`]
    for (const game of games) {
      const { updatedAt, popularity, cardLanguage, ...content } = game
      const hash = createHash('sha256').update(JSON.stringify(content))
      for (const image of [game.cover, game.detailCover, game.boxCover, ...game.screenshots].filter(Boolean)) {
        if (image.startsWith('/')) hash.update(readFileSync(new URL(`public${image}`, root)))
      }
      const fingerprint = hash.digest('hex')
      const key = `${platform}/${game.id}`
      const old = previous[key]
      next[key] = {
        fingerprint,
        // Preserve unknown historical dates when establishing the initial baseline.
        updatedAt: old?.fingerprint === fingerprint ? old.updatedAt : old ? new Date().toISOString() : updatedAt ?? null,
      }
    }
    const libraryKey = `${platform}/__library__`
    const oldLibrary = previous[libraryKey]
    const libraryFingerprint = createHash('sha256')
      .update(games.map(game => next[`${platform}/${game.id}`]?.fingerprint ?? '').join('|'))
      .digest('hex')
    next[libraryKey] = {
      count: games.length,
      fingerprint: libraryFingerprint,
      changedAt: getChangedAt(oldLibrary, libraryFingerprint, latestGameDate(games)),
    }
  }
  for (const library of ['fc-cartridges', 'gb-cartridges']) {
    const sourcePath = new URL(`src/components/${library === 'fc-cartridges' ? 'fc' : 'gb'}-cartridge-library.tsx`, root)
    const source = readFileSync(sourcePath, 'utf8')
    const variableName = library === 'fc-cartridges' ? 'FC_CARTRIDGES' : 'CARTRIDGES'
    const cartridgeData = readArrayLiteral(source, variableName)
    const count = cartridgeData.count
    // Only the cartridge catalog is an update. Layout, wording and button changes
    // must not make the navigation look like new games were added.
    const libraryFingerprint = createHash('sha256').update(cartridgeData.content).digest('hex')
    const key = `${library}/__library__`
    const old = previous[key]
    next[key] = {
      count,
      fingerprint: libraryFingerprint,
      changedAt: getChangedAt(old, libraryFingerprint, null),
    }
  }
  const json = JSON.stringify(next, null, 2) + '\n'
  if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== json) writeFileSync(manifestPath, json)
}

function getChangedAt(old, fingerprint, initialChangedAt) {
  const previousFingerprint = old?.fingerprint
  const previousChangedAt = old?.changedAt ?? old?.addedAt ?? old?.updatedAt ?? null
  if (typeof previousFingerprint === 'string') {
    return previousFingerprint === fingerprint ? previousChangedAt : new Date().toISOString()
  }
  // Migrating an existing count-only marker must not make every library flash.
  return previousChangedAt ?? initialChangedAt
}

function latestGameDate(games) {
  const latest = Math.max(0, ...games.map(game => Date.parse(game.updatedAt ?? '') || 0))
  return latest ? new Date(latest).toISOString() : null
}

function readArrayLiteral(source, variableName) {
  const sourceFile = ts.createSourceFile('library.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let result = { content: '[]', count: 0 }
  const visit = node => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === variableName
      && node.initializer) {
      let initializer = node.initializer
      while (ts.isAsExpression(initializer) || ts.isSatisfiesExpression(initializer) || ts.isParenthesizedExpression(initializer)) {
        initializer = initializer.expression
      }
      if (ts.isArrayLiteralExpression(initializer)) {
        result = {
          content: initializer.getText(sourceFile),
          count: initializer.elements.length,
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return result
}

export function libraryUpdatesPlugin() {
  return {
    name: 'library-content-updates',
    async buildStart() {
      await optimizeLibraryImages()
      await syncLibraryUpdates()
    },
    async handleHotUpdate({ file }) {
      if (/(?:psp|switch)-library\.ts$/.test(file) || /(?:fc|gb)-cartridge-library\.tsx$/.test(file) || /public[\\/](?:psp|switch)-library[\\/]/.test(file)) {
        await optimizeLibraryImages()
        await syncLibraryUpdates()
      }
    },
  }
}
