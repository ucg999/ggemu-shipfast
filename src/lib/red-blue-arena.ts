export type ArenaSide = 'red' | 'blue'
export type ArenaResult = ArenaSide | 'draw'

export const ARENA_MAX_HEALTH = 10
export const ARENA_ROUND_SECONDS = 60
export const ARENA_MIN_BET = 1
export const ARENA_MAX_BET = 100
export const ARENA_BET_OPTIONS = [1, 10, 50, 100] as const

export function arenaPayout(betSide: ArenaSide, result: ArenaResult, stake: number) {
  const safeStake = Math.max(0, Math.floor(stake))
  if (result === 'draw') return safeStake
  return result === betSide ? safeStake * 2 : 0
}

export function arenaResult(redHealth: number, blueHealth: number): ArenaResult {
  if (redHealth === blueHealth) return 'draw'
  return redHealth > blueHealth ? 'red' : 'blue'
}

export function arenaWeaponDamage(kind: string | null) {
  if (!kind) return 0
  if (kind === 'gun') return 3
  if (kind === 'sword') return 2
  return 1
}

export function weaponCollisionDamage(redWeapon: string | null, blueWeapon: string | null) {
  return {
    red: blueWeapon === 'staff' ? 0 : arenaWeaponDamage(blueWeapon),
    blue: redWeapon === 'staff' ? 0 : arenaWeaponDamage(redWeapon),
  }
}

export function healArenaHealth(health: number) {
  return Math.min(ARENA_MAX_HEALTH, Math.max(0, Math.floor(health)) + 1)
}

export function applyArenaShield(damage: number, shield: boolean) {
  return { damage: shield && damage > 0 ? 0 : damage, shield: shield && damage > 0 ? false : shield }
}
