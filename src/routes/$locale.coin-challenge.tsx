import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import { HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'
import type { Locale } from '#/lib/ggemu'
import { addCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const COIN_CHALLENGE_STORAGE_KEY = 'retro-games-coin-challenge-machine'
const COIN_CHALLENGE_RTP_STORAGE_KEY = 'retro-games-coin-challenge-rtp-ledger'
const TARGET_RETURN_RATE = 0.8
const SPECIAL_CELL_RATE = 0.12
const BAR_50_RATE = 0.015
const BAR_100_RATE = 0.002
const BAR_25_RATE = 0.025
const NORMAL_WIN_RATE_FACTOR = 0.75
const NORMAL_WIN_RATE_CAP = 0.35
const BAR_50_LIGHT_INDEX = 2
const BAR_100_LIGHT_INDEX = 3
const BAR_25_LIGHT_INDEX = 4
const PENALTY_LIGHT_INDEX = 9
const LUCKY_LIGHT_INDEX = 21
const RESERVED_MAIN_LIGHTS = new Set([
  PENALTY_LIGHT_INDEX,
  LUCKY_LIGHT_INDEX,
  BAR_50_LIGHT_INDEX,
  BAR_100_LIGHT_INDEX,
  BAR_25_LIGHT_INDEX,
])
const CHALLENGE_OPTION_COUNT = 8
const MAIN_SPIN_DURATION_MS = 5000
const BOTTOM_OPTION_ORDER = [7, 6, 5, 4, 3, 2, 1, 0] as const
const MOBILE_BET_SHIFT_CLASSES = [
  '-translate-x-[30%]', '-translate-x-[20%]', '-translate-x-[12%]', '-translate-x-[6%]',
  'translate-x-[6%]', 'translate-x-[12%]', 'translate-x-[20%]', 'translate-x-[30%]',
] as const
const DESKTOP_BET_SHIFT_CLASSES = [
  'sm:translate-x-[30%]', 'sm:translate-x-[20%]', 'sm:translate-x-[12%]', 'sm:translate-x-[6%]',
  'sm:-translate-x-[6%]', 'sm:-translate-x-[12%]', 'sm:-translate-x-[20%]', 'sm:-translate-x-[30%]',
] as const
const OPTION_PAYOUT_MULTIPLIERS = [5, 10, 10, 10, 20, 20, 20, 100] as const

const TRACK_LIGHTS = createTrackLights()
const LEFT_COMPARE_LIGHTS = TRACK_LIGHTS
  .map((light, index) => ({ light, index }))
  .filter(({ light }) => Math.abs(light.x - 21.7) < 0.1)
  .map(({ index }) => index)
const RIGHT_COMPARE_LIGHTS = TRACK_LIGHTS
  .map((light, index) => ({ light, index }))
  .filter(({ light }) => Math.abs(light.x - 78.27) < 0.1)
  .map(({ index }) => index)

type CoinChallengeState = {
  bets: Array<number>
  bonusWin: number
  credits: number
}

export const Route = createFileRoute('/$locale/coin-challenge')({
  loader: () => getSeoOrigin(),
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const title = getCoinChallengeTitle(locale)

    return {
      links: loaderData
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData,
            path: '/coin-challenge',
          })
        : undefined,
      meta: [
        { title: `${title}｜怀旧游戏厅` },
        {
          name: 'description',
          content: getCoinChallengeDescription(locale),
        },
      ],
    }
  },
  component: CoinChallengePage,
})

