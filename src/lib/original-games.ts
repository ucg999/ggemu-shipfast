import type { Locale } from '#/lib/ggemu'

export function getOriginalGamesTitle(locale: Locale) {
  if (locale === 'zh-TW') return '原創遊戲（內測版）'
  if (locale === 'en') return 'Original Games (Beta)'
  if (locale === 'ja') return 'オリジナルゲーム（ベータ版）'
  return '原创游戏（内测版）'
}
