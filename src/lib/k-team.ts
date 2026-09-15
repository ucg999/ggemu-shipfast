import assets from './k-team-assets.json'
import type { FilterOption, Locale } from './ggemu'

const aliases: Record<string, keyof typeof assets> = {
  'all-games': 'allgames',
  'theme-favorites': 'favorites',
  'theme-last-played': 'lastplayed',
  arcade: 'mame', famicom: 'nes', nes: 'nes', 'game boy advance': 'gba', gba: 'gba',
  dos: 'dos', flash: 'flash', 'game boy': 'gb', 'game boy color': 'gbc', 'game gear': 'gamegear',
  genesis: 'megadrive', 'sega genesis': 'megadrive', html5: 'html5', java: 'j2me',
  'master system': 'mastersystem', 'neo geo pocket color': 'ngpc', 'nintendo 64': 'n64',
  'nintendo ds': 'nds', 'nintendo switch': 'switch', switch: 'switch', 'pc engine': 'pcengine',
  'playstation 1': 'psx', 'playstation portable': 'psp', psp: 'psp', 'sega 32x': 'sega32x',
  'sega cd': 'segacd', 'seag saturn': 'saturn', 'sega saturn': 'saturn', 'super famicom': 'snes',
  'virtual boy': 'virtualboy', wonderswan: 'wonderswan', 'wonderswan color': 'wonderswancolor',
  'atari jaguar': 'atarijaguar',
}

export function getThemeAsset(platform: FilterOption) {
  if (platform.name.toLowerCase() === 'arcade') {
    return {
      ...assets.mame,
      pointer: assets.arcade.pointer,
      description: assets.arcade.description,
    }
  }
  const key = aliases[platform.name.toLowerCase()] || aliases[platform.slug?.toLowerCase() || '']
  return key ? assets[key] : { ...assets.html5, description: '', logo: null }
}

export function themeModeLabel(locale: Locale) {
  return locale === 'en' ? 'Theme mode' : locale === 'ja' ? 'テーマモード' : locale === 'zh-TW' ? '主題模式' : '主题模式'
}

export function themePlatformLabel(platform: FilterOption, locale: Locale) {
  if (platform.name === 'theme-favorites') {
    return locale === 'en' ? 'Game Favorites' : locale === 'ja' ? 'ゲームのお気に入り' : locale === 'zh-TW' ? '遊戲收藏' : '游戏收藏'
  }
  if (platform.name === 'theme-last-played') {
    return locale === 'en' ? 'Last Played' : locale === 'ja' ? '最後に遊んだゲーム' : locale === 'zh-TW' ? '最後遊玩' : '最后游玩'
  }
  if (platform.slug === 'theme-merged-md') {
    return locale === 'en' ? 'Sega Mega Drive' : locale === 'ja' ? 'セガ・メガドライブ' : '世嘉MD'
  }
  if (platform.slug === 'theme-merged-flash') {
    return locale === 'en' ? 'Flash Games' : locale === 'ja' ? 'Flashゲーム' : locale === 'zh-TW' ? 'Flash遊戲' : 'Flash游戏'
  }
  if (platform.name.toLowerCase() === 'all-games') {
    if (locale === 'en') return 'All Games'
    if (locale === 'ja') return 'すべてのゲーム'
    return locale === 'zh-TW' ? '所有遊戲平台' : '所有游戏平台'
  }
  if (platform.name.toLowerCase() !== 'arcade') return null
  if (locale === 'en') return 'Arcade Mode'
  if (locale === 'ja') return 'アーケードモード'
  return locale === 'zh-TW' ? '街機模式' : '街机模式'
}
