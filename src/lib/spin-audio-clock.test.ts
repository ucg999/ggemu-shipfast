import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createSpinAudioClock } from './spin-audio-clock.ts'

function setup(play = () => Promise.resolve(), extraDurationMs = 0) {
  let time = 0
  let pauses = 0
  const media = {
    currentTime: 0, duration: Number.NaN, ended: false, error: null,
    pause: () => { pauses += 1 }, play,
  }
  const clock = createSpinAudioClock(media as unknown as HTMLAudioElement, 5000, () => time, extraDurationMs)
  return { media, clock, tick: (ms: number) => { time += ms }, pauses: () => pauses }
}

test('delayed loading and buffering do not advance lights; media time catches up after a delayed frame', () => {
  const { media, clock, tick } = setup()
  tick(3000)
  assert.equal(clock.elapsed(), 0)
  media.duration = 10
  media.currentTime = 2
  assert.equal(clock.elapsed(), 1000)
  tick(4000)
  assert.equal(clock.elapsed(), 1000)
  media.currentTime = 8
  assert.equal(clock.elapsed(), 4000)
  media.ended = true
  assert.equal(clock.elapsed(), 5000)
})

test('stalled audio switches to continuous silent progress and cancels late playback', async () => {
  let resolve!: () => void
  const { media, clock, tick, pauses } = setup(() => new Promise<void>((done) => { resolve = done }))
  media.duration = 10
  media.currentTime = 2
  assert.equal(clock.elapsed(), 1000)
  tick(15000)
  assert.equal(clock.elapsed(), 1000)
  tick(1000)
  assert.equal(clock.elapsed(), 2000)
  const before = pauses()
  resolve()
  await Promise.resolve()
  assert.equal(pauses(), before + 1)
})

test('lights continue for a tenth of a second after the audio timeline', () => {
  const { media, clock, tick } = setup(undefined, 100)
  media.duration = 10
  media.currentTime = 10
  assert.equal(clock.elapsed(), 5000)
  tick(50)
  assert.equal(clock.elapsed(), 5050)
  tick(50)
  assert.equal(clock.elapsed(), 5100)
  tick(1000)
  assert.equal(clock.elapsed(), 5100)
})

test('blocked playback finishes silently; stopping freezes progress', async () => {
  const { clock, tick } = setup(() => Promise.reject(new Error('blocked')))
  await Promise.resolve()
  await Promise.resolve()
  tick(2500)
  assert.equal(clock.elapsed(), 2500)
  clock.stop()
  tick(2500)
  assert.equal(clock.elapsed(), 2500)
})
