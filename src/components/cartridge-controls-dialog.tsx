type CartridgeControlsDialogProps = {
  actionLabel: string
  cover: string
  details: string
  onAction: () => void
  onClose: () => void
  title: string
}

const controls = [
  ['上', 'W'], ['下', 'S'], ['左', 'A'], ['右', 'D'],
  ['A', 'K'], ['B', 'J'], ['SELECT', 'SHIFT'], ['START', 'ENTER'],
] as const

export function CartridgeControlsDialog({ actionLabel, cover, details, onAction, onClose, title }: CartridgeControlsDialogProps) {
  return <div className="fixed inset-0 z-[250] hidden place-items-center bg-black/45 px-6 lg:grid" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <section className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[#f0f0ed] text-base-content shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4">
        <div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-base-content/55">{details}</p></div>
        <button aria-label="关闭" className="btn btn-ghost btn-sm btn-circle text-xl" type="button" onClick={onClose}>×</button>
      </header>
      <div className="grid gap-7 p-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-white/60 p-5"><img alt={title} className="max-h-72 w-full object-contain" src={cover} /></div>
        <div className="flex flex-col justify-center">
          <h3 className="mb-3 text-base font-semibold">键盘操作</h3>
          <div className="grid grid-cols-2 gap-2">
            {controls.map(([label, key]) => <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm" key={label}><span>{label}</span><kbd className="min-w-12 rounded-md bg-neutral px-2 py-1 text-center text-xs font-semibold text-white">{key}</kbd></div>)}
          </div>
          <button className="btn btn-warning mt-5 w-full" type="button" onClick={onAction}>{actionLabel}</button>
        </div>
      </div>
    </section>
  </div>
}

type CartridgePlayerDialogProps = {
  onClose: () => void
  src: string
  title: string
}

export function CartridgePlayerDialog({ onClose, src, title }: CartridgePlayerDialogProps) {
  return <div className="fixed inset-0 z-[260] hidden place-items-center bg-black/70 p-4 lg:grid" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <section className="relative h-[min(92vh,900px)] w-[min(96vw,520px)] overflow-hidden rounded-2xl bg-[#dedede] shadow-2xl" onClick={event => event.stopPropagation()}>
      <button aria-label="关闭游戏机" className="btn btn-neutral btn-sm btn-circle absolute right-3 top-3 z-20 opacity-60 hover:opacity-100" type="button" onClick={onClose}>×</button>
      <iframe
        allow="autoplay; fullscreen; gamepad"
        className="h-full w-full border-0 outline-none"
        onLoad={event => { event.currentTarget.focus(); event.currentTarget.contentWindow?.focus() }}
        src={src}
        tabIndex={0}
        title={title}
      />
    </section>
  </div>
}
