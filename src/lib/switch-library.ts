export type SwitchLibraryGame = {
  id: string
  title: string
  foreignTitle?: string
  cover: string
  genre: string
  publisher: string
  releaseDate: string
  requiredSystem: string
  language: string
  downloadUrl?: string
  popularity?: number
  // ISO timestamp of the latest game content update; unknown dates stay unset.
  updatedAt?: string
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
  {
    "id": "tmnt-splintered-fate",
    "title": "忍者神龟：斯普特林的命运",
    "cover": "/switch-library/tmnt-splintered-fate/cover.webp",
    "genre": "待补充",
    "publisher": "待确认",
    "releaseDate": "2024-07-17",
    "requiredSystem": "待确认",
    "language": "中文",
    "updatedAt": "2026-09-07T16:21:47+00:00",
    "downloadStatus": "分享资源待添加",
    "description": "忍者神龟：斯普特林的命运。\n游戏画面见下方截图，版本信息与分享资源待补充。",
    "screenshots": [
      "/switch-library/tmnt-splintered-fate/screenshot-01.webp",
      "/switch-library/tmnt-splintered-fate/screenshot-02.webp",
      "/switch-library/tmnt-splintered-fate/screenshot-03.webp",
      "/switch-library/tmnt-splintered-fate/screenshot-04.webp",
      "/switch-library/tmnt-splintered-fate/screenshot-05.webp",
      "/switch-library/tmnt-splintered-fate/screenshot-06.webp"
    ]
  },
  {
    "id": "hello-kitty-island-adventure",
    "title": "凯蒂猫岛屿冒险",
    "cover": "/switch-library/hello-kitty-island-adventure/cover.webp",
    "genre": "待补充",
    "publisher": "待确认",
    "releaseDate": "2025-01-30",
    "requiredSystem": "待确认",
    "language": "中文",
    "updatedAt": "2026-09-07T16:21:48+00:00",
    "downloadStatus": "分享资源待添加",
    "description": "凯蒂猫岛屿冒险。\n游戏画面见下方截图，版本信息与分享资源待补充。",
    "screenshots": [
      "/switch-library/hello-kitty-island-adventure/screenshot-01.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-02.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-03.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-04.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-05.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-06.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-07.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-08.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-09.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-10.webp",
      "/switch-library/hello-kitty-island-adventure/screenshot-11.webp"
    ]
  },
  {
    "id": "nin-nin-days-2",
    "title": "女忍者恋爱二部曲",
    "cover": "/switch-library/nin-nin-days-2/cover.webp",
    "genre": "文字冒险",
    "publisher": "qureate",
    "releaseDate": "2026-09-03",
    "requiredSystem": "待确认",
    "language": "中、日、英",
    "updatedAt": "2026-09-07T16:59:38+00:00",
    "downloadStatus": "分享资源待添加",
    "description": "女忍者恋爱二部曲。\n游戏画面见下方截图，版本信息与分享资源待补充。",
    "screenshots": [
      "/switch-library/nin-nin-days-2/screenshot-01.webp",
      "/switch-library/nin-nin-days-2/screenshot-02.webp",
      "/switch-library/nin-nin-days-2/screenshot-03.webp",
      "/switch-library/nin-nin-days-2/screenshot-04.webp",
      "/switch-library/nin-nin-days-2/screenshot-05.webp",
      "/switch-library/nin-nin-days-2/screenshot-06.webp",
      "/switch-library/nin-nin-days-2/screenshot-07.webp",
      "/switch-library/nin-nin-days-2/screenshot-08.webp",
      "/switch-library/nin-nin-days-2/screenshot-09.webp"
    ],
    "foreignTitle": "Days Collection: NinNin Heroines"
  },
  {
    "id": "final-fantasy-resonance-demo",
    "title": "最终幻想 共鸣 试玩版",
    "cover": "/switch-library/final-fantasy-resonance-demo/cover.webp",
    "genre": "回合制、角色扮演",
    "publisher": "Square Enix",
    "releaseDate": "2026-10-22",
    "requiredSystem": "待确认",
    "language": "中、日、英、法、语、西、韩",
    "updatedAt": "2026-09-07T16:59:38+00:00",
    "downloadStatus": "分享资源待添加",
    "description": "最终幻想 共鸣 试玩版。\n游戏画面见下方截图，版本信息与分享资源待补充。",
    "screenshots": [
      "/switch-library/final-fantasy-resonance-demo/screenshot-01.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-02.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-03.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-04.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-05.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-06.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-07.webp",
      "/switch-library/final-fantasy-resonance-demo/screenshot-08.webp"
    ],
    "foreignTitle": "FINAL FANTASY RESONANCE"
  },
  {
    "id": "gta5-switch-port",
    "title": "GTA5 Switch移植版",
    "cover": "/switch-library/gta5-switch-port/cover.webp",
    "genre": "动作",
    "publisher": "玩家自制",
    "releaseDate": "2026-09",
    "requiredSystem": "待确认",
    "language": "中文",
    "updatedAt": "2026-09-07T16:59:38+00:00",
    "downloadStatus": "分享资源待添加",
    "description": "GTA5 Switch移植版。\n游戏画面见下方截图，版本信息与分享资源待补充。",
    "screenshots": [
      "/switch-library/gta5-switch-port/screenshot-01.webp",
      "/switch-library/gta5-switch-port/screenshot-02.webp",
      "/switch-library/gta5-switch-port/screenshot-03.webp",
      "/switch-library/gta5-switch-port/screenshot-04.webp",
      "/switch-library/gta5-switch-port/screenshot-05.webp",
      "/switch-library/gta5-switch-port/screenshot-06.webp",
      "/switch-library/gta5-switch-port/screenshot-07.webp",
      "/switch-library/gta5-switch-port/screenshot-08.webp",
      "/switch-library/gta5-switch-port/screenshot-09.webp",
      "/switch-library/gta5-switch-port/screenshot-10.webp",
      "/switch-library/gta5-switch-port/screenshot-11.webp",
      "/switch-library/gta5-switch-port/screenshot-12.webp",
      "/switch-library/gta5-switch-port/screenshot-13.webp",
      "/switch-library/gta5-switch-port/screenshot-14.webp",
      "/switch-library/gta5-switch-port/screenshot-15.webp",
      "/switch-library/gta5-switch-port/screenshot-16.webp"
    ],
    "foreignTitle": "GTA 5"
  },
]
