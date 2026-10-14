import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb } from '#/lib/member-auth.server'

const PLATFORMS = new Set(['psp', 'switch'])

export const Route = createFileRoute('/api/library-collections')({
  server: { handlers: {
    GET: async ({ request }) => {
      const url = new URL(request.url)
      const platform = normalizePlatform(url.searchParams.get('platform'))
      const gameId = normalizeGameId(url.searchParams.get('gameId'))
      if (!platform) return jsonError('游戏信息无效')
      const member = await getMemberFromRequest(request)
      const ownerKey = member ? `member:${member.id}` : guestOwner(url.searchParams.get('guestId'))
      const db = leaderboardDb()
      await ensureTable(db)
      if (!gameId) {
        const rankings = await db.prepare(`SELECT game_id, COUNT(*) AS total
          FROM game_library_collections WHERE platform = ? GROUP BY game_id
          ORDER BY total DESC, game_id ASC LIMIT 5`).bind(platform).all<{ game_id: string; total: number }>()
        return Response.json({ rankings: rankings.results.map((row, index) => ({ rank: index + 1, gameId: row.game_id, count: Math.max(0, Number(row.total) || 0) })) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
      }
      const [owned, count] = await Promise.all([
        ownerKey ? db.prepare('SELECT 1 AS found FROM game_library_collections WHERE owner_key = ? AND platform = ? AND game_id = ?').bind(ownerKey, platform, gameId).first<{ found: number }>() : null,
        db.prepare('SELECT COUNT(*) AS total FROM game_library_collections WHERE platform = ? AND game_id = ?').bind(platform, gameId).first<{ total: number }>(),
      ])
      return Response.json({ collected: Boolean(owned), count: Math.max(0, Number(count?.total) || 0) }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
    POST: async ({ request }) => {
      assertSameOrigin(request)
      const member = await getMemberFromRequest(request)
      const body = await request.json() as { platform?: unknown; gameId?: unknown; guestId?: unknown }
      const platform = normalizePlatform(body.platform)
      const gameId = normalizeGameId(body.gameId)
      const ownerKey = member ? `member:${member.id}` : guestOwner(body.guestId)
      if (!platform || !gameId || !ownerKey) return jsonError('收藏信息无效')
      const db = leaderboardDb()
      await ensureTable(db)
      await db.prepare('INSERT OR IGNORE INTO game_library_collections (owner_key, platform, game_id) VALUES (?, ?, ?)').bind(ownerKey, platform, gameId).run()
      const count = await db.prepare('SELECT COUNT(*) AS total FROM game_library_collections WHERE platform = ? AND game_id = ?').bind(platform, gameId).first<{ total: number }>()
      return Response.json({ collected: true, count: Math.max(0, Number(count?.total) || 0) }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
  } },
})

function normalizePlatform(value: unknown) {
  return typeof value === 'string' && PLATFORMS.has(value) ? value : ''
}

function normalizeGameId(value: unknown) {
  const gameId = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(gameId) ? gameId : ''
}

function guestOwner(value: unknown) {
  const guestId = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9-]{16,80}$/i.test(guestId) ? `guest:${guestId}` : ''
}

async function ensureTable(db: ReturnType<typeof leaderboardDb>) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_library_collections (
    owner_key TEXT NOT NULL, platform TEXT NOT NULL, game_id TEXT NOT NULL,
    collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_key, platform, game_id)
  )`).run()
}
