import type { FocusEvent, MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

const previewVideoSelector = '[data-game-card-preview-video]'

function getPreviewVideo(element: HTMLElement) {
  return element.querySelector<HTMLVideoElement>(previewVideoSelector)
}

function playPreviewVideo(event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  getPreviewVideo(event.currentTarget)?.play().catch(() => {})
}

function stopPreviewVideo(event: FocusEvent<HTMLElement> | MouseEvent<HTMLElement>) {
  const video = getPreviewVideo(event.currentTarget)

  if (!video) {
    return
  }

  video.pause()
  video.currentTime = 0
}

export const gameCardPreviewHandlers = {
  onBlur: stopPreviewVideo,
  onFocus: playPreviewVideo,
  onMouseEnter: playPreviewVideo,
  onMouseLeave: stopPreviewVideo,
}

export function GameCardPreviewVideo({
  className = '',
  src,
}: {
  className?: string
  src?: string
}) {
  if (!src?.trim()) {
    return null
  }

  return <DeferredPreviewVideo className={className} src={src} />
}

function DeferredPreviewVideo({ className, src }: { className: string; src: string }) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return

    const activate = () => setActive(true)
    const deactivate = () => setActive(false)
    parent.addEventListener('pointerenter', activate)
    parent.addEventListener('pointerleave', deactivate)
    parent.addEventListener('focusin', activate)
    parent.addEventListener('focusout', deactivate)

    return () => {
      parent.removeEventListener('pointerenter', activate)
      parent.removeEventListener('pointerleave', deactivate)
      parent.removeEventListener('focusin', activate)
      parent.removeEventListener('focusout', deactivate)
    }
  }, [])

  return (
    <span ref={containerRef} className="pointer-events-none absolute inset-0 block overflow-hidden opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
      {active ? <video
        autoPlay
        className={`block h-full max-h-full w-full max-w-full object-cover ${className}`}
        data-game-card-preview-video
        loop
        muted
        playsInline
        preload="none"
        src={src}
      /> : null}
    </span>
  )
}
