import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import type { Locale } from '#/lib/ggemu'
import {
  addCoinReward,
  COIN_BALANCE_EVENT,
  COIN_BALANCE_STORAGE_KEY,
  getCoinRank,
  readCoinBalance,
} from '#/lib/coin-wallet'

const COIN_INTERVAL_MS = 60_000
const MAX_FLOATING_COINS = 3

type CoinPosition = {
  id: number
  left: number
  top: number
}

type CoinRewardFeedback = {
  amount: number
  id: number
  prefix: '+' | '×'
}

type CollectedCoinFlight = {
  id: number
  left: number
  top: number
  travelX: number
  travelY: number
}

export function useHomeCoinRewards() {
  const [balance, setBalance] = useState(0)
  const [coinPositions, setCoinPositions] = useState<Array<CoinPosition>>([])
  const [rewardFeedback, setRewardFeedback] = useState<CoinRewardFeedback | null>(null)
  const [collectedCoinFlight, setCollectedCoinFlight] = useState<CollectedCoinFlight | null>(null)
  const rewardTimerRef = useRef<number | null>(null)
  const spawnedInitialCoinRef = useRef(false)

  useEffect(() => {
    setBalance(readCoinBalance())
  }, [])

  useEffect(() => {
    function syncCoinBalance(event?: StorageEvent) {
      if (event && event.key !== COIN_BALANCE_STORAGE_KEY) return

      setBalance(readCoinBalance())
    }

    function syncLocalCoinBalance() {
      syncCoinBalance()
    }

    function syncVisiblePage() {
      if (document.visibilityState === 'visible') {
        syncCoinBalance()
      }
    }

    window.addEventListener('storage', syncCoinBalance)
    window.addEventListener(COIN_BALANCE_EVENT, syncLocalCoinBalance)
    document.addEventListener('visibilitychange', syncVisiblePage)

    return () => {
      window.removeEventListener('storage', syncCoinBalance)
      window.removeEventListener(COIN_BALANCE_EVENT, syncLocalCoinBalance)
      document.removeEventListener('visibilitychange', syncVisiblePage)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (rewardTimerRef.current !== null) {
        window.clearTimeout(rewardTimerRef.current)
      }
    }
  }, [])

  const showRewardFeedback = useCallback((amount: number, prefix: '+' | '×') => {
    if (rewardTimerRef.current !== null) {
      window.clearTimeout(rewardTimerRef.current)
    }

    setRewardFeedback({ amount, id: Date.now(), prefix })
    rewardTimerRef.current = window.setTimeout(() => {
      setRewardFeedback(null)
      rewardTimerRef.current = null
    }, 1_250)
  }, [])

  useEffect(() => {
    if (!spawnedInitialCoinRef.current) {
      spawnedInitialCoinRef.current = true
      setCoinPositions((current) =>
        current.length >= MAX_FLOATING_COINS
          ? current
          : [...current, createRandomCoinPosition()],
      )
    }

    const timer = window.setInterval(() => {
      setCoinPositions((current) =>
        current.length >= MAX_FLOATING_COINS
          ? current
          : [...current, createRandomCoinPosition()],
      )
    }, COIN_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [])

  const addCoins = useCallback((amount: number, showFeedback = true) => {
    if (!Number.isFinite(amount) || amount <= 0) return

    const reward = addCoinReward(amount)
    setBalance(reward.balance)
    if (showFeedback) {
      showRewardFeedback(reward.awarded, '+')
    }
  }, [showRewardFeedback])

  const collectFloatingCoin = useCallback((coinId: number) => {
    const coinPosition = coinPositions.find((position) => position.id === coinId)
    if (!coinPosition) return

    const coinBox = document.querySelector<HTMLElement>('[data-coin-box]')
    const coinBoxRect = coinBox?.getBoundingClientRect()
    const left = (window.innerWidth * coinPosition.left) / 100
    const top = (window.innerHeight * coinPosition.top) / 100

    setCollectedCoinFlight({
      id: Date.now(),
      left,
      top,
      travelX: coinBoxRect ? coinBoxRect.left + coinBoxRect.width / 2 - left : 0,
      travelY: coinBoxRect ? coinBoxRect.top + coinBoxRect.height / 2 - top : -top,
    })
    setCoinPositions((current) =>
      current.filter((position) => position.id !== coinId),
    )
    window.setTimeout(() => {
      addCoins(1, false)
      setCollectedCoinFlight(null)
    }, 720)
  }, [addCoins, coinPositions])

  const showBalance = useCallback(() => {
    showRewardFeedback(balance, '×')
  }, [balance, showRewardFeedback])

  return {
    addCoins,
    balance,
    collectedCoinFlight,
    coinPositions,
    collectFloatingCoin,
    rewardFeedback,
    showBalance,
  }
}

export function HomeCoinBag({
  balance,
  lang,
  onOpen,
}: {
  balance: number
  lang: Locale
  onOpen: () => void
}) {
  const label = getCoinCopy(lang).bag
  const balanceTextClass = balance >= 10_000
    ? 'text-[6px] tracking-[-0.08em] sm:text-[8px]'
    : balance >= 1_000
      ? 'text-[7px] tracking-[-0.05em] sm:text-[9px]'
      : 'text-[10px] sm:text-xs'
  const [balancePopup, setBalancePopup] = useState<CoinRewardFeedback | null>(null)
  const balancePopupTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (balancePopupTimer.current !== null) window.clearTimeout(balancePopupTimer.current)
  }, [])

  const handleOpen = () => {
    onOpen()
    if (balancePopupTimer.current !== null) window.clearTimeout(balancePopupTimer.current)
    setBalancePopup({ amount: balance, id: Date.now(), prefix: '×' })
    balancePopupTimer.current = window.setTimeout(() => {
      setBalancePopup(null)
      balancePopupTimer.current = null
    }, 1_250)
  }

  return (
    <>
      <button
        aria-label={`${label}: ${balance}`}
        className="relative ml-1 grid h-9 w-9 shrink-0 place-items-center sm:ml-7 sm:h-14 sm:w-14"
        data-coin-box
        onClick={handleOpen}
        title={`${label}: ${balance}`}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain drop-shadow-sm"
          src="/images/coin-rewards/mystery-coin-box.webp"
        />
        <span className={`coin-box-count-blink relative grid h-6 w-6 place-items-center overflow-hidden rounded-full border-2 border-amber-700 bg-yellow-300 px-px font-black tabular-nums leading-none text-amber-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_1px_2px_rgba(92,48,0,0.35)] sm:h-8 sm:w-8 ${balanceTextClass}`}>
          {balance}
        </span>
      </button>
      <CoinRewardPopup feedback={balancePopup} />
    </>
  )
}

