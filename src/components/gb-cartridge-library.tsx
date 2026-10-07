import { useEffect, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { addCoinBalance, readSpendableCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import type { Locale } from '#/lib/ggemu'
import { useMemberSession } from '#/lib/member-client'

const PRICE = 50
const LOCAL_KEY = 'ucg999-gb-owned-cartridges'
const CARTRIDGE = { id: 'kof-96', number: '001号', title: '热斗 格斗之王96', genre: '格斗', releaseDate: '1997', publisher: 'TAKARA' }

export function GbCartridgeLibrary({ lang }: { lang: Locale }) {
  const copy = getCopy(lang)
  const member = useMemberSession()
  const [owned, setOwned] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!member) {
      try { setOwned(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')) } catch { setOwned([]) }
      return
    }
    let cancelled = false
    void fetch('/api/gb-cartridges', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: { owned?: string[] }) => { if (!cancelled) setOwned(Array.isArray(data.owned) ? data.owned : []) })
      .catch(() => { try { if (!cancelled) setOwned(JSON.parse(localStorage.getItem(`${LOCAL_KEY}:${member.id}`) || '[]')) } catch {} })
    return () => { cancelled = true }
  }, [member?.id])

  function selectCartridge() {
    if (owned.includes(CARTRIDGE.id)) window.location.assign('/gb')
    else setConfirming(true)
  }

  async function collect() {
    setConfirming(false)
    if (readSpendableCoinBalance() < PRICE || !spendCoinBalance(PRICE)) { setNotice(copy.insufficient); return }
    try {
      const next = [CARTRIDGE.id]
      if (member) {
        const response = await fetch('/api/gb-cartridges', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cartridgeId: CARTRIDGE.id }) })
        if (!response.ok) throw new Error('save_failed')
        localStorage.setItem(`${LOCAL_KEY}:${member.id}`, JSON.stringify(next))
      } else localStorage.setItem(LOCAL_KEY, JSON.stringify(next))
      setOwned(next)
      setNotice(copy.success)
    } catch {
      addCoinBalance(PRICE)
      setNotice(copy.failed)
    }
  }

  return <SiteLayout locale={lang}>
    <main className="min-h-screen bg-[#f0f0ed] px-4 pb-20 pt-8 text-base-content sm:px-6 lg:px-10 lg:pt-10">
      <div className="mx-auto w-full max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy.title}</h1><p className="mt-1 text-sm text-base-content/50">{copy.count}，{copy.hint} <b className="text-amber-500">{copy.owned(owned.length)}</b></p></div>
          <div className="flex items-center gap-1 text-sm"><button className="btn btn-ghost btn-sm">{copy.gameName}</button><button className="btn btn-ghost btn-sm">{copy.random}</button><button className="btn btn-ghost btn-sm">{copy.genre}</button><button className="btn btn-ghost btn-sm">{copy.publisher}</button><button className="btn btn-ghost btn-sm btn-square"><i className="ri-search-line text-lg" /></button></div>
        </header>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4 lg:grid-cols-6">
          <article className="psp-library-card group relative">
            <button className="block w-full" type="button" onClick={selectCartridge}>
              <div className="aspect-[3/2] w-full overflow-hidden rounded-lg bg-[#d6d3ca] p-3 shadow-[0_10px_16px_-12px_rgba(0,0,0,.75)]">
                <div className="relative h-full w-full rounded-[12px_12px_24px_24px] border-[7px] border-[#4e3c48] bg-[#801d3b] shadow-inner">
                  <div className="absolute inset-x-3 top-3 bottom-5 grid place-items-center rounded-sm border-2 border-[#d0b8a5] bg-[#eee4d4] px-2 text-center">
                    <div><b className="block text-xs tracking-wider text-[#70213a] sm:text-sm">THE KING OF FIGHTERS '96</b><span className="mt-1 block text-[10px] font-semibold text-black/65">GAME BOY</span></div>
                  </div>
                </div>
              </div>
            </button>
            <div className="bg-white p-1.5 sm:p-2"><h2 className="truncate text-center text-sm font-semibold sm:text-base">{CARTRIDGE.title}</h2><div className="mt-1 flex items-center gap-1 text-[10px] text-base-content/60 sm:text-xs"><span className="min-w-0 flex-1 truncate text-center">{CARTRIDGE.number} · {CARTRIDGE.releaseDate} · {CARTRIDGE.publisher}</span><button className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${owned.includes(CARTRIDGE.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-300 text-black'}`} type="button" onClick={selectCartridge}>{owned.includes(CARTRIDGE.id) ? <i className="ri-play-fill" /> : <img alt="" className="h-4 w-4" src="/images/coin-rewards/pixel-reward-coin.webp" />}</button></div></div>
            <div className="pointer-events-none absolute inset-x-1 bottom-1 z-30 hidden rounded-lg bg-black/90 px-3 py-2 text-xs text-white shadow-xl group-hover:block"><b className="block text-sm">{CARTRIDGE.title}</b>{CARTRIDGE.number} · {CARTRIDGE.genre}<br />{CARTRIDGE.releaseDate} · {CARTRIDGE.publisher}</div>
          </article>
        </div>
      </div>
      {confirming ? <div className="fixed inset-0 z-[240] grid place-items-center bg-black/35 px-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center text-black shadow-2xl"><h2 className="text-lg font-semibold">{copy.confirmTitle}</h2><p className="mt-2 text-sm text-black/65">{copy.confirmMessage}</p><div className="mt-5 flex justify-center gap-3"><button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>{copy.cancel}</button><button className="btn btn-warning btn-sm" onClick={collect}>{copy.confirm}</button></div></div></div> : null}
      {notice ? <div className="fixed bottom-8 left-1/2 z-[180] -translate-x-1/2 rounded-full bg-black px-5 py-2 text-sm text-white">{notice}</div> : null}
    </main>
  </SiteLayout>
}

function getCopy(lang: Locale) {
  if (lang === 'en') return { title: 'GB Cartridge Collection', count: '1 cartridge available', hint: 'collected cartridges can be played in the mobile GB console', owned: (n: number) => `${n} collected`, gameName: 'Game name', random: 'Random', genre: 'Genre', publisher: 'Publisher', confirmTitle: 'Collect cartridge?', confirmMessage: 'Spend 50 coins to collect The King of Fighters 96?', cancel: 'Cancel', confirm: 'Collect', insufficient: 'Not enough coins. 50 coins required.', success: 'Added to your GB cartridge collection', failed: 'Collection could not be saved' }
  if (lang === 'zh-TW') return { title: 'GB卡帶收藏', count: '目前共有 1 款卡帶', hint: '收藏後可直接在手機GB遊戲機換卡帶遊玩', owned: (n: number) => `已收藏 ${n} 款`, gameName: '遊戲名稱', random: '隨機', genre: '遊戲類型', publisher: '遊戲廠商', confirmTitle: '確認收藏卡帶？', confirmMessage: '將花費50個金幣收藏《熱鬥 格鬥之王96》，是否繼續？', cancel: '取消', confirm: '確認收藏', insufficient: '金幣不足，需要50個金幣', success: '收藏成功，卡帶已加入GB遊戲機', failed: '卡帶收藏記錄保存失敗' }
  return { title: 'GB卡带收藏', count: '目前共有 1 款卡带', hint: '收藏后可直接在手机GB游戏机换卡带游玩', owned: (n: number) => `已收藏 ${n} 款`, gameName: '游戏名称', random: '随机', genre: '游戏类型', publisher: '游戏厂商', confirmTitle: '确认收藏卡带？', confirmMessage: '将花费50个金币收藏《热斗 格斗之王96》，是否继续？', cancel: '取消', confirm: '确认收藏', insufficient: '金币不足，需要50个金币', success: '收藏成功，卡带已加入GB游戏机', failed: '卡带收藏记录保存失败' }
}
