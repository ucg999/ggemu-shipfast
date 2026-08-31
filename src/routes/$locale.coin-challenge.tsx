import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { HomeCoinBag, useGlobalCoinBalance } from '#/components/home/coin-rewards'
import type { Locale } from '#/lib/ggemu'
import { addCoinBalance, spendCoinBalance } from '#/lib/coin-wallet'
import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const COIN_CHALLENGE_STORAGE_KEY = 'retro-games-coin-challenge-machine'
const COIN_CHALLENGE_RTP_STORAGE_KEY = 'retro-games-coin-challenge-rtp-ledger'
const TARGET_RETURN_RATE = 0.8
const SPECIAL_CELL_RATE = 0.05
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
  const [shouldResetAllBets, setShouldResetAllBets] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [roundWin, setRoundWin] = useState(0)
  const [compareMode, setCompareMode] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [transferDisplay, setTransferDisplay] = useState<{
    win: number
    credits: number
  } | null>(null)
  const spinTimerRef = useRef<number | null>(null)
  const transferTimerRef = useRef<number | null>(null)
  const comparePreviewTimerRef = useRef<number | null>(null)
  const creditHoldTimeoutRef = useRef<number | null>(null)
  const creditHoldIntervalRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    setMachine(readCoinChallengeState())

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
      stopCreditHold()
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
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

  function handleInsertCredit() {
    if (!spendCoinBalance(1)) {
      window.alert(copy.walletEmpty)
      return
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
    if (isSpinning || isWithdrawing) return
    stopCreditHold()
    handleInsertCredit()
    creditHoldTimeoutRef.current = window.setTimeout(() => {
      creditHoldIntervalRef.current = window.setInterval(handleInsertCredit, 110)
    }, 360)
  }

  function handleWithdraw() {
    if (isSpinning || compareMode || isWithdrawing || machine.credits < 1) return
    setIsWithdrawing(true)
    let remaining = machine.credits
    if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
    transferTimerRef.current = window.setInterval(() => {
      if (remaining < 1) {
        if (transferTimerRef.current !== null) window.clearInterval(transferTimerRef.current)
        transferTimerRef.current = null
        setIsWithdrawing(false)
        return
      }
      remaining -= 1
      updateMachine((current) => ({ ...current, credits: Math.max(0, current.credits - 1) }))
      addCoinBalance(1)
    }, 55)
  }

  function handleCompareStart() {
    if (isSpinning || isWithdrawing || compareMode || machine.bonusWin < 1) return
    setCompareMode(true)
    setLuckyLitLights(LEFT_COMPARE_LIGHTS)
    let previewSide = false
    comparePreviewTimerRef.current = window.setInterval(() => {
      previewSide = !previewSide
      setLuckyLitLights(previewSide ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
      playTrackTick(false)
    }, 180)
  }

  function handleCompareChoice(choice: 'big' | 'small') {
    if (!compareMode || isSpinning) return
    if (comparePreviewTimerRef.current !== null) {
      window.clearInterval(comparePreviewTimerRef.current)
      comparePreviewTimerRef.current = null
    }
    setIsSpinning(true)
    let step = 0
    const playerWins = Math.random() < 0.45
    const finalSide = playerWins ? choice : choice === 'big' ? 'small' : 'big'
    const animate = () => {
      const side = step % 2 === 0 ? 'big' : 'small'
      setLuckyLitLights(side === 'big' ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
      playTrackTick(step > 10)
      step += 1
      if (step >= 16) {
        setLuckyLitLights(finalSide === 'big' ? LEFT_COMPARE_LIGHTS : RIGHT_COMPARE_LIGHTS)
        updateMachine((current) => ({
          ...current,
          bonusWin: playerWins ? Math.min(9999, current.bonusWin * 2) : 0,
        }))
        setRoundWin(playerWins ? Math.min(999, machine.bonusWin * 2) : 0)
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
    if (isSpinning) return
    if (!shouldResetAllBets && machine.bets[index] >= 9) return
    if (machine.credits < 1) {
      window.alert(copy.creditEmpty)
      return
    }

    setTransferDisplay(null)
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
    if (isSpinning) return
    if (!machine.bets.some((value) => value > 0)) {
      window.alert(copy.placeBet)
      return
    }

    const totalBet = machine.bets.reduce((sum, value) => sum + value, 0)
    const repeatBetCost = shouldResetAllBets ? totalBet : 0
    if (machine.credits + machine.bonusWin < repeatBetCost) {
      window.alert(copy.creditEmpty)
      return
    }
    playTrackTick(true)
    const rtpLedger = readRtpLedger()
    const nextTotalWagered = rtpLedger.wagered + totalBet
    const payoutBudget = Math.max(
      0,
      Math.floor(nextTotalWagered * TARGET_RETURN_RATE) - rtpLedger.paid,
    )
    saveRtpLedger({ ...rtpLedger, wagered: nextTotalWagered })

    if (transferTimerRef.current !== null) {
      window.clearInterval(transferTimerRef.current)
    }
    if (machine.bonusWin > 0) {
      const startingWin = machine.bonusWin
      const finalCredits = Math.min(
        9999,
        machine.credits + machine.bonusWin - repeatBetCost,
      )
      const frames = Math.min(60, startingWin)
      let frame = 0

      setTransferDisplay({
        win: startingWin,
        credits: machine.credits,
      })
      transferTimerRef.current = window.setInterval(() => {
        frame += 1
        const progress = Math.min(1, frame / frames)
        setTransferDisplay({
          win: Math.max(0, Math.round(startingWin * (1 - progress))),
          credits: Math.round(
            machine.credits + (finalCredits - machine.credits) * progress,
          ),
        })

        if (progress >= 1) {
          if (transferTimerRef.current !== null) {
            window.clearInterval(transferTimerRef.current)
            transferTimerRef.current = null
          }
          window.setTimeout(() => setTransferDisplay(null), 180)
        }
      }, 30)
    } else {
      setTransferDisplay(null)
    }

    updateMachine((current) => ({
      bets: current.bets,
      bonusWin: 0,
      credits: Math.min(
        9999,
        current.credits + current.bonusWin - repeatBetCost,
      ),
    }))

    const winningTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) =>
        !RESERVED_MAIN_LIGHTS.has(light.index) &&
        light.option !== null &&
        machine.bets[light.option] > 0,
      )
    const otherTargets = TRACK_LIGHTS
      .map((light, index) => ({ ...light, index }))
      .filter((light) =>
        !RESERVED_MAIN_LIGHTS.has(light.index) &&
        light.option !== null && machine.bets[light.option] === 0,
      )
    const luckyTargets = payoutBudget > 0
      ? TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
          .filter((light) => light.index === LUCKY_LIGHT_INDEX)
      : []
    const outcomeRoll = Math.random()
    const chooseLucky = outcomeRoll < SPECIAL_CELL_RATE && luckyTargets.length > 0
    const choosePenalty = outcomeRoll >= SPECIAL_CELL_RATE && outcomeRoll < SPECIAL_CELL_RATE * 2
    const barStart = SPECIAL_CELL_RATE * 2
    const bar50End = barStart + BAR_50_RATE
    const bar100End = bar50End + BAR_100_RATE
    const bar25End = bar100End + BAR_25_RATE
    const chooseBar50 = outcomeRoll >= barStart && outcomeRoll < bar50End
    const chooseBar100 = outcomeRoll >= bar50End && outcomeRoll < bar100End
    const chooseBar25 = outcomeRoll >= bar100End && outcomeRoll < bar25End
    const selectedBarIndex = chooseBar50
      ? BAR_50_LIGHT_INDEX
      : chooseBar100
        ? BAR_100_LIGHT_INDEX
        : chooseBar25
          ? BAR_25_LIGHT_INDEX
          : null
    const averageWinningPayout = winningTargets.length > 0
      ? winningTargets.reduce(
          (sum, light) => sum + machine.bets[light.option!] * light.multiplier,
          0,
        ) / winningTargets.length
      : 0
    const normalWinRate = averageWinningPayout > 0
      ? Math.min(
          NORMAL_WIN_RATE_CAP,
          (payoutBudget / averageWinningPayout) * NORMAL_WIN_RATE_FACTOR,
        )
      : 0
    const chooseNormalWin = outcomeRoll >= SPECIAL_CELL_RATE * 2 &&
      selectedBarIndex === null &&
      outcomeRoll < bar25End + normalWinRate
    const roundWins = chooseLucky ||
      (selectedBarIndex !== null && machine.bets[7] > 0) ||
      (chooseNormalWin && winningTargets.length > 0)
    const fallbackTargets = otherTargets.length > 0
      ? otherTargets
      : TRACK_LIGHTS.map((light, index) => ({ ...light, index }))
          .filter((light) => light.option !== null)
    const targetPool = chooseLucky
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
    const target = roundWins && !chooseLucky && selectedBarIndex === null
      ? pickWeightedWinningTarget(targetPool)
      : targetPool[Math.floor(Math.random() * targetPool.length)]?.index ?? 0
    const outcome = TRACK_LIGHTS[target]
    const trackLength = TRACK_LIGHTS.length
    const distance = (target - activeLight + trackLength) % trackLength
    const totalSteps = trackLength * (3 + Math.floor(Math.random() * 2)) + distance
    const spinWeights = Array.from({ length: Math.max(1, totalSteps - 1) }, (_, index) => {
      const progress = (index + 1) / totalSteps
      return progress > 0.8 ? 1 + ((progress - 0.8) / 0.2) ** 2 * 4.2 : 1
    })
    const spinWeightTotal = spinWeights.reduce((sum, weight) => sum + weight, 0)
    let completedSteps = 0

    setIsSpinning(true)
    setLuckyLitLights([])
    setRoundWin(0)

    const advance = () => {
      completedSteps += 1
      playTrackTick(completedSteps >= totalSteps)
      setActiveLight((current) => (current + 1) % trackLength)

      if (completedSteps >= totalSteps) {
        if (target === LUCKY_LIGHT_INDEX) {
          runLuckyRounds(target, 3, 0)
          return
        }
        if (target === PENALTY_LIGHT_INDEX) {
          runPenaltyRounds(target, 2, 0)
          return
        }

        finishRound(
          machine.bets[outcome.option] * outcome.multiplier,
          outcome.option,
          outcome.multiplier,
        )
        return
      }

      const delay = Math.max(
        24,
        Math.round(
          (spinWeights[completedSteps - 1] / spinWeightTotal) *
            (MAIN_SPIN_DURATION_MS - 80),
        ),
      )
      spinTimerRef.current = window.setTimeout(advance, delay)
    }

    const finishRound = (
      payout: number,
      option: number,
      multiplier: number,
      lucky = false,
    ) => {
      const adjustedPayout = payout
      if (adjustedPayout > 0) {
        const latestLedger = readRtpLedger()
        saveRtpLedger({ ...latestLedger, paid: latestLedger.paid + adjustedPayout })
      }
      updateMachine((current) => ({
        bets: current.bets,
        bonusWin: Math.min(9999, current.bonusWin + adjustedPayout),
        credits: current.credits,
      }))
      setRoundWin(adjustedPayout)
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
        finishRound(accumulatedPayout, 0, 1, true)
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
            machine.bets[selected.option] * selected.multiplier
          const nextPayout = accumulatedPayout + chancePayout

          if (remaining <= 1) {
            finishRound(nextPayout, selected.option, selected.multiplier, true)
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
          const penalty = machine.bets[selected.option] * selected.multiplier
          const actualPenalty = Math.min(readCoinChallengeState().credits, penalty)
          const nextPenalty = accumulatedPenalty + actualPenalty
          updateMachine((current) => ({
            ...current,
            credits: Math.max(0, current.credits - actualPenalty),
          }))
          if (actualPenalty > 0) {
            const latestLedger = readRtpLedger()
            saveRtpLedger({
              ...latestLedger,
              wagered: latestLedger.wagered + actualPenalty,
            })
          }
          setRoundWin(Math.min(999, nextPenalty))
          setLuckyLitLights((current) => [...current, selected.index])

          if (remaining > 1) {
            spinTimerRef.current = window.setTimeout(
              () => runPenaltyRounds(selected.index, remaining - 1, nextPenalty),
              240,
            )
          } else {
            setShouldResetAllBets(true)
            setIsSpinning(false)
            spinTimerRef.current = window.setTimeout(() => setLuckyLitLights([]), 900)
          }
          return
        }
        spinTimerRef.current = window.setTimeout(advancePenalty, 42 + completed * 3)
      }

      spinTimerRef.current = window.setTimeout(advancePenalty, 100)
    }

    spinTimerRef.current = window.setTimeout(advance, 80)
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
        <div className="relative aspect-[5/8] max-h-screen w-full max-w-[750px] select-none">
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

        <div className="absolute left-[20.5%] top-[8%] h-[5.35%] w-[20.5%]">
          <SevenSegmentNumber
            digits={4}
            value={transferDisplay?.win ?? machine.bonusWin}
          />
        </div>

        <button
          aria-label={copy.insertCredit}
          className="absolute left-[60.5%] top-[8%] h-[5.35%] w-[20.5%] cursor-pointer rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300"
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
              value={transferDisplay?.credits ?? machine.credits}
            />
          </span>
        </button>

        <button
          aria-label={copy.withdraw}
          className="absolute left-[3.7%] top-[87.2%] z-10 h-[9.3%] w-[15.5%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={isSpinning || compareMode || isWithdrawing || machine.credits < 1}
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
          aria-label={copy.compare}
          className="absolute left-[84%] top-[87.2%] z-10 h-[9.3%] w-[15%] cursor-pointer rounded-full bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed"
          disabled={isSpinning || isWithdrawing || compareMode || machine.bonusWin < 1}
          onClick={handleCompareStart}
          type="button"
        />

        {TRACK_LIGHTS.map((light, index) => (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute z-[3] block aspect-square w-[2.7%] -translate-x-1/2 -translate-y-1/2 rounded-[18%] transition-[background-color,box-shadow,transform] duration-75 ${
              activeLight === index || luckyLitLights.includes(index)
                ? 'scale-110 bg-red-500 shadow-[0_0_10px_3px_rgba(255,20,20,0.95)]'
                : 'bg-transparent shadow-none'
            }`}
            key={`${light.x}-${light.y}`}
            style={{ left: `${light.x}%`, top: `${light.y}%` }}
          />
        ))}

        <div
          aria-live="polite"
          className="absolute left-[44%] top-[43%] z-[4] h-[4.4%] w-[12%]"
        >
          <SevenSegmentNumber digits={3} value={roundWin} />
        </div>

        <div className="absolute left-[8.5%] right-[7.75%] top-[74.38%] grid h-[13.1%] grid-cols-8 gap-[5.9%]">
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
                className="absolute inset-x-0 top-0 h-[26.25%] transition group-active:brightness-150"
                style={{
                  transform: `translateX(${[30, 20, 12, 6, -6, -12, -20, -30][displayIndex]}%)`,
                }}
              >
                <SevenSegmentNumber compact digits={1} value={machine.bets[optionIndex]} />
              </span>
            </button>
          ))}
        </div>

        <button
          aria-label={copy.start}
          className="absolute left-[34.5%] top-[88.1%] z-10 h-[8.2%] w-[31%] cursor-pointer rounded-[28%] bg-transparent text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:cursor-not-allowed disabled:grayscale"
          disabled={isSpinning}
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
      walletEmpty: '金幣箱餘額不足，玩遊戲或看別人玩可以獲得金幣。',
    }
  }
  if (locale === 'en') {
    return {
      addBet: (position: number) => `Add one coin to option ${position}`,
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
      walletEmpty: 'Your coin box is empty. Play games or watch others play to earn coins.',
    }
  }
  if (locale === 'ja') {
    return {
      addBet: (position: number) => `${position} 番の絵柄にコインを1枚追加`,
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
      walletEmpty: 'コイン箱の残高が不足しています。ゲームを遊ぶか、ほかの人のプレイを見てコインを獲得できます。',
    }
  }
  return {
    addBet: (position: number) => `第 ${position} 个图案增加 1 个金币`,
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
    walletEmpty: '金币箱余额不足，玩游戏或看别人玩可以获得金币。',
  }
}

function getBackLabel(locale: Locale) {
  if (locale === 'zh-TW') return '返回金幣模式'
  if (locale === 'en') return 'Back to Coin Mode'
  if (locale === 'ja') return 'コインモードに戻る'
  return '返回金币模式'
}
