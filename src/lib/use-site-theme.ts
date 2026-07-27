import { useSyncExternalStore } from 'react'

import { normalizeSiteTheme } from './site-themes'

function subscribeToThemeChange(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange)

  observer.observe(document.documentElement, {
    attributeFilter: ['data-theme'],
    attributes: true,
  })

  return () => observer.disconnect()
}

function getCurrentTheme() {
  return normalizeSiteTheme(document.documentElement.dataset.theme ?? null)
}

function getServerTheme() {
  return normalizeSiteTheme(null)
}

export function useCurrentSiteTheme() {
  return useSyncExternalStore(
    subscribeToThemeChange,
    getCurrentTheme,
    getServerTheme,
  )
}
