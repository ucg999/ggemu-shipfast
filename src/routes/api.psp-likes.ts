import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

export const Route = createFileRoute('/api/psp-likes')({
  server: { handlers: {
    GET: async ({ request }) => {
      const rows = await memberDb().prepare('SELECT game_id, like_count FROM psp_game_likes ORDER BY game_id').all<{ game_id: string; like_count: number }>()
      const member = await getMemberFromRequest(request)
      const liked = member ? await memberDb().prepare('SELECT game_id FROM psp_game_like_members WHERE member_id = ?').bind(member.id).all<{ game_id: string }>() : { results: [] }
      return Response.json({ likes: Object.fromEntries(rows.results.map(row => [row.game_id, Math.max(0, Number(row.like_count) || 0)])), liked: liked.results.map(row => row.game_id) }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
    POST: async ({ request }) => {
      try {
        assertSameOrigin(request)
        const member = await getMemberFromRequest(request)
        if (!member) return jsonError('请先登录玩家账号后点赞', 401)
        if (member.needsNickname) return jsonError('请先完成必填昵称设置', 428)
        const body = await request.json() as { gameId?: unknown }
        const gameId = typeof body.gameId === 'string' ? body.gameId.trim().slice(0, 100) : ''
        if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(gameId)) return jsonError('游戏信息不正确')
        const owner = member.playerNumber === 1
        if (!owner) {
          const claimed = await memberDb().prepare('INSERT OR IGNORE INTO psp_game_like_members (member_id, game_id) VALUES (?, ?)').bind(member.id, gameId).run()
          if (!claimed.meta.changes) {
            const existing = await memberDb().prepare('SELECT like_count FROM psp_game_likes WHERE game_id = ?').bind(gameId).first<{ like_count: number }>()
            return Response.json({ gameId, likeCount: Math.max(0, Number(existing?.like_count) || 0), liked: true, incremented: false })
          }
        }
        await memberDb().prepare(`INSERT INTO psp_game_likes (game_id, like_count) VALUES (?, 1)
          ON CONFLICT(game_id) DO UPDATE SET like_count = like_count + 1, updated_at = CURRENT_TIMESTAMP`).bind(gameId).run()
        if (owner) await memberDb().prepare('INSERT OR IGNORE INTO psp_game_like_members (member_id, game_id) VALUES (?, ?)').bind(member.id, gameId).run()
        const row = await memberDb().prepare('SELECT like_count FROM psp_game_likes WHERE game_id = ?').bind(gameId).first<{ like_count: number }>()
        return Response.json({ gameId, likeCount: Math.max(0, Number(row?.like_count) || 0), liked: true, incremented: true })
      } catch (error) {
        if (error instanceof Response) return error
        return jsonError('点赞失败，请稍后再试', 500)
      }
    },
  } },
})
