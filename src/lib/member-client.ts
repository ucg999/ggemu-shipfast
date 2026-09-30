import { useSyncExternalStore } from 'react'

export const MEMBER_SESSION_EVENT = 'ucg999-member-session-change'

export type MemberSession = {
  id: string
  username: string
  displayName: string
  coinBalance: number
  playerNumber: number
}

let currentMember: MemberSession | null = null
const memberListeners = new Set<() => void>()

function publishMember(member: MemberSession | null) {
  currentMember = member
  memberListeners.forEach(listener => listener())
  if (typeof window !== 'undefined') {
    document.documentElement.dataset.memberLoggedIn = member ? 'true' : 'false'
    window.dispatchEvent(new CustomEvent(MEMBER_SESSION_EVENT, { detail: member }))
  }
}

export function useMemberSession() {
  return useSyncExternalStore(
    listener => {
      memberListeners.add(listener)
      return () => memberListeners.delete(listener)
    },
    () => currentMember,
    () => null,
  )
}

export async function getMemberSession() {
  const response = await fetch('/api/member', { credentials: 'same-origin' })
  if (!response.ok) {
    publishMember(null)
    return { member: null, remainingToday: 999 }
  }
  const data = await response.json() as { member: MemberSession | null; remainingToday?: number }
  publishMember(data.member)
  return { member: data.member, remainingToday: data.remainingToday ?? 999 }
}

export async function submitMemberCredentials(action: 'login' | 'register' | 'reset-password', username: string, password: string, recoveryCode?: string) {
  const response = await fetch('/api/member', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, username, password, recoveryCode }),
  })
  const data = await response.json() as { error?: string; member?: MemberSession; recoveryCode?: string }
  if (!response.ok || !data.member) throw new Error(data.error || '操作失败')
  publishMember(data.member)
  return { member: data.member, recoveryCode: data.recoveryCode }
}

export async function updateMemberPassword(action: 'change-password' | 'new-recovery-code', currentPassword: string, newPassword?: string) {
  const response = await fetch('/api/member', {
    method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, currentPassword, newPassword }),
  })
  const data = await response.json() as { error?: string; recoveryCode?: string }
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data
}

export async function logoutMember() {
  await fetch('/api/member', { method: 'DELETE', credentials: 'same-origin' })
  publishMember(null)
}

export async function transferBrowserCoinsToMember(amount: number) {
  const response = await fetch('/api/member', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, idempotencyKey: crypto.randomUUID() }),
  })
  const data = await response.json() as { error?: string; member?: MemberSession; remainingToday?: number; transferred?: number }
  if (!response.ok || !data.member || !data.transferred) throw new Error(data.error || '转入失败')
  publishMember(data.member)
  return { member: data.member, remainingToday: data.remainingToday ?? 0, transferred: data.transferred }
}

export function spendMemberCoinsOptimistic(amount: number) {
  const cost = Math.max(0, Math.floor(amount))
  if (cost === 0) return true
  if (!currentMember || currentMember.coinBalance < cost) return false

  const previous = currentMember
  publishMember({ ...previous, coinBalance: previous.coinBalance - cost })
  void fetch('/api/member', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'spend', amount: cost, idempotencyKey: crypto.randomUUID() }),
  }).then(async (response) => {
    const data = await response.json() as { member?: MemberSession }
    if (!response.ok || !data.member) throw new Error('member_coin_spend_failed')
    publishMember(data.member)
  }).catch(async () => {
    const account = await getMemberSession().catch(() => null)
    if (!account?.member) publishMember(previous)
  })
  return true
}
