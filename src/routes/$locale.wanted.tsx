import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { getWantedGuestKey } from '#/components/wanted-playtime-tracker'
import { addCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'

type Leader = { rank: number; displayName: string; rawMinutes: number; minutes: number }
type WantedData = { periodKey: string; leaders: Leader[]; pendingRewards: Array<{ periodKey: string; rank: number; coins: number }> }

export const Route = createFileRoute('/$locale/wanted')({
  head: () => ({ meta: [{ title: '悬赏令｜每周游玩时长排行榜｜怀旧游戏厅' }, { name: 'description', content: '按有效游玩时间统计的每周悬赏令排行榜，前三名可获得金币奖励。' }] }),
  component: WantedPage,
})

const displayOrder = [2, 1, 3] as const
const rewards: Record<number, number> = { 1: 5_000, 2: 2_000, 3: 500 }

function WantedPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const [data, setData] = useState<WantedData | null>(null)
  const claimingRef = useRef(false)

  async function refresh() {
    const guestKey = getWantedGuestKey()
    const response = await fetch(`/api/wanted?guest=${encodeURIComponent(guestKey)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as WantedData
    setData(next)
    if (next.pendingRewards.length && !claimingRef.current) void claimRewards(next)
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function claimRewards(current: WantedData) {
    claimingRef.current = true
    const guestKey = getWantedGuestKey()
    const response = await fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', guestKey }) })
    if (response.ok) {
      const result = await response.json() as { coins?: number }
      const coins = Math.max(0, Number(result.coins) || 0)
      if (coins) addCoinBalance(coins)
      setData({ ...current, pendingRewards: [] })
    }
    claimingRef.current = false
  }

  return <SiteLayout locale={lang}>
    <main className="grid min-h-[calc(100vh-64px)] place-items-center overflow-hidden bg-[#f0f0ed] py-2 text-[#35231d]">
      <section className="wanted-poster-board relative mx-auto w-[112vw] max-w-[1840px] min-w-[760px] overflow-hidden">
        <img alt="每周悬赏令前三名海报" className="block h-auto w-full" src="/images/wanted/wanted-board.png" />
        {displayOrder.map((rank, slot) => {
          const leader = data?.leaders.find(item => item.rank === rank)
          return <WantedPosterText key={rank} rank={rank} slot={slot} leader={leader} />
        })}
      </section>
    </main>
  </SiteLayout>
}

function WantedPosterText({ leader, rank, slot }: { leader?: Leader; rank: number; slot: number }) {
  const name = leader?.displayName || `等待第${rank}名`
  const length = Math.max(1, [...name].length)
  const scale = Math.max(.55, Math.min(1.15, 7 / length))
  return <div className={`wanted-poster-copy wanted-slot-${slot + 1}`}>
    <strong style={{ transform: `scaleX(${scale})` }}>{name}</strong>
    <span>{leader ? leader.minutes.toLocaleString() : '---'}</span>
    <small>NO.{rank} · 🪙{rewards[rank].toLocaleString()}</small>
  </div>
}
