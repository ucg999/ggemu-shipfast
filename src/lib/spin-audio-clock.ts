// Drive visual progress from media time, including network buffering pauses.
export function createSpinAudioClock(
  audio: HTMLAudioElement | null,
  durationMs: number,
  now = () => performance.now(),
  extraDurationMs = 0,
) {
  let progress = 0
  let lastMovement = now()
  let completedAt: number | null = null
  let elapsedMs = 0
  let fallbackStart: number | null = null
  let fallbackProgress = 0
  let stopped = false

  const useFallback = () => {
    if (stopped || fallbackStart !== null) return
    audio?.pause()
    fallbackProgress = progress
    fallbackStart = now()
  }

  if (audio) {
    try {
      audio.pause()
      audio.currentTime = 0
      audio.playbackRate = 0.9
      audio.preservesPitch = true
      void audio.play().then(() => {
        if (stopped || fallbackStart !== null) audio.pause()
      }).catch(useFallback)
    } catch {
      useFallback()
    }
  } else {
    useFallback()
  }

  return {
    elapsed() {
      if (stopped) return elapsedMs
      if (fallbackStart === null && audio) {
        const next = audio.ended ? 1 : Number.isFinite(audio.duration) && audio.duration > 0
          ? audio.currentTime / audio.duration : 0
        if (next > progress) {
          progress = Math.min(1, next)
          lastMovement = now()
        }
        // Never let a failed or indefinitely stalled download lock the round.
        if (audio.error || now() - lastMovement >= 15000) useFallback()
      }
      if (fallbackStart !== null) {
        progress = Math.min(1, fallbackProgress + (now() - fallbackStart) / durationMs)
      }
      if (progress >= 1 && completedAt === null) completedAt = now()
      elapsedMs = progress * durationMs + (completedAt === null
        ? 0 : Math.min(extraDurationMs, now() - completedAt))
      return elapsedMs
    },
    stop() {
      stopped = true
      audio?.pause()
    },
  }
}
