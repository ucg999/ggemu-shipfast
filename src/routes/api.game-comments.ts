import { createFileRoute } from '@tanstack/react-router'
import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

type CommentRow = { id: string; author_name: string; content: string; created_at: string }

export const Route = createFileRoute('/api/game-comments')({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        const gameId = cleanGameId(new URL(request.url).searchParams.get('gameId'))
        if (!gameId) return jsonError('游戏信息不正确')
        await ensureCommentTable()
        const rows = await memberDb().prepare(`SELECT id, author_name, content, created_at FROM game_comments WHERE game_id = ? ORDER BY created_at DESC LIMIT 50`).bind(gameId).all<CommentRow>()
        return Response.json({ comments: rows.results.map(toView) }, { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30' } })
      } catch (error) {
        console.error('[game-comments:get]', error)
        return jsonError('评论暂时无法加载', 503)
      }
    },
    POST: async ({ request }) => {
      try {
        assertSameOrigin(request)
        const body = await request.json().catch(() => ({})) as Record<string, unknown>
        const gameId = cleanGameId(body.gameId)
        const content = cleanText(body.content, 200)
        if (!gameId || !content) return jsonError('请填写评论内容')
        const member = await getMemberFromRequest(request)
        const guestName = cleanText(body.guestName, 20) || '游客'
        const authorName = member?.displayName || guestName
        await ensureCommentTable()
        const id = crypto.randomUUID()
        await memberDb().prepare(`INSERT INTO game_comments (id, game_id, member_id, author_name, content) VALUES (?, ?, ?, ?, ?)`).bind(id, gameId, member?.id ?? null, authorName, content).run()
        const row = await memberDb().prepare('SELECT id, author_name, content, created_at FROM game_comments WHERE id = ?').bind(id).first<CommentRow>()
        return Response.json({ comment: row ? toView(row) : { id, author: authorName, content, createdAt: new Date().toISOString() } })
      } catch (error) {
        if (error instanceof Response) return error
        console.error('[game-comments:post]', error)
        return jsonError('评论发表失败，请稍后重试', 503)
      }
    },
  } },
})

let tableReady: Promise<void> | null = null
function ensureCommentTable() {
  tableReady ??= (async () => {
    await memberDb().prepare(`CREATE TABLE IF NOT EXISTS game_comments (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      member_id TEXT,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    await memberDb().prepare('CREATE INDEX IF NOT EXISTS game_comments_game_created_idx ON game_comments(game_id, created_at DESC)').run()
  })().catch(error => { tableReady = null; throw error })
  return tableReady
}

function cleanGameId(value: unknown) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(id) ? id : ''
}
function cleanText(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max) : ''
}
function toView(row: CommentRow) {
  return { id: row.id, author: row.author_name, content: row.content, createdAt: row.created_at }
}
