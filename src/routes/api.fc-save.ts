import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

const MAX_SAVE_SIZE = 750_000
let saveTableReady: Promise<void> | null = null

function ensureSaveTable() {
  saveTableReady ??= memberDb().prepare(`
    CREATE TABLE IF NOT EXISTS member_fc_saves (
      member_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      save_payload TEXT NOT NULL,
      backup_payload TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (member_id, game_id)
    )
  `).run().then(() => undefined).catch(error => {
    saveTableReady = null
    throw error
  })
  return saveTableReady
}

function normalizeGameId(value: unknown) {
  return typeof value === 'string' && /^[a-z0-9_-]{1,80}$/i.test(value) ? value : ''
}

export const Route = createFileRoute('/api/fc-save')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const member = await getMemberFromRequest(request)
        if (!member) return jsonError('请先登录玩家账号', 401)
        const gameId = normalizeGameId(new URL(request.url).searchParams.get('gameId'))
        if (!gameId) return jsonError('游戏信息无效')
        await ensureSaveTable()
        const row = await memberDb().prepare(`
          SELECT save_payload, backup_payload, updated_at FROM member_fc_saves
          WHERE member_id = ? AND game_id = ?
        `).bind(member.id, gameId).first<{ save_payload: string; backup_payload: string | null; updated_at: string }>()
        if (!row) return jsonError('没有找到会员云存档', 404)
        try {
          return Response.json({
            payload: JSON.parse(row.save_payload),
            backup: row.backup_payload ? JSON.parse(row.backup_payload) : null,
            updatedAt: row.updated_at,
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch {
          return jsonError('会员云存档已损坏', 500)
        }
      },
      PUT: async ({ request }) => {
        assertSameOrigin(request)
        const member = await getMemberFromRequest(request)
        if (!member) return jsonError('请先登录玩家账号', 401)
        const contentLength = Number(request.headers.get('content-length')) || 0
        if (contentLength > MAX_SAVE_SIZE) return jsonError('存档文件过大', 413)
        const rawBody = await request.text()
        if (rawBody.length > MAX_SAVE_SIZE) return jsonError('存档文件过大', 413)
        let body: { gameId?: unknown; payload?: unknown }
        try {
          body = JSON.parse(rawBody) as typeof body
        } catch {
          return jsonError('存档数据无效')
        }
        const gameId = normalizeGameId(body.gameId)
        const payload = body.payload as { format?: unknown; data?: unknown; checksum?: unknown; rawSize?: unknown } | null
        if (!gameId || payload?.format !== 'gzip-base64-v1' || typeof payload.data !== 'string' || typeof payload.checksum !== 'string' || typeof payload.rawSize !== 'number') {
          return jsonError('存档数据无效')
        }
        const savePayload = JSON.stringify(payload)
        if (savePayload.length > MAX_SAVE_SIZE) return jsonError('存档文件过大', 413)
        await ensureSaveTable()
        await memberDb().prepare(`
          INSERT INTO member_fc_saves (member_id, game_id, save_payload, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(member_id, game_id) DO UPDATE SET
            backup_payload = member_fc_saves.save_payload,
            save_payload = excluded.save_payload,
            updated_at = CURRENT_TIMESTAMP
        `).bind(member.id, gameId, savePayload).run()
        return Response.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
