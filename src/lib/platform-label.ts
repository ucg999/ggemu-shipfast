import type { Locale } from './ggemu'

export function getPlatformLabel(name: string, locale: Locale) {
  if (locale === 'zh-CN' || locale === 'zh-TW') {
    const labels: Record<string, string> = {
      arcade: '街机',
      'atari jaguar': '雅达利',
      dos: '电脑',
      famicom: '小霸王',
      'game gear': 'GG',
      'game boy': 'GB',
      'game boy advance': 'GBA',
      'game boy color': 'GBC',
      genesis: 'MD',
      'master system': '世嘉SMS',
      'neo geo pocket color': 'NGPc',
      'nintendo 64': 'N64',
      'nintendo ds': 'NDS',
      'nintendo switch': 'Switch',
      'pc engine': 'PCE',
      'playstation 1': 'PS1',
      'playstation portable': 'PSP',
      'seag saturn': '世嘉土星',
      'sega genesis': '世嘉MD',
      'sega saturn': '世嘉土星',
      'super famicom': '超任',
      wonderswan: '万代掌机',
      'wonderswan color': '万代彩色掌机',
    }

    const label = labels[name.trim().toLowerCase()] ?? name
    if (locale === 'zh-TW') {
      return label
        .replaceAll('街机', '街機')
        .replaceAll('电脑', '電腦')
        .replaceAll('万代掌机', '萬代掌機')
        .replaceAll('万代彩色掌机', '萬代彩色掌機')
        .replaceAll('雅达利', '雅達利')
    }
    return label
  }

  return name
}
