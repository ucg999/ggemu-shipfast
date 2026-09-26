import * as Tone from 'tone'

export type ArenaSound = 'start' | 'wall' | 'collision' | 'pickup' | 'weapon' | 'clash' | 'reaper' | 'shock' | 'shatter'

export type ArenaAudio = {
  start: () => Promise<void>
  play: (sound: ArenaSound) => void
  dispose: () => void
}

export function createArenaAudio(): ArenaAudio {
  const output = new Tone.Gain(.2).toDestination()
  const tone = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: .003, decay: .08, sustain: 0, release: .08 } }).connect(output)
  const impact = new Tone.MembraneSynth({ pitchDecay: .025, octaves: 3, envelope: { attack: .001, decay: .12, sustain: 0, release: .08 } }).connect(output)
  const metal = new Tone.FMSynth({ harmonicity: 4, modulationIndex: 12, envelope: { attack: .002, decay: .12, sustain: 0, release: .1 }, modulationEnvelope: { attack: .001, decay: .08, sustain: 0, release: .05 } }).connect(output)
  const clash = new Tone.MetalSynth({ frequency: 260, harmonicity: 5.1, modulationIndex: 28, resonance: 4200, octaves: 1.8, envelope: { attack: .001, decay: .18, release: .12 } }).connect(output)
  const noise = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: .001, decay: .11, sustain: 0, release: .04 } }).connect(output)
  const lastPlayed = new Map<ArenaSound, number>()
  let active = false

  async function start() {
    await Tone.start()
    active = true
  }

  function play(sound: ArenaSound) {
    if (!active) return
    try {
      const nowMs = performance.now(); const last = lastPlayed.get(sound) ?? -Infinity
      const cooldown = sound === 'wall' || sound === 'collision' ? 70 : 25
      if (nowMs - last < cooldown) return
      lastPlayed.set(sound, nowMs)
      const now = Tone.now()
      if (sound === 'start') { tone.triggerAttackRelease('C5', .06, now); tone.triggerAttackRelease('G5', .08, now + .07) }
      else if (sound === 'wall') impact.triggerAttackRelease('C2', .045, now, .35)
      else if (sound === 'collision') impact.triggerAttackRelease('G2', .055, now, .48)
      else if (sound === 'pickup') { tone.triggerAttackRelease('E6', .045, now, .45); tone.triggerAttackRelease('A6', .07, now + .045, .4) }
      else if (sound === 'weapon') { noise.triggerAttackRelease(.075, now, .32); metal.triggerAttackRelease('D4', .07, now, .38) }
      else if (sound === 'clash') { clash.triggerAttackRelease(.16, now, .95); impact.triggerAttackRelease('G1', .11, now, .6); noise.triggerAttackRelease(.065, now, .32) }
      else if (sound === 'reaper') { noise.triggerAttackRelease(.2, now, .62); metal.triggerAttackRelease('C3', .19, now, .72); metal.triggerAttackRelease('G3', .08, now + .12, .5) }
      else if (sound === 'shock') { metal.triggerAttackRelease('C6', .06, now, .42); metal.triggerAttackRelease('F5', .1, now + .055, .4) }
      else { noise.triggerAttackRelease(.28, now, .7); impact.triggerAttackRelease('C1', .22, now, .7) }
    } catch {
      // Audio scheduling must never interrupt the animation loop.
    }
  }

  function dispose() {
    tone.dispose(); impact.dispose(); metal.dispose(); clash.dispose(); noise.dispose(); output.dispose()
  }

  return { start, play, dispose }
}
