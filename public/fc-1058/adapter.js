import Video from './vendors/Video.js'
import Audio from './vendors/Audio.js'

const WIDTH = 256
const HEIGHT = 240
const INPUT = { b: 0, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8 }
const offscreen = document.createElement('canvas')
offscreen.width = WIDTH
offscreen.height = HEIGHT

let retro = null
let audio = null
let corePromise = null
let ready = false
let paused = false
let muted = false
let speed = 1
let activeGameId = 'green-beret-captain-america'
let hasLoadedGame = false
let emulationTimer = 0

function startEmulationTimer() {
  if (emulationTimer) window.clearInterval(emulationTimer)
  emulationTimer = window.setInterval(() => {
    if (!ready || paused || document.hidden || !retro) return
    for (let step = 0; step < speed; step += 1) retro.iterate()
  }, 1000 / 60)
}

function bytesToBase64(bytes) {
  let binary = ''
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function checksum(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function encodeState(buffer) {
  const raw = new Uint8Array(buffer)
  if (window.CompressionStream) {
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
    return { format: 'gzip-base64-v1', data: bytesToBase64(compressed), checksum: await checksum(compressed), rawSize: raw.length }
  }
  return { format: 'base64-v1', data: bytesToBase64(raw), checksum: await checksum(raw), rawSize: raw.length }
}

async function decodeState(payload) {
  if (!payload || typeof payload.data !== 'string') throw new Error('存档格式不正确')
  const packed = base64ToBytes(payload.data)
  if (payload.checksum && await checksum(packed) !== payload.checksum) throw new Error('存档校验失败')
  if (payload.format === 'gzip-base64-v1') {
    if (!window.DecompressionStream) throw new Error('当前浏览器不能解压云存档')
    return new Response(new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  }
  return packed.buffer
}

function localStateKey() {
  return `ucg999-fc-mesen-state:${activeGameId}`
}

async function ensureCore() {
  if (retro) return retro
  if (!corePromise) {
    const coreConfig = {
      video: new Video(offscreen),
      audio: new Audio(),
      locateFile(path) { return `/fc-1058/wasm/${path}` },
    }
    audio = coreConfig.audio
    corePromise = libretro(coreConfig).then(instance => {
      retro = instance
      return instance
    })
  }
  return corePromise
}

window.GGEMU_CORE = {
  id: 'nes-mesen-1058',
  name: 'Mesen',
  pad: {
    actions: [{ id: 'b', label: 'B' }, { id: 'a', label: 'A' }],
    capsules: [{ id: 'select', label: 'SELECT' }, { id: 'start', label: 'START' }],
  },
  video() { return { w: WIDTH, h: HEIGHT } },
  source() { return offscreen },
  boot(romData, api) {
    ready = false
    paused = false
    activeGameId = String(api.gameId || 'green-beret-captain-america').replace(/[^a-z0-9_-]/gi, '_')
    const bytes = romData instanceof Uint8Array ? romData : new Uint8Array(romData)
    ensureCore().then(instance => {
      if (hasLoadedGame) {
        try { instance.unloadGame() } catch (error) {}
      }
      instance.loadArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), `${activeGameId}.nes`)
      hasLoadedGame = true
      instance.skip_frame(1)
      instance.setPaused(false)
      ready = true
      audio.volume = muted ? 0 : 1
      audio?.ctx?.resume?.().catch(() => {})
      startEmulationTimer()
      api.onReady()
    }).catch(error => {
      console.error('[FC1058]', error)
      api.toast('ROM 解析失败')
    })
    return true
  },
  tick() {},
  setSpeed(value) { speed = value === 4 ? 4 : value === 2 ? 2 : 1 },
  setPaused(value) {
    paused = Boolean(value)
    retro?.setPaused(paused)
    if (paused) audio?.ctx?.suspend?.().catch(() => {})
    else audio?.ctx?.resume?.().catch(() => {})
  },
  setMuted(value) {
    muted = Boolean(value)
    if (audio) audio.volume = muted ? 0 : 1
  },
  setButton(id, pressed) {
    if (!retro || typeof INPUT[id] !== 'number') return
    retro.input_user_state[0][INPUT[id]] = Boolean(pressed)
  },
  setCheatCodes() { return 0 },
  clearCheats() {},
  readMemory() { return null },
  activateAudio() { audio?.ctx?.resume?.().catch(() => {}) },
  resumeAudio() { audio?.ctx?.resume?.().catch(() => {}) },
  async saveState() {
    if (!retro || !ready) return
    try {
      const payload = await encodeState(retro.getState())
      localStorage.setItem(localStateKey(), JSON.stringify(payload))
      let cloudSaved = false
      try {
        const response = await fetch('/api/fc-save', {
          method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId: activeGameId, payload }),
        })
        cloudSaved = response.ok
      } catch (error) {
        console.warn('Unable to save Mesen cloud state', error)
      }
      window.GGEMU_TOAST(cloudSaved ? '存档成功，已同步玩家账号！' : '本机存档成功！')
    } catch (error) {
      window.GGEMU_TOAST(`存档失败：${error.message}`)
    }
  },
  async loadState(options) {
    if (!retro || !ready || options?.userInitiated !== true) return false
    try {
      let payload = null
      let cloudLoaded = false
      try {
        const response = await fetch(`/api/fc-save?gameId=${encodeURIComponent(activeGameId)}`, { credentials: 'same-origin', cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          payload = data?.payload || data?.backup || null
          cloudLoaded = Boolean(payload)
        }
      } catch (error) {
        console.warn('Unable to load Mesen cloud state', error)
      }
      if (!payload) {
        const local = localStorage.getItem(localStateKey())
        payload = local ? JSON.parse(local) : null
      }
      if (!payload) {
        window.GGEMU_TOAST('没有找到存档记录！')
        return false
      }
      retro.setState(await decodeState(payload))
      window.GGEMU_TOAST(cloudLoaded ? '会员云存档读取成功！' : '本机存档读取成功！')
      return true
    } catch (error) {
      window.GGEMU_TOAST(`读档失败：${error.message}`)
      return false
    }
  },
  connectRecordingAudio() {
    if (!audio?.ctx || !audio?.node) return null
    const destination = audio.ctx.createMediaStreamDestination()
    audio.node.connect(destination)
    return destination.stream.getAudioTracks()[0] || null
  },
}

await import('/fc-player/assets/shell.js?v=20261022-2')
