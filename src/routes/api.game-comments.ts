import { createFileRoute } from '@tanstack/react-router'
import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

type CommentRow = { id: string; member_id: string | null; author_key: string | null; author_name: string; content: string; created_at: string }

export const Route = createFileRoute('/api/game-comments')({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        const url = new URL(request.url)
        const gameId = cleanGameId(url.searchParams.get('gameId'))
        const guestKey = cleanGuestKey(url.searchParams.get('guestKey'))
        if (!gameId) return jsonError('游戏信息不正确')
        await ensureCommentTable()
        const member = await getMemberFromRequest(request)
        const rows = await memberDb().prepare(`SELECT id, member_id, author_key, author_name, content, created_at FROM game_comments WHERE game_id = ? ORDER BY created_at DESC LIMIT 50`).bind(gameId).all<CommentRow>()
        return Response.json({ comments: rows.results.map(row => toView(row, Boolean(member?.playerNumber === 1 || (member && row.member_id === member.id) || (!member && guestKey && row.author_key === guestKey)))) }, { headers: { 'Cache-Control': 'private, no-store' } })
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
        const member = await getMemberFromRequest(request)
        const guestKey = cleanGuestKey(body.guestKey)
        if (!gameId) return jsonError('游戏信息不正确')
        await ensureCommentTable()

        if (body.action === 'delete') {
          const commentId = cleanCommentId(body.commentId)
          if (!commentId) return jsonError('评论信息不正确')
          const row = await memberDb().prepare('SELECT id, member_id, author_key FROM game_comments WHERE id = ? AND game_id = ?').bind(commentId, gameId).first<Pick<CommentRow, 'id' | 'member_id' | 'author_key'>>()
          if (!row) return jsonError('评论已不存在', 404)
          const allowed = member?.playerNumber === 1 || (member && row.member_id === member.id) || (!member && guestKey && row.author_key === guestKey)
          if (!allowed) return jsonError('你没有权限删除这条评论', 403)
          await memberDb().prepare('DELETE FROM game_comments WHERE id = ?').bind(commentId).run()
          return Response.json({ deleted: true, commentId })
        }

        const content = cleanText(body.content, 200)
        if (!content) return jsonError('请填写评论内容')
        const guestName = cleanText(body.guestName, 20) || '游客'
        const authorName = member?.displayName || guestName
        if (!member && !guestKey) return jsonError('浏览器身份无效，请刷新后重试')
        const id = crypto.randomUUID()
        await memberDb().prepare(`INSERT INTO game_comments (id, game_id, member_id, author_key, author_name, content) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, gameId, member?.id ?? null, member ? null : guestKey, authorName, content).run()
        const row = await memberDb().prepare('SELECT id, member_id, author_key, author_name, content, created_at FROM game_comments WHERE id = ?').bind(id).first<CommentRow>()
        return Response.json({ comment: row ? toView(row, true) : { id, author: authorName, content, createdAt: new Date().toISOString(), canDelete: true } })
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
      author_key TEXT,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).run()
    await memberDb().prepare('ALTER TABLE game_comments ADD COLUMN IF NOT EXISTS author_key TEXT').run()
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
function cleanGuestKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : ''
  return /^guest:[a-zA-Z0-9_-]{12,80}$/.test(key) ? key : ''
}
function cleanCommentId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-zA-Z0-9-]{16,64}$/.test(id) ? id : ''
}
function toView(row: CommentRow, canDelete = false) {
  return { id: row.id, author: row.author_name, content: row.content, createdAt: row.created_at, canDelete }
}
