import { BONUS_RANK_NAMES, type BonusRankEvent, type BonusChampion } from '#/lib/coin-bonus-ranking'
import { useEffect, useRef, useState } from 'react'

import { getMemberSession, useMemberSession } from '#/lib/member-client'

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
type PendingReward = { periodKey: string; coins: number }

export function CoinChallengeCommunity({
  onOpenChange,
  recentWins,
  standalone = false,
  channel = 'coin-challenge',
  inlineLauncher = false,
  leaderboardMode,
  leaderboardTitle,
  scoreSubmission,
  sessionHits,
  bonusEvents = [],
  demo = false,
}: {
  sessionHits?: { lucky: number; gold: number; ghost: number; bomb: number }
  bonusEvents?: BonusRankEvent[]
  demo?: boolean
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
  const [singleCashouts, setSingleCashouts] = useState<WeeklyCoinEntry[]>([])
  const [bonusChampions, setBonusChampions] = useState<BonusChampion[]>([])
  const uploadedBonuses = useRef(new Set<string>())
  const [isOpen, setIsOpen] = useState(false)
  const [leaderboard, setLeaderboard] = useState<Array<LeaderboardEntry>>([])
  const [bountyLeaderboard, setBountyLeaderboard] = useState<Array<WeeklyCoinEntry>>([])
  const [arrestLeaderboard, setArrestLeaderboard] = useState<Array<WeeklyCoinEntry>>([])
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<Array<WeeklyCoinEntry>>([])
  const [lastWeekChampion, setLastWeekChampion] = useState<string | null>(null)
  const [pendingRewards, setPendingRewards] = useState<Array<PendingReward>>([])
  const [expiredRewardCoins, setExpiredRewardCoins] = useState(0)
  const [claimingReward, setClaimingReward] = useState(false)
  const [claimedCoins, setClaimedCoins] = useState(0)
  const uploadedWinsRef = useRef<Set<string>>(new Set())
  const uploadedGameScoresRef = useRef<Set<string>>(new Set())

  async function refresh() {
    if (demo) return
    const modeQuery = leaderboardMode ? `&mode=${encodeURIComponent(leaderboardMode)}` : ''
    const response = await fetch(`/api/coin-challenge-community?channel=${encodeURIComponent(channel)}${modeQuery}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as { singleCashoutLeaderboard?: WeeklyCoinEntry[]; bonusChampions?: BonusChampion[]; leaderboard?: Array<LeaderboardEntry>; weeklyLeaderboard?: Array<WeeklyCoinEntry>; bountyLeaderboard?: Array<WeeklyCoinEntry>; arrestLeaderboard?: Array<WeeklyCoinEntry>; lastWeekChampion?: string | null; pendingRewards?: Array<PendingReward>; expiredRewards?: Array<PendingReward> }
    setLeaderboard((next.leaderboard ?? []).slice(0, channel === 'coin-challenge' ? 3 : 10))
    setSingleCashouts(next.singleCashoutLeaderboard ?? [])
    setBonusChampions(next.bonusChampions ?? [])
    setWeeklyLeaderboard(next.weeklyLeaderboard ?? [])
    setBountyLeaderboard(next.bountyLeaderboard ?? [])
    setArrestLeaderboard(next.arrestLeaderboard ?? [])
    setLastWeekChampion(next.lastWeekChampion ?? null)
    setPendingRewards(next.pendingRewards ?? [])
    const expiredCoins = (next.expiredRewards ?? []).reduce((sum, reward) => sum + reward.coins, 0)
    if (expiredCoins > 0) setExpiredRewardCoins(expiredCoins)
  }

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/coin-challenge-community', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, channel }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error || '操作失败')
  }

  useEffect(() => {
    if (!isOpen) return
    void refresh()
  }, [isOpen, channel, leaderboardMode])
  useEffect(() => {
    if (demo || !member) return
    const pending = recentWins.filter(item => item.amount > 0 && !uploadedWinsRef.current.has(item.id))
    if (!pending.length) return
    pending.forEach(win => uploadedWinsRef.current.add(win.id))
    void Promise.all(pending.map(win =>
      post({ action: 'score', score: win.amount, submissionKey: `${member.id}:${win.id}` })
        .catch(() => uploadedWinsRef.current.delete(win.id)),
    ))
  }, [member?.id, recentWins, isOpen])
  useEffect(() => {
    if (demo || !member || !scoreSubmission || uploadedGameScoresRef.current.has(scoreSubmission.id)) return
    uploadedGameScoresRef.current.add(scoreSubmission.id)
    void post({ action: 'game-score', mode: leaderboardMode, outcome: scoreSubmission.outcome, score: scoreSubmission.score, wonCoins: scoreSubmission.wonCoins, lostCoins: scoreSubmission.lostCoins, submissionKey: `${member.id}:${channel}:${scoreSubmission.id}` })
      .catch(() => uploadedGameScoresRef.current.delete(scoreSubmission.id))
  }, [scoreSubmission?.id, member?.id, channel, leaderboardMode])

  useEffect(() => {
    if (demo || !member) return
    const pending = bonusEvents.filter(event => !uploadedBonuses.current.has(event.id))
    pending.forEach(event => {
      uploadedBonuses.current.add(event.id)
      void post({ action: 'bonus-hit', kind: event.kind, submissionKey: event.id })
        .catch(() => uploadedBonuses.current.delete(event.id))
    })
  }, [bonusEvents, member?.id, demo, isOpen])

  function openLeaderboard() {
    setIsOpen(true)
    onOpenChange?.(true)
  }

  function closeLeaderboard() {
    setIsOpen(false)
    onOpenChange?.(false)
  }

  async function claimWeeklyReward() {
    if (claimingReward) return
    setClaimingReward(true)
    try {
      const response = await fetch('/api/coin-challenge-community', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim-weekly-reward', channel }),
      })
      const result = await response.json() as { coins?: number; error?: string }
      if (!response.ok) throw new Error(result.error || '领取失败')
      setPendingRewards([])
      setClaimedCoins(Math.max(0, Number(result.coins) || 0))
      await getMemberSession().catch(() => null)
    } finally {
      setClaimingReward(false)
    }
  }

  return (
    <>
      <div className={inlineLauncher ? 'relative z-30 flex shrink-0 items-center gap-1.5' : standalone ? 'fixed right-3 top-3 z-[180] flex items-center gap-1.5 sm:right-5 sm:top-5' : 'absolute right-20 top-4 z-30 flex items-center gap-1.5 sm:right-28 sm:top-5'}>
        {sessionHits ? <div className="grid grid-cols-2 gap-x-2 rounded-lg bg-black/80 px-2 py-1 text-[11px] leading-4 text-amber-200" aria-live="polite"><div>幸运格 {sessionHits.lucky} 次</div><div>黄金格 {sessionHits.gold} 次</div><div>幽灵格 {sessionHits.ghost} 次</div><div>炸弹格 {sessionHits.bomb} 次</div></div> : null}
        <button className="flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-black/75 px-3 py-2 text-xs font-semibold text-amber-300 shadow-lg hover:bg-black" onClick={openLeaderboard} type="button">
          <i className="ri-trophy-line" /> 排行榜
        </button>
      </div>
      {isOpen ? (
        <aside className={channel === 'coin-challenge' ? 'fixed inset-x-2 bottom-3 top-3 z-[190] mx-auto flex w-[calc(100%-16px)] max-w-[760px] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur' : standalone ? 'fixed bottom-3 right-2 top-3 z-[190] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:bottom-5 sm:right-3 sm:top-5 sm:w-[clamp(300px,28vw,380px)]' : 'fixed inset-x-3 bottom-3 top-3 z-[190] mx-auto flex max-w-md flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:absolute sm:bottom-0 sm:left-[calc(100%+12px)] sm:right-auto sm:top-0 sm:w-[clamp(260px,24vw,340px)]'}>
          <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0 flex-1"><strong>{channel === 'red-blue-arena' ? '红蓝竞技场排行榜' : channel === 'ghost-hunter' ? '幽灵捕手排行榜' : '金币娱乐游戏排行榜'}</strong></div>
            <button aria-label="关闭排行榜" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" onClick={closeLeaderboard} type="button">✕</button>
          </header>
          <div className={channel === 'coin-challenge' ? "grid min-h-0 flex-1 grid-cols-2 gap-2 p-2 sm:gap-4 sm:p-3" : "min-h-0 flex-1 overflow-y-auto p-3"}>
            <div className="min-w-0 overflow-y-auto">
            {leaderboardTitle ? <p className="mb-2 text-center text-xs font-bold text-amber-300">{leaderboardTitle}</p> : null}
            {channel === 'coin-challenge' || channel === 'ghost-hunter' ? <h3 className="mb-2 text-center text-xs font-black text-amber-300">总榜</h3> : null}
            <div className="space-y-1">
              {leaderboard.slice(0, channel === 'coin-challenge' ? 3 : 10).map(item => <div className="grid grid-cols-[36px_1fr_auto] items-center rounded-xl bg-white/5 px-3 py-2 text-sm" key={`${item.rank}-${item.displayName}`}><b className={item.rank <= 3 ? 'text-amber-300' : 'text-white/40'}>#{item.rank}</b><span className="truncate">{item.displayName}</span><strong>{channel === 'red-blue-arena' ? `胜 ${item.wins ?? 0} · 负 ${item.losses ?? 0}` : item.score}</strong></div>)}
              {!leaderboard.length ? <p className="py-10 text-center text-sm text-white/40">暂时还没有挑战成绩</p> : null}
            </div>
            {channel === 'coin-challenge' ? <>
              <WeeklyCoinRanking title="一骑当千" entries={singleCashouts.slice(0, 3)} tone="bounty" />

            </> : null}
            {channel === 'ghost-hunter' ? <>
              <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-1.5 py-1 text-center text-[10px] leading-4 text-amber-200">周榜冠军奖 <strong className="text-xs font-bold text-yellow-300">1,000</strong> 金币</div>
              <WeeklyCoinRanking title="本周连续过关榜" entries={weeklyLeaderboard} tone="bounty" unit="关" />
              <p className="mt-3 text-center text-[11px] leading-5 text-white/45">按本周最高连续过关数排名；北京时间每周一 03:00 结算，仅登录玩家参与排名。</p>
              <p className="mt-3 text-center text-xs font-semibold text-amber-200">上周冠军获得者：{lastWeekChampion || '暂无记录'}</p>
            </> : null}
            <p className="mt-4 text-center text-xs text-white/45">{channel === 'ghost-hunter' ? '自动记录登录玩家的最高连续过关数' : channel === 'red-blue-arena' ? '自动累计登录玩家在当前模式的胜利次数' : '总榜累计每次奖池退币数，并永久显示前三名；普通币池退币不计入'}</p>
            {channel === 'coin-challenge' ? <>
              <div className="mt-2 rounded-lg border border-amber-300/30 bg-amber-400/10 px-1.5 py-1 text-center text-[10px] leading-4 text-amber-200">周榜冠军奖 <strong className="text-xs font-bold text-yellow-300">5,000</strong> 金币</div>
              <WeeklyCoinRanking title="本周退币榜" entries={weeklyLeaderboard} tone="bounty" />
              <p className="mt-3 text-center text-[11px] leading-5 text-white/45">按本周单次奖池退币最高纪录排名，不累计；北京时间每周一 03:00 结算。</p>
              <p className="mt-3 text-center text-xs font-semibold text-amber-200">上周冠军获得者：{lastWeekChampion || '暂无记录'}</p>
            </> : null}
            {channel === 'red-blue-arena' ? <>
              <WeeklyCoinRanking title="悬赏令 · 本周赢得金币" entries={bountyLeaderboard} tone="bounty" />
              <WeeklyCoinRanking title="逮捕令 · 本周输掉金币" entries={arrestLeaderboard} tone="arrest" />
              <p className="mt-3 text-center text-[11px] leading-5 text-white/45">北京时间每周一 03:00 结算；当逮捕令累计总和高于悬赏令累计总和时，逮捕令第一名获得两榜总和的差额金币。同一玩家同时位列两榜第一，也可以正常领取奖励。</p>
              <p className="mt-3 text-center text-xs font-semibold text-amber-200">上周冠军获得者：{lastWeekChampion || '暂无记录'}</p>
            </> : null}
            </div>
            {channel === 'coin-challenge' ? <section className="min-w-0 overflow-y-auto border-l border-white/10 pl-2 sm:pl-3">
              <h3 className="mb-2 mt-4 text-center text-sm font-black text-amber-300">跑灯达人榜</h3>
              {Object.entries(BONUS_RANK_NAMES).map(([kind, name]) => {
                const champion = bonusChampions.find(item => item.kind === kind)
                const localCount = bonusEvents.filter(item => item.kind === kind).length
                return <div key={kind} className="mb-1 grid grid-cols-[1fr_auto] items-center gap-1 rounded-xl bg-white/5 px-2 py-3 text-xs"><b className="col-span-2">{name}</b><span className="truncate">{demo ? (localCount ? '本地试玩' : '暂无记录') : champion?.displayName || '暂无记录'}</span><strong className="text-amber-300">{demo ? localCount : champion?.count ?? 0} 次</strong></div>
              })}
              <p className="mt-2 text-center text-[11px] text-white/45">{demo ? '本地试玩记录，不上传正式榜单' : '每种奖励累计命中最多的玩家；同次数先达到者优先'}</p>
            </section> : null}
          </div>
        </aside>
      ) : null}
      {(channel === 'red-blue-arena' || channel === 'coin-challenge' || channel === 'ghost-hunter') && (pendingRewards.length > 0 || claimedCoins > 0 || expiredRewardCoins > 0) ? <div className="fixed inset-0 z-[260] grid place-items-center bg-black/65 p-4">
        <section className="w-full max-w-sm rounded-3xl border border-red-300/25 bg-[#171111] p-6 text-center text-white shadow-2xl">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-3xl">🪙</div>
          <h2 className="text-xl font-black">{expiredRewardCoins ? '奖币已过期' : claimedCoins ? '奖励领取成功' : channel === 'red-blue-arena' ? '红蓝竞技奖励待领取' : '周榜冠军奖励待领取'}</h2>
          <p className="mt-2 text-sm leading-6 text-white/60">{expiredRewardCoins ? '你上周获得冠军，但领币已过时了，抱歉' : claimedCoins ? '恭喜你，奖励金币已经计入玩家账号！' : `恭喜你赢得上周${channel === 'coin-challenge' ? '金币娱乐退币榜冠军' : channel === 'ghost-hunter' ? '幽灵捕手连续过关榜冠军' : '红蓝竞技奖励'}！可领取 ${pendingRewards.reduce((sum, reward) => sum + reward.coins, 0).toLocaleString()} 个金币。`}</p>
          {claimedCoins ? <strong className="mt-4 block text-3xl text-amber-300">+{claimedCoins.toLocaleString()}</strong> : null}
          <button className="mt-5 w-full rounded-full bg-red-600 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={claimingReward} onClick={() => expiredRewardCoins ? setExpiredRewardCoins(0) : claimedCoins ? setClaimedCoins(0) : void claimWeeklyReward()} type="button">
            {expiredRewardCoins || claimedCoins ? '确定' : claimingReward ? '领取中…' : '领取奖励'}
          </button>
        </section>
      </div> : null}
    </>
  )
}

function WeeklyCoinRanking({ title, entries, tone, unit = 'coin' }: { title: string; entries: WeeklyCoinEntry[]; tone: 'bounty' | 'arrest'; unit?: 'coin' | '关' }) {
  return <section className="mt-4 border-t border-white/10 pt-3">
    <h3 className={`mb-2 text-center text-xs font-black ${tone === 'bounty' ? 'text-yellow-300' : 'text-red-300'}`}>{title}</h3>
    <div className="space-y-1.5">
      {entries.slice(0, 10).map(item => <div className="grid grid-cols-[32px_1fr_auto] items-center rounded-xl bg-white/5 px-3 py-2 text-xs" key={`${tone}-${item.rank}-${item.displayName}`}><b className={item.rank <= 3 ? 'text-amber-300' : 'text-white/40'}>#{item.rank}</b><span className="truncate">{item.displayName}</span><strong>{unit === 'coin' ? `🪙 ${item.coins}` : `${item.coins} ${unit}`}</strong></div>)}
      {!entries.length ? <p className="py-4 text-center text-xs text-white/35">暂时没有记录</p> : null}
    </div>
  </section>
}
