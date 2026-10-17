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
  cardLanguage?: string
  downloadUrl?: string
  extractionCode?: string
  videoUrl?: string
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
    id: 'tales-of-eternia-remastered',
    title: '永恒传说 高清重制',
    foreignTitle: 'Tales of Eternia Remastered',
    cover: '/switch-library/tales-of-eternia-remastered/cover.webp',
    genre: '角色扮演、动作',
    publisher: 'BANDAI NAMCO Entertainment',
    releaseDate: '2026-10-16',
    requiredSystem: '待确认',
    language: '中文',
    updatedAt: '2026-10-16T09:00:00+08:00',
    downloadUrl: 'https://pan.baidu.com/s/1Zzuk9rMkgghr1lnPgD-4Bg?pwd=sj9k',
    shareVersion: '本体+v2.0.0升补|NSP| · 提取码：sj9k',
    description: `永远与羁绊的 RPG，《永恒传说》以 Remastered 之姿回归！

伊菲利亚与塞雷斯迪亚是隔着天空对望的两个世界。主角里德和青梅竹马法拉在边境村落拉修安遇见了来自另一个世界的少女梅露蒂，并得知两个世界即将相撞的“大崩落”近在眼前。众人为借助大晶灵的力量阻止危机，展开横跨两个世界的壮阔旅程。

游戏采用“主动型线性动作战斗系统（A-LMBS）”，可发动多种法术与招式连击，享受高速、爽快的 2D 战斗。Remastered 版本还加入目的地图标、关闭遇敌、自动战斗高速模式等便利功能，同时可切换画面和特效模式，重温原作氛围。`,
    screenshots: Array.from({ length: 4 }, (_, index) => `/switch-library/tales-of-eternia-remastered/screenshot-${String(index + 1).padStart(2, '0')}.webp`),
  },
  {
    id: 'warriors-abyss',
    title: '无双深渊',
    popularity: 96,
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
    popularity: 100,
    cover: '/switch-library/dave-the-diver/cover.webp',
    genre: '冒险、角色扮演、经营',
    publisher: 'MINTROCKET',
    description: `白天潜入神秘的蓝洞捕鱼，晚上经营寿司店赚钱。探索不断变化的海底环境，收集装备与素材，认识性格鲜明的伙伴，并逐步揭开蓝洞深处隐藏的秘密。
游戏结合海洋探索、动作冒险、角色扮演和餐厅经营，多种玩法会随着故事推进不断展开。`,
    releaseDate: '2023-10-26',
    requiredSystem: '待确认',
    language: '中文',
    downloadUrl: 'https://pan.baidu.com/s/1Qkx-nyzqj3nqsnnsOPm1yA?pwd=9999',
    shareVersion: '版本号：1.0.6+6DLC（XCI）',
    updatedAt: '2026-10-11T11:08:54+08:00',
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
    "popularity": 88,
    "cover": "/switch-library/tmnt-splintered-fate/cover.webp",
    "genre": "动作、Roguelike",
    "publisher": "Super Evil Megacorp",
    "releaseDate": "2024-07-17",
    "requiredSystem": "待确认",
    "language": "中文",
    "updatedAt": "2026-10-17T00:00:00+08:00",
    "cardLanguage": "中文",
    "downloadUrl": "https://pan.baidu.com/s/1tKOOjAOzOD8cLFDq3T9wvg?pwd=i5jv",
    "extractionCode": "i5jv",
    "shareVersion": "本体+2.0.3升补+4DLC|NSZ|原版|",
    "description": "在Roguelike任务中释放乌龟之力，从大脚帮的手中救出斯普林特！掌握忍者技能，在惊心动魄的合作游戏中团结一心，征服纽约各大标志性地区。\n\n当斯普林特被施瑞德绑架后，整个纽约市同时出现了很多神秘的传送门。为了寻找线索，艾普和金属头对抢回的神器加以分析，乌龟们则展开奋战，誓要从大脚帮的魔掌中救回他们的父亲。然而，随着大伙儿距离斯普林特所处的异界位置越来越近，一个更大的威胁却从阴影之中浮现出来……\n\n玩家将投身节奏明快的Roguelike动作狂潮之中，没有两次冒险完全相同。强化物品、房间布局和头目增益特效均为随机生成。四只乌龟都可操控，每只都拥有独特力量，还可与好友组队游玩。",
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
    "popularity": 82,
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
    "popularity": 76,
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
    "popularity": 84,
    "cover": "/switch-library/final-fantasy-resonance-demo/cover.webp",
    "genre": "回合制、角色扮演",
    "publisher": "Square Enix",
    "releaseDate": "2026-10-22",
    "requiredSystem": "待确认",
    "language": "中、日、英、法、德、西、韩",
    "cardLanguage": "英文",
    "updatedAt": "2026-10-17T00:00:00+08:00",
    "downloadUrl": "https://pan.baidu.com/s/1FzUvnxCe26kEdCh13oKitA?pwd=3gsa",
    "extractionCode": "3gsa",
    "shareVersion": "试玩版|官方英文|NSZ|",
    "description": "可将保存数据继承至正式版的免费体验版登场！虽然等级设有部分限制，但可在与正式版相同的第一章范围内自由冒险。",
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
    "popularity": 92,
    "cover": "/switch-library/gta5-switch-port/cover.webp",
    "genre": "动作",
    "publisher": "玩家自制",
    "releaseDate": "2026-09",
    "requiredSystem": "待确认",
    "language": "中文",
    "updatedAt": "2026-10-17T00:00:00+08:00",
    "cardLanguage": "中文",
    "downloadUrl": "https://pan.baidu.com/s/1wBKVjA0eQuHkNjWgSoG2Mg?pwd=r8vb",
    "extractionCode": "r8vb",
    "shareVersion": "9.10优化版，游戏内增加图形设置选项",
    "description": "一个初涉江湖的街头新丁、一个洗手多年的银行劫匪和一个丧心病狂的杀人狂魔，误打误撞中深陷犯罪集团、美国政府和娱乐产业之间盘根错杂的困境。他们必须齐心协力完成一连串惊天劫案，才能在这座冷酷的城市中生存。\n\n本移植版本提供图形设置选项，玩家可在洛圣都和布莱恩郡体验故事、驾驶、枪战与开放世界探索。",
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
  {
    "id": "ace-angler",
    "title": "王牌钓手",
    "foreignTitle": "Ace Angler Nintendo Switch version",
    "cover": "/switch-library/ace-angler/cover.webp",
    "genre": "模拟、动作",
    "publisher": "BANDAI",
    "releaseDate": "2019-07-25",
    "requiredSystem": "9.2",
    "language": "中、日、英",
    "updatedAt": "2026-10-17T00:00:00+08:00",
    "cardLanguage": "中文",
    "downloadUrl": "https://pan.baidu.com/s/1sQaQ3JBwTjfaPTh-q5W2PQ?pwd=pwqz",
    "extractionCode": "pwqz",
    "shareVersion": "本体+1.2.5整合版/[NSP-XCI][原版+魔改9.2]",
    "description": "本作是一款体感模拟钓鱼游戏，玩家可以挥动Joy-Con以投掷浮标、再转动另一支手腕模拟捲线动作，重现钓竿钓鱼的乐趣。\n除剧情模式以外，本作还为玩家带来了复古街机风格的“硬币模式”以及4人本地联机的“同乐模式”。\n在鱼类数量方面，本作拥有250余种鱼类供玩家垂钓，喜爱钓鱼活动的玩家不要错过。",
    "screenshots": [
      "/switch-library/ace-angler/screenshot-01.webp",
      "/switch-library/ace-angler/screenshot-02.webp",
      "/switch-library/ace-angler/screenshot-03.webp"
    ]
  },
  {
    id: 'octopath-traveler-2',
    title: '八方旅人2',
    foreignTitle: 'OCTOPATH TRAVELER II',
    cover: '/switch-library/octopath-traveler-2/cover.webp',
    genre: '角色扮演',
    publisher: 'Square Enix',
    releaseDate: '2023-02-24',
    requiredSystem: '待确认',
    language: '中文',
    updatedAt: '2026-10-17T00:00:00+08:00',
    downloadUrl: 'https://pan.baidu.com/s/19XCSl8HDjQzXsV9hdySsTQ?pwd=ajym',
    extractionCode: 'ajym',
    shareVersion: '中文国语配音版',
    description: `启程吧，展开专属于你的故事——

2018年发售至今，全球出货量与下载量突破300万套的“歧路旅人”系列全新RPG。以点阵图融合3DCG的“HD-2D”画面效果，实现了更进一步的进化。

在名为“索里斯帝亚”的全新大地，新的8位旅人在崭新的时代展开旅程。要前往何方、做什么、成为哪段故事的主角，全都由你决定。`,
    screenshots: Array.from({ length: 4 }, (_, index) => `/switch-library/octopath-traveler-2/screenshot-${String(index + 1).padStart(2, '0')}.webp`),
  },
  {
    id: 'digimon-story-time-stranger',
    title: '数码宝贝物语 时空异客',
    foreignTitle: 'DIGIMON STORY TIME STRANGER',
    cover: '/switch-library/digimon-story-time-stranger/cover.webp',
    genre: '角色扮演',
    publisher: 'Bandai Namco Entertainment',
    releaseDate: '待确认',
    requiredSystem: '待确认',
    language: '中文',
    updatedAt: '2026-10-17T00:00:00+08:00',
    downloadUrl: 'https://pan.baidu.com/s/1k2wQ7hnXMJm3796iGte7-g?pwd=4fib',
    extractionCode: '4fib',
    shareVersion: '本体+1.2.2升补+14DLC|NSZ|',
    description: `《数码宝贝物语》系列最新作品。本作是一款角色扮演游戏，玩家将在追查世界毁灭谜团的过程中，体验横跨人类世界与异世界的冒险，并搜集、培育种类丰富的数码宝贝。

故事舞台位于日本东京。身为秘密组织探员的主角与未知生物“数码宝贝”邂逅，并被卷入神秘爆炸。回过神来时，世界已经回溯至8年前。过去与未来、人类世界与异世界、人类与数码宝贝，两种截然不同的要素交织出壮阔故事。

游戏收录超过450只数码宝贝，可通过进化、退化和自定义培育专属伙伴，并以战略性编组挑战回合制战斗。`,
    screenshots: Array.from({ length: 6 }, (_, index) => `/switch-library/digimon-story-time-stranger/screenshot-${String(index + 1).padStart(2, '0')}.webp`),
  },
  {
    id: 'new-sword-heroes-trilogy',
    title: '新剑侠情缘 三部曲',
    cover: '/switch-library/new-sword-heroes-trilogy/cover.webp',
    genre: '动作、角色扮演',
    publisher: '玩家移植',
    releaseDate: '待确认',
    requiredSystem: '待确认',
    language: '中文',
    updatedAt: '2026-10-17T00:00:00+08:00',
    downloadUrl: 'https://pan.baidu.com/s/1jLbH6ByHPQqJkSszJXN1Hw?pwd=dy1s',
    extractionCode: 'dy1s',
    shareVersion: '移植版V1.0',
    description: `《新剑侠情缘》是1997年发行的DOS版《剑侠情缘》的重新制作版本，主要剧情相同，结局有所扩充。

游戏采用即时动作RPG玩法，遇敌后即刻进入战斗。部分剧情需要清除当前画面中的全部敌人才能继续，玩家需要仔细探索场景，寻找可能躲藏的敌人。`,
    screenshots: [],
  },
  {
    id: 'ace-angler-fishing-spirits',
    title: '王牌钓手 欢钓水族馆',
    foreignTitle: 'Ace Angler: Fishing Spirits',
    cover: '/switch-library/ace-angler-fishing-spirits/cover.webp',
    genre: '模拟、动作、聚会',
    publisher: 'Bandai Namco Entertainment',
    releaseDate: '2022-10-27',
    requiredSystem: '19.0.0',
    language: '中文',
    updatedAt: '2026-10-17T00:00:00+08:00',
    downloadUrl: 'https://pan.baidu.com/s/1DlQ_AMSRYJ2b0GJhQxuX0w?pwd=87d3',
    extractionCode: '87d3',
    shareVersion: '本体+1.2.2升补+2DLC|NSZ|原版|',
    description: `欢迎来到梦想中的水族馆主题游乐园。摇动并旋转Joy-Con，体验仿佛置身海浪之中的体感钓鱼乐趣。玩家可以独自或与朋友游玩园区景点、收集奖牌，并用奖牌升级自己的水族馆。

除核心钓鱼玩法外，游戏还包含故事模式、在线竞赛、聚会小游戏和奖牌推杆游戏。水族馆收录超过250种海洋生物，包括大白鲨和巨型乌贼，并提供丰富的鱼类知识。`,
    screenshots: Array.from({ length: 4 }, (_, index) => `/switch-library/ace-angler-fishing-spirits/screenshot-${String(index + 1).padStart(2, '0')}.webp`),
  },
]
