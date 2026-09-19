const THEME_MODE_DEFAULT_KEY = 'ucg999-default-theme-mode'

export function prefersThemeMode() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(THEME_MODE_DEFAULT_KEY) === '1'
  } catch {
    return false
  }
}

export function setThemeModePreference(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(THEME_MODE_DEFAULT_KEY, '1')
    else window.localStorage.removeItem(THEME_MODE_DEFAULT_KEY)
  } catch {
    // The preference is optional when browser storage is unavailable.
  }
}
