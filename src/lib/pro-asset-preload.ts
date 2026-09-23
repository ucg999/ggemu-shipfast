type PreloadStage = 'initial' | 'expanded'

const INITIAL_PRO_ASSETS = [
  '/themes/es-k-team/allgames-background-1920.jpeg',
  '/themes/es-k-team/allgames-console.lossless.webp',
  '/themes/es-k-team/allgames-logo-800.lossless.webp',
  '/themes/es-k-team/allgames-pointer.lossless.webp',
]

const EXPANDED_PRO_ASSETS = [
  '/themes/es-k-team/mame-background-1920.jpeg',
  '/themes/es-k-team/mame-console.lossless.webp',
  '/themes/es-k-team/nes-background-1920.jpeg',
  '/themes/es-k-team/nes-console.lossless.webp',
  '/themes/es-k-team/gba-background-1920.jpeg',
  '/themes/es-k-team/gba-console.lossless.webp',
]

const requestedAssets = new Set<string>()

function allowsBackgroundPreload() {
  if (typeof navigator === 'undefined') return false
  const connection = (navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean }
  }).connection
  if (connection?.saveData) return false
  return connection?.effectiveType !== 'slow-2g' && connection?.effectiveType !== '2g'
}

export function preloadProModeAssets(stage: PreloadStage) {
  if (typeof window === 'undefined' || !allowsBackgroundPreload()) return
  const assets = stage === 'initial'
    ? INITIAL_PRO_ASSETS
    : [...INITIAL_PRO_ASSETS, ...EXPANDED_PRO_ASSETS]

  for (const source of assets) {
    if (requestedAssets.has(source)) continue
    requestedAssets.add(source)
    const image = new Image()
    image.decoding = 'async'
    image.fetchPriority = 'low'
    image.src = source
  }
}

export function scheduleInitialProModePreload() {
  if (typeof window === 'undefined') return () => {}
  let cancelled = false
  const run = () => { if (!cancelled) preloadProModeAssets('initial') }
  const idleWindow = window as Window & {
    cancelIdleCallback?: (id: number) => void
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }
  if (typeof idleWindow.requestIdleCallback === 'function') {
    const id = idleWindow.requestIdleCallback(run, { timeout: 4000 })
    return () => { cancelled = true; idleWindow.cancelIdleCallback?.(id) }
  }
  const id = globalThis.setTimeout(run, 1800)
  return () => { cancelled = true; globalThis.clearTimeout(id) }
}
