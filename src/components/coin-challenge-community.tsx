import { useEffect, useRef, useState } from 'react'

import { useMemberSession } from '#/lib/member-client'

export type RankableCoinWin = { amount: number; id: string }

type LeaderboardEntry = {
  rank: number
  displayName: string
  score: number
  wins?: number
  losses?: number
  updatedAt: string
}

type WeeklyCoinEntry = { rank: number; displayName: string; coins: number }

export function CoinChallengeCommunity({
  onOpenChange,
  recentWins,
  standalone = false,
  channel = 'coin-challenge',
  inlineLauncher = false,
  leaderboardMode,
  leaderboardTitle,
  scoreSubmission,
}: {
  onOpenChange?: (open: boolean) => void
  recentWins: Array<RankableCoinWin>
  standalone?: boolean
  channel?: 'coin-challenge' | 'red-blue-arena' | 'ghost-hunter'
  inlineLauncher?: boolean
  leaderboardMode?: string
  leaderboardTitle?: string
  scoreSubmission?: { id: string; score: number; outcome?: 'win' | 'loss' | 'draw'; wonCoins?: number; lostCoins?: number } | null
}) {
  const member = useMemberSession()
  const [isOpen, setIsOpen] = useState(false)
  const [leaderboard, setLeaderboard] = useState<Array<LeaderboardEntry>>([])
  const [bountyLeaderboard, setBountyLeaderboard] = useState<Array<WeeklyCoinEntry>>([])
  const [arrestLeaderboard, setArrestLeaderboard] = useState<Array<WeeklyCoinEntry>>([])
  const uploadedWinsRef = useRef<Set<string>>(new Set())
  const uploadedGameScoresRef = useRef<Set<string>>(new Set())

  async function refresh() {
    const modeQuery = leaderboardMode ? `&mode=${encodeURIComponent(leaderboardMode)}` : ''
    const response = await fetch(`/api/coin-challenge-community?channel=${encodeURIComponent(channel)}${modeQuery}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as { leaderboard?: Array<LeaderboardEntry>; bountyLeaderboard?: Array<WeeklyCoinEntry>; arrestLeaderboard?: Array<WeeklyCoinEntry> }
    setLeaderboard(next.leaderboard ?? [])
    setBountyLeaderboard(next.bountyLeaderboard ?? [])
    setArrestLeaderboard(next.arrestLeaderboard ?? [])
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/coin-challenge-community', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, channel }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error || '操作失败')
  }

  useEffect(() => { void refresh() }, [channel, leaderboardMode])
  useEffect(() => {
    if (!isOpen) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 2_000)
    return () => window.clearInterval(timer)
  }, [isOpen, channel, leaderboardMode])
  useEffect(() => {
    if (!member) return
    const pending = recentWins.filter(item => item.amount > 0 && !uploadedWinsRef.current.has(item.id))
    if (!pending.length) return
    pending.forEach(win => uploadedWinsRef.current.add(win.id))
    void Promise.all(pending.map(win =>
      post({ action: 'score', score: win.amount, submissionKey: `${member.id}:${win.id}` })
        .catch(() => uploadedWinsRef.current.delete(win.id)),
    )).then(() => void refresh())
  }, [member?.id, recentWins, isOpen])
  useEffect(() => {
    if (!member || !scoreSubmission || uploadedGameScoresRef.current.has(scoreSubmission.id)) return
    uploadedGameScoresRef.current.add(scoreSubmission.id)
    void post({ action: 'game-score', mode: leaderboardMode, outcome: scoreSubmission.outcome, score: scoreSubmission.score, wonCoins: scoreSubmission.wonCoins, lostCoins: scoreSubmission.lostCoins, submissionKey: `${member.id}:${channel}:${scoreSubmission.id}` })
      .then(() => void refresh())
      .catch(() => uploadedGameScoresRef.current.delete(scoreSubmission.id))
  }, [scoreSubmission?.id, member?.id, channel, leaderboardMode])

  function openLeaderboard() {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  function closeLeaderboard() {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  return (
    <>
      <div className={inlineLauncher ? 'relative z-30 flex shrink-0 items-center gap-1.5' : standalone ? 'fixed right-3 top-3 z-[180] flex items-center gap-1.5 sm:right-5 sm:top-5' : 'absolute right-20 top-4 z-30 flex items-center gap-1.5 sm:right-28 sm:top-5'}>
        <button className="flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-black/75 px-3 py-2 text-xs font-semibold text-amber-300 shadow-lg hover:bg-black" onClick={openLeaderboard} type="button">
          <i className="ri-trophy-line" /> 排行榜
        </button>
      </div>
      {isOpen ? (
        <aside className={standalone ? 'fixed bottom-3 right-2 top-3 z-[190] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:bottom-5 sm:right-3 sm:top-5 sm:w-[clamp(300px,28vw,380px)]' : 'fixed inset-x-3 bottom-3 top-3 z-[190] mx-auto flex max-w-md flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:absolute sm:bottom-0 sm:left-[calc(100%+12px)] sm:right-auto sm:top-0 sm:w-[clamp(260px,24vw,340px)]'}>
          <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0 flex-1"><strong>{channel === 'red-blue-arena' ? '红蓝竞技场排行榜' : channel === 'ghost-hunter' ? '幽灵捕手排行榜' : '金币娱乐游戏排行榜'}</strong></div>
            <button aria-label="关闭排行榜" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" onClick={closeLeaderboard} type="button">✕</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {leaderboardTitle ? <p className="mb-2 text-center text-xs font-bold text-amber-300">{leaderboardTitle}</p> : null}
            <div className="space-y-1">
              {leaderboard.map(item => <div className="grid grid-cols-[36px_1fr_auto] items-center rounded-xl bg-white/5 px-3 py-2 text-sm" key={`${item.rank}-${item.displayName}`}><b className={item.rank <= 3 ? 'text-amber-300' : 'text-white/40'}>#{item.rank}</b><span className="truncate">{item.displayName}</span><strong>{channel === 'red-blue-arena' ? `胜 ${item.wins ?? 0} · 负 ${item.losses ?? 0}` : item.score}</strong></div>)}
              {!leaderboard.length ? <p className="py-10 text-center text-sm text-white/40">暂时还没有挑战成绩</p> : null}
            </div>
            <p className="mt-4 text-center text-xs text-white/45">{channel === 'ghost-hunter' ? '自动记录登录玩家的最高连续过关数' : channel === 'red-blue-arena' ? '自动累计登录玩家在当前模式的胜利次数' : '按本游戏单局获得的金币数自动排名，0 金币不计入'}</p>
            {channel === 'red-blue-arena' ? <>
              <WeeklyCoinRanking title="悬赏令 · 本周赢得金币" entries={bountyLeaderboard} tone="bounty" />
              <WeeklyCoinRanking title="逮捕令 · 本周输掉金币" entries={arrestLeaderboard} tone="arrest" />
              <p className="mt-3 text-center text-[11px] leading-5 text-white/45">北京时间每周一 03:00 结算；逮捕令第一名高于悬赏令第一名时，可获得悬赏令第一名对应的金币数。不能领取自己的悬赏，同一玩家同时第一时顺延给下一位符合者。</p>
            </> : null}
          </div>
        </aside>
      ) : null}
    </>
  )
}

function WeeklyCoinRanking({ title, entries, tone }: { title: string; entries: WeeklyCoinEntry[]; tone: 'bounty' | 'arrest' }) {
  return <section className="mt-4 border-t border-white/10 pt-3">
    <h3 className={`mb-2 text-center text-xs font-black ${tone === 'bounty' ? 'text-yellow-300' : 'text-red-300'}`}>{title}</h3>
    <div className="space-y-1.5">
      {entries.slice(0, 10).map(item => <div className="grid grid-cols-[32px_1fr_auto] items-center rounded-xl bg-white/5 px-3 py-2 text-xs" key={`${tone}-${item.rank}-${item.displayName}`}><b className={item.rank <= 3 ? 'text-amber-300' : 'text-white/40'}>#{item.rank}</b><span className="truncate">{item.displayName}</span><strong>🪙 {item.coins}</strong></div>)}
      {!entries.length ? <p className="py-4 text-center text-xs text-white/35">本周暂时没有记录</p> : null}
    </div>
  </section>
}
