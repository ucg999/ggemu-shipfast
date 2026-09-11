import ghostHunterStyles from '#/components/ghost-hunter.css?url'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { SiteLayout } from '#/components/site-layout'
import { normalizeLocale } from '#/lib/i18n'
import { LEVELS, MODULES, geometry, canPlace, isLevelComplete, litGhosts } from '#/lib/ghost-hunter'
import type { Placement } from '#/lib/ghost-hunter'

export const Route = createFileRoute('/$locale/ghost-hunter')({
  validateSearch: (search: Record<string, unknown>) => ({
    embed: search.embed === '1' || search.embed === 1 ? ('1' as const) : undefined,
  }),
  loader: () => ({
    levelIndex: Math.floor(Math.random() * LEVELS.length),
    rotations: randomRotations(),
  }),
  head: () => ({ links: [{ rel: 'stylesheet', href: ghostHunterStyles }], meta: [{ title: '幽灵捕手' }] }),
  component: GhostHunterPage,
})

type Drag = { id: number; startX: number; startY: number; x: number; y: number; grabX: number; grabY: number; moved: boolean }

function randomRotations() {
  return MODULES.map(() => Math.floor(Math.random() * 4))
}

// Ellipses follow the light openings in the original artwork, in source pixels.
const LIGHT_OPENINGS = [
  [{ cx: 126, cy: 124, rx: 108, ry: 79, angle: 0 }],
  [{ cx: 382, cy: 131, rx: 108, ry: 80, angle: 0 }],
  [{ cx: 126, cy: 131, rx: 108, ry: 80, angle: 0 }],
  [{ cx: 135, cy: 110, rx: 79, ry: 102, angle: -12 }, { cx: 280, cy: 441, rx: 102, ry: 77, angle: 12 }],
  [{ cx: 125, cy: 126, rx: 107, ry: 79, angle: 0 }],
  [],
]

const GHOST_SOUNDS = [
  '/ghost-hunter/audio/ghost-90.mp3',
  '/ghost-hunter/audio/ghost-91.mp3',
  '/ghost-hunter/audio/ghost-35.mp3',
]
const LEVEL_COMPLETE_SOUND = '/ghost-hunter/audio/level-complete.mp3'

