import { spendCoinBalance } from './coin-wallet'

const RESOURCE_UNLOCK_PREFIX = 'game-adventure-resource-unlocked:'
const RESOURCE_UNLOCK_DURATION_MS = 60 * 60 * 1000

export function unlockPaidResource(resourceId: string, cost: number) {
  const storageKey = `${RESOURCE_UNLOCK_PREFIX}${resourceId}`
  const unlockedAt = Number(window.localStorage.getItem(storageKey) ?? 0)

  if (unlockedAt > 0 && Date.now() - unlockedAt < RESOURCE_UNLOCK_DURATION_MS) {
    return true
  }

  if (!spendCoinBalance(cost)) return false

  window.localStorage.setItem(storageKey, String(Date.now()))
  return true
}
