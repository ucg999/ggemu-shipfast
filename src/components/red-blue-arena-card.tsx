import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

export function RedBlueArenaCard({ lang }: { lang: Locale }) {
  const title = lang === 'en' ? 'Red vs Blue Arena' : lang === 'ja' ? '赤青アリーナ' : lang === 'zh-TW' ? '紅藍競技場' : '红蓝竞技场'
  return <Link to="/$locale/red-blue-arena" params={{ locale: lang }} search={{ embed: undefined }} aria-label={title}
    className="group relative flex aspect-square min-w-0 flex-col items-center justify-center overflow-hidden rounded-md border border-fuchsia-400/40 bg-[radial-gradient(circle_at_center,#24204d,#090813_70%)] text-white lg:aspect-[4/3]">
    <span aria-hidden="true" className="flex items-center gap-2 text-4xl transition-transform group-hover:scale-110"><i className="h-9 w-9 rounded-full bg-red-500 shadow-[0_0_18px_#ef4444]" /><b className="text-sm italic">VS</b><i className="h-9 w-9 rounded-full bg-blue-500 shadow-[0_0_18px_#3b82f6]" /></span>
    <span className="mt-3 text-center text-xs font-bold sm:text-sm">{title}</span>
    <span className="mt-1 rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] text-amber-200">金币竞猜</span>
  </Link>
}
