import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

export function CoinFruitCard({ lang, videoAligned = false }: { lang: Locale; videoAligned?: boolean }) {
  const title = lang === 'zh-TW' ? '金幣水果機' : lang === 'en' ? 'Coin Fruit Machine' : lang === 'ja' ? 'コインフルーツマシン' : '金币水果机'
  if (videoAligned) {
    return (
      <div className="relative aspect-[4/3] min-w-0">
        <Link className="group relative mx-auto block aspect-square w-3/4" to="/$locale/coin-challenge" params={{ locale: lang }} aria-label={title}>
          <span className="absolute inset-x-0 bottom-full pb-1 text-center text-xs font-bold leading-5 text-base-content sm:text-sm">{title}</span>
          <span className="block h-full w-full overflow-hidden rounded-md bg-black">
            <img src="/coin-fruit-machine-cover.jpg" alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
          </span>
        </Link>
      </div>
    )
  }
  return (
    <Link className="group relative block aspect-square overflow-hidden rounded-md bg-black" to="/$locale/coin-challenge" params={{ locale: lang }} aria-label={title}>
      <img src="/coin-fruit-machine-cover.jpg" alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <span className="absolute inset-x-0 bottom-0 bg-black/75 px-2 py-1 text-center text-sm font-bold text-white">{title}</span>
    </Link>
  )
}

export function matchesCoinFruitQuery(query: string) {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, '')
  return normalized.length > 0 && ['金币水果机', '金幣水果機', '水果机', '水果機', '老虎机', '老虎機', '金币挑战机', '金幣挑戰機', 'coinfruitmachine', 'coinchallengemachine', 'コインフルーツマシン'].some(name => name.includes(normalized))
}
