import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb, memberDb } from '#/lib/member-auth.server'

const CARTRIDGE_IDS = new Set([
  'donkey-kong', 'donkey-kong-jr', 'popeye', 'gomoku-narabe', 'mahjong', 'mario-bros',
  'popeye-english', 'baseball', 'donkey-kong-jr-math', 'urban-champion', 'happy-cat', 'karateka-street-fighter',
  'baoxiao-sanguo',
])

export const Route = createFileRoute('/api/fc-cartridges')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const member = await getMemberFromRequest(request)
        const db = leaderboardDb()
        const [rows, popularRows, collectorRows] = await Promise.all([
          member
            ? db.prepare(`SELECT cartridge_id FROM member_fc_cartridges WHERE member_id = ? ORDER BY cartridge_id ASC`).bind(member.id).all<{ cartridge_id: string }>()
            : Promise.resolve({ results: [] as { cartridge_id: string }[] }),
          db.prepare(`
            SELECT cartridge_id, COUNT(DISTINCT member_id) AS collection_count
            FROM member_fc_cartridges
            GROUP BY cartridge_id
            ORDER BY collection_count DESC, cartridge_id ASC LIMIT 5
          `).all<{ cartridge_id: string; collection_count: number }>(),
          db.prepare(`
            SELECT member_id, COUNT(DISTINCT cartridge_id) AS collection_count
            FROM member_fc_cartridges
            GROUP BY member_id
            ORDER BY collection_count DESC, member_id ASC LIMIT 5
          `).all<{ member_id: string; collection_count: number }>(),
        ])
        const collectorIds = collectorRows.results.map(row => row.member_id)
        let profiles: { id: string; display_name: string; player_number: number }[] = []
        if (collectorIds.length) {
          const placeholders = collectorIds.map(() => '?').join(', ')
          try {
            const result = await memberDb().prepare(`SELECT id, display_name, player_number FROM members WHERE id IN (${placeholders})`).bind(...collectorIds).all<{ id: string; display_name: string; player_number: number }>()
            profiles = result.results
          } catch (error) {
            console.warn('Unable to load FC collector profiles', error instanceof Error ? error.message : error)
          }
        }
        const profileById = new Map(profiles.map(profile => [profile.id, profile]))
        return Response.json({
          authenticated: Boolean(member),
          memberId: member?.id ?? null,
          owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)),
          rankings: {
            cartridges: popularRows.results.filter(row => CARTRIDGE_IDS.has(row.cartridge_id)).map((row, index) => ({ rank: index + 1, cartridgeId: row.cartridge_id, count: Number(row.collection_count) || 0 })),
            collectors: collectorRows.results.map((row, index) => {
              const profile = profileById.get(row.member_id)
              return { rank: index + 1, displayName: profile?.display_name || '玩家', playerNumber: profile?.player_number ?? null, count: Number(row.collection_count) || 0 }
            }),
          },
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
      POST: async ({ request }) => {
        assertSameOrigin(request)
        const member = await getMemberFromRequest(request)
        if (!member) return jsonError('请先登录玩家账号', 401)
        const body = await request.json() as { cartridgeId?: unknown; cartridgeIds?: unknown }
        const requested = Array.isArray(body.cartridgeIds) ? body.cartridgeIds : [body.cartridgeId]
        const cartridgeIds = [...new Set(requested.filter((value): value is string => typeof value === 'string' && CARTRIDGE_IDS.has(value)))]
        if (!cartridgeIds.length) return jsonError('卡带信息无效')
        const db = leaderboardDb()
        await db.batch(cartridgeIds.map(cartridgeId => db.prepare(`
          INSERT OR IGNORE INTO member_fc_cartridges (member_id, cartridge_id)
          VALUES (?, ?)
        `).bind(member.id, cartridgeId)))
        const rows = await db.prepare(`
          SELECT cartridge_id FROM member_fc_cartridges
          WHERE member_id = ? ORDER BY cartridge_id ASC
        `).bind(member.id).all<{ cartridge_id: string }>()
        return Response.json({ authenticated: true, memberId: member.id, owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)) }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
