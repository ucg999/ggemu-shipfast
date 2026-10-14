import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb, memberDb } from '#/lib/member-auth.server'

const CARTRIDGE_IDS = new Set(['castlevania-2', 'pokemon-gold', 'pokemon-silver', 'cyborg-kuro-chan-2', 'pokemon-crystal'])

export const Route = createFileRoute('/api/gb-cartridges')({
  server: { handlers: {
    GET: async ({ request }) => {
      const member = await getMemberFromRequest(request)
      const ownerId = member?.id ?? guestOwnerId(new URL(request.url).searchParams.get('guestId'))
      const db = leaderboardDb()
      const [rows, popularRows, collectorRows] = await Promise.all([
        ownerId ? db.prepare('SELECT cartridge_id FROM member_gb_cartridges WHERE member_id = ? ORDER BY cartridge_id').bind(ownerId).all<{ cartridge_id: string }>() : Promise.resolve({ results: [] as { cartridge_id: string }[] }),
        db.prepare('SELECT cartridge_id, COUNT(DISTINCT member_id) AS collection_count FROM member_gb_cartridges GROUP BY cartridge_id ORDER BY collection_count DESC, cartridge_id ASC').all<{ cartridge_id: string; collection_count: number }>(),
        db.prepare("SELECT member_id, COUNT(DISTINCT cartridge_id) AS collection_count FROM member_gb_cartridges WHERE member_id NOT LIKE 'guest:%' GROUP BY member_id ORDER BY collection_count DESC, member_id ASC LIMIT 5").all<{ member_id: string; collection_count: number }>(),
      ])
      const collectorIds = collectorRows.results.map(row => row.member_id)
      let profiles: { id: string; display_name: string; player_number: number }[] = []
      if (collectorIds.length) {
        const placeholders = collectorIds.map(() => '?').join(', ')
        try {
          profiles = (await memberDb().prepare(`SELECT id, display_name, player_number FROM members WHERE id IN (${placeholders})`).bind(...collectorIds).all<{ id: string; display_name: string; player_number: number }>()).results
        } catch (error) {
          console.warn('Unable to load GB collector profiles', error instanceof Error ? error.message : error)
        }
      }
      const profileById = new Map(profiles.map(profile => [profile.id, profile]))
      return Response.json({
        authenticated: Boolean(member),
        memberId: member?.id ?? null,
        owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)),
        collectionCounts: Object.fromEntries(popularRows.results.filter(row => CARTRIDGE_IDS.has(row.cartridge_id)).map(row => [row.cartridge_id, Number(row.collection_count) || 0])),
        rankings: {
          cartridges: popularRows.results.filter(row => CARTRIDGE_IDS.has(row.cartridge_id)).slice(0, 5).map((row, index) => ({ rank: index + 1, cartridgeId: row.cartridge_id, count: Number(row.collection_count) || 0 })),
          collectors: collectorRows.results.map((row, index) => { const profile = profileById.get(row.member_id); return { rank: index + 1, displayName: profile?.display_name || '玩家', playerNumber: profile?.player_number ?? null, count: Number(row.collection_count) || 0 } }),
        },
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
    POST: async ({ request }) => {
      assertSameOrigin(request)
      const member = await getMemberFromRequest(request)
      const body = await request.json() as { cartridgeId?: unknown; cartridgeIds?: unknown; guestId?: unknown }
      const ownerId = member?.id ?? guestOwnerId(body.guestId)
      if (!ownerId) return jsonError('收藏信息无效', 400)
      const requested = Array.isArray(body.cartridgeIds) ? body.cartridgeIds : [body.cartridgeId]
      const ids = [...new Set(requested.filter((value): value is string => typeof value === 'string' && CARTRIDGE_IDS.has(value)))]
      if (!ids.length) return jsonError('卡带信息无效')
      const db = leaderboardDb()
      await db.batch(ids.map(id => db.prepare('INSERT OR IGNORE INTO member_gb_cartridges (member_id, cartridge_id) VALUES (?, ?)').bind(ownerId, id)))
      const rows = await db.prepare('SELECT cartridge_id FROM member_gb_cartridges WHERE member_id = ? ORDER BY cartridge_id').bind(ownerId).all<{ cartridge_id: string }>()
      return Response.json({ authenticated: Boolean(member), owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)) }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
  } },
})

function guestOwnerId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9-]{16,80}$/i.test(id) ? `guest:${id}` : ''
}
