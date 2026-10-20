import libraryUpdates from './library-updates.json'

export type CartridgeLibraryId = 'fc-cartridges' | 'gb-cartridges' | 'psp' | 'switch'

const NEW_DURATION_MS = 24 * 60 * 60 * 1000

export function isCartridgeLibraryNew(libraryId: CartridgeLibraryId, now = Date.now()) {
  const updates = libraryUpdates as Record<string, {
    changedAt?: string | null
    addedAt?: string | null
    updatedAt?: string | null
  }>
  const marker = updates[`${libraryId}/__library__`]
  const changedTime = Date.parse(marker?.changedAt ?? marker?.addedAt ?? marker?.updatedAt ?? '') || 0
  return changedTime > 0 && now >= changedTime && now - changedTime < NEW_DURATION_MS
}
