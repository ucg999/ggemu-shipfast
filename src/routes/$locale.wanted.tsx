import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { getWantedGuestKey } from '#/components/wanted-playtime-tracker'
import { normalizeLocale } from '#/lib/i18n'
import { getMemberSession } from '#/lib/member-client'

type Leader = { rank: number; displayName: string; rawMinutes: number; minutes: number }
type WantedData = { periodKey: string; leaders: Leader[]; pendingRewards: Array<{ periodKey: string; rank: number; coins: number }>; lastWeekChampion?: string | null }

export const Route = createFileRoute('/$locale/wanted')({
  head: () => ({ meta: [{ title: '悬赏令｜每周游玩时长排行榜｜怀旧游戏厅' }, { name: 'description', content: '按有效游玩时间统计的每周悬赏令排行榜，前三名可获得金币奖励。' }] }),
  component: WantedPage,
})

const displayOrder = [2, 1, 3] as const
const rewards: Record<number, number> = { 1: 5_000, 2: 2_000, 3: 500 }
const wantedPosterCount = 18

function getWeeklyPosterSet(data: WantedData | null) {
  const used = new Set<number>()
  return displayOrder.map((rank) => {
    const leader = data?.leaders.find(item => item.rank === rank)
    const seed = `${data?.periodKey || 'current'}:${rank}:${leader?.displayName || `waiting-${rank}`}`
    let hash = 2166136261
    for (const character of seed) {
      hash ^= character.charCodeAt(0)
      hash = Math.imul(hash, 16777619)
    }
    let posterNumber = (hash >>> 0) % wantedPosterCount + 1
    while (used.has(posterNumber)) posterNumber = posterNumber % wantedPosterCount + 1
    used.add(posterNumber)
    return `/images/wanted/posters/${String(posterNumber).padStart(3, '0')}.webp`
  })
}

function WantedPage() {
  const lang = normalizeLocale(Route.useParams().locale)
  const [data, setData] = useState<WantedData | null>(null)
  const posterImages = useMemo(() => getWeeklyPosterSet(data), [data])
  const claimingRef = useRef(false)
  const [claiming, setClaiming] = useState(false)
  const [claimedCoins, setClaimedCoins] = useState(0)

  async function refresh() {
    const guestKey = getWantedGuestKey()
    const response = await fetch(`/api/wanted?guest=${encodeURIComponent(guestKey)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as WantedData
    setData(next)
  }

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  async function claimRewards(current: WantedData) {
    if (claimingRef.current) return
    claimingRef.current = true
    setClaiming(true)
    const guestKey = getWantedGuestKey()
    const response = await fetch('/api/wanted', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'claim', guestKey }) })
    if (response.ok) {
      const result = await response.json() as { coins?: number }
      const coins = Math.max(0, Number(result.coins) || 0)
      await getMemberSession().catch(() => null)
      setData({ ...current, pendingRewards: [] })
      setClaimedCoins(coins)
    }
    claimingRef.current = false
    setClaiming(false)
  }

  return <SiteLayout hideFooter locale={lang}>
    <main className="wanted-page-main flex h-[calc(100dvh-61px)] min-h-0 flex-col items-center justify-start overflow-hidden bg-[#f0f0ed] text-[#35231d]">
      <div className="min-h-0 w-full">
        <section className="wanted-poster-board relative mx-auto overflow-hidden">
          {displayOrder.map((rank, slot) => {
            const leader = data?.leaders.find(item => item.rank === rank)
            return <div className={`wanted-poster-slot wanted-poster-slot-${slot + 1}`} key={rank}>
              <img alt={`悬赏令第${rank}名海报`} className="wanted-poster-image" decoding="async" fetchPriority={slot === 1 ? 'high' : 'auto'} src={posterImages[slot]} />
              <WantedPosterText rank={rank} slot={slot} leader={leader} />
            </div>
          })}
        </section>
        <p className="mx-auto -mt-1 px-4 text-center text-sm font-semibold sm:text-base">上周冠军获得者：<span className="text-[#9a281d]">{data?.lastWeekChampion || '暂无记录'}</span></p>
      </div>
    </main>
    {data?.pendingRewards.length || claimedCoins ? <div className="fixed inset-0 z-[250] grid place-items-center bg-black/55 p-4">
      <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-[#35231d] shadow-2xl">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-amber-100 text-3xl">🪙</div>
        <h2 className="text-xl font-black">{claimedCoins ? '奖励领取成功' : '悬赏令奖励待领取'}</h2>
        <p className="mt-2 text-sm leading-6 text-black/60">{claimedCoins ? '恭喜你，奖励金币已经计入玩家账号！' : `恭喜你在上周悬赏令中脱颖而出！可领取 ${data?.pendingRewards.reduce((sum, reward) => sum + reward.coins, 0).toLocaleString()} 个金币。`}</p>
        {claimedCoins ? <strong className="mt-4 block text-3xl text-amber-600">+{claimedCoins.toLocaleString()}</strong> : null}
        <button className="mt-5 w-full rounded-full bg-[#35231d] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={claiming} onClick={() => claimedCoins ? setClaimedCoins(0) : data && void claimRewards(data)} type="button">
          {claimedCoins ? '确定' : claiming ? '领取中…' : '领取奖励'}
        </button>
      </section>
    </div> : null}
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
