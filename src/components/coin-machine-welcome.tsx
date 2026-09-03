import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import type { Locale } from '#/lib/ggemu'

const copy = {
  'zh-CN': ['欢迎来到怀旧游戏厅', '请在进入本游戏前确认您已满18岁', '此游戏仅供娱乐，禁止赌博', '开始吧', '继续浏览我们的网站即表示您同意我们的', '隐私声明', '和', '使用条款'],
  'zh-TW': ['歡迎來到懷舊遊戲廳', '請在進入本遊戲前確認您已滿18歲', '此遊戲僅供娛樂，禁止賭博', '開始吧', '繼續瀏覽我們的網站即表示您同意我們的', '隱私聲明', '和', '使用條款'],
  en: ['Welcome to the Retro Arcade', 'Please confirm you are at least 18 before entering this game.', 'For entertainment only. Gambling is prohibited.', 'Let’s start', 'By continuing to browse our website, you agree to our', 'Privacy Policy', 'and', 'Terms of Service'],
  ja: ['レトロゲームセンターへようこそ', 'ゲームを始める前に、18歳以上であることをご確認ください。', 'このゲームは娯楽専用です。賭博は禁止されています。', 'はじめよう', '当サイトの閲覧を続けることで、以下に同意したものとみなされます：', 'プライバシーポリシー', 'と', '利用規約'],
} as const

export function CoinMachineWelcome({ lang }: { lang: Locale }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const t = copy[lang]
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="coin-welcome-title"
      aria-describedby="coin-welcome-description"
      onCancel={event => event.preventDefault()}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-white/15 bg-neutral-950 p-6 text-center text-white shadow-2xl backdrop:bg-black/80 sm:p-8"
    >
      <h2 id="coin-welcome-title" className="text-2xl font-bold">{t[0]}</h2>
      <div id="coin-welcome-description" className="mt-5 space-y-3 text-sm leading-6 text-neutral-300">
        <p>{t[1]}</p>
        <p>{t[2]}</p>
      </div>
      <button type="button" onClick={() => dialogRef.current?.close()} className="mt-6 w-full rounded-full bg-yellow-400 px-6 py-3 text-lg font-bold text-black hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-yellow-400">{t[3]}</button>
      <p className="mt-5 text-xs leading-5 text-neutral-400">
        {t[4]}{' '}<Link className="underline" to="/$locale/privacy-policy" params={{ locale: lang }}>{t[5]}</Link>{' '}{t[6]}{' '}<Link className="underline" to="/$locale/terms-of-service" params={{ locale: lang }}>{t[7]}</Link>。
      </p>
    </dialog>
  )
}
