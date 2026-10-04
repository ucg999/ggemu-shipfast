import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const directory = 'public/themes/es-k-team'
const names = (await fs.readdir(directory))
  .filter(name => /-console\.png$/i.test(name))

const report = []
for (const name of names) {
  const inputPath = path.join(directory, name)
  const outputName = name.replace(/-console\.png$/i, '-console-720.webp')
  const outputPath = path.join(directory, outputName)
  await sharp(inputPath)
    .rotate()
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 68, alphaQuality: 82, effort: 6, smartSubsample: true })
    .toFile(outputPath)
  const stat = await fs.stat(outputPath)
  report.push({ name: outputName, bytes: stat.size })
}

console.log(JSON.stringify({
  count: report.length,
  bytes: report.reduce((sum, item) => sum + item.bytes, 0),
}, null, 2))
