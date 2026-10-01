import { SiteLayout } from '#/components/site-layout'
import type { Locale } from '#/lib/ggemu'
import { requestMemberLogin } from '#/lib/member-client'

export function MemberRequiredNotice({ checked, locale }: { checked: boolean; locale: Locale }) {
  return (
    <SiteLayout locale={locale} hideFooter>
      <main className="grid min-h-[70dvh] place-items-center px-4 py-12">
        <section className="w-full max-w-md rounded-3xl border border-base-300 bg-base-100 p-8 text-center shadow-xl">
          <i className="ri-account-circle-line text-5xl" aria-hidden="true" />
          <h1 className="mt-4 text-2xl font-black">{checked ? '请先登录玩家账号' : '正在确认登录状态…'}</h1>
          <p className="mt-2 text-sm text-base-content/60">登录后即可进入原创游戏，等待加载时的小试玩不受影响。</p>
          {checked ? <button className="btn mt-6 rounded-full bg-black px-8 text-white hover:bg-black/80" onClick={requestMemberLogin} type="button">登录 / 注册</button> : null}
        </section>
      </main>
    </SiteLayout>
  )
}
