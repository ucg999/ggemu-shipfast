import { createFileRoute } from '@tanstack/react-router'

import { getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

type CountRow = { count: number | string }

export const Route = createFileRoute('/api/owner-site-stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const member = await getMemberFromRequest(request)
        if (!member || member.playerNumber !== 1) return jsonError('无权查看网站统计', 403)
        if (member.id === 'local-owner-00001') {
          return Response.json({ online: 1, today: 1, month: 1, updatedAt: Date.now(), preview: true }, {
            headers: { 'Cache-Control': 'private, no-store' },
          })
        }

        await ensureVisitorStatsTable()
        const today = getShanghaiDateKey()
        const month = today.slice(0, 7)
        const [online, daily, monthly] = await Promise.all([
          memberDb().prepare(`
            SELECT COUNT(DISTINCT visitor_key) AS count
            FROM site_visitor_daily
            WHERE last_seen_at >= ?
          `).bind(toSqlTimestamp(Date.now() - 10 * 60_000)).first<CountRow>(),
          memberDb().prepare(`
            SELECT COUNT(*) AS count FROM site_visitor_daily WHERE visit_date = ?
          `).bind(today).first<CountRow>(),
          memberDb().prepare(`
            SELECT COUNT(DISTINCT visitor_key) AS count
            FROM site_visitor_daily WHERE substr(visit_date, 1, 7) = ?
          `).bind(month).first<CountRow>(),
        ])

        return Response.json({
          online: toCount(online),
          today: toCount(daily),
          month: toCount(monthly),
          updatedAt: Date.now(),
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({})) as { guestKey?: unknown }
        const member = await getMemberFromRequest(request)
        const guestKey = normalizeGuestKey(body.guestKey)
        const visitorKey = member ? `member:${member.id}` : guestKey
        if (!visitorKey) return jsonError('访客信息无效')
        if (member?.id === 'local-owner-00001') return Response.json({ recorded: true, preview: true })

        await ensureVisitorStatsTable()
        await memberDb().prepare(`
          INSERT INTO site_visitor_daily (visitor_key, visit_date, first_seen_at, last_seen_at)
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(visitor_key, visit_date) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP
          WHERE site_visitor_daily.last_seen_at < ?
        `).bind(visitorKey, getShanghaiDateKey(), toSqlTimestamp(Date.now() - 4 * 60_000)).run()
        return Response.json({ recorded: true }, { headers: { 'Cache-Control': 'no-store' } })
      },
    },
  },
})

let tableReady: Promise<void> | null = null

function ensureVisitorStatsTable() {
  tableReady ??= (async () => {
    await memberDb().prepare(`
      CREATE TABLE IF NOT EXISTS site_visitor_daily (
        visitor_key TEXT NOT NULL,
        visit_date TEXT NOT NULL,
        first_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (visitor_key, visit_date)
      )
    `).run()
    await memberDb().prepare(`
      CREATE INDEX IF NOT EXISTS site_visitor_daily_last_seen_idx
      ON site_visitor_daily (last_seen_at)
    `).run()
  })().catch((error) => {
    tableReady = null
    throw error
  })
  return tableReady
}

function normalizeGuestKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : ''
  return /^guest:[a-zA-Z0-9_-]{12,72}$/.test(key) ? key : null
}

function getShanghaiDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

function toCount(row: CountRow | null) {
  return Math.max(0, Math.floor(Number(row?.count) || 0))
}

function toSqlTimestamp(value: number) {
  return new Date(value).toISOString().replace('T', ' ').replace('Z', '')
}
