import { useEffect, useState } from 'react'

import { addCoinBalance, readCoinBalance, spendBrowserCoinBalance } from '#/lib/coin-wallet'
import type { Locale } from '#/lib/ggemu'
import { getMemberSession, useMemberSession } from '#/lib/member-client'
import { collectionApiUrl, getGuestCollectorId } from '#/lib/library-collection-client'

const PRICE = 10
type Result = { available?: boolean; collected?: boolean; guestUnlocked?: boolean; count?: number; downloadUrl?: string; error?: string }

export function PspDiscCollectionButton({ gameId, locale, platform }: { gameId: string; locale: Locale; platform: 'psp' | 'switch' }) {
  const member = useMemberSession()
  const copy = getCopy(locale, platform)
  const [available, setAvailable] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const [collectionCount, setCollectionCount] = useState(0)

  useEffect(() => {
    setDownloadUrl('')
    void fetch(collectionApiUrl(`/api/library-collections?platform=${platform}&gameId=${encodeURIComponent(gameId)}`), { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((result: Result) => {
        setAvailable(Boolean(result.available))
        setDownloadUrl(typeof result.downloadUrl === 'string' ? result.downloadUrl : '')
        setCollectionCount(Math.max(0, Number(result.count) || 0))
      }).catch(() => {})
  }, [gameId, member?.id, platform])

  async function collect() {
    setConfirming(false)
    let paidFromBrowser = false
    try {
      const session = await getMemberSession().catch(() => ({ member: null }))
      if (!session.member) {
        if (readCoinBalance() < PRICE || !spendBrowserCoinBalance(PRICE)) {
          flash(copy.insufficient)
          return
        }
        paidFromBrowser = true
      }
      const response = await fetch('/api/library-collections', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, gameId, guestId: getGuestCollectorId(), guestPaid: paidFromBrowser, paymentId: paidFromBrowser ? crypto.randomUUID() : undefined }),
      })
      const result = await response.json() as Result
      if (!response.ok || !result.downloadUrl) throw new Error(result.error || 'collection_save_failed')
      setDownloadUrl(result.downloadUrl)
      setCollectionCount(Math.max(0, Number(result.count) || 0))
      if (session.member) await getMemberSession().catch(() => null)
      flash(copy.success)
    } catch (error) {
      if (paidFromBrowser) addCoinBalance(PRICE)
      flash(error instanceof Error && error.message.includes('金币不足') ? copy.insufficient : copy.failed)
    }
  }

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2400)
  }

  return <>
    <p className="mb-2 text-center text-xs text-base-content/55">{locale === 'en' ? `${collectionCount} collections` : `已收藏 ${collectionCount} 次`}</p>
    {downloadUrl
      ? <a className="btn btn-warning w-full" href={downloadUrl} target="_blank" rel="noopener noreferrer">{copy.open}</a>
      : <button className="btn btn-warning w-full" disabled={!available} type="button" onClick={() => setConfirming(true)}>{available ? copy.collect : copy.preparing}</button>}
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
    return { collect: `Collect ${item} · ${PRICE} coins`, open: 'Open resource', confirmTitle: `Collect this ${item}?`, confirmMessage: `${PRICE} coins will be deducted. Guest access remains unlocked for one hour.`, cancel: 'Cancel', confirm: 'Collect', insufficient: `Not enough coins. ${PRICE} coins required.`, success: `${item[0].toUpperCase()}${item.slice(1)} collected`, failed: 'Collection could not be saved', preparing: 'Resource updating' }
  }
  if (locale === 'zh-TW') {
    const item = platform === 'switch' ? '遊戲卡帶' : '遊戲碟'
    return { collect: `${item}收藏 · ${PRICE}金幣`, open: '打開資源', confirmTitle: `確認收藏${item}？`, confirmMessage: `確認後扣除${PRICE}個金幣，遊客收藏狀態保留一小時。`, cancel: '取消', confirm: '確認收藏', insufficient: `金幣不足，需要${PRICE}個金幣`, success: `${item}收藏成功`, failed: '收藏記錄保存失敗', preparing: '資源更新中' }
  }
  if (locale === 'ja') {
    const item = platform === 'switch' ? 'ゲームカード' : 'ゲームディスク'
    return { collect: `${item}収集・${PRICE}コイン`, open: 'リソースを開く', confirmTitle: `${item}を収集しますか？`, confirmMessage: `${PRICE}コインを消費し、ゲストの解除状態は1時間保持されます。`, cancel: 'キャンセル', confirm: '収集', insufficient: `コインが不足しています（${PRICE}枚必要）`, success: `${item}を収集しました`, failed: '収集情報を保存できませんでした', preparing: '更新中' }
  }
  const item = platform === 'switch' ? '游戏卡带' : '游戏碟'
  return { collect: `${item}收藏 · ${PRICE}金币`, open: '打开资源', confirmTitle: `确认收藏${item}？`, confirmMessage: `确认后扣除${PRICE}个金币，游客收藏状态保留一小时。`, cancel: '取消', confirm: '确认收藏', insufficient: `金币不足，需要${PRICE}个金币`, success: `${item}收藏成功`, failed: '收藏记录保存失败', preparing: '资源更新中' }
}
