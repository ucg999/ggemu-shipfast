import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

export function FishingCard({ lang }: { lang: Locale }) {
  const title = lang === 'zh-TW' ? '湖畔釣魚' : lang === 'en' ? 'Lakeside Fishing' : lang === 'ja' ? '湖畔の釣り' : '湖畔钓鱼'
  return (
    <Link
      to="/$locale/lakeside-fishing"
      params={{ locale: lang }}
      aria-label={title}
      className="group relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-teal-400/50 bg-gradient-to-br from-sky-300 via-teal-300 to-emerald-600 text-slate-900 lg:aspect-[4/3]"
    >
      <span aria-hidden="true" className="text-4xl drop-shadow-md transition-transform group-hover:-rotate-12 group-hover:scale-110 sm:text-6xl">🎣</span>
      <span className="mt-2 text-center text-xs font-black sm:text-sm">{title}</span>
    </Link>
  )
}
