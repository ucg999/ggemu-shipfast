import { useEffect, useState } from 'react'
import { useMemberSession } from '#/lib/member-client'

type GameComment = { id: string; author: string; content: string; createdAt: string }

export function GameComments({ gameId }: { gameId: string }) {
  const member = useMemberSession()
  const [comments, setComments] = useState<Array<GameComment>>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/game-comments?gameId=${encodeURIComponent(gameId)}`)
      .then(async response => {
        if (!response.ok) throw new Error('load_failed')
        return response.json() as Promise<{ comments: Array<GameComment> }>
      })
      .then(data => { if (!cancelled) setComments(data.comments) })
      .catch(() => { if (!cancelled) setMessage('评论暂时加载失败，请稍后重试。') })
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
        body: JSON.stringify({ gameId, content: normalized, guestName: '游客' }),
      })
      const data = await response.json() as { comment?: GameComment; error?: string }
      if (!response.ok || !data.comment) throw new Error(data.error || 'submit_failed')
      setComments(previous => [data.comment!, ...previous].slice(0, 50))
      setContent('')
    } catch (error) {
      setMessage(error instanceof Error && error.message !== 'submit_failed' ? error.message : '评论发表失败，请稍后重试。')
    } finally {
      setSending(false)
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
            <div className="flex items-center justify-between gap-3 text-sm"><strong>{comment.author}</strong><time className="text-xs text-base-content/50">{new Date(comment.createdAt).toLocaleString('zh-CN')}</time></div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-base-content/80">{comment.content}</p>
          </article>
        )) : <p className="py-5 text-center text-sm text-base-content/50">还没有评论，来说第一句吧。</p>}
      </div>
    </section>
  )
}
