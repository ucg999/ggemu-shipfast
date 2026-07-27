import type { Locale } from './ggemu'

export function getPlatformLabel(name: string, locale: Locale) {
  if (locale === 'zh-CN') {
    const labels: Record<string, string> = {
      arcade: '街机',
      famicom: '小霸王',
      'game boy advance': 'GBA',
      'playstation 1': 'PS1',
      'playstation portable': 'PSP',
    }

    return labels[name.trim().toLowerCase()] ?? name
  }

  return name
}
