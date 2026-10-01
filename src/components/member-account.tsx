import { useCallback, useEffect, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { readCoinBalance, spendBrowserCoinBalance } from '#/lib/coin-wallet'
import {
  getMemberSession,
  logoutMember,
  MEMBER_LOGIN_REQUEST_EVENT,
  MEMBER_SESSION_EVENT,
  submitMemberCredentials,
  transferBrowserCoinsToMember,
  updateMemberPassword,
  type MemberSession,
} from '#/lib/member-client'

export function MemberAccountButton({ locale }: { locale: Locale }) {
  const [member, setMember] = useState<MemberSession | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'reset-password'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [remainingToday, setRemainingToday] = useState(999)
  const copy = getMemberCopy(locale)

  const refreshAccount = useCallback(async () => {
    try {
      const account = await getMemberSession()
      setMember(account.member)
      setRemainingToday(account.remainingToday)
    } catch {
      // A temporary network failure must not sign the player out locally.
    }
  }, [])

  useEffect(() => {
    let active = true
    void getMemberSession().then((account) => {
      if (!active) return
      setMember(account.member)
      setRemainingToday(account.remainingToday)
    }).catch(() => setMember(null))
    const handleSession = (event: Event) => setMember((event as CustomEvent<MemberSession | null>).detail)
    window.addEventListener(MEMBER_SESSION_EVENT, handleSession)
    return () => {
      active = false
      window.removeEventListener(MEMBER_SESSION_EVENT, handleSession)
    }
  }, [])

  useEffect(() => {
    const openLogin = () => {
      setMode('login')
      setError('')
      setIsOpen(true)
    }
    window.addEventListener(MEMBER_LOGIN_REQUEST_EVENT, openLogin)
    return () => window.removeEventListener(MEMBER_LOGIN_REQUEST_EVENT, openLogin)
  }, [])

  useEffect(() => {
    if (!member) return
    const refresh = () => void refreshAccount()
    const timer = isOpen ? window.setInterval(refresh, 5_000) : undefined
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      if (timer) window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [isOpen, member?.id, refreshAccount])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await submitMemberCredentials(mode, username, password, recoveryCode)
      setMember(session.member)
      const account = await getMemberSession()
      setRemainingToday(account.remainingToday)
      setPassword('')
      if (session.recoveryCode) setIssuedRecoveryCode(session.recoveryCode)
      else setIsOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  async function handleSecurity(action: 'change-password' | 'new-recovery-code') {
    setBusy(true); setError('')
    try {
      const result = await updateMemberPassword(action, currentPassword, newPassword)
      if (result.recoveryCode) setIssuedRecoveryCode(result.recoveryCode)
      setCurrentPassword(''); setNewPassword('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.failed) }
    finally { setBusy(false) }
  }

  async function handleTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Math.floor(Number(transferAmount))
    const browserBalance = readCoinBalance()
    if (!Number.isFinite(amount) || amount < 1) return setError(copy.invalidAmount)
    if (amount > browserBalance) return setError(copy.browserInsufficient)
    if (amount > remainingToday) return setError(copy.dailyLimit.replace('{count}', String(remainingToday)))
    setBusy(true)
    setError('')
    try {
      const result = await transferBrowserCoinsToMember(amount)
      if (!spendBrowserCoinBalance(result.transferred)) throw new Error(copy.browserInsufficient)
      setMember(result.member)
      setRemainingToday(result.remainingToday)
      setTransferAmount('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      await logoutMember()
      setMember(null)
      setIsOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        aria-label={member ? `${copy.member}: ${member.displayName}` : copy.login}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-black/25 text-sm text-current transition hover:border-black lg:h-9 lg:w-auto lg:grid-flow-col lg:gap-1.5 lg:px-3"
        onClick={() => { setSecurityOpen(false); setIsOpen(true); void refreshAccount() }}
        title={member ? member.displayName : copy.login}
        type="button"
      >
        <i className={member ? 'ri-user-smile-line' : 'ri-user-line'} />
        <span className="hidden max-w-24 truncate text-xs font-semibold lg:block">{member?.displayName ?? copy.login}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[180] grid place-items-center bg-black/55 p-4" onClick={() => setIsOpen(false)} role="presentation">
          <section aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white p-6 text-black shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{member ? copy.account : mode === 'login' ? copy.login : copy.register}</h2>
                <p className="mt-1 text-sm text-black/55">{copy.description}</p>
              </div>
              <button aria-label={copy.close} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5" onClick={() => setIsOpen(false)} type="button">✕</button>
            </div>

            {member ? (
              <div className="mt-6">
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm text-black/55">{copy.signedInAs}</p>
                  <strong className="mt-1 block text-xl">{member.displayName}</strong>
                  <p className="mt-0.5 font-mono text-xs font-semibold tracking-wider text-black/55">ID：{String(member.playerNumber).padStart(5, '0')}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p>{copy.browserCoins}：<b>{readCoinBalance()}</b></p>
                    <p>{copy.memberCoins}：<b>{member.coinBalance}</b></p>
                  </div>
                </div>
                <form className="mt-4" onSubmit={handleTransfer}>
                  <div className="flex gap-2">
                    <input aria-label={copy.transferAmount} className="h-11 min-w-0 flex-1 rounded-xl border border-black/20 px-3 outline-none focus:border-black" max={Math.min(999, remainingToday)} min="1" onChange={(event) => setTransferAmount(event.target.value)} placeholder={copy.transferAmount} type="number" value={transferAmount} />
                    <button className="h-11 shrink-0 rounded-xl bg-amber-400 px-4 font-semibold disabled:opacity-50" disabled={busy || remainingToday <= 0} type="submit">{copy.transfer}</button>
                  </div>
                  <p className="mt-2 text-xs text-black/50">{copy.remainingToday.replace('{count}', String(remainingToday))}</p>
                  {error ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
                </form>
                <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                  <button aria-expanded={securityOpen} className="flex h-12 w-full items-center justify-between px-3 text-sm font-semibold hover:bg-black/[0.03]" onClick={() => setSecurityOpen(current => !current)} type="button">
                    <span>{copy.security}</span>
                    <i className={`ri-arrow-down-s-line text-lg transition-transform ${securityOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {securityOpen ? (
                    <div className="border-t border-black/10 p-3 pt-1">
                      <PasswordInput className="mt-2 h-10 w-full rounded-xl border border-black/20 px-3 pr-10 text-sm" onChange={setCurrentPassword} placeholder={copy.currentPassword} value={currentPassword} />
                      <PasswordInput className="mt-2 h-10 w-full rounded-xl border border-black/20 px-3 pr-10 text-sm" minLength={8} onChange={setNewPassword} placeholder={copy.newPassword} value={newPassword} />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button className="h-10 rounded-xl bg-amber-300 text-xs font-semibold text-black disabled:opacity-40" disabled={busy || !currentPassword || newPassword.length < 8} onClick={() => void handleSecurity('change-password')} type="button">{copy.changePassword}</button>
                        <button className="h-10 rounded-xl border border-black/20 text-xs font-semibold disabled:opacity-40" disabled={busy || !currentPassword} onClick={() => void handleSecurity('new-recovery-code')} type="button">{copy.newRecoveryCode}</button>
                      </div>
                    </div>
                  ) : null}
                </div>
                {issuedRecoveryCode ? <RecoveryCodeNotice code={issuedRecoveryCode} copy={copy} onDone={() => setIssuedRecoveryCode('')} /> : null}
                <button className="mt-4 h-11 w-full rounded-full border border-black/25 font-medium hover:bg-black/5" disabled={busy} onClick={handleLogout} type="button">{copy.logout}</button>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 rounded-full bg-black/5 p-1">
                  <button className={`h-9 rounded-full text-sm ${mode === 'login' ? 'bg-black text-white' : ''}`} onClick={() => { setMode('login'); setError('') }} type="button">{copy.login}</button>
                  <button className={`h-9 rounded-full text-sm ${mode === 'register' ? 'bg-black text-white' : ''}`} onClick={() => { setMode('register'); setError('') }} type="button">{copy.register}</button>
                  <button className={`h-9 rounded-full text-xs ${mode === 'reset-password' ? 'bg-black text-white' : ''}`} onClick={() => { setMode('reset-password'); setError('') }} type="button">{copy.forgot}</button>
                </div>
                <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
                  <label className="block text-sm font-medium">{copy.username}<input autoComplete="username" className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 outline-none focus:border-black" maxLength={24} minLength={3} onChange={(event) => setUsername(event.target.value)} required value={username} /></label>
                  <label className="block text-sm font-medium">{mode === 'reset-password' ? copy.newPassword : copy.password}<PasswordInput autoComplete={mode === 'register' || mode === 'reset-password' ? 'new-password' : 'current-password'} className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 pr-10 outline-none focus:border-black" maxLength={72} minLength={8} onChange={setPassword} required value={password} /></label>
                  {mode === 'reset-password' ? <label className="block text-sm font-medium">{copy.recoveryCode}<input className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 uppercase outline-none focus:border-black" onChange={event => setRecoveryCode(event.target.value)} required value={recoveryCode} /></label> : null}
                  {mode === 'register' ? <p className="text-xs text-black/50">{copy.separateHint}</p> : null}
                  {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
                  <button className="h-11 w-full rounded-full bg-amber-400 font-semibold text-black hover:bg-amber-300 disabled:opacity-50" disabled={busy} type="submit">{busy ? copy.wait : mode === 'login' ? copy.login : mode === 'register' ? copy.create : copy.resetPassword}</button>
                  {issuedRecoveryCode ? <RecoveryCodeNotice code={issuedRecoveryCode} copy={copy} onDone={() => { setIssuedRecoveryCode(''); setIsOpen(false) }} /> : null}
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  )
}

function PasswordInput({ className, onChange, ...props }: {
  className: string
  onChange: (value: string) => void
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'onChange' | 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative block">
      <input {...props} className={className} onChange={event => onChange(event.target.value)} type={visible ? 'text' : 'password'} />
      <button
        aria-label={visible ? '隐藏密码' : '显示密码'}
        className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-base text-black/55 hover:bg-black/5 hover:text-black"
        onClick={() => setVisible(value => !value)}
        tabIndex={-1}
        title={visible ? '隐藏密码' : '显示密码'}
        type="button"
      ><i aria-hidden="true" className={visible ? 'ri-eye-off-line' : 'ri-eye-line'} /></button>
    </span>
  )
}

function getMemberCopy(locale: Locale) {
  if (locale === 'en') return { account: 'Member account', browserCoins: 'Browser coins', browserInsufficient: 'Not enough browser coins', changePassword: 'Change password', close: 'Close', create: 'Create account', currentPassword: 'Current password', dailyLimit: 'You can transfer {count} more coins today', description: 'Browser coins and member coins are kept separately.', failed: 'Something went wrong', forgot: 'Forgot', invalidAmount: 'Enter a valid coin amount', login: 'Sign in', logout: 'Sign out', member: 'Member', memberCoins: 'Member coins', newPassword: 'New password', newRecoveryCode: 'New recovery code', password: 'New password', recoveryCode: 'Recovery code', recoveryWarning: 'Save this code now. It is shown only once and is required if you forget your password.', register: 'Register', remainingToday: 'Daily transfer allowance remaining: {count}/999', resetPassword: 'Reset password', security: 'Account security', separateHint: 'Your browser coins stay on this device. Transfer them manually after signing in.', signedInAs: 'Signed in as', transfer: 'Save', transferAmount: 'Coin amount', username: 'Username', wait: 'Please wait…' }
  return { account: '玩家账号', browserCoins: '浏览器金币', browserInsufficient: '浏览器金币不足', changePassword: '修改密码', close: '关闭', create: '创建玩家账号', currentPassword: '当前密码', dailyLimit: '今天最多还能转入 {count} 个金币', description: '浏览器金币与玩家金币相互独立，登录后可主动转入保存。', failed: '操作失败，请稍后重试', forgot: '忘记密码', invalidAmount: '请输入正确的金币数量', login: '登录', logout: '退出登录', member: '玩家', memberCoins: '玩家金币', newPassword: '新密码（至少8位）', newRecoveryCode: '生成恢复码', password: '密码', recoveryCode: '账号恢复码', recoveryWarning: '请立即保存恢复码。它只显示一次，忘记密码时必须使用。', register: '注册', remainingToday: '今日还可转入 {count}/999 个', resetPassword: '重置密码', security: '账号安全', separateHint: '浏览器金币仍保留在当前设备，登录后可自行选择转入玩家账号。', signedInAs: '当前玩家', transfer: '转入玩家账号', transferAmount: '转入数量', username: '用户名', wait: '请稍候…' }
}

function RecoveryCodeNotice({ code, copy, onDone }: { code: string; copy: ReturnType<typeof getMemberCopy>; onDone: () => void }) {
  return <div className="mt-3 rounded-2xl bg-amber-100 p-3 text-center"><p className="text-xs text-black/65">{copy.recoveryWarning}</p><strong className="mt-2 block select-all font-mono text-lg tracking-wider">{code}</strong><button className="mt-2 text-xs underline" onClick={onDone} type="button">{copy.close}</button></div>
}
