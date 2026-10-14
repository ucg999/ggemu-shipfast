export const BONUS_RANK_NAMES = { 'small-three': '小三元', 'small-four': '小四喜', 'big-three': '大三元', 'big-four': '大四喜', 'all-fruits': '全水果', 'all-bar': '全BAR', five: '五分天下', train: '开火车', 'all-stars': '满天星' } as const
export type BonusRankEvent = { id: string; kind: keyof typeof BONUS_RANK_NAMES | 'bomb' | 'ghost' }
export type BonusChampion = { kind: string; displayName: string; count: number }
