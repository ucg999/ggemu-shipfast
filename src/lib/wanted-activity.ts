export function weightedPlayMinutes(minutes: number, activeMinutes: unknown, multiplier: number) {
  const value = Number(activeMinutes)
  const active = Number.isFinite(value) ? Math.min(minutes, Math.max(0, Math.floor(value))) : 0
  return minutes + active * (multiplier - 1)
}

export class WantedActivityClock {
  elapsed = 0
  private interacted = false
  tick(delta: number) { this.elapsed += Math.max(0, Math.min(5000, delta)) }
  interact(trusted: boolean) { if (trusted) this.interacted = true }
  activeMinutes(limit: number) { return this.interacted ? Math.min(limit, Math.floor(this.elapsed / 60000)) : 0 }
}
