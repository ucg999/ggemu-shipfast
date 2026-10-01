import { useEffect, useState, useSyncExternalStore } from 'react'

export const MEMBER_SESSION_EVENT = 'ucg999-member-session-change'
export const MEMBER_LOGIN_REQUEST_EVENT = 'ucg999-member-login-request'

export type MemberSession = {
  id: string
  username: string
  displayName: string
  coinBalance: number
  playerNumber: number
}

let currentMember: MemberSession | null = null
let memberSessionRequest: Promise<{ member: MemberSession | null; remainingToday: number }> | null = null
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

export function useRequiredMemberAccess(enabled = true) {
  const member = useMemberSession()
  const [checked, setChecked] = useState(!enabled)

  useEffect(() => {
    if (!enabled) {
      setChecked(true)
      return
    }
    let cancelled = false
    void getMemberSession().then(({ member: sessionMember }) => {
      if (cancelled) return
      setChecked(true)
      if (!sessionMember) window.setTimeout(requestMemberLogin, 100)
    }).catch(() => {
      if (cancelled) return
      setChecked(true)
      window.setTimeout(requestMemberLogin, 100)
    })
    return () => { cancelled = true }
  }, [enabled])

  return { checked, member }
}

export function requestMemberLogin() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEMBER_LOGIN_REQUEST_EVENT))
}

export async function getMemberSession() {
  if (memberSessionRequest) return memberSessionRequest

  memberSessionRequest = (async () => {
    const response = await fetch('/api/member', { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`member_session_request_failed:${response.status}`)
    const data = await response.json() as { member: MemberSession | null; remainingToday?: number }
    // Only a successful response is authoritative. A network/database error must
    // never turn a signed-in player into a guest in the browser.
    publishMember(data.member)
    return { member: data.member, remainingToday: data.remainingToday ?? 999 }
  })().finally(() => {
    memberSessionRequest = null
  })

  return memberSessionRequest
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
