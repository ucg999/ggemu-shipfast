import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sharp = require(process.argv[2] || 'sharp')
const directory = 'public/themes/es-k-team'
const mapping = {}
const report = []
for (const name of await fs.readdir(directory)) {
  if (!name.endsWith('.png')) continue
  const input = await fs.readFile(path.join(directory, name))
  const output = await sharp(input).webp({ lossless: true, effort: 6 }).toBuffer()
  if (output.length >= input.length) continue
  const outputName = name.replace(/\.png$/, '.lossless.webp')
  await fs.writeFile(path.join(directory, outputName), output)
  mapping[`/themes/es-k-team/${name}`] = `/themes/es-k-team/${outputName}`
  report.push({ name, before: input.length, after: output.length })
}
await fs.writeFile('src/lib/theme-image-formats.json', JSON.stringify(mapping, null, 2) + '\n')
console.log(JSON.stringify({ count: report.length, before: report.reduce((n, r) => n + r.before, 0), after: report.reduce((n, r) => n + r.after, 0), examples: report.filter(r => ['ngpc-console.png', 'gbc-console.png', 'dos-console.png', 'wheel.png'].includes(r.name)) }, null, 2))
