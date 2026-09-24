import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = path.join(root, 'src/lib/library-image-formats.json')
let pending

async function optimize() {
  const mapping = {}
  let before = 0
  let after = 0
  const outputDir = path.join(root, 'public/library-optimized')
  await mkdir(outputDir, { recursive: true })
  for (const platform of ['psp', 'switch']) {
    const directory = path.join(root, `public/${platform}-library`)
    for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue
      const file = path.join(entry.parentPath, entry.name)
      const input = await readFile(file)
      if (input.length < 100 * 1024) continue
      const fingerprint = createHash('sha256').update('webp-85-1600-v1').update(input).digest('hex')
      const outputPath = path.join(outputDir, `${fingerprint}.webp`)
      let output
      try { output = await readFile(outputPath) } catch (error) {
        if (error.code !== 'ENOENT') throw error
        output = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85, effort: 4 }).toBuffer()
        if (output.length < input.length) await writeFile(outputPath, output)
      }
      if (output.length >= input.length) continue
      const src = '/' + path.relative(path.join(root, 'public'), file).split(path.sep).join('/')
      mapping[src] = `/library-optimized/${fingerprint}.webp`
      before += input.length
      after += output.length
    }
  }
  const json = JSON.stringify(mapping, null, 2) + '\n'
  let old = ''
  try { old = await readFile(manifest, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (old !== json) await writeFile(manifest, json)
  console.log(`Library images: ${Object.keys(mapping).length} optimized, ${(before / 1048576).toFixed(2)} MB → ${(after / 1048576).toFixed(2)} MB`)
}

export function optimizeLibraryImages() {
  if (!pending) pending = optimize().finally(() => { pending = undefined })
  return pending
}
