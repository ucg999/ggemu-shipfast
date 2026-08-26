import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import type { Locale } from '#/lib/ggemu'

const COIN_BALANCE_STORAGE_KEY = 'game-adventure-coin-balance'
const COIN_INTERVAL_MS = 90_000
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

  useEffect(() => {
    setBalance(readStoredNumber(COIN_BALANCE_STORAGE_KEY))
    setCoinPositions([createRandomCoinPosition()])
  }, [])

  useEffect(() => {
    function syncCoinBalance(event?: StorageEvent) {
      if (event && event.key !== COIN_BALANCE_STORAGE_KEY) return

      setBalance(readStoredNumber(COIN_BALANCE_STORAGE_KEY))
    }

    function syncVisiblePage() {
      if (document.visibilityState === 'visible') {
        syncCoinBalance()
      }
    }

    window.addEventListener('storage', syncCoinBalance)
    document.addEventListener('visibilitychange', syncVisiblePage)

    return () => {
      window.removeEventListener('storage', syncCoinBalance)
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

    setBalance((current) => {
      const next = current + Math.floor(amount)
      writeStoredNumber(COIN_BALANCE_STORAGE_KEY, next)
      return next
    })
    if (showFeedback) {
      showRewardFeedback(Math.floor(amount), '+')
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

  return (
    <button
      aria-label={`${label}: ${balance}`}
      className="relative ml-1 grid h-9 w-9 shrink-0 place-items-center sm:ml-7 sm:h-14 sm:w-14"
      data-coin-box
      onClick={onOpen}
      title={`${label}: ${balance}`}
      type="button"
    >
      <img
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain drop-shadow-sm"
        src="/images/coin-rewards/mystery-coin-box.png"
      />
      <span className="coin-box-count-blink relative grid h-6 w-6 place-items-center rounded-full border-2 border-amber-700 bg-yellow-300 text-[10px] font-black leading-none text-amber-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_1px_2px_rgba(92,48,0,0.35)] sm:h-8 sm:w-8 sm:text-xs">
        {balance}
      </span>
    </button>
  )
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
          src="/images/coin-rewards/floating-gold-coin.png"
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
        src="/images/coin-rewards/floating-gold-coin.png"
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
          src="/images/coin-rewards/pixel-reward-coin.png"
        />
        <span>{feedback.prefix}{feedback.amount}</span>
      </div>
    </div>
  )
}

function createRandomCoinPosition(): CoinPosition {
  return {
    id: Date.now() + Math.floor(Math.random() * 100_000),
    left: 6 + Math.random() * 82,
    top: 16 + Math.random() * 68,
  }
}

function readStoredNumber(key: string) {
  try {
    return Math.max(0, Number(window.localStorage.getItem(key)) || 0)
  } catch {
    return 0
  }
}

function writeStoredNumber(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    // Rewards remain available for the current visit when storage is unavailable.
  }
}

function getCoinCopy(lang: Locale) {
  if (lang === 'zh-CN') return { bag: '金币袋', collect: '收集金币' }
  if (lang === 'zh-TW') return { bag: '金幣袋', collect: '收集金幣' }
  if (lang === 'ja') return { bag: 'コイン袋', collect: 'コインを集める' }
  return { bag: 'Coin bag', collect: 'Collect coin' }
}
