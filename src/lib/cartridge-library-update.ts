import libraryUpdates from './library-updates.json'

export type CartridgeLibraryId = 'fc-cartridges' | 'gb-cartridges' | 'psp' | 'switch'

const NEW_DURATION_MS = 24 * 60 * 60 * 1000

export function isCartridgeLibraryNew(libraryId: CartridgeLibraryId, now = Date.now()) {
  const updateTime = getLatestUpdateTime(libraryId)
  return updateTime > 0 && now >= updateTime && now - updateTime < NEW_DURATION_MS
}

function getLatestUpdateTime(libraryId: CartridgeLibraryId) {
  const updates = libraryUpdates as Record<string, { updatedAt?: string | null }>
  const exactKey = libraryId === 'fc-cartridges' || libraryId === 'gb-cartridges'
    ? `${libraryId}/__library__`
    : null

  if (exactKey) return Date.parse(updates[exactKey]?.updatedAt ?? '') || 0

  const prefix = `${libraryId}/`
  return Math.max(0, ...Object.entries(updates)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, value]) => Date.parse(value.updatedAt ?? '') || 0))
}
