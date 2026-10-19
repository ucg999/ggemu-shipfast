import { createFileRoute } from '@tanstack/react-router'

import { getLibraryDownloadUrl, type DownloadPlatform } from '#/lib/library-downloads.server'
import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb, memberDb, toMemberView } from '#/lib/member-auth.server'

const PLATFORMS = new Set<DownloadPlatform>(['psp', 'switch'])
const PRICE = 10
const GUEST_UNLOCK_MS = 60 * 60 * 1000

export const Route = createFileRoute('/api/library-collections')({ server: { handlers: {
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const platform = normalizePlatform(url.searchParams.get('platform'))
    const gameId = normalizeGameId(url.searchParams.get('gameId'))
    if (!platform) return jsonError('游戏信息无效')
    const member = await getMemberFromRequest(request)
    const guest = member ? '' : guestOwner(url.searchParams.get('guestId'))
    const db = leaderboardDb()
    await ensureTables(db)
    if (!gameId) {
      const rankings = await db.prepare(`SELECT game_id, COUNT(*) AS total FROM game_library_collection_events
        WHERE platform = ? GROUP BY game_id ORDER BY total DESC, game_id ASC LIMIT 5`).bind(platform).all<{ game_id: string; total: number }>()
      return Response.json({ rankings: rankings.results.map((row: { game_id: string; total: number }, index: number) => ({ rank: index + 1, gameId: row.game_id, count: safeCount(row.total) })) }, { headers: { 'Cache-Control': 'public, max-age=60' } })
    }
    const ownerKey = member ? `member:${member.id}` : guest
    const [memberOwned, guestUnlock, count] = await Promise.all([
      member ? db.prepare('SELECT 1 AS found FROM game_library_collections WHERE owner_key = ? AND platform = ? AND game_id = ?').bind(ownerKey, platform, gameId).first<{ found: number }>() : null,
      guest ? db.prepare('SELECT expires_at_ms FROM game_library_guest_unlocks WHERE owner_key = ? AND platform = ? AND game_id = ? AND expires_at_ms > ?').bind(guest, platform, gameId, Date.now()).first<{ expires_at_ms: number }>() : null,
      collectionCount(db, platform, gameId),
    ])
    const unlocked = Boolean(memberOwned || guestUnlock)
    const downloadUrl = getLibraryDownloadUrl(platform, gameId)
    return Response.json({
      available: Boolean(downloadUrl), collected: Boolean(memberOwned), guestUnlocked: Boolean(guestUnlock), count,
      ...(unlocked && downloadUrl ? { downloadUrl } : {}),
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  },
  POST: async ({ request }) => {
    assertSameOrigin(request)
    const member = await getMemberFromRequest(request)
    const body = await request.json() as { platform?: unknown; gameId?: unknown; guestId?: unknown; guestPaid?: unknown; paymentId?: unknown }
    const platform = normalizePlatform(body.platform)
    const gameId = normalizeGameId(body.gameId)
    const downloadUrl = platform && gameId ? getLibraryDownloadUrl(platform, gameId) : ''
    if (!platform || !gameId || !downloadUrl) return jsonError('收藏信息无效')
    const db = leaderboardDb()
    await ensureTables(db)

    if (!member) {
      const guest = guestOwner(body.guestId)
      const paymentId = normalizeToken(body.paymentId)
      if (!guest || body.guestPaid !== true || !paymentId) return jsonError('请使用当前浏览器金币收藏', 402)
      const event = await db.prepare(`INSERT OR IGNORE INTO game_library_collection_events
        (event_key, owner_key, platform, game_id) VALUES (?, ?, ?, ?)`)
        .bind(`guest:${paymentId}`, guest, platform, gameId).run()
      if (!event.meta.changes) return jsonError('本次收藏已处理', 409)
      await db.prepare(`INSERT INTO game_library_guest_unlocks (owner_key, platform, game_id, expires_at_ms)
        VALUES (?, ?, ?, ?) ON CONFLICT(owner_key, platform, game_id)
        DO UPDATE SET expires_at_ms = excluded.expires_at_ms`)
        .bind(guest, platform, gameId, Date.now() + GUEST_UNLOCK_MS).run()
      return Response.json({ collected: false, guestUnlocked: true, count: await collectionCount(db, platform, gameId), downloadUrl, spent: PRICE }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const ownerKey = `member:${member.id}`
    const owned = await db.prepare('SELECT 1 AS found FROM game_library_collections WHERE owner_key = ? AND platform = ? AND game_id = ?').bind(ownerKey, platform, gameId).first<{ found: number }>()
    if (owned) return Response.json({ collected: true, count: await collectionCount(db, platform, gameId), downloadUrl, member }, { headers: { 'Cache-Control': 'private, no-store' } })
    if (member.id === 'local-owner-00001') {
      await recordMemberCollection(db, ownerKey, platform, gameId)
      return Response.json({ collected: true, count: await collectionCount(db, platform, gameId), downloadUrl, member }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const accounts = memberDb()
    const deduction = await accounts.prepare(`UPDATE members SET coin_balance = coin_balance - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND coin_balance >= ?`).bind(PRICE, member.id, PRICE).run()
    if (!deduction.meta.changes) return jsonError('玩家金币不足', 402)
    let inserted = false
    try {
      const result = await db.prepare('INSERT OR IGNORE INTO game_library_collections (owner_key, platform, game_id) VALUES (?, ?, ?)').bind(ownerKey, platform, gameId).run()
      inserted = Boolean(result.meta.changes)
      if (inserted) await db.prepare(`INSERT OR IGNORE INTO game_library_collection_events
        (event_key, owner_key, platform, game_id) VALUES (?, ?, ?, ?)`)
        .bind(`${ownerKey}:${platform}:${gameId}`, ownerKey, platform, gameId).run()
    } catch (error) {
      await refund(accounts, member.id)
      throw error
    }
    if (!inserted) await refund(accounts, member.id)
    const updated = await accounts.prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
    if (!updated) return jsonError('玩家账号不存在', 404)
    if (inserted) await accounts.prepare(`INSERT OR IGNORE INTO member_coin_transactions
      (member_id, amount, balance_after, reason, idempotency_key) VALUES (?, ?, ?, 'library_collection', ?)`)
      .bind(member.id, -PRICE, updated.coin_balance, `library_collection:${platform}:${gameId}`).run()
    return Response.json({ collected: true, count: await collectionCount(db, platform, gameId), downloadUrl, member: toMemberView(updated) }, { headers: { 'Cache-Control': 'private, no-store' } })
  },
} } })

function normalizePlatform(value: unknown): DownloadPlatform | '' {
  return typeof value === 'string' && PLATFORMS.has(value as DownloadPlatform) ? value as DownloadPlatform : ''
}
function normalizeGameId(value: unknown) {
  const valueString = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return /^[a-z0-9][a-z0-9-]{0,99}$/.test(valueString) ? valueString : ''
}
function normalizeToken(value: unknown) {
  const valueString = typeof value === 'string' ? value.trim() : ''
  return /^[a-z0-9-]{16,80}$/i.test(valueString) ? valueString : ''
}
function guestOwner(value: unknown) {
  const id = normalizeToken(value)
  return id ? `guest:${id}` : ''
}
function safeCount(value: unknown) { return Math.max(0, Number(value) || 0) }
async function collectionCount(db: ReturnType<typeof leaderboardDb>, platform: DownloadPlatform, gameId: string) {
  const row = await db.prepare('SELECT COUNT(*) AS total FROM game_library_collection_events WHERE platform = ? AND game_id = ?').bind(platform, gameId).first<{ total: number }>()
  return safeCount(row?.total)
}
async function recordMemberCollection(db: ReturnType<typeof leaderboardDb>, ownerKey: string, platform: DownloadPlatform, gameId: string) {
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO game_library_collections (owner_key, platform, game_id) VALUES (?, ?, ?)').bind(ownerKey, platform, gameId),
    db.prepare('INSERT OR IGNORE INTO game_library_collection_events (event_key, owner_key, platform, game_id) VALUES (?, ?, ?, ?)').bind(`${ownerKey}:${platform}:${gameId}`, ownerKey, platform, gameId),
  ])
}
async function refund(db: ReturnType<typeof memberDb>, memberId: string) {
  await db.prepare('UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(PRICE, memberId).run()
}
async function ensureTables(db: ReturnType<typeof leaderboardDb>) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_library_collections (
    owner_key TEXT NOT NULL, platform TEXT NOT NULL, game_id TEXT NOT NULL, collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_key, platform, game_id))`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_library_collection_events (
    event_key TEXT PRIMARY KEY, owner_key TEXT NOT NULL, platform TEXT NOT NULL, game_id TEXT NOT NULL,
    collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run()
  await db.prepare(`CREATE TABLE IF NOT EXISTS game_library_guest_unlocks (
    owner_key TEXT NOT NULL, platform TEXT NOT NULL, game_id TEXT NOT NULL, expires_at_ms INTEGER NOT NULL,
    PRIMARY KEY (owner_key, platform, game_id))`).run()
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_game_library_collection_events_game ON game_library_collection_events(platform, game_id, collected_at)').run()
  await db.prepare(`INSERT OR IGNORE INTO game_library_collection_events (event_key, owner_key, platform, game_id, collected_at)
    SELECT 'legacy:' || owner_key || ':' || platform || ':' || game_id, owner_key, platform, game_id, collected_at FROM game_library_collections`).run()
}
