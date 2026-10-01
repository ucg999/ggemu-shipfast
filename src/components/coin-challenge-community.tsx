import { useEffect, useRef, useState } from 'react'

import { getMemberSession, useMemberSession } from '#/lib/member-client'

export type RankableCoinWin = { amount: number; id: string }
export type CoinChallengeRoomPlayer = { memberId: string; displayName: string; bets: Array<number>; mode: string; credits: number; inRoom: boolean; seat: number | null }

type CommunityData = {
  chat: Array<{ id: number; memberId: string; displayName: string; message: string; createdAt: string }>
  leaderboard: Array<{ rank: number; displayName: string; score: number; wins?: number; losses?: number; updatedAt: string }>
  online: number
  players: Array<CoinChallengeRoomPlayer>
  room: { joined: boolean; count: number; capacity: number }
  sharedRound?: { token: string; startsAt: number; target: number } | null
  winCounts: Record<string, number>
  winCoins: Record<string, number>
}

const EMPTY_DATA: CommunityData = { chat: [], leaderboard: [], online: 0, players: [], room: { joined: false, count: 0, capacity: 4 }, winCounts: {}, winCoins: {} }

export function CoinChallengeCommunity({ bets, credits, gameMode, onOpenChange, onRoomChange, onRoomPlayers, recentWins, chatOnly = false, channel = 'coin-challenge', inlineLauncher = false, leaderboardMode, leaderboardTitle, scoreSubmission }: { bets: Array<number>; credits: number; gameMode: 'normal' | 'gold' | 'ghost'; onOpenChange?: (open: boolean) => void; onRoomChange?: (joined: boolean) => void; onRoomPlayers?: (players: Array<CoinChallengeRoomPlayer>) => void; recentWins: Array<RankableCoinWin>; chatOnly?: boolean; channel?: 'coin-challenge' | 'red-blue-arena' | 'ghost-hunter'; inlineLauncher?: boolean; leaderboardMode?: string; leaderboardTitle?: string; scoreSubmission?: { id: string; score: number; outcome?: 'win' | 'loss' } | null }) {
  const member = useMemberSession()
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState<'chat' | 'rank'>('chat')
  const [data, setData] = useState<CommunityData>(EMPTY_DATA)
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const uploadedWinsRef = useRef<Set<string>>(new Set())
  const uploadedGameScoresRef = useRef<Set<string>>(new Set())

  async function refresh() {
    const modeQuery = leaderboardMode ? `&mode=${encodeURIComponent(leaderboardMode)}` : ''
    const response = await fetch(`/api/coin-challenge-community?channel=${encodeURIComponent(channel)}${modeQuery}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as CommunityData
    setData(next)
    onRoomChange?.(next.room?.joined ?? false)
    onRoomPlayers?.(next.players.filter(player => player.inRoom))
  }

  async function refreshRoom() {
    const response = await fetch(`/api/coin-challenge-community?room=1&channel=${encodeURIComponent(channel)}`, { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) return
    const next = await response.json() as Pick<CommunityData, 'online' | 'players' | 'room' | 'sharedRound' | 'winCounts' | 'winCoins'>
    setData(current => ({ ...current, ...next }))
    onRoomChange?.(next.room.joined)
    onRoomPlayers?.(next.players.filter(player => player.inRoom))
  }

  useEffect(() => { void getMemberSession() }, [])
  useEffect(() => {
    if (!member) return
    void post({
      action: 'presence',
      // Gold/ghost bonus rounds reuse the initiating wager locally. Do not
      // publish that retained wager as a new multiplayer bet.
      bets: gameMode === 'normal' ? bets : bets.map(() => 0),
      credits,
      mode: gameMode,
    }).catch(() => {})
  }, [bets, credits, gameMode, isOpen, member?.id])
  useEffect(() => {
    if (!member) return
    const leave = () => {
      const body = JSON.stringify({ action: 'presence-leave', channel })
      navigator.sendBeacon('/api/coin-challenge-community', new Blob([body], { type: 'application/json' }))
    }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [channel, member?.id])
  useEffect(() => { void refresh() }, [channel, leaderboardMode])
  useEffect(() => {
    if (!isOpen || data.room.joined) return
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => window.clearInterval(timer)
  }, [isOpen, data.room.joined, channel, leaderboardMode])
  useEffect(() => {
    if (!data.room.joined) return
    void refreshRoom()
    const timer = window.setInterval(() => void refreshRoom(), 2_000)
    return () => window.clearInterval(timer)
  }, [data.room.joined])
  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [data.chat, tab])
  useEffect(() => {
    if (!member) return
    const pending = recentWins.filter(item => item.amount > 0 && !uploadedWinsRef.current.has(item.id))
    if (!pending.length) return
    pending.forEach(win => uploadedWinsRef.current.add(win.id))
    void Promise.all(pending.map(win =>
      post({ action: 'score', score: win.amount, submissionKey: `${member.id}:${win.id}` })
        .catch(() => uploadedWinsRef.current.delete(win.id)),
    )).then(() => { if (isOpen && tab === 'rank') void refresh() })
  }, [member?.id, recentWins, isOpen, tab])
  useEffect(() => {
    if (!member || !scoreSubmission || uploadedGameScoresRef.current.has(scoreSubmission.id)) return
    uploadedGameScoresRef.current.add(scoreSubmission.id)
    void post({ action: 'game-score', mode: leaderboardMode, outcome: scoreSubmission.outcome, score: scoreSubmission.score, submissionKey: `${member.id}:${channel}:${scoreSubmission.id}` })
      .then(() => { if (isOpen && tab === 'rank') void refresh() })
      .catch(() => uploadedGameScoresRef.current.delete(scoreSubmission.id))
  }, [scoreSubmission?.id, member?.id, channel, leaderboardMode])

  async function post(body: Record<string, unknown>) {
    const response = await fetch('/api/coin-challenge-community', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, channel }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) throw new Error(result.error || '操作失败')
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault()
    if (!member || !message.trim() || busy) return
    setBusy(true); setStatus('')
    try {
      await post({ action: 'chat', message })
      setMessage('')
      await refresh()
    } catch (error) { setStatus(error instanceof Error ? error.message : '发送失败') }
    finally { setBusy(false) }
  }

  async function changeRoom(action: 'room-join' | 'room-leave') {
    if (!member || busy) {
      setStatus('请先登录玩家账号再加入联机房间')
      setIsOpen(true); onOpenChange?.(true)
      return
    }
    setBusy(true); setStatus('')
    try {
      await post({ action })
      await refresh()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '房间操作失败')
      setIsOpen(true); onOpenChange?.(true)
    } finally { setBusy(false) }
  }

  async function closeHall() {
    setIsOpen(false)
    onOpenChange?.(false)
    setData(current => ({ ...current, chat: [] }))
    if (member) await post({ action: 'chat-clear' }).catch(() => {})
  }

  return (
    <>
      <div className={inlineLauncher ? 'relative z-30 flex shrink-0 items-center gap-1.5' : chatOnly ? 'fixed right-3 top-3 z-[180] flex items-center gap-1.5 sm:right-5 sm:top-5' : 'absolute right-20 top-4 z-30 flex items-center gap-1.5 sm:right-28 sm:top-5'}>
        {!chatOnly ? <button className="rounded-full border border-emerald-300/40 bg-emerald-500/90 px-2.5 py-2 text-xs font-bold text-white shadow-lg disabled:opacity-35" disabled={busy || data.room.joined} onClick={() => void changeRoom('room-join')} type="button">加入</button> : null}
        {!chatOnly ? <button className="rounded-full border border-white/20 bg-black/75 px-2.5 py-2 text-xs font-semibold text-white shadow-lg disabled:opacity-35" disabled={busy || !data.room.joined} onClick={() => void changeRoom('room-leave')} type="button">退出</button> : null}
        <button className="flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-black/75 px-3 py-2 text-xs font-semibold text-amber-300 shadow-lg hover:bg-black" onClick={() => { setTab('rank'); setIsOpen(true); onOpenChange?.(true) }} type="button">
          <i className="ri-trophy-line" /> 排行榜
        </button>
        <button className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/75 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur hover:bg-black" onClick={() => { setTab('chat'); setIsOpen(true); onOpenChange?.(true) }} type="button">
          <i className="ri-group-line" /> 聊天室 {data.online}
        </button>
      </div>
      {isOpen ? (
        <aside className={chatOnly ? 'fixed bottom-3 right-2 top-3 z-[190] flex w-[min(92vw,380px)] flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:bottom-5 sm:right-3 sm:top-5 sm:w-[clamp(300px,28vw,380px)]' : 'fixed inset-x-3 bottom-3 top-3 z-[190] mx-auto flex max-w-md flex-col overflow-hidden rounded-3xl border border-white/15 bg-[#111]/95 text-white shadow-2xl backdrop-blur sm:absolute sm:bottom-0 sm:left-[calc(100%+12px)] sm:right-auto sm:top-0 sm:w-[clamp(260px,24vw,340px)]'}>
          <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <div className="min-w-0 flex-1"><strong>{channel === 'red-blue-arena' ? '红蓝竞技场聊天室' : channel === 'ghost-hunter' ? '幽灵捕手聊天室' : '金币娱乐游戏聊天室'}</strong><p className="text-xs text-white/50">在线玩家 {data.online} 人</p></div>
            <button aria-label="关闭聊天室" className="grid h-8 w-8 place-items-center rounded-full hover:bg-white/10" onClick={() => void closeHall()} type="button">✕</button>
          </header>
          {tab === 'chat' ? (
            <>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {!chatOnly && data.room.joined ? <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-2"><p className="mb-2 text-[11px] font-semibold text-emerald-300">1号房正在下注 · 由1P点击开始</p><div className="space-y-2">{data.players.filter(player => player.inRoom).sort((left, right) => (left.seat ?? 99) - (right.seat ?? 99)).map(player => { const total = player.bets.reduce((sum, value) => sum + value, 0); return <div className="rounded-xl bg-black/30 px-2.5 py-2" key={player.memberId}><div className="flex items-center justify-between gap-2 text-xs"><b className="truncate"><span className="mr-1 text-emerald-300">{player.seat ?? '?'}P</span>{player.displayName}</b><span className="flex items-center gap-2"><em className="not-italic font-bold text-amber-300">中 {data.winCoins[player.memberId] ?? 0} 币 · {data.winCounts[player.memberId] ?? 0} 次</em><span className="text-white/50">下注 {total}</span></span></div><BetCells bets={player.bets} /></div> })}</div></div> : null}
                {data.chat.length ? data.chat.map(item => <div key={item.id}><div className="text-[11px] text-amber-300">{item.displayName}</div><p className="mt-0.5 break-words rounded-2xl rounded-tl-sm bg-white/10 px-3 py-2 text-sm">{item.message}</p></div>) : <p className="py-10 text-center text-sm text-white/40">还没有消息，来打个招呼吧</p>}
                <div ref={chatEndRef} />
              </div>
              <form className="border-t border-white/10 p-3" onSubmit={sendMessage}>
                {member ? <div className="flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-sm outline-none focus:border-amber-300" maxLength={120} onChange={event => setMessage(event.target.value)} placeholder="和正在玩的玩家聊聊…" value={message} /><button className="h-10 rounded-full bg-amber-400 px-4 text-sm font-bold text-black disabled:opacity-50" disabled={busy || !message.trim()} type="submit">发送</button></div> : <p className="text-center text-sm text-white/60">登录玩家账号后即可参与聊天</p>}
              </form>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {leaderboardTitle ? <p className="mb-2 text-center text-xs font-bold text-amber-300">{leaderboardTitle}</p> : null}
              <div className="space-y-1">
                {data.leaderboard.map(item => <div className="grid grid-cols-[36px_1fr_auto] items-center rounded-xl bg-white/5 px-3 py-2 text-sm" key={`${item.rank}-${item.displayName}`}><b className={item.rank <= 3 ? 'text-amber-300' : 'text-white/40'}>#{item.rank}</b><span className="truncate">{item.displayName}</span><strong>{channel === 'red-blue-arena' ? `胜 ${item.wins ?? 0} · 负 ${item.losses ?? 0}` : item.score}</strong></div>)}
                {!data.leaderboard.length ? <p className="py-10 text-center text-sm text-white/40">暂时还没有挑战成绩</p> : null}
              </div>
              <p className="mt-4 text-center text-xs text-white/45">{channel === 'ghost-hunter' ? '自动记录登录玩家的最高连续过关数' : channel === 'red-blue-arena' ? '自动累计登录玩家在当前模式的胜利次数' : '按本游戏单局获得的金币数自动排名，0 金币不计入'}</p>
            </div>
          )}
          {status ? <p className="border-t border-white/10 px-4 py-2 text-center text-xs text-amber-300">{status}</p> : null}
        </aside>
      ) : null}
    </>
  )
}

function BetCells({ bets }: { bets: Array<number> }) {
  return <div className="mt-1 grid grid-cols-8 gap-1">{bets.map((_, displayIndex) => { const optionIndex = bets.length - 1 - displayIndex; const value = bets[optionIndex] ?? 0; return <span className={`grid aspect-square place-items-center rounded text-[10px] ${value ? 'bg-amber-400 font-bold text-black' : 'bg-white/5 text-white/25'}`} key={optionIndex}>{value}</span> })}</div>
}
