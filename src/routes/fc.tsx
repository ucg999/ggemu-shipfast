import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/fc')({
  head: () => ({
    meta: [
      { title: 'FC收藏馆｜Waixing01｜UCG999 怀旧游戏厅' },
      {
        name: 'description',
        content: '手机直接打开即可游玩的 Waixing01 FC 独立游戏界面，支持触屏按键、存档和读档。',
      },
    ],
  }),
  component: FcPlayerPage,
})

function FcPlayerPage() {
  return (
    <iframe
      allow="autoplay"
      src="/fc-player/index.html"
      title="Waixing01 FC收藏馆"
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
  )
}
