import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import ts from 'typescript'

const manifestPath = new URL('../src/lib/library-updates.json', import.meta.url)
const root = new URL('../', import.meta.url)

export async function syncLibraryUpdates() {
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const next = {}
  for (const platform of ['switch', 'psp']) {
    const source = readFileSync(new URL(`src/lib/${platform}-library.ts`, root), 'utf8')
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
    const data = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
    for (const game of data[`${platform.toUpperCase()}_LIBRARY_GAMES`]) {
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
  }
  const json = JSON.stringify(next, null, 2) + '\n'
  if (!existsSync(manifestPath) || readFileSync(manifestPath, 'utf8') !== json) writeFileSync(manifestPath, json)
}

export function libraryUpdatesPlugin() {
  return {
    name: 'library-content-updates',
    buildStart: syncLibraryUpdates,
    async handleHotUpdate({ file }) {
      if (/(?:psp|switch)-library\.ts$/.test(file) || /public[\\/](?:psp|switch)-library[\\/]/.test(file)) {
        await syncLibraryUpdates()
      }
    },
  }
}
