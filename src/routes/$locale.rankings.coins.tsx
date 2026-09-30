import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { normalizeLocale } from '#/lib/i18n'

type RankingEntry = { rank: number; displayName: string; playerNumber: number; coins: number }
type RankingData = { date: string; total: Array<RankingEntry>; daily: Array<RankingEntry> }

export const Route = createFileRoute('/$locale/rankings/coins')({
  head: () => ({ meta: [{ title: '玩家金币排行榜｜怀旧游戏厅' }, { name: 'description', content: '查看玩家账号总金币榜和本日金币榜。' }] }),
  component: CoinRankingsPage,
})

function CoinRankingsPage() {
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const english = lang === 'en'
  const [data, setData] = useState<RankingData | null>(null)

  useEffect(() => {
    void fetch('/api/coin-rankings').then(response => response.json()).then(setData).catch(() => setData({ date: '', total: [], daily: [] }))
  }, [])

  return (
    <SiteLayout locale={lang}>
      <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/45">Player Rankings</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-6xl">{english ? 'Coin Rankings' : '金币排行榜'}</h1>
        <p className="mt-3 text-sm text-base-content/55">{english ? 'The total ranking refreshes once per day. Daily ranking counts coins credited today.' : '账号总金币榜每天更新一次；本日金币榜按今天进入玩家账号的金币计算。'}</p>
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <RankingPanel entries={data?.total ?? []} loading={!data} title={english ? 'Total Coins' : '金币榜'} />
          <RankingPanel entries={data?.daily ?? []} loading={!data} title={english ? "Today's Coins" : '本日金币榜'} />
        </div>
      </main>
    </SiteLayout>
  )
}

function RankingPanel({ entries, loading, title }: { entries: Array<RankingEntry>; loading: boolean; title: string }) {
  return <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm"><header className="border-b border-black/10 px-5 py-4"><h2 className="text-xl font-semibold">{title}</h2></header><ol className="divide-y divide-black/5">{entries.map(entry => <li className="grid grid-cols-[42px_1fr_auto] items-center gap-3 px-5 py-4" key={entry.playerNumber}><b className={entry.rank <= 3 ? 'text-amber-500' : 'text-black/35'}>#{entry.rank}</b><div className="min-w-0"><strong className="block truncate">{entry.displayName}</strong><span className="font-mono text-xs text-black/45">ID：{String(entry.playerNumber).padStart(5, '0')}</span></div><span className="font-mono text-lg font-bold">{entry.coins.toLocaleString()}</span></li>)}{loading ? <li className="px-5 py-12 text-center text-sm text-black/40">加载中…</li> : !entries.length ? <li className="px-5 py-12 text-center text-sm text-black/40">暂无排行数据</li> : null}</ol></section>
}
