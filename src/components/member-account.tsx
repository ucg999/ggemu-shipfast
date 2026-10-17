import { useCallback, useEffect, useState } from 'react'

import type { Locale } from '#/lib/ggemu'
import { readCoinBalance, spendBrowserCoinBalance } from '#/lib/coin-wallet'
import {
  getMemberSession,
  logoutMember,
  MEMBER_LOGIN_REQUEST_EVENT,
  submitMemberCredentials,
  transferBrowserCoinsToMember,
  updateMemberNickname,
  updateMemberPassword,
  useMemberSession,
} from '#/lib/member-client'

export function MemberAccountButton({ locale }: { locale: Locale }) {
  const member = useMemberSession()
  const [isOpen, setIsOpen] = useState(false)
  const [securityOpen, setSecurityOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register' | 'reset-password'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [invitationCode, setInvitationCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [nicknameSetup, setNicknameSetup] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [remainingToday, setRemainingToday] = useState(999)
  const copy = getMemberCopy(locale)

  const refreshAccount = useCallback(async () => {
    try {
      const account = await getMemberSession()
      setRemainingToday(account.remainingToday)
    } catch {
      // A temporary network failure must not sign the player out locally.
    }
  }, [])

  useEffect(() => {
    let active = true
    void getMemberSession().then((account) => {
      if (!active) return
      setRemainingToday(account.remainingToday)
    }).catch(() => {
      // Keep the last known account visible while the service reconnects.
    })
    return () => {
      active = false
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

  useEffect(() => {
    if (!member?.needsNickname) return
    setNicknameSetup(true)
    setIsOpen(true)
  }, [member?.needsNickname])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const session = await submitMemberCredentials(mode, username, password, recoveryCode, invitationCode)
      const account = await getMemberSession()
      setRemainingToday(account.remainingToday)
      setPassword('')
      setInvitationCode('')
      setNicknameSetup(session.needsNickname)
      if (session.recoveryCode) setIssuedRecoveryCode(session.recoveryCode)
      else setIsOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  async function handleNickname(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateMemberNickname(nickname)
      setNickname('')
      setNicknameSetup(false)
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
    setNotice('')
    try {
      const result = await transferBrowserCoinsToMember(amount)
      if (!spendBrowserCoinBalance(result.transferred)) throw new Error(copy.browserInsufficient)
      setRemainingToday(result.remainingToday)
      setTransferAmount('')
      setNotice(copy.availableTomorrow)
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
        title={member ? member.displayName || copy.setNickname : copy.login}
        type="button"
      >
        <i className={member ? 'ri-user-smile-line' : 'ri-user-line'} />
        <span className="hidden max-w-24 truncate text-xs font-semibold lg:block">{member ? member.displayName || copy.setNickname : copy.login}</span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[180] grid place-items-center bg-black/55 p-4" onClick={() => { if (!member?.needsNickname) setIsOpen(false) }} role="presentation">
          <section aria-modal="true" className="max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-6 text-black shadow-2xl" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">{member ? copy.account : mode === 'login' ? copy.login : copy.register}</h2>
                <p className="mt-1 text-sm text-black/55">{copy.description}</p>
              </div>
              {!member?.needsNickname ? <button aria-label={copy.close} className="grid h-8 w-8 place-items-center rounded-full hover:bg-black/5" onClick={() => setIsOpen(false)} type="button">✕</button> : null}
            </div>

            <CoinEarningGuide locale={locale} />

            {member ? (
              <div className="mt-6">
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-sm text-black/55">{copy.signedInAs}</p>
                  <strong className="mt-1 block text-xl">{member.displayName || copy.nicknameRequired}</strong>
                  <p className="mt-0.5 text-xs text-black/45">{copy.loginAccount}：{member.username}</p>
                  <p className="mt-0.5 font-mono text-xs font-semibold tracking-wider text-black/55">ID：{String(member.playerNumber).padStart(5, '0')}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <p>{copy.browserCoins}：<b>{readCoinBalance()}</b></p>
                    <p>{copy.memberCoins}：<b>{member.coinBalance}</b></p>
                  </div>
                </div>
                <div className={`mt-4 overflow-hidden rounded-2xl border ${member.needsNickname ? 'border-amber-400 bg-amber-50' : 'border-black/10'}`}>
                  <button aria-expanded={nicknameSetup || member.needsNickname} className="flex h-12 w-full items-center justify-between px-3 text-sm font-semibold hover:bg-black/[0.03]" disabled={member.needsNickname} onClick={() => setNicknameSetup(current => !current)} type="button">
                    <span>{member.needsNickname ? copy.setNickname : copy.changeNickname}</span>
                    <i className={`ri-arrow-down-s-line text-lg transition-transform ${nicknameSetup || member.needsNickname ? 'rotate-180' : ''}`} />
                  </button>
                  {nicknameSetup || member.needsNickname ? <form className="border-t border-black/10 p-3" onSubmit={handleNickname}>
                    <p className="text-xs text-black/50">{copy.nicknameHint}</p>
                    <div className="mt-2 flex gap-2">
                      <input aria-label={copy.nickname} className="h-10 min-w-0 flex-1 rounded-xl border border-black/20 px-3 outline-none focus:border-black" maxLength={12} onChange={event => setNickname(event.target.value)} placeholder={copy.nickname} required value={nickname} />
                      <button className="h-10 shrink-0 rounded-xl bg-amber-400 px-4 text-sm font-semibold disabled:opacity-40" disabled={busy || !nickname.trim()} type="submit">{copy.saveNickname}</button>
                    </div>
                  </form> : null}
                </div>
                {!member.needsNickname ? <form className="mt-4" onSubmit={handleTransfer}>
                  <div className="flex gap-2">
                    <input aria-label={copy.transferAmount} className="h-11 min-w-0 flex-1 rounded-xl border border-black/20 px-3 outline-none focus:border-black" max={Math.min(999, remainingToday)} min="1" onChange={(event) => setTransferAmount(event.target.value)} placeholder={copy.transferAmount} type="number" value={transferAmount} />
                    <button className="h-11 shrink-0 rounded-xl bg-amber-400 px-4 font-semibold disabled:opacity-50" disabled={busy || remainingToday <= 0} type="submit">{copy.transfer}</button>
                  </div>
                  <p className="mt-2 text-xs text-black/50">{copy.remainingToday.replace('{count}', String(remainingToday))}</p>
                  {notice ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p> : null}
                  {error ? <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
                </form> : null}
                {!member.needsNickname ? <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                  <button aria-expanded={securityOpen} className="flex h-12 w-full items-center justify-between px-3 text-sm font-semibold hover:bg-black/[0.03]" onClick={() => setSecurityOpen(current => !current)} type="button">
                    <span>{copy.security}</span>
                    <i className={`ri-arrow-down-s-line text-lg transition-transform ${securityOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {securityOpen ? (
                    <div className="border-t border-black/10 p-3 pt-1">
                      <PasswordInput className="mt-2 h-10 w-full rounded-xl border border-black/20 px-3 pr-10 text-sm" onChange={setCurrentPassword} placeholder={copy.currentPassword} value={currentPassword} />
                      <PasswordInput className="mt-2 h-10 w-full rounded-xl border border-black/20 px-3 pr-10 text-sm" maxLength={12} minLength={8} onChange={setNewPassword} placeholder={copy.newPassword} value={newPassword} />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button className="h-10 rounded-xl bg-amber-300 text-xs font-semibold text-black disabled:opacity-40" disabled={busy || !currentPassword || newPassword.length < 8 || newPassword.length > 12} onClick={() => void handleSecurity('change-password')} type="button">{copy.changePassword}</button>
                        <button className="h-10 rounded-xl border border-black/20 text-xs font-semibold disabled:opacity-40" disabled={busy || !currentPassword} onClick={() => void handleSecurity('new-recovery-code')} type="button">{copy.newRecoveryCode}</button>
                      </div>
                    </div>
                  ) : null}
                </div> : null}
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
                  <label className="block text-sm font-medium">{copy.username}<input autoComplete="username" className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 outline-none focus:border-black" maxLength={20} minLength={mode === 'register' ? 6 : 1} onChange={(event) => setUsername(event.target.value)} pattern={mode === 'register' ? '[A-Za-z0-9_]{6,20}' : undefined} required value={username} /></label>
                  {mode === 'register' ? <p className="-mt-1 text-xs text-black/50">{copy.usernameHint}</p> : null}
                  <label className="block text-sm font-medium">{mode === 'reset-password' ? copy.newPassword : copy.password}<PasswordInput autoComplete={mode === 'register' || mode === 'reset-password' ? 'new-password' : 'current-password'} className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 pr-10 outline-none focus:border-black" maxLength={mode === 'login' ? 72 : 12} minLength={8} onChange={setPassword} required value={password} /></label>
                  {mode === 'reset-password' ? <label className="block text-sm font-medium">{copy.recoveryCode}<input className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 uppercase outline-none focus:border-black" onChange={event => setRecoveryCode(event.target.value)} required value={recoveryCode} /></label> : null}
                  {mode === 'register' ? <label className="block text-sm font-medium">{copy.invitationCode}<input autoComplete="off" className="mt-1 h-11 w-full rounded-xl border border-black/20 px-3 font-mono uppercase tracking-wider outline-none focus:border-black" maxLength={15} onChange={event => setInvitationCode(event.target.value.toUpperCase())} placeholder="UCG-XXXXX-XXXXX" required value={invitationCode} /></label> : null}
                  {mode === 'register' ? <p className="-mt-1 text-xs leading-5 text-black/50">{copy.invitationHint}</p> : null}
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

function CoinEarningGuide({ locale }: { locale: Locale }) {
  const isEnglish = locale === 'en'
  return (
    <details className="mt-4 overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/70">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-amber-950">
        <span className="flex items-center gap-2"><i className="ri-coin-line text-amber-600" />{isEnglish ? 'How to earn game coins' : '游戏币如何获得？'}</span>
        <i className="ri-arrow-down-s-line text-lg" />
      </summary>
      <div className="border-t border-amber-200 px-4 py-3 text-xs leading-5 text-black/70">
        {isEnglish ? (
          <><ul className="list-disc space-y-1.5 pl-4">
            <li><b>Play games:</b> rewards settle after each complete 5-minute period. Incomplete periods do not award coins, and ordinary sessions are capped at 50 coins.</li>
            <li><b>Console Mode:</b> game rewards use a 2× bonus and are capped at 100 coins per session.</li>
            <li><b>Daily check-in and watching others:</b> both can award coins; consecutive check-ins increase the check-in multiplier.</li>
            <li><b>Share the website:</b> after completing and confirming a share, receive 100 coins once per account or IP each day.</li>
            <li><b>Page coins:</b> collect coins appearing on the home page or inner pages. These fixed/random pickups do not use multipliers.</li>
            <li><b>Member bonuses:</b> rank and check-in multipliers are added together for eligible game and viewing rewards. Guests always use 1×.</li>
            <li><b>Saving coins:</b> browser coins and player coins are separate. After signing in, you can save up to 999 browser coins each day; saved coins become available the next day (Beijing time).</li>
          </ul>
          <div className="mt-3 rounded-xl border border-amber-300 bg-white/80 p-3">
            <strong className="flex items-center gap-1.5 text-sm text-amber-800"><i className="ri-trophy-line" />Weekly grand prizes</strong>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li><b>Weekly Wanted:</b> ranked by valid time. First place receives 5,000 coins, second 2,000, and third 500. Guests may participate and claim rewards into the current browser.</li>
              <li><b>Coin Entertainment weekly:</b> the highest single bonus-pool cash-out of the week wins 2,000 coins. It is not based on accumulated cash-outs.</li>
              <li><b>Red–Blue Arena weekly:</b> if the total Arrest value exceeds the total Bounty value, the top Arrest player receives the difference between the two totals.</li>
              <li><b>Settlement and claim:</b> weekly boards settle every Monday at 03:00 China time. Winners must open the corresponding page and claim within 24 hours; expired rewards cannot be recovered.</li>
            </ul>
          </div></>
        ) : (
          <><ul className="list-disc space-y-1.5 pl-4">
            <li><b>游玩游戏：</b>每完整游玩5分钟结算一次，不足5分钟不发币；普通游戏单局最多获得50币。</li>
            <li><b>主机模式：</b>游玩结算享受双倍金币，单局最高100币。</li>
            <li><b>每日签到、看别人玩：</b>都可以获得金币；连续签到会提高签到倍数。</li>
            <li><b>分享网站：</b>好友从另一台设备打开你的专属分享链接后获得100币；自己打开、只点按钮或取消分享不计奖励，同一账号或IP每天限领一次。</li>
            <li><b>页面捡金币：</b>首页和内页会出现可收集金币；这类固定或随机金币不参与倍数。</li>
            <li><b>玩家倍数：</b>符合条件的游玩和观看奖励，会将段位倍数与连续签到倍数相加；游客固定为1倍。</li>
            <li><b>保存金币：</b>浏览器金币与玩家金币相互独立；登录后每天最多可主动存入999个，按北京时间次日统一更新为可用玩家金币。</li>
          </ul>
          <div className="mt-3 rounded-xl border border-amber-300 bg-white/80 p-3">
            <strong className="flex items-center gap-1.5 text-sm text-amber-800"><i className="ri-trophy-line" />各种周榜大奖</strong>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li><b>悬赏令周榜：</b>按有效时间排名；第一名奖5000币、第二名奖2000币、第三名奖500币。游客也可参赛，获奖后领到当前浏览器。</li>
              <li><b>金币娱乐周榜：</b>按本周“单次奖池退币”的最高纪录排名，不累计；冠军奖2000币。</li>
              <li><b>幽灵捕手周榜：</b>按本周最高连续过关数排名；冠军奖1000币，游客可玩但不参与排名。</li>
              <li><b>红蓝竞技周榜：</b>逮捕令全榜总和高于悬赏令全榜总和时，逮捕令第一名获得“两榜总和的差额”金币。</li>
              <li><b>结算与领奖：</b>以上周榜均在北京时间每周一03:00结算。获奖后要进入对应页面弹窗领取，必须在24小时内领取，过期无法补领。</li>
            </ul>
          </div></>
        )}
      </div>
    </details>
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
  if (locale === 'en') return {
    account: 'Member account', availableTomorrow: 'Saved successfully. These coins will become available tomorrow (Beijing time).', browserCoins: 'Browser coins', browserInsufficient: 'Not enough browser coins', changeNickname: 'Change nickname', changePassword: 'Change password', close: 'Close', create: 'Create account', currentPassword: 'Current password', dailyLimit: 'You can transfer {count} more coins today', description: 'Player accounts are only used to save coins and access some special games. Most games can be played without registering.', failed: 'Something went wrong', forgot: 'Forgot', invalidAmount: 'Enter a valid coin amount', invitationCode: 'Group invitation code', invitationHint: 'Join any QQ, WeChat, Xiaohongshu, or Douyin group and ask the group owner for a code.', login: 'Sign in', loginAccount: 'Login username', logout: 'Sign out', member: 'Member', memberCoins: 'Member coins', newPassword: 'New password (8–12 characters)', newRecoveryCode: 'New recovery code', nickname: 'Display nickname', nicknameHint: 'Chinese, English letters and numbers only; up to 12 characters total and no more than 6 Chinese characters. It can be changed once every 30 days.', nicknameRequired: 'Nickname required', password: 'Password', recoveryCode: 'Recovery code', recoveryWarning: 'Save this code now. It is shown only once and is required if you forget your password.', register: 'Register', remainingToday: 'Daily transfer allowance remaining: {count}/999 · available tomorrow', resetPassword: 'Reset password', saveNickname: 'Save', security: 'Account security', separateHint: 'A leaderboard nickname will be generated automatically and can be changed later. Your browser coins stay on this device.', setNickname: 'Set your nickname', signedInAs: 'Signed in as', transfer: 'Save', transferAmount: 'Coin amount', username: 'Username', usernameHint: 'Use 6–20 letters, numbers, or underscores. This is your login name.', wait: 'Please wait…',
  }
  return {
    account: '玩家账号', availableTomorrow: '已存入待到账，按北京时间次日统一更新为可用玩家金币。', browserCoins: '浏览器金币', browserInsufficient: '浏览器金币不足', changeNickname: '修改昵称', changePassword: '修改密码', close: '关闭', create: '创建玩家账号', currentPassword: '当前密码', dailyLimit: '今天最多还能转入 {count} 个金币', description: '玩家账号只存放金币和玩一些特殊游戏，不用注册也可以玩大部分游戏。', failed: '操作失败，请稍后重试', forgot: '忘记密码', invalidAmount: '请输入正确的金币数量', invitationCode: '群邀请码', invitationHint: '加入任何群（Q群、微信、小红书、抖音）可向群主索取一个。', login: '登录', loginAccount: '登录账号', logout: '退出登录', member: '玩家', memberCoins: '玩家金币', newPassword: '新密码（8–12位）', newRecoveryCode: '生成恢复码', nickname: '展示昵称', nicknameHint: '只能使用中文、英文字母和数字；总长1–12个字符，其中中文最多6个字；修改后需等待30天才能再次修改。', nicknameRequired: '请先设置昵称', password: '密码', recoveryCode: '账号恢复码', recoveryWarning: '请立即保存恢复码。它只显示一次，忘记密码时必须使用。', register: '注册', remainingToday: '今日还可转入 {count}/999 个 · 次日到账', resetPassword: '重置密码', saveNickname: '保存', security: '账号安全', separateHint: '系统会自动生成排行榜昵称，注册后可自行修改；浏览器金币仍保留在当前设备。', setNickname: '设置昵称', signedInAs: '当前玩家', transfer: '转入玩家账号', transferAmount: '转入数量', username: '用户名', usernameHint: '只允许字母、数字和下划线，长度为6–20位；这是以后登录使用的账号。', wait: '请稍候…',
  }
}

function RecoveryCodeNotice({ code, copy, onDone }: { code: string; copy: ReturnType<typeof getMemberCopy>; onDone: () => void }) {
  return <div className="mt-3 rounded-2xl bg-amber-100 p-3 text-center"><p className="text-xs text-black/65">{copy.recoveryWarning}</p><strong className="mt-2 block select-all font-mono text-lg tracking-wider">{code}</strong><button className="mt-2 text-xs underline" onClick={onDone} type="button">{copy.close}</button></div>
}
