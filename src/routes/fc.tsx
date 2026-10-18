import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { MemberAccountButton } from '#/components/member-account'
import { spendCoinBalance } from '#/lib/coin-wallet'
import { getMemberSession, requestMemberLogin, useMemberSession } from '#/lib/member-client'

const FC_CARTRIDGE_IDS = new Set([
  'donkey-kong', 'donkey-kong-jr', 'popeye', 'gomoku-narabe', 'mahjong', 'mario-bros',
  'popeye-english', 'baseball', 'donkey-kong-jr-math', 'urban-champion', 'happy-cat', 'karateka-street-fighter',
  'baoxiao-sanguo', 'prison-break-nine-characters', 'contra-underwater-eight-levels', 'green-beret-captain-america',
  'balloon-fight', 'ice-climber', 'galaga', 'soccer', 'championship-lode-runner', 'kung-fu', 'wrecking-crew',
])

export const Route = createFileRoute('/fc')({
  validateSearch: (search: Record<string, unknown>) => ({
    cartridge: typeof search.cartridge === 'string' && FC_CARTRIDGE_IDS.has(search.cartridge) ? search.cartridge : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'FC游戏机｜超级马里奥兄弟｜UCG999 怀旧游戏厅' },
      {
        name: 'description',
        content: '手机直接打开即可游玩的超级马里奥兄弟 FC 独立游戏界面，支持触屏按键、存档和读档。',
      },
    ],
  }),
  component: FcPlayerPage,
})

function FcPlayerPage() {
  const { cartridge } = Route.useSearch()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const member = useMemberSession()

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'fc-member-status', loggedIn: Boolean(member) }, window.location.origin)
  }, [member])

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'fc-member-status-request') {
        const { member: sessionMember } = await getMemberSession().catch(() => ({ member: null }))
        ;(event.source as Window | null)?.postMessage(
          { type: 'fc-member-status', loggedIn: Boolean(sessionMember) },
          event.origin,
        )
        return
      }
      if (event.data?.type === 'fc-member-login-request') {
        requestMemberLogin()
        return
      }
      if (event.data?.type === 'fc-spend-coins-request') {
        const requestId = typeof event.data.requestId === 'string' ? event.data.requestId : ''
        const amount = Math.max(0, Math.min(100, Math.floor(Number(event.data.amount) || 0)))
        await getMemberSession().catch(() => null)
        const success = Boolean(requestId && amount > 0 && spendCoinBalance(amount))
        ;(event.source as Window | null)?.postMessage(
          { type: 'fc-spend-coins-result', requestId, success },
          event.origin,
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <>
      <iframe
        ref={iframeRef}
        allow="autoplay; web-share"
        onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'fc-member-status', loggedIn: Boolean(member) }, window.location.origin)}
        src={cartridge === 'green-beret-captain-america'
          ? '/fc-1058/index.html?v=20261016-2&cartridge=green-beret-captain-america'
          : `/fc-player/index.html?v=20261016-5${cartridge ? `&cartridge=${encodeURIComponent(cartridge)}` : ''}`}
        title="超级马里奥兄弟 FC游戏机"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          border: 0,
          background: '#d6d6d8',
        }}
      />
      <div className="fixed left-0 top-0 z-[220] [&>button]:hidden">
        <MemberAccountButton locale="zh-CN" />
      </div>
    </>
  )
}
