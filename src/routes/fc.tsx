import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { MemberAccountButton } from '#/components/member-account'
import { requestMemberLogin } from '#/lib/member-client'

export const Route = createFileRoute('/fc')({
  validateSearch: (search: Record<string, unknown>) => ({
    cartridge: search.cartridge === 'happy-cat' || search.cartridge === 'urban-champion' || search.cartridge === 'karateka-street-fighter' ? search.cartridge : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'FC收藏馆｜超级马里奥兄弟｜UCG999 怀旧游戏厅' },
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
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'fc-member-login-request') return
      requestMemberLogin()
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  return (
    <>
      <iframe
        allow="autoplay"
        src={`/fc-player/index.html${cartridge ? `?cartridge=${encodeURIComponent(cartridge)}` : ''}`}
        title="超级马里奥兄弟 FC收藏馆"
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
