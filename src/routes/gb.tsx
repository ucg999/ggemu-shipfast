import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/gb')({
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
  return <iframe
    allow="autoplay"
    src="/gb-player/index.html"
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
}
