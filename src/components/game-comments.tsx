import { useEffect, useMemo, useState } from 'react'
import { useMemberSession } from '#/lib/member-client'

type GameComment = {
  id: string
  author: string
  content: string
  createdAt: string
}

export function GameComments({ gameId }: { gameId: string }) {
  const member = useMemberSession()
  const storageKey = useMemo(() => `ucg999-game-comments:${gameId}`, [gameId])
  const [comments, setComments] = useState<Array<GameComment>>([])
  const [content, setContent] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]') as Array<GameComment>
      if (Array.isArray(saved)) setComments(saved.slice(0, 50))
    } catch {
      setComments([])
    }
  }, [storageKey])

  function submitComment() {
    const normalized = content.trim().slice(0, 200)
    if (!normalized) return
    const next = [{
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      author: member?.displayName || '游客',
      content: normalized,
      createdAt: new Date().toISOString(),
    }, ...comments].slice(0, 50)
    setComments(next)
    setContent('')
    window.localStorage.setItem(storageKey, JSON.stringify(next))
  }

  return (
    <section className="max-w-5xl rounded-box border border-base-300 bg-base-100 p-5 shadow-sm sm:p-7">
      <h2 className="text-2xl font-semibold">玩家评论</h2>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <textarea
          className="textarea textarea-bordered min-h-24 flex-1 resize-y"
          maxLength={200}
          onChange={event => setContent(event.target.value)}
          placeholder="说说你对这款游戏的看法……"
          value={content}
        />
        <button className="btn btn-primary self-end sm:self-stretch" disabled={!content.trim()} onClick={submitComment} type="button">发表评论</button>
      </div>
      <p className="mt-2 text-right text-xs text-base-content/50">{content.length}/200</p>
      <div className="mt-5 space-y-3">
        {comments.length ? comments.map(comment => (
          <article className="rounded-xl bg-base-200 px-4 py-3" key={comment.id}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <strong>{comment.author}</strong>
              <time className="text-xs text-base-content/50">{new Date(comment.createdAt).toLocaleString('zh-CN')}</time>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-base-content/80">{comment.content}</p>
          </article>
        )) : <p className="py-5 text-center text-sm text-base-content/50">还没有评论，来说第一句吧。</p>}
      </div>
    </section>
  )
}
