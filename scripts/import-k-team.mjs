import fs from 'node:fs'
import path from 'node:path'

const source = process.argv[2] || 'E:/RetroBat/emulationstation/.emulationstation/themes/ES-K-team'
const target = 'public/themes/es-k-team'
fs.mkdirSync(target, { recursive: true })
const keys = ['allgames','favorites','lastplayed','arcade','mame','nes','gba','dos','flash','gb','gbc','gamegear','megadrive','html5','j2me','mastersystem','ngpc','n64','nds','switch','pcengine','psx','psp','sega32x','segacd','saturn','snes','virtualboy','wonderswan','wonderswancolor','atarijaguar']
const manifest = {}
function copy(relative, output) {
  if (!fs.existsSync(path.join(source, relative))) return null
  fs.copyFileSync(path.join(source, relative), path.join(target, output))
  return `/themes/es-k-team/${output}`
}
function value(block, tag, fallback) {
  const matches = [...block.matchAll(new RegExp(`<${tag}([^>]*)>([^<]*)</${tag}>`, 'g'))]
  return (matches.find(m => m[1].includes('rightwheel')) || matches[0])?.[2]?.trim() || fallback
}
function pair(block, tag, fallback) { return value(block, tag, fallback).split(/\s+/).map(Number) }
for (const key of keys) {
  const layoutKey = key === 'dos' ? 'pc' : ['allgames','favorites','lastplayed'].includes(key) ? `auto-${key === 'allgames' ? 'allgames' : key === 'lastplayed' ? 'lastplayed' : 'favorites'}` : key
  const assetKey = ['allgames','favorites','lastplayed'].includes(key) ? `auto-${key === 'allgames' ? 'allgames' : key === 'lastplayed' ? 'lastplayed' : 'favorites'}` : key
  const xmlPath = path.join(source, 'layouts', layoutKey, 'default.xml')
  const xml = fs.existsSync(xmlPath) ? fs.readFileSync(xmlPath, 'utf8') : ''
  const consoleBlock = xml.match(/<image name="console"[\s\S]*?<\/image>/)?.[0] || ''
  const videoBlock = xml.match(/<video name="gamevideo"[\s\S]*?<\/video>/)?.[0] || ''
  const logo = copy(`art/logos/${assetKey}.png`, `${key}-logo.png`) || copy(`art/logos/${assetKey}.svg`, `${key}-logo.svg`) || copy(`art/clean/${assetKey}.svg`, `${key}-logo.svg`)
  manifest[key] = {
    logo,
    background: copy(`assets/arts/${assetKey}.jpeg`, `${key}-background.jpeg`) || '/themes/es-k-team/default-background.jpeg',
    console: copy(['allgames','favorites','lastplayed'].includes(key) ? 'layouts/default.png' : `layouts/${layoutKey}/ecran_console.png`, `${key}-console.png`),
    pointer: copy(`art/wheel/pointers/${assetKey}.png`, `${key}-pointer.png`) || '/themes/es-k-team/pointer.png',
    description: xml.match(/<text name="info1"[^>]*>\s*<text>([\s\S]*?)<\/text>/)?.[1]?.trim() || '',
    consolePosition: pair(consoleBlock, 'pos', '0.18 0.715'),
    consoleSize: pair(consoleBlock, 'maxSize', '0.45 0.45'),
    videoPosition: pair(videoBlock, 'pos', '0.04 0.53'),
    videoSize: pair(videoBlock, 'size', '0.216 0.288'),
  }
}
copy('assets/arts/default.jpeg', 'default-background.jpeg')
copy('art/wheel/light.png', 'wheel.png')
copy('art/wheel/pointers/default.png', 'pointer.png')
copy('art/sounds/scroll1A.wav', 'scroll.wav')
copy('art/fonts/Saira_SMedium.ttf', 'Saira.ttf')
fs.writeFileSync('src/lib/k-team-assets.json', JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(`${target}/SOURCE.txt`, 'Assets copied from the user-provided ES-K-team theme for local website adaptation. Original artwork and trademarks remain with their respective owners. No new license is granted.\n')
console.log(`Imported ${keys.length} platform definitions; missing logos: ${keys.filter(k => !manifest[k].logo).join(', ')}`)
