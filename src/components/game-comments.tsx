import { useEffect, useState } from 'react'
import { useMemberSession } from '#/lib/member-client'

type GameComment = { id: string; author: string; content: string; createdAt: string; canDelete?: boolean }

export function GameComments({ gameId }: { gameId: string }) {
  const member = useMemberSession()
  const [comments, setComments] = useState<Array<GameComment>>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const localKey = `ucg999-game-comments-preview:${gameId}`

  useEffect(() => {
    let cancelled = false
    const guestKey = getGuestCommentKey()
    setLoading(true)
    fetch(`/api/game-comments?gameId=${encodeURIComponent(gameId)}&guestKey=${encodeURIComponent(guestKey)}`, { credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error('load_failed')
        return response.json() as Promise<{ comments: Array<GameComment> }>
      })
      .then(data => { if (!cancelled) setComments(data.comments) })
      .catch(() => {
        if (cancelled) return
        try { setComments(JSON.parse(window.localStorage.getItem(localKey) || '[]') as Array<GameComment>) } catch { setComments([]) }
        setMessage('本地预览模式：评论将在部署后统一保存到 Supabase。')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [gameId])

  async function submitComment() {
    const normalized = content.trim().slice(0, 200)
    if (!normalized || sending) return
    setSending(true)
    setMessage('')
    try {
      const response = await fetch('/api/game-comments', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, content: normalized, guestName: '游客', guestKey: getGuestCommentKey() }),
      })
      const data = await response.json() as { comment?: GameComment; error?: string }
      if (!response.ok || !data.comment) throw new Error(data.error || 'submit_failed')
      setComments(previous => [data.comment!, ...previous].slice(0, 50))
      setContent('')
    } catch {
      const localComment = { id: `${Date.now()}-local-preview`, author: member?.displayName || '游客', content: normalized, createdAt: new Date().toISOString(), canDelete: true }
      setComments(previous => {
        const next = [localComment, ...previous].slice(0, 50)
        window.localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      setContent('')
      setMessage('本地预览评论已保存；部署后评论将写入 Supabase。')
    } finally {
      setSending(false)
    }
  }

  async function deleteComment(comment: GameComment) {
    if (!comment.canDelete || !window.confirm('确定删除这条评论吗？')) return
    setMessage('')
    if (comment.id.endsWith('-local-preview')) {
      setComments(previous => {
        const next = previous.filter(item => item.id !== comment.id)
        window.localStorage.setItem(localKey, JSON.stringify(next))
        return next
      })
      return
    }
    try {
      const response = await fetch('/api/game-comments', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', gameId, commentId: comment.id, guestKey: getGuestCommentKey() }),
      })
      const data = await response.json() as { error?: string }
      if (!response.ok) throw new Error(data.error || '删除失败')
      setComments(previous => previous.filter(item => item.id !== comment.id))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败，请稍后重试。')
    }
  }

  return (
    <section className="rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩家评论</h2>
      <p className="mt-1 text-sm text-base-content/55">{member ? `以“${member.displayName}”发表评论` : '游客也可以发表评论'}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <textarea className="textarea textarea-bordered min-h-24 flex-1 resize-y" maxLength={200} onChange={event => setContent(event.target.value)} placeholder="说说你对这款游戏的看法……" value={content} />
        <button className="btn btn-primary self-end sm:self-stretch" disabled={!content.trim() || sending} onClick={() => void submitComment()} type="button">{sending ? '发表中…' : '发表评论'}</button>
      </div>
      <p className="mt-2 text-right text-xs text-base-content/50">{content.length}/200</p>
      {message ? <p className="mt-3 text-sm text-error">{message}</p> : null}
      <div className="mt-5 space-y-3">
        {loading ? <p className="py-5 text-center text-sm text-base-content/50">正在加载评论…</p> : comments.length ? comments.map(comment => (
          <article className="rounded-xl bg-base-200 px-4 py-3" key={comment.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <strong>{comment.author}</strong>
              <div className="flex items-center gap-3">
                <time className="text-xs text-base-content/50">{new Date(comment.createdAt).toLocaleString('zh-CN')}</time>
                {comment.canDelete ? <button className="btn btn-ghost btn-xs text-error" onClick={() => void deleteComment(comment)} type="button">删除</button> : null}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-base-content/80">{comment.content}</p>
          </article>
        )) : <p className="py-5 text-center text-sm text-base-content/50">还没有评论，来说第一句吧。</p>}
      </div>
    </section>
  )
}

function getGuestCommentKey() {
  const storageKey = 'ucg999-game-comment-guest-key'
  const existing = window.localStorage.getItem(storageKey)
  if (existing && /^guest:[a-zA-Z0-9_-]{12,80}$/.test(existing)) return existing
  const created = `guest:${crypto.randomUUID().replaceAll('-', '')}`
  window.localStorage.setItem(storageKey, created)
  return created
}
