import { useRef } from 'react'
import type { ReactNode } from 'react'
import type { Locale } from '#/lib/ggemu'

export function CardScrollRow({ children, lang, className = '' }: { children: ReactNode; lang: Locale; className?: string }) {
  const row = useRef<HTMLDivElement>(null)
  const label = lang === 'en' ? 'Scroll right' : lang === 'ja' ? '右へスクロール' : lang === 'zh-TW' ? '向右翻動' : '向右翻动'
  return (
    <div className="relative">
      <div ref={row} className={`flex flex-nowrap gap-px lg:gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
        {children}
      </div>
      <button type="button" aria-label={lang === 'en' ? 'Scroll left' : lang === 'ja' ? '左へスクロール' : '向左翻动'} className="absolute -left-4 top-1/2 grid h-10 w-4 -translate-y-1/2 place-items-center text-black" onClick={() => {
        const element = row.current
        if (element) element.scrollBy({ left: -element.clientWidth * 0.8, behavior: 'smooth' })
      }}><svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="m8 4-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <button type="button" aria-label={label} title={label} className="absolute -right-4 top-1/2 grid h-10 w-4 -translate-y-1/2 place-items-center text-black" onClick={() => {
        const element = row.current
        if (element) element.scrollBy({ left: Math.max(180, element.clientWidth * 0.8), behavior: 'smooth' })
      }}><svg aria-hidden="true" width="12" height="16" viewBox="0 0 12 16" fill="none"><path d="m4 4 4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
    </div>
  )
}
