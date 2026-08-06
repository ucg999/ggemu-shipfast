export type GameCollection = {
  cover: string
  description: string
  id: string
  keywords: Array<string>
  title: string
}

export const GAME_COLLECTIONS: Array<GameCollection> = [
  {
    cover: '/images/collections/king-of-fighters-series.png',
    description:
      '拳皇系列以三人组队、连续对战和鲜明角色阵容闻名。从街机厅里的经典对决到不断进化的战斗系统，它承载了无数玩家关于连招、必杀技与好友挑战的热血记忆。',
    id: 'king-of-fighters',
    keywords: ['拳皇', 'king of fighters'],
    title: '拳皇系列',
  },
  {
    cover: '/images/collections/street-fighter-series.png',
    description:
      '街霸系列是格斗游戏的重要代表，以扎实的攻防节奏、丰富的世界格斗家和经典必杀技著称。无论是初次搓出招式，还是研究对局策略，都能感受到纯粹的街机竞技乐趣。',
    id: 'street-fighter',
    keywords: ['街霸', 'street fighter'],
    title: '街霸系列',
  },
]

export function getGameCollection(collectionId: string) {
  return GAME_COLLECTIONS.find((collection) => collection.id === collectionId)
}