export function CoinRankBadge({ balance, lang, compact = false }: { balance: number; lang: Locale; compact?: boolean }) {
  const rank = getCoinRank(balance)
  const names = getCoinRankNames(lang)
  const levelLabel = lang === 'zh-TW' ? '你的等級' : lang === 'en' ? 'Your rank' : lang === 'ja' ? 'あなたのランク' : '你的等级'
  return (
    <div
      className="coin-rank-badge flex shrink-0 items-center gap-0.5"
      title={`${names[rank.id]} · ×${rank.multiplier}`}
    >
      <img className={compact ? 'h-10 w-10 object-contain' : 'h-9 w-9 object-contain sm:h-12 sm:w-12'} decoding="async" src={rank.icon} alt="" />
      <span className="-ml-0.5 flex min-w-0 flex-col leading-tight">
        <small className={compact ? 'text-[9px] text-white/70' : 'text-[8px] text-white/65 sm:text-[10px]'}>{levelLabel}</small>
        <strong className={compact ? 'whitespace-nowrap text-[11px]' : 'whitespace-nowrap text-xs sm:text-base'}>{names[rank.id]}</strong>
      </span>
    </div>
  )
}

function getCoinRankNames(lang: Locale) {
  if (lang === 'zh-TW') return { bronze: '青銅', silver: '白銀', gold: '黃金', platinum: '鉑金', diamond: '鑽石', master: '大師', king: '王者', legend: '傳奇' }
  if (lang === 'en') return { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', diamond: 'Diamond', master: 'Master', king: 'King', legend: 'Legend' }
  if (lang === 'ja') return { bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ', diamond: 'ダイヤ', master: 'マスター', king: '王者', legend: 'レジェンド' }
  return { bronze: '青铜', silver: '白银', gold: '黄金', platinum: '铂金', diamond: '钻石', master: '大师', king: '王者', legend: '传奇' }
}

export function useGlobalCoinBalance() {
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    const syncBalance = () => setBalance(readCoinBalance())
    const syncVisiblePage = () => {
      if (document.visibilityState === 'visible') syncBalance()
    }

    syncBalance()
    window.addEventListener('storage', syncBalance)
    window.addEventListener(COIN_BALANCE_EVENT, syncBalance)
    document.addEventListener('visibilitychange', syncVisiblePage)

    return () => {
      window.removeEventListener('storage', syncBalance)
      window.removeEventListener(COIN_BALANCE_EVENT, syncBalance)
      document.removeEventListener('visibilitychange', syncVisiblePage)
    }
  }, [])

  return {
    balance,
    showBalance: () => setBalance(readCoinBalance()),
  }
}

