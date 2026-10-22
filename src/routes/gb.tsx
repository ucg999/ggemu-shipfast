import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { MemberAccountButton } from '#/components/member-account'
import { spendCoinBalance } from '#/lib/coin-wallet'
import { getMemberSession, requestMemberLogin, useMemberSession } from '#/lib/member-client'

export const Route = createFileRoute('/gb')({
  validateSearch: (search: Record<string, unknown>) => ({
    cartridge: typeof search.cartridge === 'string' && ['castlevania-2', 'pokemon-gold', 'pokemon-silver', 'cyborg-kuro-chan-2', 'pokemon-crystal'].includes(search.cartridge) ? search.cartridge : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'GB游戏机｜热斗 格斗之王96｜UCG999 怀旧游戏厅' },
      {
        name: 'description',
        content: '手机直接打开即可游玩的 GB 游戏机，试玩《热斗 格斗之王96》，支持触屏按键、存档和读档。',
      },
    ],
  }),
  component: GbPlayerPage,
})

function GbPlayerPage() {
  const { cartridge } = Route.useSearch()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const member = useMemberSession()

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'gb-member-status', loggedIn: Boolean(member) }, window.location.origin)
  }, [member])

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'gb-member-status-request') {
        const { member: sessionMember } = await getMemberSession().catch(() => ({ member: null }))
        ;(event.source as Window | null)?.postMessage(
          { type: 'gb-member-status', loggedIn: Boolean(sessionMember) },
          event.origin,
        )
        return
      }
      if (event.data?.type === 'gb-member-login-request') {
        requestMemberLogin()
        return
      }
      if (event.data?.type === 'gb-spend-coins-request') {
        const requestId = typeof event.data.requestId === 'string' ? event.data.requestId : ''
        const amount = Math.max(0, Math.min(100, Math.floor(Number(event.data.amount) || 0)))
        await getMemberSession().catch(() => null)
        const success = Boolean(requestId && amount > 0 && spendCoinBalance(amount))
        ;(event.source as Window | null)?.postMessage(
          { type: 'gb-spend-coins-result', requestId, success },
          event.origin,
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])
  return <>
    <iframe
      ref={iframeRef}
      allow="autoplay; web-share"
      onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'gb-member-status', loggedIn: Boolean(member) }, window.location.origin)}
      src={`/gb-player/index.html?v=20261022-1${cartridge ? `&cartridge=${encodeURIComponent(cartridge)}` : ''}`}
      title="GB游戏机 热斗 格斗之王96"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        border: 0,
        background: '#d6d6d8',
      }}
    />
    <div className="fixed left-0 top-0 z-[220] [&>button]:hidden"><MemberAccountButton locale="zh-CN" /></div>
  </>
}
