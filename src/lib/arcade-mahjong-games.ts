import type { PublicGame } from './ggemu'

// Adding a game here also opts it into the Arcade Mahjong play-time charge rule.
export const ARCADE_MAHJONG_GAME_QUERIES = [
  '明星三缺一',
  '幸运满贯',
  '龙虎榜',
  '电子基盘',
  '天开眼',
  '泰山闯天关2',
] as const

const ARCADE_MAHJONG_GAME_ALIASES = [
  ...ARCADE_MAHJONG_GAME_QUERIES,
  '幸運滿貫',
  '龍虎榜',
  '電子基盤',
  '天開眼',
  '泰山闖天關2',
].map(normalizeArcadeMahjongGameName)

export function isArcadeMahjongGame(game: PublicGame) {
  const name = normalizeArcadeMahjongGameName(game.name)
  return ARCADE_MAHJONG_GAME_ALIASES.some(alias => name === alias || name.includes(alias))
}

export function normalizeArcadeMahjongGameName(value: string | undefined) {
  return (value ?? '').normalize('NFKC').toLowerCase().replaceAll(/\s+/g, '')
}
