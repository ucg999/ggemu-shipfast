import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gba')({
  head: () => ({
    meta: [
      { title: 'GBA 在线游戏 | UCG999 怀旧游戏厅' },
      {
        name: 'description',
        content: '打开 UCG999 GBA 专用游戏机，直接在手机或电脑上游玩。',
      },
    ],
  }),
  component: GbaPlayerPage,
})

function GbaPlayerPage() {
  return (
    <iframe
      allow="autoplay; fullscreen"
      src="/gba-player/index.html"
      title="UCG999 GBA 在线游戏"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        border: 0,
        background: '#06383b',
      }}
    />
  )
}
