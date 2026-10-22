import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb, memberDb, toMemberView } from '#/lib/member-auth.server'

const PRICE = 10
const GUEST_COLLECTION_LIFETIME_SQL = "datetime('now', '-1 day')"

const CARTRIDGE_IDS = new Set(['castlevania-2', 'pokemon-gold', 'pokemon-silver', 'cyborg-kuro-chan-2', 'pokemon-crystal'])

export const Route = createFileRoute('/api/gb-cartridges')({
  server: { handlers: {
    GET: async ({ request }) => {
      const member = await getMemberFromRequest(request)
      const ownerId = member?.id ?? guestOwnerId(new URL(request.url).searchParams.get('guestId'))
      const db = leaderboardDb()
      const [rows, popularRows, collectorRows] = await Promise.all([
        ownerId ? db.prepare(`SELECT cartridge_id FROM member_gb_cartridges WHERE member_id = ?${member ? '' : ` AND collected_at >= ${GUEST_COLLECTION_LIFETIME_SQL}`} ORDER BY cartridge_id`).bind(ownerId).all<{ cartridge_id: string }>() : Promise.resolve({ results: [] as { cartridge_id: string }[] }),
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
      const body = await request.json() as { cartridgeId?: unknown; guestId?: unknown; guestPaid?: unknown; paymentId?: unknown }
      const ownerId = member?.id ?? guestOwnerId(body.guestId)
      if (!ownerId) return jsonError('收藏信息无效', 400)
      const cartridgeId = typeof body.cartridgeId === 'string' && CARTRIDGE_IDS.has(body.cartridgeId) ? body.cartridgeId : ''
      if (!cartridgeId) return jsonError('卡带信息无效')
      const db = leaderboardDb()
      const owned = await db.prepare(`SELECT 1 AS found FROM member_gb_cartridges WHERE member_id = ? AND cartridge_id = ?${member ? '' : ` AND collected_at >= ${GUEST_COLLECTION_LIFETIME_SQL}`}`).bind(ownerId, cartridgeId).first<{ found: number }>()
      if (!owned) {
        if (member) {
          const deduction = await memberDb().prepare('UPDATE members SET coin_balance = coin_balance - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND coin_balance >= ?').bind(PRICE, member.id, PRICE).run()
          if (!deduction.meta.changes) return jsonError('玩家金币不足', 402)
          try {
            await db.prepare('INSERT INTO member_gb_cartridges (member_id, cartridge_id) VALUES (?, ?)').bind(ownerId, cartridgeId).run()
          } catch (error) {
            await memberDb().prepare('UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(PRICE, member.id).run()
            throw error
          }
          const updated = await memberDb().prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
          if (updated) await memberDb().prepare(`INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key) VALUES (?, ?, ?, 'gb_cartridge_collection', ?)`).bind(member.id, -PRICE, updated.coin_balance, `gb_cartridge:${cartridgeId}`).run()
        } else {
          const paymentId = normalizePaymentId(body.paymentId)
          if (body.guestPaid !== true || !paymentId) return jsonError('请使用当前浏览器金币收藏', 402)
          await ensureGuestPaymentTable(db)
          const payment = await db.prepare(`INSERT OR IGNORE INTO cartridge_payment_events (event_key, owner_key, platform, cartridge_id) VALUES (?, ?, 'gb', ?)`).bind(`guest-gb:${paymentId}`, ownerId, cartridgeId).run()
          if (!payment.meta.changes) return jsonError('本次收藏已处理', 409)
          await db.prepare(`INSERT INTO member_gb_cartridges (member_id, cartridge_id) VALUES (?, ?)
            ON CONFLICT(member_id, cartridge_id) DO UPDATE SET collected_at = CURRENT_TIMESTAMP`).bind(ownerId, cartridgeId).run()
        }
      }
      const rows = await db.prepare(`SELECT cartridge_id FROM member_gb_cartridges WHERE member_id = ?${member ? '' : ` AND collected_at >= ${GUEST_COLLECTION_LIFETIME_SQL}`} ORDER BY cartridge_id`).bind(ownerId).all<{ cartridge_id: string }>()
      const updatedMember = member ? await memberDb().prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>() : null
      return Response.json({ authenticated: Boolean(member), owned: rows.results.map(row => row.cartridge_id).filter(id => CARTRIDGE_IDS.has(id)), member: updatedMember ? toMemberView(updatedMember) : undefined }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
  } },
})

function guestOwnerId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9-]{16,80}$/i.test(id) ? `guest:${id}` : ''
}

function normalizePaymentId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9-]{16,80}$/i.test(id) ? id : ''
}

async function ensureGuestPaymentTable(db: ReturnType<typeof leaderboardDb>) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS cartridge_payment_events (
    event_key TEXT PRIMARY KEY, owner_key TEXT NOT NULL, platform TEXT NOT NULL,
    cartridge_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run()
}
