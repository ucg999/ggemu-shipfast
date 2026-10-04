import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const directory = 'public/themes/es-k-team'
const names = (await fs.readdir(directory))
  .filter(name => /-background\.jpeg$/i.test(name) && !/-\d+\.jpeg$/i.test(name))

const variants = [
  { width: 960, suffix: '-960.webp', quality: 66 },
  { width: 1280, suffix: '-1280.webp', quality: 69 },
  { width: 1920, suffix: '-1920.webp', quality: 72 },
]

const report = []
for (const name of names) {
  const inputPath = path.join(directory, name)
  for (const variant of variants) {
    const outputName = name.replace(/\.jpeg$/i, variant.suffix)
    const outputPath = path.join(directory, outputName)
    await sharp(inputPath)
      .rotate()
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality, effort: 5 })
      .toFile(outputPath)
    const stat = await fs.stat(outputPath)
    report.push({ name: outputName, bytes: stat.size })
  }
}

console.log(JSON.stringify({ count: report.length, bytes: report.reduce((sum, item) => sum + item.bytes, 0) }, null, 2))
