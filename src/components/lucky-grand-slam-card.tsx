import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

export function LuckyGrandSlamCard({ lang }: { lang: Locale }) {
  const title = lang === 'zh-TW'
    ? '幸運大滿貫'
    : lang === 'en'
      ? 'Lucky Grand Slam'
      : lang === 'ja'
        ? 'ラッキーグランドスラム'
        : '幸运大满贯'

  return (
    <Link
      aria-label={title}
      className="group relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-emerald-400/40 bg-gradient-to-br from-emerald-950 via-green-800 to-slate-950 text-white lg:aspect-[4/3]"
      params={{ locale: lang }}
      search={{}}
      to="/$locale/lucky-grand-slam"
    >
      <span aria-hidden="true" className="text-3xl transition-transform group-hover:scale-110 sm:text-5xl">🀄</span>
      <span className="mt-2 text-center text-xs font-bold sm:text-sm">{title}</span>
    </Link>
  )
}