function ModuleImage({ id, rotation, highlighted = [] }: { id: number; rotation: number; highlighted?: boolean[] }) {
  const module = MODULES[id]
  const shape = geometry(id, rotation)
  const transform = [undefined, `translate(${module.height} 0) rotate(90)`,
    `translate(${module.width} ${module.height}) rotate(180)`, `translate(0 ${module.width}) rotate(270)`][rotation]
  return <svg viewBox={`0 0 ${shape.width} ${shape.height}`} width="100%" height="100%" style={{ overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
    <g transform={transform}><image href={`/ghost-hunter/torch-${id + 1}.png`} width={module.width} height={module.height} preserveAspectRatio="none" />
      <g transform={`scale(${module.width / (id < 4 ? 505 : 251)} ${module.height / (id === 2 || id === 3 ? 506 : 505)})`}>
        {LIGHT_OPENINGS[id].map((opening, index) => highlighted[index] ? <ellipse
          key={index} cx={opening.cx} cy={opening.cy} rx={opening.rx} ry={opening.ry}
          className="ghost-light-ring"
          transform={`rotate(${opening.angle} ${opening.cx} ${opening.cy})`}
          fill="rgba(255, 239, 153, 0.12)" stroke="#fff3ad" strokeWidth="3"
        /> : null)}
      </g>
    </g>
  </svg>
}

function GhostHunterPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const { embed } = Route.useSearch()
  const initialGame = Route.useLoaderData()
  const [levelIndex, setLevelIndex] = useState(initialGame.levelIndex)
  const level = LEVELS[levelIndex]
  const [placed, setPlaced] = useState<(Placement | null)[]>(Array(6).fill(null))
  const [rotations, setRotations] = useState<number[]>(initialGame.rotations)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<HTMLElement>(null)
  const ghostAudioRef = useRef<HTMLAudioElement[]>([])
  const completionAudioRef = useRef<HTMLAudioElement | null>(null)
  const countdownAudioRef = useRef<HTMLAudioElement[]>([])
  const countdownCueRef = useRef<number | null>(null)
  const previousFoundRef = useRef(new Set<string>())
  const advancingRef = useRef(false)
  const rewardedRef = useRef(false)
  const elapsedRef = useRef(0)
  const [remaining, setRemaining] = useState(120)
  const [cleared, setCleared] = useState(0)
  const [lightning, setLightning] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [zap, setZap] = useState(0)
  const [message, setMessage] = useState('把右侧模块拖进场景，点击模块旋转 90°。')
  const found = litGhosts(placed, level.ghosts)
  const foundKey = found.map(([x, y]) => `${x},${y}`).sort().join('|')
  const won = isLevelComplete(placed, level.ghosts)

  useEffect(() => {
    if (won || gameOver) return
    let previous = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      elapsedRef.current += (now - previous) / 1000 * (1 + cleared * 0.05)
      previous = now
      setRemaining(Math.max(0, 120 - elapsedRef.current))
      if (elapsedRef.current >= 120) {
        setGameOver(true)
        dragRef.current = null
        setDrag(null)
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [won, gameOver, levelIndex, cleared])

  function resetTime() {
    elapsedRef.current = 0
    setRemaining(120)
  }

  function useLightning() {
    if (lightning < 1 || won || gameOver) return
    setLightning(value => value - 1)
    resetTime()
    setZap(value => value + 1)
  }

  useEffect(() => {
    const sounds = countdownAudioRef.current
    if (remaining > 10 || remaining <= 0 || won || gameOver) {
      countdownCueRef.current = null
      sounds.forEach(audio => audio.pause())
      return
    }
    const now = performance.now()
    const interval = remaining > 5 ? 1400 : 650
    if (countdownCueRef.current !== null && now - countdownCueRef.current < interval) return
    const audio = sounds[Math.floor(Math.random() * sounds.length)]
    if (!audio) return
    countdownCueRef.current = now
    sounds.forEach(sound => sound.pause())
    audio.currentTime = 0
    audio.volume = remaining > 5 ? 0.7 : 0.9
    void audio.play().catch(() => {})
  }, [remaining, won, gameOver])

  useEffect(() => {
    if (!gameOver) return
    const timer = window.setTimeout(() => {
      setCleared(0)
      setLightning(1)
      setGameOver(false)
      advanceLevel()
    }, 2500)
    return () => window.clearTimeout(timer)
  }, [gameOver])

  useEffect(() => {
    ghostAudioRef.current = GHOST_SOUNDS.map(src => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      return audio
    })
    completionAudioRef.current = new Audio(LEVEL_COMPLETE_SOUND)
    completionAudioRef.current.preload = 'auto'
    countdownAudioRef.current = GHOST_SOUNDS.map(src => {
      const audio = new Audio(src)
      audio.preload = 'auto'
      return audio
    })
    return () => {
      countdownAudioRef.current.forEach(audio => audio.pause())
      countdownAudioRef.current = []
      ghostAudioRef.current.forEach(audio => audio.pause())
      ghostAudioRef.current = []
      completionAudioRef.current?.pause()
      completionAudioRef.current = null
    }
  }, [])

  useEffect(() => {
    const current = new Set(foundKey ? foundKey.split('|') : [])
    const hasNewGhost = [...current].some(cell => !previousFoundRef.current.has(cell))
    previousFoundRef.current = current
    if (!hasNewGhost) return
    const sounds = ghostAudioRef.current
    const audio = sounds[Math.floor(Math.random() * sounds.length)]
    if (!audio) return
    sounds.forEach(sound => {
      if (sound !== audio) sound.pause()
    })
    audio.currentTime = 0
    void audio.play().catch(() => {})
  }, [foundKey])

  function resetBoard(message = '已重置关卡。', shuffleRotations = false) {
    resetTime()
    rewardedRef.current = false
    setPlaced(Array(6).fill(null))
    setRotations(shuffleRotations ? randomRotations() : Array(6).fill(0))
    setDrag(null)
    dragRef.current = null
    setMessage(message)
  }

  function advanceLevel() {
    if (advancingRef.current) return
    advancingRef.current = true
    setLevelIndex(current => {
      const offset = 1 + Math.floor(Math.random() * (LEVELS.length - 1))
      return (current + offset) % LEVELS.length
    })
    resetBoard('新关卡开始！手电筒角度已随机打乱。', true)
  }

  useEffect(() => {
    advancingRef.current = false
  }, [levelIndex])

  useEffect(() => {
    if (!won || gameOver) return
    if (!rewardedRef.current) {
      rewardedRef.current = true
      setCleared(value => value + 1)
      setLightning(value => value + 1)
    }
    const audio = completionAudioRef.current
    if (!audio) {
      advanceLevel()
      return
    }
    const handleEnded = () => advanceLevel()
    audio.currentTime = 0
    audio.addEventListener('ended', handleEnded, { once: true })
    void audio.play().catch(advanceLevel)
    return () => audio.removeEventListener('ended', handleEnded)
  }, [won])

  function candidate(d: Drag): Placement {
    const rect = boardRef.current!.getBoundingClientRect()
    const unit = rect.width / 4
    return { x: Math.round((d.x - rect.left) / unit - d.grabX), y: Math.round((d.y - rect.top) / unit - d.grabY), rotation: rotations[d.id] }
  }

  function rotate(id: number) {
    if (won || gameOver) return
    const rotation = (rotations[id] + 1) % 4
    const p = placed[id]
    if (p && !canPlace(id, { ...p, rotation }, placed)) {
      setMessage('旋转后会重叠或超出边界，请先移到空位或放回右侧。')
      return
    }
    setRotations(current => current.map((r, i) => i === id ? rotation : r))
    if (p) setPlaced(current => current.map((value, i) => i === id ? { ...p, rotation } : value))
    setMessage('已旋转 90°。')
  }

  function start(event: PointerEvent<HTMLElement>, id: number) {
    if (won || gameOver || event.button !== 0 || dragRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const shape = geometry(id, rotations[id])
    const grabX = (event.clientX - rect.left) / rect.width * shape.width
    const grabY = (event.clientY - rect.top) / rect.height * shape.height
    // Transparent cutouts do not claim a neighboring module's pointer.
    if (!shape.cells.some(([x, y]) => Math.floor(grabX) === x && Math.floor(grabY) === y)) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const next = { id, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, grabX, grabY, moved: false }
    dragRef.current = next
    setDrag(next)
  }

  function move(event: PointerEvent<HTMLElement>) {
    const d = dragRef.current
    if (!d) return
    const next = { ...d, x: event.clientX, y: event.clientY, moved: d.moved || Math.hypot(event.clientX - d.startX, event.clientY - d.startY) > 5 }
    dragRef.current = next
    setDrag(next)
  }

  function end(event: PointerEvent<HTMLElement>) {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    setDrag(null)
    if (!d.moved) { rotate(d.id); return }
    const final = { ...d, x: event.clientX, y: event.clientY }
    const rect = boardRef.current!.getBoundingClientRect()
    if (final.x < rect.left || final.x > rect.right || final.y < rect.top || final.y > rect.bottom) {
      setPlaced(current => current.map((p, i) => i === d.id ? null : p))
      setMessage('模块已放回右侧。')
      return
    }
    const p = candidate(final)
    if (canPlace(d.id, p, placed)) {
      setPlaced(current => current.map((value, i) => i === d.id ? p : value))
      setMessage('已吸附到格子。继续照亮其他幽灵！')
    } else setMessage('这里放不下：模块不能重叠或超出背景。')
  }

  const preview = drag?.moved && boardRef.current ? candidate(drag) : null
  const validPreview = preview && drag ? canPlace(drag.id, preview, placed) : false
  const unit = boardRef.current ? boardRef.current.getBoundingClientRect().width / 4 : 0
  const handlers = (id: number) => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => start(e, id), onPointerMove: move, onPointerUp: end,
    onPointerCancel: () => { dragRef.current = null; setDrag(null) },
  })
  const game = <section ref={gameRef} className={`ghost-game mx-auto w-full max-w-6xl px-3 sm:px-6 ${embed === '1' ? 'ghost-game-embed' : ''}`}>
      {embed !== '1' ? <div className="flex shrink-0 items-center justify-between gap-2">
        <div><Link to="/$locale/original-games" params={{ locale: lang }} className="text-sm text-base-content/60">← 原创游戏（内测版）</Link>
          <h1 className="text-xl font-black">幽灵捕手 <span className="text-sm font-normal text-base-content/60">关卡 {level.id}</span></h1></div>
        <div className="flex gap-1">
        <button className="btn btn-sm sm:hidden" onClick={async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else if (gameRef.current?.requestFullscreen) await gameRef.current.requestFullscreen()
            else setMessage('当前浏览器不支持系统全屏，游戏已铺满可用屏幕。')
          } catch { setMessage('未能进入系统全屏，游戏仍可正常操作。') }
        }}>全屏</button>
        <button className="btn btn-sm" disabled={gameOver || won} onClick={() => { setCleared(0); setLightning(1); resetBoard() }}>重新开始</button>
        </div>
      </div> : null}
      {embed !== '1' ? <p className="shrink-0 text-xs text-base-content/70">拖动放置 · 点击旋转 90° · 拖出背景放回 · 光圈照到全部幽灵即可过关</p> : null}
      <div className="ghost-timer-panel">
        <button type="button" className="ghost-lightning" onClick={useLightning} disabled={lightning < 1 || won || gameOver} aria-label={`使用闪电重置倒计时，剩余 ${lightning} 道`} title="电击时间幽灵，恢复120秒">⚡ {lightning}</button>
        <div className="ghost-time-track" role="progressbar" aria-label="剩余时间" aria-valuemin={0} aria-valuemax={120} aria-valuenow={Math.ceil(remaining)}>
          <div className="ghost-time-fill" style={{ width: `${(120 - remaining) / 120 * 100}%` }} />
          <span className="ghost-time-spirit" style={{ left: `${(120 - remaining) / 120 * 100}%` }}><span>👻</span></span>
          <span className="ghost-time-label">{Math.ceil(remaining)}秒</span>
          {zap > 0 && <span key={zap} className="ghost-time-zap" aria-hidden="true">⚡</span>}
        </div>
        <strong className="ghost-clear-count" aria-live="polite">过关 {cleared}</strong>
      </div>
      <div className="ghost-play-area"><div className="ghost-stage">
        <div ref={boardRef} className={`ghost-board relative aspect-square select-none overflow-hidden rounded-xl bg-slate-950 shadow-xl ${won ? 'ghost-board-complete cursor-pointer' : ''}`} onClick={won ? advanceLevel : undefined} style={{ touchAction: 'none' }}>
          <img src={level.image} alt={`幽灵捕手关卡 ${level.id}`} draggable={false} className="pointer-events-none absolute inset-0 z-0 h-full w-full" />
          {gameOver && <div className="ghost-game-over" role="alert"><strong>GAME OVER</strong><span>本次过关 {cleared} 关</span><span>即将切换新场景，重新开始…</span></div>}
          {placed.map((p, id) => {
            if (!p) return null
            const shape = geometry(id, p.rotation)
            return <div key={id} role="button" tabIndex={0} aria-label={`模块 ${id + 1}，点击旋转，Delete 放回`} {...handlers(id)}
              onKeyDown={e => { if (won || gameOver) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rotate(id) } if (e.key === 'Delete') setPlaced(current => current.map((v, i) => i === id ? null : v)) }}
              className="absolute z-10 cursor-grab outline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
              style={{ left: `${p.x * 25}%`, top: `${p.y * 25}%`, width: `${shape.width * 25}%`, height: `${shape.height * 25}%`, opacity: drag?.id === id && drag.moved ? 0.25 : 1, pointerEvents: 'none' }}>
              <ModuleImage id={id} rotation={p.rotation} highlighted={shape.lights.map(([x, y]) => found.some(([gx, gy]) => gx === p.x + x && gy === p.y + y))} />
              {shape.cells.map(([x, y]) => <span key={`${x},${y}`} className="absolute" style={{ left: `${x / shape.width * 100}%`, top: `${y / shape.height * 100}%`, width: `${100 / shape.width}%`, height: `${100 / shape.height}%`, pointerEvents: 'auto' }} />)}
            </div>
          })}
          {preview && drag && <svg viewBox="0 0 4 4" className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
            <g transform={`translate(${preview.x} ${preview.y})`} fill={validPreview ? 'rgba(110,231,183,0.24)' : 'rgba(248,113,113,0.24)'}>
              {geometry(drag.id, preview.rotation).cells.map(([x, y]) => {
                const cells = geometry(drag.id, preview.rotation).cells
                const hasCell = (cx: number, cy: number) => cells.some(([px, py]) => px === cx && py === cy)
                const outline = [
                  !hasCell(x, y - 1) ? `M${x},${y}h1` : '',
                  !hasCell(x + 1, y) ? `M${x + 1},${y}v1` : '',
                  !hasCell(x, y + 1) ? `M${x},${y + 1}h1` : '',
                  !hasCell(x - 1, y) ? `M${x},${y}v1` : '',
                ].join(' ')
                return <g key={`${x},${y}`}>
                  <rect x={x} y={y} width="1" height="1" />
                  <path d={outline} fill="none" stroke={validPreview ? '#6ee7b7' : '#f87171'} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                </g>
              })}
            </g>
          </svg>}
        </div>
        <aside className="ghost-tray flex min-h-0 flex-col rounded-xl border border-base-300 p-2">
          {embed !== '1' ? <h2 className="mb-1 shrink-0 text-center text-xs font-bold">抓鬼手电筒</h2> : null}
          <div className="ghost-modules grid min-h-0 flex-1 gap-1">
            {MODULES.map((_, id) => <div key={id} className="flex min-h-0 items-center justify-center [container-type:size]">
              {placed[id] ? (embed === '1' ? null : <span className="text-center text-xs text-slate-400">{id + 1} · 已放入</span>) : <button type="button" aria-label={`模块 ${id + 1}，点击旋转`} {...handlers(id)} onClick={e => { if (e.detail === 0) rotate(id) }} className="block cursor-grab touch-none bg-transparent" style={{ width: `calc(min(100cqw, 100cqh) * ${geometry(id, rotations[id]).width / 2})`, height: `calc(min(100cqw, 100cqh) * ${geometry(id, rotations[id]).height / 2})` }}><ModuleImage id={id} rotation={rotations[id]} /></button>}
            </div>)}
          </div>
          {embed !== '1' ? <p className="ghost-tray-tip mt-1 text-center text-xs text-base-content/60">点击旋转 90° · 拖动放置<br />6 号为空框模块</p> : null}
        </aside>
      </div>
      </div>
      {embed !== '1' ? <div role="status" aria-live="polite" className={`ghost-status shrink-0 rounded-xl border px-3 py-2 text-sm ${won ? 'border-amber-300 bg-amber-100 text-amber-950' : 'border-base-300 bg-base-200'}`}>
        <strong>{won ? '🎉 过关！点击场景立即进入下一关…' : `已放入 ${placed.filter(Boolean).length} / 6 个模块 · 已照亮 ${found.length} / ${level.ghosts.length} 只幽灵`}</strong>
        <p className="text-xs">{won ? '音乐播放完会自动切换，也可点击场景立即进入下一关。' : message}</p>
      </div> : null}
      {embed !== '1' ? <p className="ghost-beta-note shrink-0 text-center text-xs leading-5 text-white/65">
        游戏开发测试中，欢迎试玩，有任何建议和想法可以加入Q群62119057，一起修改完善
      </p> : <p className="ghost-trial-note shrink-0 text-center text-white/65">等待游戏加载，请你试玩原创游戏，希望你喜欢</p>}
      {drag?.moved && <div className="pointer-events-none fixed z-[100] opacity-90" style={{ left: drag.x - drag.grabX * unit, top: drag.y - drag.grabY * unit, width: geometry(drag.id, rotations[drag.id]).width * unit, height: geometry(drag.id, rotations[drag.id]).height * unit }}><ModuleImage id={drag.id} rotation={rotations[drag.id]} /></div>}
    </section>

  return embed === '1'
    ? <main className="min-h-dvh bg-black">{game}</main>
    : <SiteLayout locale={lang} hideFooter>{game}</SiteLayout>
}
