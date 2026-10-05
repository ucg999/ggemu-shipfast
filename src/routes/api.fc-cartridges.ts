import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb } from '#/lib/member-auth.server'

const CARTRIDGE_IDS = new Set(['urban-champion', 'happy-cat', 'karateka-street-fighter'])

export const Route = createFileRoute('/api/fc-cartridges')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const member = await getMemberFromRequest(request)
        if (!member) return Response.json({ authenticated: false, owned: [] }, { headers: { 'Cache-Control': 'private, no-store' } })
        const rows = await leaderboardDb().prepare(`
          SELECT cartridge_id FROM member_fc_cartridges
          WHERE member_id = ? ORDER BY cartridge_id ASC
        `).bind(member.id).all<{ cartridge_id: string }>()
        return Response.json({ authenticated: true, memberId: member.id, owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)) }, { headers: { 'Cache-Control': 'private, no-store' } })
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
