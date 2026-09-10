import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

export function getGhostHunterTitle(lang: Locale) {
  return lang === 'zh-TW' ? '幽靈捕手' : lang === 'en' ? 'Ghost Hunter' : lang === 'ja' ? 'ゴーストハンター' : '幽灵捕手'
}

export function GhostHunterCard({ lang }: { lang: Locale }) {
  const title = getGhostHunterTitle(lang)
  return (
    <Link to="/$locale/ghost-hunter" params={{ locale: lang }} search={{ embed: undefined }} aria-label={title}
      className="group relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-violet-400/40 bg-gradient-to-br from-indigo-950 via-violet-900 to-slate-950 text-white lg:aspect-[4/3]">
      <span aria-hidden="true" className="text-3xl transition-transform group-hover:scale-110 sm:text-5xl">👻</span>
      <span className="mt-2 text-center text-xs font-bold sm:text-sm">{title}</span>
    </Link>
  )
}
