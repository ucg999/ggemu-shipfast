import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const directory = 'public/themes/es-k-team'
const names = await fs.readdir(directory)
const targets = [
  { pattern: /(?:^|-)pointer\.png$/i, width: 54, height: 96 },
]

const report = []
for (const target of targets) {
  for (const name of names.filter(item => target.pattern.test(item))) {
    const inputPath = path.join(directory, name)
    const outputName = name.replace(/\.png$/i, '.pixel.webp')
    const outputPath = path.join(directory, outputName)
    await sharp(inputPath)
      .resize({
        width: target.width,
        height: target.height,
        fit: 'inside',
        kernel: sharp.kernel.nearest,
        withoutEnlargement: true,
      })
      .webp({ lossless: true, effort: 6 })
      .toFile(outputPath)
    const stat = await fs.stat(outputPath)
    report.push({ name: outputName, bytes: stat.size })
  }
}

console.log(JSON.stringify({
  count: report.length,
  bytes: report.reduce((sum, item) => sum + item.bytes, 0),
  pointers: report.filter(item => item.name.includes('-pointer.')).length,
}, null, 2))
