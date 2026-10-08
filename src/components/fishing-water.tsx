import { useEffect, useRef } from 'react'

type FishShadow = { x: number; y: number; angle: number; speed: number; size: number; sway: number }
type Phase = 'ready' | 'waiting' | 'bite' | 'result'

export function FishingWater({ phase, castPoint, onChoosePoint }: {
  phase: Phase
  castPoint: { x: number; y: number }
  onChoosePoint: (point: { x: number; y: number }) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fishRef = useRef<FishShadow[]>([])
  const phaseRef = useRef(phase)
  const castPointRef = useRef(castPoint)
  phaseRef.current = phase
  castPointRef.current = castPoint

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const illustratedFish = new Image()
    illustratedFish.src = '/lakeside-fishing-mahi.webp'
    if (!fishRef.current.length) fishRef.current = Array.from({ length: 11 }, (_, index) => ({
      x: index === 0 ? .47 : .12 + Math.random() * .76,
      y: index === 0 ? .42 : .14 + Math.random() * .72,
      angle: Math.random() * Math.PI * 2,
      speed: .000035 + Math.random() * .000035,
      size: index === 0 ? 45 : 14 + Math.random() * 18,
      sway: Math.random() * 6,
    }))

    let frame = 0
    let last = 0
    let width = 0
    let height = 0
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      width = bounds.width
      height = bounds.height
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      context.setTransform(scale, 0, 0, scale, 0, 0)
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    const draw = (time: number) => {
      const delta = Math.min(time - (last || time), 40)
      last = time
      const w = width
      const h = height
      context.clearRect(0, 0, w, h)

      const water = context.createLinearGradient(0, 0, w, h)
      water.addColorStop(0, '#83d9cc')
      water.addColorStop(.43, '#4cb9b6')
      water.addColorStop(1, '#287f9b')
      context.fillStyle = water
      context.fillRect(0, 0, w, h)

      for (let i = 0; i < 19; i++) {
        const offset = (time * (.009 + i % 3 * .003) + i * 91) % (w + 230) - 115
        const y = h * (.08 + (i * .171) % .88) + Math.sin(time * .0007 + i) * 11
        context.strokeStyle = i % 4 === 0 ? 'rgba(238,255,229,.28)' : 'rgba(212,255,249,.15)'
        context.lineWidth = i % 4 === 0 ? 3 : 1.5
        context.beginPath()
        context.moveTo(offset - 80, y)
        context.bezierCurveTo(offset - 25, y - 8, offset + 25, y + 8, offset + 95, y)
        context.stroke()
      }

      for (let i = 0; i < 8; i++) {
        const x = w * ((i * .19 + .07) % 1)
        const y = h * ((i * .29 + .12) % 1)
        const r = 18 + ((time * .019 + i * 23) % 55)
        context.strokeStyle = `rgba(232,255,239,${.16 * (1 - (r - 18) / 55)})`
        context.lineWidth = 2
        context.beginPath()
        context.ellipse(x, y, r, r * .35, 0, 0, Math.PI * 2)
        context.stroke()
      }

      fishRef.current.forEach((fish, index) => {
        const target = castPointRef.current
        const seeking = (phaseRef.current === 'waiting' || phaseRef.current === 'bite') && index === 0
        if (seeking) {
          const targetAngle = Math.atan2(target.y - fish.y, target.x - fish.x)
          fish.angle += Math.atan2(Math.sin(targetAngle - fish.angle), Math.cos(targetAngle - fish.angle)) * .025
        } else if (Math.random() < .012) fish.angle += (Math.random() - .5) * .35
        if (seeking) {
          fish.x += (target.x - fish.x) * Math.min(.025, delta * .0008)
          fish.y += (target.y - fish.y) * Math.min(.025, delta * .0008)
        } else {
          fish.x += Math.cos(fish.angle) * fish.speed * delta
          fish.y += Math.sin(fish.angle) * fish.speed * delta * w / Math.max(h, 1)
        }
        if (fish.x < .04 || fish.x > .96) fish.angle = Math.PI - fish.angle
        if (fish.y < .07 || fish.y > .93) fish.angle = -fish.angle
        fish.x = Math.max(.035, Math.min(.965, fish.x))
        fish.y = Math.max(.06, Math.min(.94, fish.y))

        const size = fish.size * Math.min(w / 850, 1.2)
        context.save()
        context.translate(fish.x * w, fish.y * h)
        context.rotate(fish.angle)
        context.globalAlpha = .48 + Math.sin(time * .001 + fish.sway) * .08
        context.shadowColor = '#123d53'
        context.shadowBlur = 12
        if (index === 0 && illustratedFish.complete && illustratedFish.naturalWidth > 0) {
          context.rotate(Math.PI)
          context.globalAlpha = .72
          context.drawImage(illustratedFish, -size * 3.1, -size * 1.2, size * 6.2, size * 2.4)
        } else {
          context.fillStyle = '#194b62'
          context.beginPath()
          context.ellipse(0, 0, size * 1.4, size * .48, 0, 0, Math.PI * 2)
          context.fill()
          const tail = Math.sin(time * .008 + fish.sway) * size * .18
          context.beginPath()
          context.moveTo(-size * 1.1, 0)
          context.lineTo(-size * 2, -size * .67 + tail)
          context.lineTo(-size * 1.85, size * .67 + tail)
          context.closePath()
          context.fill()
        }
        context.restore()
      })

      if (phaseRef.current === 'waiting' || phaseRef.current === 'bite') {
        const { x, y } = castPointRef.current
        const px = x * w
        const py = y * h
        const bite = phaseRef.current === 'bite'
        const radius = bite ? 15 + Math.sin(time * .025) * 6 : 21 + Math.sin(time * .004) * 3
        context.strokeStyle = bite ? '#f8fff3' : 'rgba(241,255,249,.65)'
        context.lineWidth = bite ? 4 : 2
        context.beginPath()
        context.ellipse(px, py, radius, radius * .5, 0, 0, Math.PI * 2)
        context.stroke()
        context.fillStyle = bite ? '#e45e4e' : '#fa786c'
        context.beginPath()
        context.ellipse(px, py - (bite ? -4 : 7), 8, 10, 0, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#fff8df'
        context.fillRect(px - 7, py - (bite ? -4 : 7), 14, 6)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(frame); observer.disconnect() }
  }, [])

  return <canvas
    ref={canvasRef}
    className="fishing-water-canvas"
    aria-label="流动的湖水与游动的鱼影；点击水面可以选择抛竿位置"
    onPointerDown={event => {
      const bounds = event.currentTarget.getBoundingClientRect()
      onChoosePoint({
        x: Math.max(.08, Math.min(.92, (event.clientX - bounds.left) / bounds.width)),
        y: Math.max(.1, Math.min(.9, (event.clientY - bounds.top) / bounds.height)),
      })
    }}
  />
}
