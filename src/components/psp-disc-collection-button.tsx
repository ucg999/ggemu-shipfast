import { useEffect, useState } from 'react'

import { readSpendableCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import type { Locale } from '#/lib/ggemu'
import { useMemberSession } from '#/lib/member-client'
import { collectionApiUrl, getGuestCollectorId } from '#/lib/library-collection-client'

const PRICE = 10
const STORAGE_KEY = 'ucg999-game-disc-collection'

export function PspDiscCollectionButton({ downloadUrl, gameId, locale, platform }: { downloadUrl?: string; gameId: string; locale: Locale; platform: 'psp' | 'switch' }) {
  const member = useMemberSession()
  const copy = getCopy(locale, platform)
  const [collected, setCollected] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const [collectionCount, setCollectionCount] = useState(0)
  const key = member ? `${STORAGE_KEY}:${platform}:${member.id}` : `${STORAGE_KEY}:${platform}`

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || '[]')
      setCollected(Array.isArray(stored) && stored.includes(gameId))
    } catch { setCollected(false) }
    void fetch(collectionApiUrl(`/api/library-collections?platform=${platform}&gameId=${encodeURIComponent(gameId)}`), { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((result: { collected?: boolean; count?: number }) => {
        setCollected(Boolean(result.collected))
        setCollectionCount(Math.max(0, Number(result.count) || 0))
      }).catch(() => {})
  }, [gameId, key, platform])

  async function collect() {
    setConfirming(false)
    if (readSpendableCoinBalance() < PRICE || !spendCoinBalance(PRICE)) {
      setNotice(copy.insufficient)
      window.setTimeout(() => setNotice(''), 2400)
      return
    }
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) || '[]')
      const next = [...new Set([...(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : []), gameId])]
      window.localStorage.setItem(key, JSON.stringify(next))
      const response = await fetch('/api/library-collections', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, gameId, guestId: getGuestCollectorId() }),
      })
      if (!response.ok) throw new Error('collection_save_failed')
      const result = await response.json() as { count?: number }
      setCollected(true)
      setCollectionCount(Math.max(0, Number(result.count) || 0))
      setNotice(copy.success)
      window.setTimeout(() => setNotice(''), 2400)
    } catch {
      setNotice(copy.failed)
      window.setTimeout(() => setNotice(''), 2400)
    }
  }

  return <>
    <p className="mb-2 text-center text-xs text-base-content/55">{locale === 'en' ? `${collectionCount} collectors` : `已有 ${collectionCount} 人收藏`}</p>
    {collected && downloadUrl
      ? <a className="btn btn-warning w-full" href={downloadUrl} target="_blank" rel="noopener noreferrer">{copy.open}</a>
      : <button className="btn btn-warning w-full" disabled={!downloadUrl} type="button" onClick={() => setConfirming(true)}>{downloadUrl ? copy.collect : copy.preparing}</button>}
    {confirming ? <div className="fixed inset-0 z-[260] grid place-items-center bg-black/40 px-4" role="dialog" aria-modal="true" onClick={() => setConfirming(false)}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black shadow-2xl" onClick={event => event.stopPropagation()}>
        <h2 className="text-lg font-semibold">{copy.confirmTitle}</h2>
        <p className="mt-2 text-sm text-black/60">{copy.confirmMessage}</p>
        <div className="mt-5 flex justify-center gap-3"><button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirming(false)}>{copy.cancel}</button><button className="btn btn-warning btn-sm" type="button" onClick={collect}>{copy.confirm}</button></div>
      </div>
    </div> : null}
    {notice ? <div className="fixed bottom-8 left-1/2 z-[270] -translate-x-1/2 rounded-full bg-black px-5 py-2 text-sm text-white shadow-xl" role="status">{notice}</div> : null}
  </>
}

function getCopy(locale: Locale, platform: 'psp' | 'switch') {
  if (locale === 'en') {
    const item = platform === 'switch' ? 'game cartridge' : 'game disc'
    return { collect: `Collect ${item} · ${PRICE} coins`, open: 'Collected · Open resource', confirmTitle: `Collect this ${item}?`, confirmMessage: `${PRICE} coins will be deducted after confirmation.`, cancel: 'Cancel', confirm: 'Collect', insufficient: `Not enough coins. ${PRICE} coins required.`, success: `${item[0].toUpperCase()}${item.slice(1)} collected`, failed: 'Collection could not be saved', preparing: 'Resource updating' }
  }
  if (locale === 'zh-TW') {
    const item = platform === 'switch' ? '遊戲卡帶' : '遊戲碟'
    return { collect: `${item}收藏 · ${PRICE}金幣`, open: '已收藏 · 打開資源', confirmTitle: `確認收藏${item}？`, confirmMessage: `確認後將扣除${PRICE}個金幣。`, cancel: '取消', confirm: '確認收藏', insufficient: `金幣不足，需要${PRICE}個金幣`, success: `${item}收藏成功`, failed: '收藏記錄保存失敗', preparing: '資源更新中' }
  }
  if (locale === 'ja') {
    const item = platform === 'switch' ? 'ゲームカード' : 'ゲームディスク'
    return { collect: `${item}収集・${PRICE}コイン`, open: '収集済み・リソースを開く', confirmTitle: `${item}を収集しますか？`, confirmMessage: `確認後、${PRICE}コインを消費します。`, cancel: 'キャンセル', confirm: '収集', insufficient: `コインが不足しています（${PRICE}枚必要）`, success: `${item}を収集しました`, failed: '収集情報を保存できませんでした', preparing: '更新中' }
  }
  const item = platform === 'switch' ? '游戏卡带' : '游戏碟'
  return { collect: `${item}收藏 · ${PRICE}金币`, open: '已收藏 · 打开资源', confirmTitle: `确认收藏${item}？`, confirmMessage: `确认后将扣除${PRICE}个金币。`, cancel: '取消', confirm: '确认收藏', insufficient: `金币不足，需要${PRICE}个金币`, success: `${item}收藏成功`, failed: '收藏记录保存失败', preparing: '资源更新中' }
}
