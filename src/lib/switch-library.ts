export type SwitchLibraryGame = {
  id: string
  title: string
  cover: string
  genre: string
  publisher: string
  releaseDate: string
  requiredSystem: string
  language: string
  downloadUrl?: string
  downloadStatus?: string
  shareVersion?: string
  description: string
  screenshots: string[]
}

// Add future Switch downloads here to keep every card consistent.
export const SWITCH_LIBRARY_GAMES: SwitchLibraryGame[] = [
  {
    id: 'warriors-abyss',
    title: '无双深渊',
    cover: '/switch-library/musou-abyss/Abyss01.webp',
    genre: '动作、角色扮演',
    publisher: 'KOEI TECMO GAMES',
    description: `号令名垂青史的各路一骑当千之英豪，挑战蜂拥而至的敌人。积累胜与败的经验，突破地狱的难关吧。
■超过百名英豪搭档参战的全新战斗
可成为同伴的英豪数量超越100名！
通过搭配个性十足的英豪，组成属于自己的最强队伍，战胜地狱的亡者吧！
■运用“召唤英豪”歼灭大量敌军的全新无双体验
通过“召唤英豪”击溃从四面八方涌现的无数敌军，展开魄力十足的激战。可以体验到无双系列未曾有过的爽快感。`,
    releaseDate: '2025-02-13',
    requiredSystem: '19.0.1',
    language: '中文',
    downloadUrl: 'https://pan.baidu.com/s/1tLpvWSG03B2NLwvrWM1zvQ?pwd=9999',
    shareVersion: '版本号（本体+1.8.0升补+19DLC|NSZ|原版|）',
    screenshots: Array.from({ length: 6 }, (_, index) => `/switch-library/musou-abyss/Abyss0${index + 2}.webp`),
  },
  {
    id: 'dave-the-diver',
    title: '潜水员戴夫',
    cover: '/switch-library/dave-the-diver/cover.webp',
    genre: '冒险、角色扮演、经营',
    publisher: 'MINTROCKET',
    description: `白天潜入神秘的蓝洞捕鱼，晚上经营寿司店赚钱。探索不断变化的海底环境，收集装备与素材，认识性格鲜明的伙伴，并逐步揭开蓝洞深处隐藏的秘密。
游戏结合海洋探索、动作冒险、角色扮演和餐厅经营，多种玩法会随着故事推进不断展开。`,
    releaseDate: '2023-10-26',
    requiredSystem: '待确认',
    language: '中文',
    downloadStatus: '正在更新',
    screenshots: [
      '/switch-library/dave-the-diver/promo-godzilla.webp',
      '/switch-library/dave-the-diver/promo-jungle.webp',
      '/switch-library/dave-the-diver/gameplay-01.webp',
      '/switch-library/dave-the-diver/gameplay-02.webp',
      '/switch-library/dave-the-diver/gameplay-03.webp',
      ...Array.from({ length: 9 }, (_, index) => `/switch-library/dave-the-diver/screenshot-${String(index + 1).padStart(2, '0')}.webp`),
    ],
  },
]
