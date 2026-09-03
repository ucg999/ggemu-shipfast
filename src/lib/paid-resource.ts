import { spendCoinBalance } from './coin-wallet'
import type { Locale } from './ggemu'

const RESOURCE_UNLOCK_PREFIX = 'game-adventure-resource-unlocked:'
const RESOURCE_UNLOCK_DURATION_MS = 60 * 60 * 1000

export function confirmResourceDownload(locale: Locale, cost: number) {
  const message = locale === 'en'
    ? `Confirm download?\nAn external resource page will open. Unlocking costs ${cost} coins; repeat visits are free for one hour. Canceling will not spend any coins.`
    : locale === 'ja'
      ? `ダウンロードを確認しますか？\n外部の配布ページを開きます。解除には${cost}コインが必要です。解除後1時間は再課金されません。キャンセルするとコインは消費されません。`
      : locale === 'zh-TW'
        ? `確認下載？\n將開啟外部資源頁面。解鎖需 ${cost} 個金幣，解鎖後 1 小時內不重複收費。取消不扣金幣。`
        : `确认下载？\n将打开外部资源页面。解锁需 ${cost} 个金币，解锁后 1 小时内不重复收费。取消不扣金币。`
  return window.confirm(message)
}

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
