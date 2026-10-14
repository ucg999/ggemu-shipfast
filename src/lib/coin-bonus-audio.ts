import * as Tone from 'tone'
import type { BonusKind } from './coin-bonus'

// Each reward has its own melody, timbre and timing; no audio downloads are needed.
const THEMES: Record<BonusKind, { notes: string[]; wave: 'sine' | 'triangle' | 'square'; step: number; release: number }> = {
  free: { notes:['C5','E5','G5'], wave:'sine', step:.10, release:.18 },
  'small-four': { notes:['C5','E5','G5','C6'], wave:'triangle', step:.17, release:.3 },
  'small-three': { notes:['E5','G5','B5'], wave:'triangle', step:.14, release:.24 },
  'fruit-double': { notes:['D5','D6','F#5','F#6','A6'], wave:'sine', step:.09, release:.22 },
  'all-bar': { notes:['G3','C4','E4','G4','C5','E5'], wave:'square', step:.18, release:.28 },
  five: { notes:['C5','D5','E5','G5','A5'], wave:'triangle', step:.12, release:.26 },
  'random-lights': { notes:['A4','C#5','E5'], wave:'sine', step:.16, release:.18 },
  'big-three': { notes:['C4','G4','C5'], wave:'square', step:.20, release:.30 },
  'all-fruits': { notes:['C5','E5','G5','C6'], wave:'triangle', step:.17, release:.3 },
  'big-four': { notes:['G4','B4','D5','G5'], wave:'triangle', step:.19, release:.32 },
  train: { notes:['C4','E4','G4','C5','E5','G5','C6'], wave:'square', step:.1, release:.2 },
  'all-stars': { notes:['C5','E5','G5','C6','E6','G6','C7','G6','E6','C6'], wave:'sine', step:.13, release:.55 },
}
type Bank = { context: Tone.Context; voices: Set<Tone.Synth>; timers: Set<ReturnType<typeof setTimeout>> }
const banks = new WeakMap<AudioContext, Bank>()

export function prepareBonusAudio(native: AudioContext) {
  if (banks.has(native) || native.state === 'closed') return
  // Use the game's clock without replacing Tone's global context used by other games.
  const context = new Tone.Context({ context: native, lookAhead: 0, latencyHint: 'interactive' })
  banks.set(native, { context, voices: new Set(), timers: new Set() })
}

export function playBonusSound(native: AudioContext | null, kind: BonusKind, stage: number, finale=false) {
  if (!native || native.state !== 'running') return
  prepareBonusAudio(native)
  const bank = banks.get(native)!
  const theme = THEMES[kind]
  const notes = finale ? theme.notes : [theme.notes[stage % theme.notes.length]]
  const start = native.currentTime + .005
  notes.forEach((note, index) => {
    const synth = new Tone.Synth({ context: bank.context, volume: theme.wave === 'square' ? -23 : -17,
      oscillator: { type: theme.wave }, envelope: { attack:.008, decay:.09, sustain:.18, release:theme.release },
    }).connect(native.destination)
    bank.voices.add(synth)
    synth.triggerAttackRelease(note, finale ? .14 : .08, start + index * theme.step, .65)
    const timer = setTimeout(() => {
      synth.dispose(); bank.voices.delete(synth); bank.timers.delete(timer)
    }, (index * theme.step + theme.release + .5) * 1000)
    bank.timers.add(timer)
  })
}

// Called only when the game is releasing its native AudioContext too.
export function disposeBonusAudio(native: AudioContext | null) {
  if (!native) return
  const bank = banks.get(native)
  if (!bank) return
  bank.timers.forEach(clearTimeout)
  bank.voices.forEach(voice => voice.dispose())
  bank.context.dispose()
  banks.delete(native)
}
