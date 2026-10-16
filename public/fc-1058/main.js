import Video from './vendors/Video.js'
import Audio from './vendors/Audio.js'

const INPUT = { b: 0, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8 }
const KEYBOARD = {
  KeyJ: 'b', KeyK: 'a', ShiftLeft: 'select', ShiftRight: 'select', Enter: 'start',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
}

let retro = null
let audio = null
let started = false
const coreConfig = {}
let frameTimer = 0

function runFrameLoop() {
  if (!retro) return
  retro.iterate()
}

function setInput(name, pressed) {
  if (!retro) return
  const names = name === 'ab' ? ['a', 'b'] : [name]
  names.forEach((item) => {
    const id = INPUT[item]
    if (typeof id === 'number') retro.input_user_state[0][id] = pressed
  })
}

function bindControls() {
  window.addEventListener('keydown', (event) => {
    const name = KEYBOARD[event.code]
    if (!name) return
    event.preventDefault()
    setInput(name, true)
  }, { passive: false })

  window.addEventListener('keyup', (event) => {
    const name = KEYBOARD[event.code]
    if (!name) return
    event.preventDefault()
    setInput(name, false)
  }, { passive: false })

  document.querySelectorAll('[data-button]').forEach((button) => {
    const name = button.dataset.button
    const release = (event) => {
      event.preventDefault()
      setInput(name, false)
      button.classList.remove('pressed')
      if (button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId)
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      button.setPointerCapture?.(event.pointerId)
      setInput(name, true)
      button.classList.add('pressed')
      audio?.ctx?.resume?.()
    })
    button.addEventListener('pointerup', release)
    button.addEventListener('pointercancel', release)
    button.addEventListener('lostpointercapture', () => {
      setInput(name, false)
      button.classList.remove('pressed')
    })
  })

  document.querySelector('#resetButton').addEventListener('click', () => retro?.reset())
}

async function boot() {
  if (started) {
    await audio?.ctx?.resume?.()
    return
  }
  started = true
  const loading = document.querySelector('#loading')
  const startButton = document.querySelector('#startButton')
  loading.style.display = 'flex'
  startButton.style.display = 'none'

  try {
    const canvas = document.querySelector('#screen')
    const video = new Video(canvas)
    audio = new Audio()
    coreConfig.video = video
    coreConfig.audio = audio

    retro = await libretro(coreConfig)
    const response = await fetch('./game.nes?v=20261016-1', { cache: 'force-cache' })
    if (!response.ok) throw new Error(`ROM ${response.status}`)
    retro.loadArrayBuffer(await response.arrayBuffer(), 'green-beret-captain-america.nes')
    retro.skip_frame(1)
    bindControls()
    loading.style.display = 'none'
    clearInterval(frameTimer)
    frameTimer = window.setInterval(runFrameLoop, 1000 / 60)
    audio?.ctx?.resume?.().catch(() => {})
  } catch (error) {
    console.error('[FC1058]', error)
    loading.textContent = '专用播放器启动失败，请重新打开页面'
    started = false
  }
}

document.querySelector('#startButton').addEventListener('click', boot)
document.addEventListener('pointerdown', () => audio?.ctx?.resume?.(), { passive: true })

// 先加载画面；若浏览器拦截声音，第一次触摸会自动恢复声音。
boot()
