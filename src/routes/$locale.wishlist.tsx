import { createFileRoute } from '@tanstack/react-router'
import { FormEvent, useEffect, useState } from 'react'

import { SiteLayout } from '#/components/site-layout'
import { getWantedGuestKey } from '#/components/wanted-playtime-tracker'
import { normalizeLocale } from '#/lib/i18n'

type Wish = {
  id: string
  gameName: string
  platform: string
  genre: string
  era: string
  requesterName: string
  ownerReply: string
  createdAt: string
  supportCount: number
  supported: boolean
}

export const Route = createFileRoute('/$locale/wishlist')({
  head: () => ({
    meta: [
      { title: '游戏愿望单｜提交想玩的游戏｜UCG999 怀旧游戏厅' },
      { name: 'description', content: '提交你想玩的游戏，填写游戏名、平台和类型，也可以为其他玩家的愿望点同求。' },
    ],
  }),
  component: WishlistPage,
})

const localWishlistStorageKey = 'ucg999-local-wishlist-preview-v1'

function WishlistPage() {
  const locale = normalizeLocale(Route.useParams().locale)
  const [wishes, setWishes] = useState<Wish[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [gameName, setGameName] = useState('')
  const [platform, setPlatform] = useState('')
  const [genre, setGenre] = useState('')
  const [era, setEra] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})

  async function loadWishes() {
    setLoading(true)
    setError('')
    try {
      if (isLocalPreview()) {
        const localWishes = readLocalWishes()
        setWishes(localWishes)
        setIsOwner(true)
        setReplyDrafts(Object.fromEntries(localWishes.map(wish => [wish.id, wish.ownerReply || ''])))
        return
      }
      const response = await fetch(`/api/game-wishes?guestKey=${encodeURIComponent(getWantedGuestKey())}`, { credentials: 'same-origin', cache: 'no-store' })
      const data = await response.json() as { wishes?: Wish[]; isOwner?: boolean; error?: string }
      if (!response.ok) throw new Error(data.error || '加载失败')
      setWishes(data.wishes || [])
      setIsOwner(Boolean(data.isOwner))
      setReplyDrafts(Object.fromEntries((data.wishes || []).map(wish => [wish.id, wish.ownerReply || ''])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '愿望单暂时加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadWishes() }, [])

  async function post(body: Record<string, unknown>) {
    if (isLocalPreview()) return postLocalPreview(body)
    const response = await fetch('/api/game-wishes', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, guestKey: getWantedGuestKey() }),
    })
    const data = await response.json() as Record<string, unknown>
    if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : '操作失败')
    return data
  }

  async function submitWish(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      await post({ action: 'create', gameName, platform, genre, era })
      setGameName(''); setPlatform(''); setGenre(''); setEra('')
      await loadWishes()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function supportWish(wish: Wish) {
    if (wish.supported || busyId) return
    setBusyId(wish.id)
    try {
      const data = await post({ action: 'support', wishId: wish.id })
      setWishes(items => items.map(item => item.id === wish.id ? { ...item, supported: true, supportCount: Number(data.supportCount) || item.supportCount + 1 } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '同求失败')
    } finally {
      setBusyId('')
    }
  }

  async function saveReply(wish: Wish) {
    if (busyId) return
    setBusyId(wish.id)
    try {
      const reply = replyDrafts[wish.id] || ''
      await post({ action: 'reply', wishId: wish.id, reply })
      setWishes(items => items.map(item => item.id === wish.id ? { ...item, ownerReply: reply.trim() } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回复保存失败')
    } finally {
      setBusyId('')
    }
  }

  async function deleteWish(wish: Wish) {
    if (busyId || !window.confirm(`确定删除“${wish.gameName}”这个愿望吗？删除后无法恢复。`)) return
    setBusyId(wish.id)
    setError('')
    try {
      await post({ action: 'delete', wishId: wish.id })
      setWishes(items => items.filter(item => item.id !== wish.id))
      setReplyDrafts(drafts => {
        const next = { ...drafts }
        delete next[wish.id]
        return next
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setBusyId('')
    }
  }

  return <SiteLayout locale={locale}>
    <main className="min-h-[calc(100dvh-64px)] bg-base-200/55 px-3 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 text-center">
          <span className="text-4xl" aria-hidden="true">✨</span>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-base-content sm:text-4xl">游戏愿望单</h1>
          <p className="mx-auto mt-2 max-w-3xl text-sm text-base-content/60 sm:text-base">告诉我们你想玩的游戏，我们可以优先找一找并且上线，需求比较多的优先找找。</p>
        </header>

        <form className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm sm:p-6" onSubmit={submitWish}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="form-control"><span className="mb-1.5 text-sm font-bold">1. 游戏名</span><input className="input input-bordered w-full" maxLength={80} onChange={event => setGameName(event.target.value)} placeholder="例如：超级马里奥 3" required value={gameName} /></label>
            <label className="form-control"><span className="mb-1.5 text-sm font-bold">2. 什么平台</span><input className="input input-bordered w-full" maxLength={40} onChange={event => setPlatform(event.target.value)} placeholder="自由填写，例如：FC" required value={platform} /></label>
            <label className="form-control"><span className="mb-1.5 text-sm font-bold">3. 类型</span><input className="input input-bordered w-full" maxLength={40} onChange={event => setGenre(event.target.value)} placeholder="自由填写，例如：动作" required value={genre} /></label>
            <label className="form-control"><span className="mb-1.5 text-sm font-bold">4. 年代</span><input className="input input-bordered w-full" maxLength={20} onChange={event => setEra(event.target.value)} placeholder="例如：1990年代" required value={era} /></label>
          </div>
          <button className="btn btn-primary mt-5 w-full sm:w-auto sm:min-w-40" disabled={submitting} type="submit">{submitting ? <span className="loading loading-spinner loading-sm" /> : <i className="ri-magic-line" />}提交游戏愿望</button>
        </form>

        {error && <div className="alert alert-error mt-4 text-sm"><i className="ri-error-warning-line" /><span>{error}</span><button className="btn btn-sm" onClick={() => void loadWishes()} type="button">重新加载</button></div>}

        <section className="mt-7 space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black">大家的游戏愿望</h2><span className="text-sm text-base-content/50">共 {wishes.length} 个</span></div>
          {loading ? <div className="flex justify-center py-16"><span className="loading loading-spinner loading-lg" /></div> : wishes.length === 0 ? <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 py-16 text-center text-base-content/50">还没有愿望，来提交第一个吧。</div> : wishes.map((wish, index) => <article className="rounded-xl border border-base-300 bg-base-100 px-3 py-2 shadow-sm" key={wish.id}>
            <div className="grid items-center gap-2 lg:grid-cols-[minmax(240px,1fr)_auto_minmax(320px,1.15fr)]">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-base-content/35">#{index + 1}</span><strong className="max-w-56 truncate text-sm">{wish.gameName}</strong><span className="badge badge-outline badge-sm">{wish.platform}</span><span className="badge badge-ghost badge-sm">{wish.genre}</span><span className="badge badge-ghost badge-sm">{wish.era || '年代未填'}</span><span className="text-[10px] text-base-content/40">{wish.requesterName} · {formatDate(wish.createdAt)}</span>
              </div>
              <button className={`btn btn-xs justify-self-start ${wish.supported ? 'btn-success btn-outline' : 'btn-warning'}`} disabled={wish.supported || busyId === wish.id} onClick={() => void supportWish(wish)} type="button"><i className={wish.supported ? 'ri-check-line' : 'ri-add-line'} />{wish.supported ? '已同求' : '同求'} {wish.supportCount}</button>
              {(wish.ownerReply || isOwner) ? isOwner ? <div className="flex min-w-0 items-center gap-1.5"><span className="shrink-0 text-xs font-bold text-primary">回复</span><input className="input input-bordered input-xs min-w-0 flex-1" maxLength={500} onChange={event => setReplyDrafts(drafts => ({ ...drafts, [wish.id]: event.target.value }))} placeholder="回复进度或状况……" value={replyDrafts[wish.id] ?? wish.ownerReply} /><button className="btn btn-primary btn-xs" disabled={busyId === wish.id} onClick={() => void saveReply(wish)} type="button">保存</button><button aria-label="删除愿望" className="btn btn-error btn-outline btn-xs px-2" disabled={busyId === wish.id} onClick={() => void deleteWish(wish)} title="删除" type="button"><i className="ri-delete-bin-line" /></button></div> : <p className="min-w-0 truncate text-xs"><strong className="mr-1 text-primary">00001 回复：</strong>{wish.ownerReply}</p> : <span />}
            </div>
          </article>)}
        </section>
      </div>
    </main>
  </SiteLayout>
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function isLocalPreview() {
  return typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

function readLocalWishes(): Wish[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(localWishlistStorageKey) || '[]')
    return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string' && typeof item.gameName === 'string').slice(0, 100) : []
  } catch {
    return []
  }
}

function writeLocalWishes(wishes: Wish[]) {
  window.localStorage.setItem(localWishlistStorageKey, JSON.stringify(wishes.slice(0, 100)))
}

function postLocalPreview(body: Record<string, unknown>): Record<string, unknown> {
  const wishes = readLocalWishes()
  if (body.action === 'create') {
    const gameName = String(body.gameName || '').trim().slice(0, 80)
    const platform = String(body.platform || '').trim().slice(0, 40)
    const genre = String(body.genre || '').trim().slice(0, 40)
    const era = String(body.era || '').trim().slice(0, 20)
    if (!gameName || !platform || !genre || !era) throw new Error('请填写游戏名、平台、类型和年代')
    const wish: Wish = {
      id: crypto.randomUUID(), gameName, platform, genre, era,
      requesterName: '00001 本地测试', ownerReply: '',
      createdAt: new Date().toISOString(), supportCount: 0, supported: false,
    }
    writeLocalWishes([wish, ...wishes])
    return { created: true, id: wish.id, preview: true }
  }
  const wishId = String(body.wishId || '')
  const index = wishes.findIndex(wish => wish.id === wishId)
  if (index < 0) throw new Error('这个愿望已不存在')
  if (body.action === 'support') {
    if (!wishes[index].supported) wishes[index] = { ...wishes[index], supported: true, supportCount: wishes[index].supportCount + 1 }
    writeLocalWishes(wishes)
    return { supported: true, supportCount: wishes[index].supportCount, preview: true }
  }
  if (body.action === 'reply') {
    const reply = String(body.reply || '').trim().slice(0, 500)
    wishes[index] = { ...wishes[index], ownerReply: reply }
    writeLocalWishes(wishes)
    return { saved: true, reply, preview: true }
  }
  if (body.action === 'delete') {
    wishes.splice(index, 1)
    writeLocalWishes(wishes)
    return { deleted: true, preview: true }
  }
  throw new Error('不支持的操作')
}
