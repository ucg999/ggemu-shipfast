type CartridgeControlsDialogProps = {
  actionLabel: string
  cover: string
  collectionLabel?: string
  details: string
  onAction: () => void
  onClose: () => void
  onTrial?: () => void
  title: string
  actionHint?: string
  trialHint?: string
  trialLabel?: string
  guide?: {
    title: string
    introduction: readonly string[]
    highlights: ReadonlyArray<readonly [string, string]>
    sections: ReadonlyArray<{ readonly title: string; readonly items: ReadonlyArray<readonly [string, string]> }>
    credit?: string
  }
}

const controls = [
  ['上', 'W'], ['下', 'S'], ['左', 'A'], ['右', 'D'],
  ['A', 'K'], ['B', 'J'], ['SELECT', 'SHIFT'], ['START', 'ENTER'],
] as const

export function CartridgeControlsDialog({ actionHint, actionLabel, collectionLabel, cover, details, guide, onAction, onClose, onTrial, title, trialHint, trialLabel }: CartridgeControlsDialogProps) {
  return <div className="fixed inset-0 z-[250] grid place-items-center bg-black/45 px-4 sm:px-6" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
    <section className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-[#f0f0ed] text-base-content shadow-2xl ${guide ? 'max-w-5xl' : 'max-w-3xl'}`} onClick={event => event.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-4">
        <div><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-base-content/55">{details}</p></div>
        <button aria-label="关闭" className="btn btn-ghost btn-sm btn-circle text-xl" type="button" onClick={onClose}>×</button>
      </header>
      <div className="grid gap-7 p-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
        <div className="flex min-h-64 items-center justify-center rounded-xl bg-white/60 p-5"><img alt={title} className="max-h-72 w-full object-contain" src={cover} /></div>
        <div className="flex flex-col justify-center">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold">键盘操作</h3>
            {guide ? <details className="group min-w-0 flex-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <summary className="cursor-pointer select-none font-semibold text-amber-900">{guide.title}</summary>
              <div className="mt-3 max-h-[48vh] space-y-4 overflow-y-auto pr-2 text-sm leading-relaxed text-base-content/80">
                {guide.introduction.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                <ul className="space-y-2">
                  {guide.highlights.map(([label, text]) => <li key={label}><strong>{label}：</strong>{text}</li>)}
                </ul>
                {guide.sections.map(section => <section key={section.title}>
                  <h4 className="mb-2 text-base font-bold text-base-content">{section.title}</h4>
                  <ul className="space-y-2">
                    {section.items.map(([label, text]) => <li key={label}><strong>{label}：</strong>{text}</li>)}
                  </ul>
                </section>)}
                {guide.credit ? <p className="border-t border-amber-200 pt-3">本版来自 <strong>{guide.credit}</strong> 的改版游戏，如有侵权请联系删除</p> : null}
              </div>
            </details> : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {controls.map(([label, key]) => <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm" key={label}><span>{label}</span><kbd className="min-w-12 rounded-md bg-neutral px-2 py-1 text-center text-xs font-semibold text-white">{key}</kbd></div>)}
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {onTrial ? <div className="flex flex-col items-center gap-1"><button className="btn btn-info w-full" type="button" onClick={onTrial}>{trialLabel ?? '试玩'}</button>{trialHint ? <small className="text-xs text-base-content/55">{trialHint}</small> : null}</div> : null}
            <div className={`flex flex-col items-center gap-1 ${onTrial ? '' : 'sm:col-span-2'}`}><button className="btn btn-warning w-full" type="button" onClick={onAction}>{actionLabel}</button>{actionHint ? <small className="text-xs text-base-content/55">{actionHint}</small> : null}{collectionLabel ? <small className="text-xs text-base-content/55">{collectionLabel}</small> : null}</div>
          </div>
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
  return <div className="fixed inset-0 z-[260] hidden place-items-center bg-black/70 p-4 lg:grid" role="dialog" aria-modal="true" aria-label={title}>
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