function CoinChallengePage() {
  const { locale } = Route.useParams()
  const lang = normalizeLocale(locale)
  const title = getCoinChallengeTitle(lang)
  const copy = getCoinChallengeCopy(lang)
  const globalCoins = useGlobalCoinBalance()
  const [machine, setMachine] = useState<CoinChallengeState>(() =>
    createEmptyChallengeState(),
  )
  const [activeLight, setActiveLight] = useState(0)
  const [luckyLitLights, setLuckyLitLights] = useState<Array<number>>([])
  const [winningLight, setWinningLight] = useState<number | null>(null)
  const [specialCellEffect, setSpecialCellEffect] = useState<'lucky' | 'penalty' | 'jackpot' | null>(null)
  const [shouldResetAllBets, setShouldResetAllBets] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [roundWin, setRoundWin] = useState(0)
  const [collectibleWin, setCollectibleWin] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [poolTransferDisplay, setPoolTransferDisplay] = useState<{
    pending: number
    pool: number
  } | null>(null)
  const [creditTransferDisplay, setCreditTransferDisplay] = useState<{
    credits: number
    pool: number
  } | null>(null)
  const spinTimerRef = useRef<number | null>(null)
  const transferTimerRef = useRef<number | null>(null)
  const comparePreviewTimerRef = useRef<number | null>(null)
  const creditHoldTimeoutRef = useRef<number | null>(null)
  const creditHoldIntervalRef = useRef<number | null>(null)
  const walletEmptyAlertShownRef = useRef(false)
  const betNoteIndexRef = useRef(0)
  const audioContextRef = useRef<AudioContext | null>(null)
  const coinDropAudioRef = useRef<HTMLAudioElement | null>(null)
  const mainSpinAudioRef = useRef<HTMLAudioElement | null>(null)
  const withdrawAudioRef = useRef<HTMLAudioElement | null>(null)
  const winAudioRef = useRef<HTMLAudioElement | null>(null)
  const winAudioAltRef = useRef<HTMLAudioElement | null>(null)
  const winAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const winAudioGainRef = useRef<GainNode | null>(null)
  const winAudioAltSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const winAudioAltGainRef = useRef<GainNode | null>(null)
  const luckyAudioRef = useRef<HTMLAudioElement | null>(null)
  const penaltyAudioRef = useRef<HTMLAudioElement | null>(null)
  const jackpotAudioRef = useRef<HTMLAudioElement | null>(null)
  const poolAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setMachine(readCoinChallengeState())
    coinDropAudioRef.current = new Audio('/coin-challenge-drop.mp3')
    coinDropAudioRef.current.preload = 'auto'
    mainSpinAudioRef.current = new Audio('/coin-challenge-spin-main.mp3')
    mainSpinAudioRef.current.preload = 'auto'
    mainSpinAudioRef.current.volume = 1
    withdrawAudioRef.current = new Audio('/coin-challenge-withdraw.mp3')
    withdrawAudioRef.current.preload = 'auto'
    winAudioRef.current = new Audio('/coin-challenge-win.mp3')
    winAudioRef.current.preload = 'auto'
    winAudioAltRef.current = new Audio('/coin-challenge-win-alt.mp3')
    winAudioAltRef.current.preload = 'auto'
    luckyAudioRef.current = new Audio('/coin-challenge-lucky.mp3')
    luckyAudioRef.current.preload = 'auto'
    luckyAudioRef.current.volume = 1
    penaltyAudioRef.current = new Audio('/coin-challenge-penalty.mp3')
    penaltyAudioRef.current.preload = 'auto'
    penaltyAudioRef.current.volume = 1
    jackpotAudioRef.current = new Audio('/coin-challenge-jackpot.mp3')
    jackpotAudioRef.current.preload = 'auto'
    jackpotAudioRef.current.volume = 1
    poolAudioRef.current = new Audio('/coin-challenge-pool.mp3')
    poolAudioRef.current.preload = 'auto'

    return () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current)
      }
      if (transferTimerRef.current !== null) {
        window.clearInterval(transferTimerRef.current)
      }
      if (comparePreviewTimerRef.current !== null) {
        window.clearInterval(comparePreviewTimerRef.current)
      }
      window.speechSynthesis?.cancel()
      stopCreditHold()
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
      coinDropAudioRef.current?.pause()
      coinDropAudioRef.current = null
      mainSpinAudioRef.current?.pause()
      mainSpinAudioRef.current = null
      withdrawAudioRef.current?.pause()
      withdrawAudioRef.current = null
      winAudioRef.current?.pause()
      if (winAudioRef.current) winAudioRef.current.onended = null
      winAudioRef.current = null
      winAudioAltRef.current?.pause()
      if (winAudioAltRef.current) winAudioAltRef.current.onended = null
      winAudioAltRef.current = null
      luckyAudioRef.current?.pause()
      luckyAudioRef.current = null
      penaltyAudioRef.current?.pause()
      penaltyAudioRef.current = null
      jackpotAudioRef.current?.pause()
      if (jackpotAudioRef.current) jackpotAudioRef.current.onended = null
      jackpotAudioRef.current = null
      poolAudioRef.current?.pause()
      poolAudioRef.current = null
    }
  }, [])

  function updateMachine(
    update: (current: CoinChallengeState) => CoinChallengeState,
  ) {
    setMachine((current) => {
      const next = update(current)
      saveCoinChallengeState(next)
      return next
    })
  }

  function playTrackTick(emphasized = false) {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextClass) return
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context
      if (context.state === 'suspended') void context.resume()

      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'square'
      oscillator.frequency.setValueAtTime(emphasized ? 760 : 520, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(emphasized ? 0.32 : 0.22, now + 0.004)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (emphasized ? 0.14 : 0.07))
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + (emphasized ? 0.15 : 0.08))
    } catch {
      // Audio remains optional when the browser blocks playback.
    }
  }

  function playMainSpinAudio() {
    const audio = mainSpinAudioRef.current
    if (!audio) return MAIN_SPIN_DURATION_MS
    const playbackRate = 0.9
    audio.pause()
    audio.currentTime = 0
    audio.playbackRate = playbackRate
    audio.preservesPitch = true
    void audio.play().catch(() => {
      // The running lights remain usable if audio playback is blocked.
    })
    return Number.isFinite(audio.duration) && audio.duration > 0
      ? Math.round((audio.duration * 1000) / playbackRate)
      : Math.round(MAIN_SPIN_DURATION_MS / playbackRate)
  }

  function celebrateWin(lightIndex: number) {
    const useAlternate = Math.random() < 0.5
    const winAudio = useAlternate ? winAudioAltRef.current : winAudioRef.current
    const sourceRef = useAlternate ? winAudioAltSourceRef : winAudioSourceRef
    const gainRef = useAlternate ? winAudioAltGainRef : winAudioGainRef
    if (winAudio) {
      try {
        const AudioContextClass =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (AudioContextClass) {
          const context = audioContextRef.current ?? new AudioContextClass()
          audioContextRef.current = context
          if (!sourceRef.current || !gainRef.current) {
            const source = context.createMediaElementSource(winAudio)
            const gain = context.createGain()
            gain.gain.value = 2.8
            source.connect(gain)
            gain.connect(context.destination)
            sourceRef.current = source
            gainRef.current = gain
          }
          if (context.state === 'suspended') void context.resume()
        }
      } catch {
        // Fall back to the media element's normal volume.
      }
      winAudio.volume = 1
      winAudio.currentTime = 0
      winAudio.onended = () => setWinningLight(null)
      void winAudio.play().catch(() => {
        const fallbackAudio = useAlternate ? winAudioRef.current : winAudioAltRef.current
        if (!fallbackAudio) return
        fallbackAudio.volume = 1
        fallbackAudio.currentTime = 0
        fallbackAudio.onended = () => setWinningLight(null)
        void fallbackAudio.play().catch(() => {
          // Winning remains visible when the browser blocks all audio playback.
        })
      })
    }
    setWinningLight(lightIndex)
  }

  function playBetClick() {
    try {
      const AudioContextClass =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioContextClass) return
      const context = audioContextRef.current ?? new AudioContextClass()
      audioContextRef.current = context
      if (context.state === 'suspended') void context.resume()

      const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77]
      const frequency = scale[betNoteIndexRef.current % scale.length]
      betNoteIndexRef.current = (betNoteIndexRef.current + 1) % scale.length
      const now = context.currentTime
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(frequency, now)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.38, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.21)
    } catch {
      // Betting remains usable when audio playback is unavailable.
    }
  }

  function playLuckyAudio() {
    const audio = luckyAudioRef.current
    if (!audio) return
    window.speechSynthesis.cancel()
    audio.currentTime = 0
    void audio.play().catch(() => {
      // The lucky animation remains visible if audio playback is blocked.
    })
  }

  function playPenaltyAudio() {
    const audio = penaltyAudioRef.current
    if (!audio) return
    window.speechSynthesis.cancel()
    audio.currentTime = 0
    void audio.play().catch(() => {
      // The penalty animation remains visible if audio playback is blocked.
    })
  }

  function playJackpotAudio() {
    const audio = jackpotAudioRef.current
    if (!audio) {
      setSpecialCellEffect(null)
      return
    }
    window.speechSynthesis.cancel()
    audio.currentTime = 0
    audio.onended = () => setSpecialCellEffect(null)
    void audio.play().catch(() => setSpecialCellEffect(null))
  }

  function playPoolAudio() {
    const poolAudio = poolAudioRef.current
    if (!poolAudio) return
    poolAudio.currentTime = 0
    void poolAudio.play().catch(() => {
      // Prize-pool actions remain usable when the browser blocks audio.
    })
  }

  function handleCollectPrize() {
    if (isSpinning || isWithdrawing || compareMode || poolTransferDisplay || collectibleWin < 1) return
    const amount = collectibleWin
    const startingPool = machine.bonusWin
    const finalPool = Math.min(9999, startingPool + amount)
    const frames = Math.min(60, amount)
    let frame = 0

    playPoolAudio()
    updateMachine((current) => ({
      ...current,
      bonusWin: Math.min(9999, current.bonusWin + amount),
    }))
    setPoolTransferDisplay({ pending: amount, pool: startingPool })
    if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
    transferTimerRef.current = window.setInterval(() => {
      frame += 1
      const progress = Math.min(1, frame / frames)
      setPoolTransferDisplay({
        pending: Math.max(0, Math.round(amount * (1 - progress))),
        pool: Math.round(startingPool + (finalPool - startingPool) * progress),
      })
      if (progress >= 1) {
        if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
        transferTimerRef.current = null
        setRoundWin(0)
        setCollectibleWin(0)
        window.setTimeout(() => setPoolTransferDisplay(null), 160)
      }
    }, 30)
  }

  function handleInsertCredit() {
    if (isSpinning || isWithdrawing || compareMode || poolTransferDisplay || creditTransferDisplay) return
    const latestMachine = readCoinChallengeState()
    if (latestMachine.bonusWin > 0) {
      const amount = latestMachine.bonusWin
      const startingCredits = latestMachine.credits
      const finalCredits = Math.min(9999, startingCredits + amount)
      const frames = Math.min(60, amount)
      let frame = 0

      playPoolAudio()
      updateMachine((current) => ({
        ...current,
        bonusWin: 0,
        credits: Math.min(9999, current.credits + current.bonusWin),
      }))
      setCreditTransferDisplay({ credits: startingCredits, pool: amount })
      if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
      transferTimerRef.current = window.setInterval(() => {
        frame += 1
        const progress = Math.min(1, frame / frames)
        setCreditTransferDisplay({
          credits: Math.round(startingCredits + (finalCredits - startingCredits) * progress),
          pool: Math.max(0, Math.round(amount * (1 - progress))),
        })
        if (progress >= 1) {
          if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
          transferTimerRef.current = null
          window.setTimeout(() => setCreditTransferDisplay(null), 160)
        }
      }, 30)
      return
    }

    if (!spendCoinBalance(1)) {
      stopCreditHold()
      if (!walletEmptyAlertShownRef.current) {
        walletEmptyAlertShownRef.current = true
        window.alert(copy.walletEmpty)
      }
      return
    }
    walletEmptyAlertShownRef.current = false

    const coinDropAudio = coinDropAudioRef.current
    if (coinDropAudio) {
      coinDropAudio.currentTime = 0
      void coinDropAudio.play().catch(() => {
        // Coin insertion remains usable when the browser blocks audio.
      })
    }

    updateMachine((current) => ({
      ...current,
      credits: Math.min(9999, current.credits + 1),
    }))
  }

  function stopCreditHold() {
    if (creditHoldTimeoutRef.current !== null) {
      window.clearTimeout(creditHoldTimeoutRef.current)
      creditHoldTimeoutRef.current = null
    }
    if (creditHoldIntervalRef.current !== null) {
      window.clearInterval(creditHoldIntervalRef.current)
      creditHoldIntervalRef.current = null
    }
  }

  function handleCreditPointerDown() {
    if (isSpinning || isWithdrawing || poolTransferDisplay || creditTransferDisplay) return
    stopCreditHold()
    const isPoolTransfer = readCoinChallengeState().bonusWin > 0
    handleInsertCredit()
    if (isPoolTransfer) return
    creditHoldTimeoutRef.current = window.setTimeout(() => {
      creditHoldIntervalRef.current = window.setInterval(handleInsertCredit, 110)
    }, 360)
  }

  function handleWithdraw() {
    const totalCoins = machine.credits + machine.bonusWin + collectibleWin
    if (isSpinning || compareMode || isWithdrawing || poolTransferDisplay || creditTransferDisplay || totalCoins < 1) return
    setIsWithdrawing(true)
    winAudioRef.current?.pause()
    if (winAudioRef.current) winAudioRef.current.currentTime = 0
    winAudioAltRef.current?.pause()
    if (winAudioAltRef.current) winAudioAltRef.current.currentTime = 0
    setWinningLight(null)
    const withdrawAudio = withdrawAudioRef.current
    if (withdrawAudio) {
      withdrawAudio.currentTime = 0
      void withdrawAudio.play().catch(() => {
        // Withdrawal remains usable when the browser blocks audio.
      })
    }
    let remainingCredits = machine.credits
    let remainingPool = machine.bonusWin
    let remainingPending = collectibleWin
    if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
    transferTimerRef.current = window.setInterval(() => {
      if (remainingCredits + remainingPool + remainingPending < 1) {
        if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
        transferTimerRef.current = null
        withdrawAudioRef.current?.pause()
        if (withdrawAudioRef.current) withdrawAudioRef.current.currentTime = 0
        setIsWithdrawing(false)
        return
      }
      if (remainingPending > 0) {
        remainingPending -= 1
        setCollectibleWin(remainingPending)
        setRoundWin((current) => Math.max(0, current - 1))
      } else if (remainingPool > 0) {
        remainingPool -= 1
        updateMachine((current) => ({
          ...current,
          bonusWin: Math.max(0, current.bonusWin - 1),
        }))
      } else {
        remainingCredits -= 1
        updateMachine((current) => ({
          ...current,
          credits: Math.max(0, current.credits - 1),
        }))
      }
      addCoinBalance(1)
    }, 55)
  }

  function handleCompareStart() {
    if (isSpinning || isWithdrawing || compareMode || poolTransferDisplay || creditTransferDisplay || collectibleWin < 1) return
    setCompareMode(true)
    setLuckyLitLights(LEFT_COMPARE_LIGHTS)
    let previewSide = false
    comparePreviewTimerRef.current = window.setInterval(() => {
      previewSide = !previewSide
      setLuckyLitLights(previewSide ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
      playTrackTick(false)
    }, 180)
  }

  function handleCompareOrReset() {
    if (collectibleWin > 0) {
      handleCompareStart()
      return
    }
    if (isSpinning || isWithdrawing || compareMode || poolTransferDisplay || creditTransferDisplay) return
    const displayedBet = machine.bets.reduce((sum, value) => sum + value, 0)
    if (displayedBet < 1) return
    // Bets left visible after a completed round are only the repeat-bet template.
    // Refund coins only while the displayed bet belongs to the pending round.
    const refund = shouldResetAllBets ? 0 : displayedBet
    updateMachine((current) => ({
      ...current,
      bets: Array.from({ length: CHALLENGE_OPTION_COUNT }, () => 0),
      credits: Math.min(9999, current.credits + refund),
    }))
    setShouldResetAllBets(false)
  }

  function handleCompareChoice(choice: 'big' | 'small') {
    if (!compareMode || isSpinning) return
    if (comparePreviewTimerRef.current !== null) {
      window.clearInterval(comparePreviewTimerRef.current)
      comparePreviewTimerRef.current = null
    }
    setIsSpinning(true)
    let step = 0
    const compareStake = collectibleWin
    const playerWins = Math.random() < 0.45
    const finalSide = playerWins ? choice : choice === 'big' ? 'small' : 'big'
    const animate = () => {
      const side = step % 2 === 0 ? 'big' : 'small'
      setLuckyLitLights(side === 'big' ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
      playTrackTick(step > 10)
      step += 1
      if (step >= 16) {
        setLuckyLitLights(finalSide === 'big' ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
        setRoundWin(playerWins ? Math.min(999, compareStake * 2) : 0)
        setCollectibleWin(playerWins ? Math.min(9999, compareStake * 2) : 0)
        setCompareMode(false)
        setIsSpinning(false)
        spinTimerRef.current = window.setTimeout(() => setLuckyLitLights([]), 900)
        return
      }
      spinTimerRef.current = window.setTimeout(animate, 55 + step * 15)
    }
    animate()
  }

  function handleBet(index: number) {
    if (isSpinning || poolTransferDisplay || creditTransferDisplay) return
    if (!shouldResetAllBets && machine.bets[index] >= 9) return
    if (machine.credits < 1) {
      window.alert(copy.creditEmpty)
      return
    }

    playBetClick()
    updateMachine((current) => {
      if (current.credits < 1) return current
      const currentBets = shouldResetAllBets
        ? Array.from({ length: CHALLENGE_OPTION_COUNT }, () => 0)
        : current.bets
      if (currentBets[index] >= 9) return current

      return {
        bets: currentBets.map((value, itemIndex) =>
          itemIndex === index ? Math.min(9, value + 1) : value,
        ),
        bonusWin: current.bonusWin,
        credits: current.credits - 1,
      }
    })
    setShouldResetAllBets(false)
  }

  function handleStart() {
    if (isSpinning || poolTransferDisplay || creditTransferDisplay) return
    winAudioRef.current?.pause()
    if (winAudioRef.current) {
      winAudioRef.current.currentTime = 0
      winAudioRef.current.onended = null
    }
    winAudioAltRef.current?.pause()
    if (winAudioAltRef.current) {
      winAudioAltRef.current.currentTime = 0
      winAudioAltRef.current.onended = null
    }
    for (const specialAudio of [luckyAudioRef.current, penaltyAudioRef.current, jackpotAudioRef.current]) {
      specialAudio?.pause()
      if (specialAudio) {
        specialAudio.currentTime = 0
        specialAudio.onended = null
      }
    }
    setWinningLight(null)
    setSpecialCellEffect(null)
    window.speechSynthesis?.cancel()

    let roundBets = machine.bets
    let usedAutomaticBet = false
    if (!roundBets.some((value) => value > 0)) {
      if (machine.credits < 1) {
        window.alert(copy.creditEmpty)
        return
      }
      const randomOption = Math.floor(Math.random() * CHALLENGE_OPTION_COUNT)
      roundBets = Array.from(
        { length: CHALLENGE_OPTION_COUNT },
        (_, index) => index === randomOption ? 1 : 0,
      )
      usedAutomaticBet = true
      updateMachine((current) => ({
        ...current,
        bets: roundBets,
        credits: Math.max(0, current.credits - 1),
      }))
      setShouldResetAllBets(false)
    }

    const totalBet = roundBets.reduce((sum, value) => sum + value, 0)
    const repeatBetCost = shouldResetAllBets && !usedAutomaticBet ? totalBet : 0
    if (machine.credits < repeatBetCost) {
      window.alert(copy.creditEmpty)
      return
    }
    const mainSpinDurationMs = playMainSpinAudio()
    const rtpLedger = readRtpLedger()
    const nextTotalWagered = rtpLedger.wagered + totalBet
    const payoutBudget = Math.max(
      0,
      Math.floor(nextTotalWagered * TARGET_RETURN_RATE) - rtpLedger.paid,
    )
    saveRtpLedger({ ...rtpLedger, wagered: nextTotalWagered })

    updateMachine((current) => ({
      bets: roundBets,
      bonusWin: current.bonusWin,
      credits: Math.max(0, current.credits - repeatBetCost),
    }))

    const winningTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) =>
        !RESERVED_MAIN_LIGHTS.has(light.index) &&
        light.option !== null &&
        roundBets[light.option] > 0,
      )
    const otherTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) =>
        !RESERVED_MAIN_LIGHTS.has(light.index) &&
        light.option !== null && roundBets[light.option] === 0,
      )
    const luckyTargets = payoutBudget > 0
      ? TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
          .filter((light) => light.index === LUCKY_LIGHT_INDEX)
      : []
    const allOptionsBet = roundBets.every((value) => value > 0)
    const activeBetOptions = roundBets
      .map((value, option) => ({ option, value }))
      .filter(({ value }) => value > 0)
    const usesScaledPartialRate = activeBetOptions.length > 0 && !allOptionsBet
    const scaledWinRate = 0.2 +
      Math.max(0, activeBetOptions.length - 1) * (0.5 / 7)
    const scaledWinningTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) => light.option !== null && roundBets[light.option] > 0)
    const outcomeRoll = Math.random()
    const chooseLucky = outcomeRoll < SPECIAL_CELL_RATE && luckyTargets.length > 0
    const choosePenalty = outcomeRoll >= SPECIAL_CELL_RATE && outcomeRoll < SPECIAL_CELL_RATE * 2
    const chooseScaledWin = usesScaledPartialRate &&
      !chooseLucky &&
      !choosePenalty &&
      scaledWinningTargets.length > 0 &&
      Math.random() < scaledWinRate
    const lowMultiplierTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) =>
        light.option !== null && (light.multiplier === 2 || light.multiplier === 3),
      )
    const selectedLowMultiplierTargets = lowMultiplierTargets.filter(
      (light) => light.option !== null && roundBets[light.option] > 0,
    )
    const scaledLowMultiplierRate = Math.max(
      0,
      (activeBetOptions.length - 1) * (0.7 / 7),
    )
    const chooseScaledLowMultiplier = chooseScaledWin &&
      selectedLowMultiplierTargets.length > 0 &&
      Math.random() < scaledLowMultiplierRate
    const chooseLowMultiplier = allOptionsBet &&
      !chooseLucky &&
      !choosePenalty &&
      lowMultiplierTargets.length > 0 &&
      Math.random() < 0.7
    const barStart = SPECIAL_CELL_RATE * 2
    const bar50End = barStart + BAR_50_RATE
    const bar100End = bar50End + BAR_100_RATE
    const bar25End = bar100End + BAR_25_RATE
    const chooseBar50 = !usesScaledPartialRate && !chooseLowMultiplier && outcomeRoll >= barStart && outcomeRoll < bar50End
    const chooseBar100 = !usesScaledPartialRate && !chooseLowMultiplier && outcomeRoll >= bar50End && outcomeRoll < bar100End
    const chooseBar25 = !usesScaledPartialRate && !chooseLowMultiplier && outcomeRoll >= bar100End && outcomeRoll < bar25End
    const selectedBarIndex = chooseBar50
      ? BAR_50_LIGHT_INDEX
      : chooseBar100
        ? BAR_100_LIGHT_INDEX
        : chooseBar25
          ? BAR_25_LIGHT_INDEX
          : null
    const averageWinningPayout = winningTargets.length > 0
      ? winningTargets.reduce(
          (sum, light) => sum + roundBets[light.option!] * light.multiplier,
          0,
        ) / winningTargets.length
      : 0
    const normalWinRate = averageWinningPayout > 0
      ? Math.min(
          NORMAL_WIN_RATE_CAP,
          (payoutBudget / averageWinningPayout) * NORMAL_WIN_RATE_FACTOR,
        )
      : 0
    const chooseNormalWin = !usesScaledPartialRate && !chooseLowMultiplier && outcomeRoll >= SPECIAL_CELL_RATE * 2 &&
      selectedBarIndex === null &&
      outcomeRoll < bar25End + normalWinRate
    const roundWins = chooseScaledWin || chooseLowMultiplier || chooseLucky ||
      (selectedBarIndex !== null && roundBets[7] > 0) ||
      (chooseNormalWin && winningTargets.length > 0)
    const suppressFullBetFallbackPayout = allOptionsBet && !roundWins
    const fallbackTargets = otherTargets.length > 0
      ? otherTargets
      : TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
          .filter((light) => light.option !== null)
    const targetPool = chooseScaledLowMultiplier
      ? selectedLowMultiplierTargets
      : chooseScaledWin
      ? scaledWinningTargets
      : chooseLowMultiplier
        ? lowMultiplierTargets
      : chooseLucky
        ? luckyTargets
      : choosePenalty
        ? TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
            .filter((light) => light.index === PENALTY_LIGHT_INDEX)
        : selectedBarIndex !== null
          ? TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
              .filter((light) => light.index === selectedBarIndex)
        : roundWins
          ? winningTargets
          : fallbackTargets
    const scaledTargetOption = chooseScaledWin && !chooseScaledLowMultiplier
      ? activeBetOptions[Math.floor(Math.random() * activeBetOptions.length)]?.option
      : undefined
    const scaledOptionTargets = scaledTargetOption === undefined
      ? []
      : targetPool.filter((light) => light.option === scaledTargetOption)
    const target = chooseScaledLowMultiplier
      ? targetPool[Math.floor(Math.random() * targetPool.length)]?.index ?? 0
      : chooseScaledWin
      ? scaledOptionTargets[Math.floor(Math.random() * scaledOptionTargets.length)]?.index ?? 0
      : chooseLowMultiplier
      ? targetPool[Math.floor(Math.random() * targetPool.length)]?.index ?? 0
      : roundWins && !chooseLucky && selectedBarIndex === null
        ? pickWeightedWinningTarget(targetPool)
      : targetPool[Math.floor(Math.random() * targetPool.length)]?.index ?? 0
    const outcome = TRACK_LIGHTS[target]
    const trackLength = TRACK_LIGHTS.length
    const distance = (target - activeLight + trackLength) % trackLength
    const totalSteps = trackLength * (3 + Math.floor(Math.random() * 2)) + distance
    const spinWeights = Array.from({ length: Math.max(1, totalSteps - 1) }, (_, index) => {
      const progress = (index + 1) / totalSteps
      if (progress < 0.14) {
        const openingProgress = progress / 0.14
        return 2.75 - 1.75 * openingProgress
      }
      if (progress > 0.7) {
        const closingProgress = (progress - 0.7) / 0.3
        return 1 + closingProgress ** 2 * 6.5
      }
      return 1
    })
    const spinWeightTotal = spinWeights.reduce((sum, weight) => sum + weight, 0)
    const minimumStepDelayMs = 12
    const openingDelayMs = 80
    const endingLeadMs = 700
    const spinDelayBudgetMs = Math.max(
      spinWeights.length * minimumStepDelayMs,
      mainSpinDurationMs - openingDelayMs - endingLeadMs,
    )
    const weightedDelayBudgetMs = Math.max(
      0,
      spinDelayBudgetMs - spinWeights.length * minimumStepDelayMs,
    )
    let completedSteps = 0
    let penaltyPendingBalance = collectibleWin
    let penaltyPoolBalance = machine.bonusWin
    let penaltyCreditBalance = Math.max(
      0,
      machine.credits - repeatBetCost - (usedAutomaticBet ? 1 : 0),
    )

    setIsSpinning(true)
    setLuckyLitLights([])
    setWinningLight(null)

    const advance = () => {
      completedSteps += 1
      setActiveLight((current) => (current + 1) % trackLength)

      if (completedSteps >= totalSteps) {
        if (target === LUCKY_LIGHT_INDEX) {
          setSpecialCellEffect('lucky')
          playLuckyAudio()
          runLuckyRounds(target, 3, 0)
          return
        }
        if (target === PENALTY_LIGHT_INDEX) {
          setSpecialCellEffect('penalty')
          playPenaltyAudio()
          runPenaltyRounds(target, 3, 0)
          return
        }
        if (target === BAR_100_LIGHT_INDEX && roundBets[7] > 0) {
          setSpecialCellEffect('jackpot')
          playJackpotAudio()
        }

        finishRound(
          suppressFullBetFallbackPayout
            ? 0
            : roundBets[outcome.option] * outcome.multiplier,
          outcome.option,
          outcome.multiplier,
          target,
        )
        return
      }

      const delay = Math.round(
        minimumStepDelayMs +
          (spinWeights[completedSteps - 1] / spinWeightTotal) *
            weightedDelayBudgetMs,
      )
      spinTimerRef.current = window.setTimeout(advance, delay)
    }

    const finishRound = (
      payout: number,
      option: number,
      multiplier: number,
      lightIndex: number,
      lucky = false,
    ) => {
      const adjustedPayout = payout
      if (adjustedPayout > 0) {
        const latestLedger = readRtpLedger()
        saveRtpLedger({ ...latestLedger, paid: latestLedger.paid + adjustedPayout })
        if (!lucky && lightIndex !== BAR_100_LIGHT_INDEX) {
          celebrateWin(lightIndex)
        }
      }
      updateMachine((current) => ({
        bets: current.bets,
        bonusWin: current.bonusWin,
        credits: current.credits,
      }))
      setRoundWin((current) => Math.min(999, current + adjustedPayout))
      setCollectibleWin((current) => Math.min(9999, current + adjustedPayout))
      if (lucky) setSpecialCellEffect(null)
      setShouldResetAllBets(true)
      setIsSpinning(false)
      spinTimerRef.current = null
    }

    const runLuckyRounds = (
      startIndex: number,
      remaining: number,
      accumulatedPayout: number,
    ) => {
      const candidates = TRACK_LIGHTS
        .map((light, index) => ({ ...light, index }))
        .filter((light) => light.option !== null)
      const selected = candidates[Math.floor(Math.random() * candidates.length)]

      if (!selected || selected.option === null) {
        finishRound(accumulatedPayout, 0, 1, startIndex, true)
        return
      }

      const luckyDistance =
        (selected.index - startIndex + trackLength) % trackLength
      const luckySteps = trackLength + luckyDistance
      let luckyCompleted = 0

      const advanceLucky = () => {
        luckyCompleted += 1
        playTrackTick(luckyCompleted >= luckySteps)
        setActiveLight((current) => (current + 1) % trackLength)

        if (luckyCompleted >= luckySteps) {
          setLuckyLitLights((current) =>
            current.includes(selected.index)
              ? current
              : [...current, selected.index],
          )
          const chancePayout =
            roundBets[selected.option] * selected.multiplier
          const nextPayout = accumulatedPayout + chancePayout

          if (remaining <= 1) {
            finishRound(nextPayout, selected.option, selected.multiplier, selected.index, true)
            return
          }

          spinTimerRef.current = window.setTimeout(
            () => runLuckyRounds(selected.index, remaining - 1, nextPayout),
            180,
          )
          return
        }

        spinTimerRef.current = window.setTimeout(advanceLucky, 34)
      }

      spinTimerRef.current = window.setTimeout(advanceLucky, 100)
    }

    const runPenaltyRounds = (
      startIndex: number,
      remaining: number,
      accumulatedPenalty: number,
    ) => {
      const candidates = TRACK_LIGHTS
        .map((light, index) => ({ ...light, index }))
        .filter((light) => light.option !== null)
      const selected = candidates[Math.floor(Math.random() * candidates.length)]

      if (!selected || selected.option === null) {
        setShouldResetAllBets(true)
        setIsSpinning(false)
        setSpecialCellEffect(null)
        spinTimerRef.current = null
        return
      }

      const distance = (selected.index - startIndex + trackLength) % trackLength
      const steps = trackLength + distance
      let completed = 0
      const advancePenalty = () => {
        completed += 1
        playTrackTick(completed >= steps)
        setActiveLight((current) => (current + 1) % trackLength)

        if (completed >= steps) {
          const penalty = roundBets[selected.option] * selected.multiplier
          let remainingPenalty = penalty
          const pendingDeduction = Math.min(penaltyPendingBalance, remainingPenalty)
          penaltyPendingBalance -= pendingDeduction
          remainingPenalty -= pendingDeduction
          const poolDeduction = Math.min(penaltyPoolBalance, remainingPenalty)
          penaltyPoolBalance -= poolDeduction
          remainingPenalty -= poolDeduction
          const creditDeduction = Math.min(penaltyCreditBalance, remainingPenalty)
          penaltyCreditBalance -= creditDeduction
          const actualPenalty = pendingDeduction + poolDeduction + creditDeduction
          const nextPenalty = accumulatedPenalty + actualPenalty
          setCollectibleWin(penaltyPendingBalance)
          setRoundWin(Math.min(999, penaltyPendingBalance))
          updateMachine((current) => ({
            ...current,
            bonusWin: Math.max(0, current.bonusWin - poolDeduction),
            credits: Math.max(0, current.credits - creditDeduction),
          }))
          if (actualPenalty > 0) {
            const latestLedger = readRtpLedger()
            saveRtpLedger({
              ...latestLedger,
              wagered: latestLedger.wagered + actualPenalty,
            })
          }
          setLuckyLitLights((current) => [...current, selected.index])

          if (remaining > 1) {
            spinTimerRef.current = window.setTimeout(
              () => runPenaltyRounds(selected.index, remaining - 1, nextPenalty),
              240,
            )
          } else {
            setShouldResetAllBets(true)
            setIsSpinning(false)
            spinTimerRef.current = window.setTimeout(() => {
              setLuckyLitLights([])
              setSpecialCellEffect(null)
            }, 900)
          }
          return
        }
        spinTimerRef.current = window.setTimeout(advancePenalty, 42 + completed * 3)
      }

      spinTimerRef.current = window.setTimeout(advancePenalty, 100)
    }

    spinTimerRef.current = window.setTimeout(advance, openingDelayMs)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <Link
        aria-label={getBackLabel(lang)}
        className="absolute left-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/65 text-xl text-white backdrop-blur transition hover:bg-white hover:text-black"
        params={{ locale: lang, platformId: 'coin' }}
        title={getBackLabel(lang)}
        to="/$locale/platform/$platformId"
      >
        <i className="ri-arrow-left-line" />
      </Link>
      <div className="absolute right-3 top-3 z-20 rounded-xl bg-black/70 p-1 backdrop-blur">
        <HomeCoinBag
          balance={globalCoins.balance}
          lang={lang}
          onOpen={globalCoins.showBalance}
        />
      </div>

      <h1 className="sr-only">{title}</h1>
      <div className="flex min-h-screen items-center justify-center bg-black p-0 sm:p-4">
        <div className="relative aspect-[5/8] w-full max-w-[min(750px,62.5vh)] shrink-0 select-none">
        <img
          alt={title}
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          draggable={false}
          src="/coin-challenge-classic-bg.jpg"
        />
        <img
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0"
          draggable={false}
          src="/coin-challenge-position-map.jpg"
        />

        {specialCellEffect === 'lucky' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[4.65%] top-[40.35%] z-[2] h-[8.15%] w-[13%] animate-[pulse_0.22s_linear_infinite] overflow-hidden"
          >
            <span className="absolute -inset-[65%] animate-[spin_0.65s_linear_infinite] bg-[repeating-conic-gradient(from_0deg,rgba(255,255,90,0.72)_0deg_12deg,rgba(80,255,70,0.08)_12deg_25deg)] mix-blend-screen" />
          </div>
        ) : null}
        {specialCellEffect === 'penalty' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[82.35%] top-[40.35%] z-[2] h-[8.15%] w-[13%] animate-[pulse_0.2s_linear_infinite] overflow-hidden"
          >
            <span className="absolute -inset-[65%] animate-[spin_0.55s_linear_infinite] bg-[repeating-conic-gradient(from_0deg,rgba(255,70,220,0.72)_0deg_12deg,rgba(120,40,255,0.08)_12deg_25deg)] mix-blend-screen" />
          </div>
        ) : null}
        {specialCellEffect === 'jackpot' ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[43.55%] top-[16.15%] z-[2] h-[8.15%] w-[13%] animate-[pulse_0.16s_linear_infinite] overflow-hidden bg-cyan-300/80"
          >
            <span className="absolute -inset-[65%] animate-[spin_0.45s_linear_infinite] bg-[repeating-conic-gradient(from_0deg,rgba(255,255,255,0.95)_0deg_10deg,rgba(0,220,255,0.12)_10deg_22deg)] mix-blend-screen" />
          </div>
        ) : null}

        <button
          aria-label={copy.collectPrize}
          className="absolute left-[19%] top-[8%] h-[5.35%] w-[20.5%] cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed sm:left-[17.17%]"
          disabled={isSpinning || isWithdrawing || compareMode || Boolean(poolTransferDisplay) || collectibleWin < 1}
          onClick={handleCollectPrize}
          title={copy.collectPrize}
          type="button"
        >
          <SevenSegmentNumber
            digits={4}
            value={creditTransferDisplay?.pool ?? poolTransferDisplay?.pool ?? machine.bonusWin}
          />
        </button>

        <button
          aria-label={copy.insertCredit}
          className="absolute left-[63.5%] top-[8%] h-[5.35%] w-[20.5%] cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 sm:left-[63.83%]"
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              handleInsertCredit()
            }
          }}
          onPointerCancel={stopCreditHold}
          onPointerDown={handleCreditPointerDown}
          onPointerLeave={stopCreditHold}
          onPointerUp={stopCreditHold}
          title={copy.insertCredit}
          type="button"
        >
          <span className="absolute inset-0">
            <SevenSegmentNumber
              digits={4}
              value={creditTransferDisplay?.credits ?? machine.credits}
            />
          </span>
        </button>

        <button
          aria-label={copy.withdraw}
          className="absolute left-[3.7%] top-[87.2%] z-10 h-[9.3%] w-[15.5%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={isSpinning || compareMode || isWithdrawing || Boolean(poolTransferDisplay) || Boolean(creditTransferDisplay) || machine.credits + machine.bonusWin + collectibleWin < 1}
          onClick={handleWithdraw}
          type="button"
        />
        <button
          aria-label={copy.big}
          className="absolute left-[23%] top-[87.4%] z-10 h-[8.5%] w-[10.5%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={!compareMode || isSpinning}
          onClick={() => handleCompareChoice('big')}
          type="button"
        />
        <button
          aria-label={copy.small}
          className="absolute left-[69%] top-[87.4%] z-10 h-[8.5%] w-[10.5%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={!compareMode || isSpinning}
          onClick={() => handleCompareChoice('small')}
          type="button"
        />
        <button
          aria-label={collectibleWin > 0 ? copy.compare : copy.resetBet}
          className="absolute left-[84%] top-[87.2%] z-10 h-[9.3%] w-[15%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={isSpinning || isWithdrawing || compareMode || Boolean(poolTransferDisplay) || Boolean(creditTransferDisplay) || (collectibleWin < 1 && !machine.bets.some((value) => value > 0))}
          onClick={handleCompareOrReset}
          title={collectibleWin > 0 ? copy.compare : copy.resetBet}
          type="button"
        />

        {TRACK_LIGHTS.map((light, index) => (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute z-[3] block aspect-square w-[2.7%] -translate-x-1/2 -translate-y-1/2 rounded-[18%] transition-[background-color,box-shadow,transform] duration-75 [left:var(--track-x)] max-sm:[left:calc(var(--track-x)_+_var(--mobile-track-shift))] sm:[left:calc(var(--track-x)_+_var(--desktop-track-shift))] ${
              winningLight === index
                ? 'animate-[pulse_0.18s_linear_infinite] scale-125 bg-yellow-200 shadow-[0_0_16px_6px_rgba(255,230,50,1)]'
                : activeLight === index || luckyLitLights.includes(index)
                  ? 'scale-110 bg-red-500 shadow-[0_0_10px_3px_rgba(255,20,20,0.95)]'
                : 'bg-transparent shadow-none'
            }`}
            key={`${light.x}-${light.y}`}
            style={{
              '--mobile-track-shift': getMobileTrackShift(light),
              '--desktop-track-shift': getDesktopTrackShift(light),
              '--track-x': `${light.x}%`,
              top: `${light.y}%`,
            } as CSSProperties}
          />
        ))}

        <div
          aria-live="polite"
          className="absolute left-[44%] top-[43%] z-[4] h-[4.4%] w-[12%]"
        >
          <SevenSegmentNumber digits={3} value={poolTransferDisplay?.pending ?? roundWin} />
        </div>

        <div className="absolute left-[8.5%] right-[7.75%] top-[74.38%] grid h-[13.1%] origin-center grid-cols-8 gap-[5.9%] sm:scale-x-[1.08]">
          {BOTTOM_OPTION_ORDER.map((optionIndex, displayIndex) => (
            <button
              aria-label={copy.addBet(optionIndex + 1)}
              className="group relative min-w-0 cursor-pointer rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300"
              key={optionIndex}
              onClick={() => handleBet(optionIndex)}
              title={copy.addBet(optionIndex + 1)}
              type="button"
            >
              <span
                className={`absolute inset-x-0 top-0 h-[26.25%] transition group-active:brightness-150 sm:scale-x-[.9259] ${MOBILE_BET_SHIFT_CLASSES[displayIndex]} ${DESKTOP_BET_SHIFT_CLASSES[displayIndex]}`}
              >
                <SevenSegmentNumber compact digits={1} value={machine.bets[optionIndex]} />
              </span>
            </button>
          ))}
        </div>

        <button
          aria-label={copy.start}
          className="absolute left-[34.5%] top-[88.1%] z-10 h-[8.2%] w-[31%] cursor-pointer rounded-[28%] bg-transparent text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:grayscale"
          disabled={isSpinning || Boolean(poolTransferDisplay) || Boolean(creditTransferDisplay)}
          onClick={handleStart}
          type="button"
        >
          <span className="sr-only">{isSpinning ? copy.running : copy.start}</span>
        </button>

        </div>
      </div>
    </main>
  )
}

function createEmptyChallengeState(): CoinChallengeState {
  return {
    bets: Array.from({ length: CHALLENGE_OPTION_COUNT }, () => 0),
    bonusWin: 0,
    credits: 0,
  }
}

type CoinChallengeRtpLedger = {
  paid: number
  wagered: number
}

function readRtpLedger(): CoinChallengeRtpLedger {
  try {
    const stored = window.localStorage.getItem(COIN_CHALLENGE_RTP_STORAGE_KEY)
    const parsed = stored ? JSON.parse(stored) as Partial<CoinChallengeRtpLedger> : null
    return {
      paid: Math.max(0, Math.floor(Number(parsed?.paid) || 0)),
      wagered: Math.max(0, Math.floor(Number(parsed?.wagered) || 0)),
    }
  } catch {
    return { paid: 0, wagered: 0 }
  }
}

function saveRtpLedger(ledger: CoinChallengeRtpLedger) {
  try {
    window.localStorage.setItem(COIN_CHALLENGE_RTP_STORAGE_KEY, JSON.stringify(ledger))
  } catch {
    // The current round remains playable when storage is unavailable.
  }
}

function readCoinChallengeState(): CoinChallengeState {
  try {
    const stored = window.localStorage.getItem(COIN_CHALLENGE_STORAGE_KEY)
    const parsed = stored ? (JSON.parse(stored) as Partial<CoinChallengeState>) : null
    const storedBets = Array.isArray(parsed?.bets) ? parsed.bets : []

    return {
      bets: Array.from({ length: CHALLENGE_OPTION_COUNT }, (_, index) =>
        Math.max(0, Math.min(9, Math.floor(Number(storedBets[index]) || 0))),
      ),
      bonusWin: Math.max(
        0,
        Math.min(9999, Math.floor(Number(parsed?.bonusWin) || 0)),
      ),
      credits: Math.max(
        0,
        Math.min(9999, Math.floor(Number(parsed?.credits) || 0)),
      ),
    }
  } catch {
    return createEmptyChallengeState()
  }
}

function saveCoinChallengeState(state: CoinChallengeState) {
  try {
    window.localStorage.setItem(COIN_CHALLENGE_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // The machine remains usable for the current page when storage is unavailable.
  }
}

function SevenSegmentNumber({
  compact = false,
  digits,
  value,
}: {
  compact?: boolean
  digits: number
  value: number
}) {
  const characters = String(Math.max(0, Math.floor(value)))
    .slice(-digits)
    .padStart(digits, '0')

  return (
    <span
      className={`flex h-full w-full items-center justify-center gap-[3%] ${
        compact ? 'px-[28%] py-[11%]' : 'px-[5%] py-[7%]'
      }`}
    >
      {Array.from(characters).map((character, index) => (
        <SevenSegmentDigit character={character} key={`${index}-${character}`} />
      ))}
    </span>
  )
}

function SevenSegmentDigit({ character }: { character: string }) {
  const activeSegments = new Set(SEVEN_SEGMENT_DIGITS[character] ?? [])

  return (
    <svg
      aria-hidden="true"
      className="h-full min-w-0 flex-1 overflow-visible"
      preserveAspectRatio="none"
      viewBox="0 0 40 72"
    >
      {SEVEN_SEGMENT_SHAPES.map((points, index) => (
        <polygon
          fill={activeSegments.has(index) ? '#ef1010' : '#260000'}
          key={points}
          points={points}
          style={activeSegments.has(index)
            ? { filter: 'drop-shadow(0 0 2px rgba(255, 20, 20, 0.9))' }
            : undefined}
        />
      ))}
    </svg>
  )
}

const SEVEN_SEGMENT_SHAPES = [
  '8,4 32,4 35,7 32,10 8,10 5,7',
  '33,9 36,12 36,31 33,34 30,31 30,13',
  '33,38 36,41 36,60 33,63 30,60 30,42',
  '8,62 32,62 35,65 32,68 8,68 5,65',
  '4,38 7,41 7,60 4,63 1,60 1,41',
  '4,9 7,13 7,31 4,34 1,31 1,12',
  '8,33 32,33 35,36 32,39 8,39 5,36',
] as const

const SEVEN_SEGMENT_DIGITS: Record<string, Array<number>> = {
  '0': [0, 1, 2, 3, 4, 5],
  '1': [1, 2],
  '2': [0, 1, 6, 4, 3],
  '3': [0, 1, 6, 2, 3],
  '4': [5, 6, 1, 2],
  '5': [0, 5, 6, 2, 3],
  '6': [0, 5, 6, 4, 2, 3],
  '7': [0, 1, 2],
  '8': [0, 1, 2, 3, 4, 5, 6],
  '9': [0, 1, 2, 3, 5, 6],
}

function createTrackLights() {
  const lights: Array<{
    multiplier: number
    option: number | null
    x: number
    y: number
  }> = []
  const outcomes: Array<{ multiplier?: number; option: number | null }> = [
    { multiplier: 10, option: 1 },
    { multiplier: 10, option: 3 },
    { multiplier: 50, option: 7 },
    { multiplier: 100, option: 7 },
    { multiplier: 25, option: 7 },
    { multiplier: 5, option: 0 },
    { multiplier: 10, option: 2 },
    { option: 4 },
    { multiplier: 3, option: 4 },
    { option: null },
    { option: 0 },
    { multiplier: 2, option: 1 },
    { multiplier: 10, option: 1 },
    { multiplier: 10, option: 3 },
    { multiplier: 3, option: 6 },
    { multiplier: 20, option: 6 },
    { multiplier: 5, option: 0 },
    { multiplier: 2, option: 2 },
    { multiplier: 10, option: 2 },
    { option: 5 },
    { multiplier: 3, option: 5 },
    { option: null },
    { option: 0 },
    { multiplier: 2, option: 1 },
  ]
  const addLight = (x: number, y: number) => {
    const outcome = outcomes[lights.length]
    lights.push({
      multiplier: outcome?.multiplier ?? (
        outcome?.option === null || outcome?.option === undefined
          ? 1
          : OPTION_PAYOUT_MULTIPLIERS[outcome.option]
      ),
      option: outcome?.option ?? null,
      x,
      y,
    })
  }
  const horizontal = [21.7, 26.93, 38.47, 50, 61.53, 73.15, 78.27]
  const vertical = [24.77, 28.28, 36.35, 44.43, 52.55, 60.63, 64.14]

  horizontal.forEach((x) => addLight(x, vertical[0]))
  vertical.slice(1).forEach((y) => addLight(horizontal[6], y))
  horizontal.slice(0, -1).reverse().forEach((x) => addLight(x, vertical[6]))
  vertical.slice(1, -1).reverse().forEach((y) => addLight(horizontal[0], y))

  return lights
}

function pickWeightedWinningTarget(
  targets: Array<{
    index: number
    multiplier: number
    option: number | null
  }>,
) {
  if (targets.length === 0) return 0
  const weighted = targets.map((target) => ({
    target,
    weight: target.option === 0 || target.multiplier === 2 || target.multiplier === 3
      ? 3.5
      : 1,
  }))
  let roll = Math.random() * weighted.reduce((sum, item) => sum + item.weight, 0)
  for (const item of weighted) {
    roll -= item.weight
    if (roll <= 0) return item.target.index
  }
  return weighted[weighted.length - 1].target.index
}

function getMobileTrackShift(light: { x: number; y: number }) {
  const isLeftColumn = Math.abs(light.x - 21.7) < 0.1
  const isRightColumn = Math.abs(light.x - 78.27) < 0.1
  let shift = light.x < 50 ? -2.5 : light.x > 50 ? 2.5 : 0

  if (isLeftColumn) shift -= 0.5
  if (isRightColumn) shift += 0.5
  if (Math.abs(light.x - 26.93) < 0.1) {
    return `${shift}%`
  }
  if (Math.abs(light.x - 38.47) < 0.1) return `calc(${shift}% + 7px)`
  if (Math.abs(light.x - 61.53) < 0.1) return `calc(${shift}% - 5px)`
  return `${shift}%`
}

function getDesktopTrackShift(light: { x: number; y: number }) {
  let shift = light.x < 49.9 ? -3.33 : light.x > 50.1 ? 3.33 : 0

  if (Math.abs(light.x - 26.93) < 0.1) shift += 0.67
  if (Math.abs(light.x - 38.47) < 0.1) shift += 2
  if (Math.abs(light.x - 61.53) < 0.1) shift -= 2
  if (Math.abs(light.x - 73.15) < 0.1) shift -= 0.67
  return `${shift}%`
}

function getCoinChallengeTitle(locale: Locale) {
  if (locale === 'zh-TW') return '金幣挑戰機'
  if (locale === 'en') return 'Coin Challenge Machine'
  if (locale === 'ja') return 'コインチャレンジマシン'
  return '金币挑战机'
}

function getCoinChallengeDescription(locale: Locale) {
  if (locale === 'zh-TW') return '金幣挑戰機獨立遊戲介面。'
  if (locale === 'en') return 'The dedicated Coin Challenge Machine game screen.'
  if (locale === 'ja') return 'コインチャレンジマシンの専用ゲーム画面です。'
  return '金币挑战机独立游戏界面。'
}

function getCoinChallengeCopy(locale: Locale) {
  if (locale === 'zh-TW') {
    return {
      addBet: (position: number) => `第 ${position} 個圖案增加 1 枚金幣`,
      collectPrize: '將中央獎金轉入獎池',
      creditEmpty: 'CREDIT 不足，請先點擊頂部 CREDIT 投入金幣。',
      insertCredit: '從金幣箱投入 1 枚金幣',
      luckyResult: (payout: number) => `馬里奧幸運三連轉完成，共獲得 ${payout} 分`,
      placeBet: '請先點擊下方圖案投入至少 1 枚金幣。',
      result: (position: number | null, payout: number, multiplier: number) =>
        position === null
          ? '停在未對應圖案，本次未中獎'
          : payout > 0
            ? `第 ${position} 格 ×${multiplier} 中獎 ${payout} 分，下局開始時轉入 CREDIT`
            : `停在第 ${position} 格，本次未中獎`,
      running: '轉動中',
      start: '開始',
      withdraw: '退幣',
      big: '大',
      small: '小',
      compare: '比大小',
      resetBet: '清空下注並退回 CREDIT',
      walletEmpty: '金幣箱餘額不足，玩遊戲或看別人玩可以獲得金幣。',
    }
  }
  if (locale === 'en') {
    return {
      addBet: (position: number) => `Add one coin to option ${position}`,
      collectPrize: 'Move the center win into the prize pool',
      creditEmpty: 'No CREDIT. Click the CREDIT display to insert a coin first.',
      insertCredit: 'Insert one coin from your coin box',
      luckyResult: (payout: number) => `Mario lucky triple spin complete: ${payout} points won.`,
      placeBet: 'Add at least one coin to an option first.',
      result: (position: number | null, payout: number, multiplier: number) =>
        position === null
          ? 'Stopped on an unmatched symbol. No win this round.'
          : payout > 0
            ? `Option ${position} ×${multiplier} wins ${payout}. It moves to CREDIT when the next round starts.`
            : `Stopped on option ${position}. No win this round.`,
      running: 'RUNNING',
      start: 'START',
      withdraw: 'RETURN COINS',
      big: 'BIG',
      small: 'SMALL',
      compare: 'DOUBLE OR NOTHING',
      resetBet: 'Reset bets and refund CREDIT',
      walletEmpty: 'Your coin box is empty. Play games or watch others play to earn coins.',
    }
  }
  if (locale === 'ja') {
    return {
      addBet: (position: number) => `${position} 番の絵柄にコインを1枚追加`,
      collectPrize: '中央の賞金をジャックポットへ移す',
      creditEmpty: 'CREDITがありません。上のCREDIT表示を押してコインを入れてください。',
      insertCredit: 'コイン箱からコインを1枚入れる',
      luckyResult: (payout: number) => `マリオのラッキー3連続回転完了：合計${payout}点。`,
      placeBet: '先に下の絵柄へコインを1枚以上入れてください。',
      result: (position: number | null, payout: number, multiplier: number) =>
        position === null
          ? '対応しない絵柄で停止。今回は当たりなし。'
          : payout > 0
            ? `${position} 番 ×${multiplier} が当たり：${payout}点。次のラウンド開始時にCREDITへ移動します。`
            : `${position} 番で停止。今回は当たりなし。`,
      running: '回転中',
      start: '開始',
      withdraw: 'コインを戻す',
      big: '大',
      small: '小',
      compare: '大小勝負',
      resetBet: 'ベットをリセットしてCREDITへ戻す',
      walletEmpty: 'コイン箱の残高が不足しています。ゲームを遊ぶか、ほかの人のプレイを見てコインを獲得できます。',
    }
  }
  return {
    addBet: (position: number) => `第 ${position} 个图案增加 1 个金币`,
    collectPrize: '将中央奖金转入奖池',
    creditEmpty: 'CREDIT 不足，请先点击顶部 CREDIT 投入金币。',
    insertCredit: '从金币箱投入 1 个金币',
    luckyResult: (payout: number) => `马里奥幸运三连转完成，共获得 ${payout} 分`,
    placeBet: '请先点击下方图案，至少投入 1 个金币。',
    result: (position: number | null, payout: number, multiplier: number) =>
      position === null
        ? '停在未对应图案，本次未中奖'
        : payout > 0
          ? `第 ${position} 格 ×${multiplier} 中奖 ${payout} 分，下局开始时转入 CREDIT`
          : `停在第 ${position} 格，本次未中奖`,
    running: '转动中',
    start: '开始',
    withdraw: '退币',
    big: '大',
    small: '小',
    compare: '比大小',
    resetBet: '清空下注并退回 CREDIT',
    walletEmpty: '金币箱余额不足，玩游戏或看别人玩可以获得金币。',
  }
}

function getBackLabel(locale: Locale) {
  if (locale === 'zh-TW') return '返回金幣模式'
  if (locale === 'en') return 'Back to Coin Mode'
  if (locale === 'ja') return 'コインモードに戻る'
  return '返回金币模式'
}
