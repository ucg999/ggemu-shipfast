import { useState } from 'react'

type SwitchLibraryImageProps = {
  alt: string
  className?: string
  eager?: boolean
  src: string
  transparent?: boolean
  clickable?: boolean
}

export function SwitchLibraryImage({ alt, className = '', eager = false, src, transparent = false, clickable = false }: SwitchLibraryImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={`relative block ${clickable ? 'cursor-pointer' : 'cursor-default'} select-none overflow-hidden ${transparent ? 'bg-transparent' : 'bg-base-300'} ${className}`}
      style={{ WebkitTouchCallout: 'none' }}
      onClick={clickable ? undefined : (event) => { event.preventDefault(); event.stopPropagation() }}
      onAuxClick={clickable ? undefined : (event) => { event.preventDefault(); event.stopPropagation() }}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      {!loaded ? (
        <span className="absolute inset-0 z-[1] grid place-items-center bg-base-300" aria-live="polite">
          {failed
            ? <span className="text-xs text-base-content/45">图片加载失败</span>
            : <span className="loading loading-spinner loading-sm text-base-content/45" aria-label="图片加载中" />}
        </span>
      ) : null}
      <img
        alt={alt}
        className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        decoding="async"
        draggable={false}
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        src={src}
      />
    </span>
  )
}
