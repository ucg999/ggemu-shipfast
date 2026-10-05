import { useEffect, useState, type ReactNode } from 'react'

import { SiteLayout } from '#/components/site-layout'
import type { Locale } from '#/lib/ggemu'
import { claimGuestLibraryDetail } from '#/lib/guest-access'
import { getMemberSession, requestMemberLogin } from '#/lib/member-client'

export function GuestLibraryDetailGate({ children, gameId, locale, platform }: { children: ReactNode; gameId: string; locale: Locale; platform: 'psp' | 'switch' }) {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking')

  useEffect(() => {
    let active = true
    void getMemberSession().then(({ member }) => {
      if (!active) return
      setAccess(member || claimGuestLibraryDetail(platform, gameId) ? 'allowed' : 'denied')
    }).catch(() => {
      if (active) setAccess(claimGuestLibraryDetail(platform, gameId) ? 'allowed' : 'denied')
    })
    return () => { active = false }
  }, [gameId, platform])

  if (access === 'allowed') return children
  return <SiteLayout locale={locale} hideFooter>
    <main className="flex min-h-[70vh] items-center justify-center bg-base-200 px-4">
      {access === 'denied' ? <section className="max-w-md rounded-2xl bg-base-100 p-7 text-center shadow-sm">
        <h1 className="text-xl font-semibold">游客今日详情次数已使用</h1>
        <p className="mt-3 text-sm leading-6 text-base-content/60">游客每天只能进入一款 PSP 或 Switch 游戏详情，登录玩家账号后可以无限查看和下载。</p>
        <button className="btn mt-5 rounded-full bg-black px-8 text-white hover:bg-black/80" onClick={requestMemberLogin} type="button">登录 / 注册</button>
      </section> : <span className="loading loading-spinner loading-md" />}
    </main>
  </SiteLayout>
}