export function FloatingHomeCoin({
  lang,
  onCollect,
  positions,
}: {
  lang: Locale
  onCollect: (coinId: number) => void
  positions: Array<CoinPosition>
}) {
  if (positions.length === 0) return null

  const label = getCoinCopy(lang).collect

  return positions.map((position) => (
      <button
        aria-label={label}
        className="fixed z-30 grid h-12 w-12 animate-bounce place-items-center rounded-full bg-transparent p-0 text-amber-950 drop-shadow-[0_3px_3px_rgba(63,38,8,0.35)] transition hover:scale-110 active:scale-95 sm:h-14 sm:w-14"
        key={position.id}
        onClick={() => onCollect(position.id)}
        style={{ left: `${position.left}%`, top: `${position.top}%` }}
        title={label}
        type="button"
      >
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain"
          src="/images/coin-rewards/floating-gold-coin.webp"
        />
      </button>
    ))
}

export function FlyingCollectedCoin({
  flight,
}: {
  flight: CollectedCoinFlight | null
}) {
  if (!flight) return null

  return (
    <div
      aria-hidden="true"
      className="coin-fly-to-box pointer-events-none fixed z-[110] h-12 w-12 text-amber-950 drop-shadow-[0_3px_3px_rgba(63,38,8,0.35)] sm:h-14 sm:w-14"
      key={flight.id}
      style={{
        left: flight.left,
        top: flight.top,
        '--coin-travel-x': `${flight.travelX}px`,
        '--coin-travel-y': `${flight.travelY}px`,
      } as CSSProperties}
    >
      <img
        alt=""
        className="h-full w-full object-contain"
        src="/images/coin-rewards/floating-gold-coin.webp"
      />
    </div>
  )
}

export function CoinRewardPopup({
  feedback,
}: {
  feedback: CoinRewardFeedback | null
}) {
  if (!feedback) return null

  return (
    <div
      aria-live="polite"
      className="coin-reward-pop pointer-events-none fixed inset-0 z-[120] grid place-items-center"
      key={feedback.id}
    >
      <div className="flex items-center gap-2 rounded-2xl bg-black/70 px-5 py-3 text-3xl font-black text-yellow-300 shadow-xl backdrop-blur-sm">
        <img
          alt=""
          aria-hidden="true"
          className="h-14 w-14 object-contain [image-rendering:pixelated] sm:h-16 sm:w-16"
          src="/images/coin-rewards/pixel-reward-coin.webp"
        />
        <span>{feedback.prefix}{feedback.amount}</span>
      </div>
    </div>
  )
}

function createRandomCoinPosition(): CoinPosition {
  const minimumLeft = window.innerWidth >= 1024
    ? Math.min(28, (240 / window.innerWidth) * 100)
    : 6

  return {
    id: Date.now() + Math.floor(Math.random() * 100_000),
    left: minimumLeft + Math.random() * (88 - minimumLeft),
    top: 16 + Math.random() * 68,
  }
}

function getCoinCopy(lang: Locale) {
  if (lang === 'zh-CN') return { bag: '金币袋', collect: '收集金币' }
  if (lang === 'zh-TW') return { bag: '金幣袋', collect: '收集金幣' }
  if (lang === 'ja') return { bag: 'コイン袋', collect: 'コインを集める' }
  return { bag: 'Coin bag', collect: 'Collect coin' }
}
