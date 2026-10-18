import { createFileRoute } from '@tanstack/react-router'

import { getMemberFromRequest, jsonError, leaderboardDb, memberDb } from '#/lib/member-auth.server'

type WantedRow = {
  participant_key: string
  member_id: string | null
  display_name: string
  raw_minutes: number
  weighted_minutes: number
}

const WEEKLY_REWARDS = [5_000, 2_000, 1_000] as const
const ONLINE_TIME_REWARD = 500
let fairTimeTableReady: Promise<void> | null = null
const fairMigrationReady = new Map<string, Promise<void>>()

function ensureFairTimeTable() {
  fairTimeTableReady ??= (async () => {
    const db = leaderboardDb()
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS wanted_weekly_fair_time (
        participant_key TEXT NOT NULL,
        period_key TEXT NOT NULL,
        member_id TEXT,
        display_name TEXT NOT NULL,
        raw_minutes INTEGER NOT NULL DEFAULT 0,
        weighted_minutes INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (participant_key, period_key)
      )
    `).run()
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS wanted_fair_time_migrations (
        period_key TEXT NOT NULL,
        participant_key TEXT NOT NULL,
        migrated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (period_key, participant_key)
      )
    `).run()
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS wanted_weekly_online_time (
        participant_key TEXT NOT NULL,
        period_key TEXT NOT NULL,
        member_id TEXT,
        display_name TEXT NOT NULL,
        seconds INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (participant_key, period_key)
      )
    `).run()
  })().catch((error: unknown) => {
    fairTimeTableReady = null
    throw error
  })
  return fairTimeTableReady
}

function ensureCurrentWeekFairMigration(periodKey: string) {
  let promise = fairMigrationReady.get(periodKey)
  if (promise) return promise
  promise = (async () => {
    const db = leaderboardDb()
    let formerLeaders: { results: Array<WantedRow & { updated_at: string }> }
    try {
      formerLeaders = await db.prepare(`
        SELECT participant_key, member_id, display_name, raw_minutes, weighted_minutes, updated_at
        FROM wanted_weekly_playtime
        WHERE period_key = ? AND weighted_minutes > 0
        ORDER BY weighted_minutes DESC, updated_at ASC
        LIMIT 6
      `).bind(periodKey).all<WantedRow & { updated_at: string }>()
    } catch (error) {
      console.warn('[wanted] No former weekly table available for fair-time migration', error)
      return
    }
    for (const leader of formerLeaders.results) {
      const marked = await db.prepare(`
        INSERT OR IGNORE INTO wanted_fair_time_migrations (period_key, participant_key)
        VALUES (?, ?)
      `).bind(periodKey, leader.participant_key).run()
      if (!marked.meta.changes) continue
      const actualSeconds = Math.max(0, Math.floor(Number(leader.raw_minutes) || 0)) * 60
      if (actualSeconds < 1) continue
      await db.prepare(`
        INSERT INTO wanted_weekly_fair_time
          (participant_key, period_key, member_id, display_name, raw_minutes, weighted_minutes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_key, period_key) DO UPDATE SET
          member_id = COALESCE(excluded.member_id, member_id),
          display_name = excluded.display_name,
          raw_minutes = raw_minutes + excluded.raw_minutes,
          weighted_minutes = weighted_minutes + excluded.weighted_minutes,
          updated_at = CASE WHEN updated_at > excluded.updated_at THEN updated_at ELSE excluded.updated_at END
      `).bind(leader.participant_key, periodKey, leader.member_id, leader.display_name, actualSeconds, actualSeconds, leader.updated_at).run()
    }
  })().catch((error) => {
    fairMigrationReady.delete(periodKey)
    throw error
  })
  fairMigrationReady.set(periodKey, promise)
  return promise
}

export const Route = createFileRoute('/api/wanted')({
  server: { handlers: {
    GET: async ({ request }) => {
      await ensureFairTimeTable()
      const periodKey = getWantedWeekKey(Date.now())
      await ensureCurrentWeekFairMigration(periodKey)
      await ensurePreviousWeekAwards()
      const member = await getMemberFromRequest(request)
      const url = new URL(request.url)
      const guestKey = normalizeGuestKey(url.searchParams.get('guest'))
      if (member && guestKey) await adoptGuestWantedIdentity(member.id, member.displayName, guestKey)
      const rows = await leaderboardDb().prepare(`
        SELECT participant_key, member_id, display_name, raw_minutes, weighted_minutes
        FROM wanted_weekly_fair_time
        WHERE period_key = ? AND weighted_minutes > 0
        ORDER BY weighted_minutes DESC, updated_at ASC LIMIT 6
      `).bind(periodKey).all<WantedRow>()
      const posterAssignments = await ensureWantedPosterAssignments(periodKey, rows.results.slice(0, 3))
      const onlineLeader = await leaderboardDb().prepare(`
        SELECT display_name, seconds FROM wanted_weekly_online_time
        WHERE period_key = ? AND seconds > 0
          AND participant_key NOT IN (
            SELECT participant_key FROM wanted_weekly_fair_time
            WHERE period_key = ? AND weighted_minutes > 0
            ORDER BY weighted_minutes DESC, updated_at ASC LIMIT 3
          )
        ORDER BY seconds DESC, updated_at ASC LIMIT 1
      `).bind(periodKey, periodKey).first<{ display_name: string; seconds: number }>()
      const participantKey = member ? `member:${member.id}` : guestKey
      const expiredRewards = participantKey ? await expireWantedRewards(participantKey) : []
      const pending = participantKey ? await leaderboardDb().prepare(`
        SELECT period_key, rank, reward_coins FROM wanted_weekly_awards
        WHERE participant_key = ? AND claimed_at IS NULL
          AND datetime('now') < datetime(period_key, '+7 days', '+19 hours')
        ORDER BY period_key ASC
      `).bind(participantKey).all<{ period_key: string; rank: number; reward_coins: number }>() : { results: [] }
      const lastWeekChampion = await leaderboardDb().prepare(`
        SELECT display_name FROM wanted_weekly_awards
        WHERE period_key < ? AND rank = 1
        ORDER BY period_key DESC LIMIT 1
      `).bind(periodKey).first<{ display_name: string }>()
      return Response.json({
        periodKey,
        leaders: rows.results.map((row, index) => ({ rank: index + 1, displayName: row.display_name, seconds: row.weighted_minutes, posterNumber: posterAssignments.get(row.participant_key) })),
        onlineLeader: onlineLeader ? { displayName: onlineLeader.display_name, seconds: Number(onlineLeader.seconds) || 0, coins: ONLINE_TIME_REWARD } : null,
        pendingRewards: pending.results.map(row => ({ periodKey: row.period_key, rank: row.rank, coins: row.reward_coins })),
        expiredRewards,
        lastWeekChampion: lastWeekChampion?.display_name ?? null,
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    },
    POST: async ({ request }) => {
      await ensureFairTimeTable()
      const currentPeriodKey = getWantedWeekKey(Date.now())
      await ensureCurrentWeekFairMigration(currentPeriodKey)
      const body = await request.json() as { action?: unknown; sessionType?: unknown; guestKey?: unknown; guestName?: unknown; seconds?: unknown; minutes?: unknown; submissionKey?: unknown }
      const member = await getMemberFromRequest(request)
      const guestKey = normalizeGuestKey(body.guestKey)
      const participantKey = member ? `member:${member.id}` : guestKey
      if (!participantKey) return jsonError('参与者信息无效')
      if (member && guestKey) await adoptGuestWantedIdentity(member.id, member.displayName, guestKey)

      if (body.action === 'session') {
        const submissionKey = typeof body.submissionKey === 'string' ? body.submissionKey.trim().slice(0, 160) : ''
        if (!/^[a-zA-Z0-9:_-]{8,160}$/.test(submissionKey)) return jsonError('计时记录无效')
        const displayName = member?.displayName || normalizeGuestName(body.guestName, participantKey)
        // Older cached clients did not send a type and only recorded game sessions.
        const sessionType = body.sessionType === 'online'
          ? 'online'
          : body.sessionType === 'pro'
            ? 'pro'
            : body.sessionType === 'handheld'
              ? 'handheld'
            : body.sessionType === 'featured'
              ? 'featured'
              : 'game'
        const requestedSeconds = body.seconds === undefined ? Number(body.minutes) * 60 : Number(body.seconds)
        const seconds = Math.min(12 * 60 * 60, Math.max(0, Math.floor(requestedSeconds || 0)))
        if (seconds < 1) return jsonError('本次没有可累计的实时时间')
        const periodKey = currentPeriodKey
        const db = leaderboardDb()
        const accepted = await db.prepare(`INSERT OR IGNORE INTO wanted_playtime_submissions (submission_key, participant_key, period_key) VALUES (?, ?, ?)`)
          .bind(submissionKey, participantKey, periodKey).run()
        if (sessionType === 'online') {
          if (accepted.meta.changes) await db.prepare(`
            INSERT INTO wanted_weekly_online_time (participant_key, period_key, member_id, display_name, seconds)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(participant_key, period_key) DO UPDATE SET
              member_id = excluded.member_id,
              display_name = excluded.display_name,
              seconds = seconds + excluded.seconds,
              updated_at = CURRENT_TIMESTAMP
          `).bind(participantKey, periodKey, member?.id ?? null, displayName, seconds).run()
          return Response.json({ ok: true, sessionType, seconds })
        }
        let creditedSeconds = 0
        if (accepted.meta.changes) {
          creditedSeconds = seconds
          if (creditedSeconds > 0) await db.batch([
            db.prepare(`
              INSERT INTO wanted_weekly_fair_time (participant_key, period_key, member_id, display_name, raw_minutes, weighted_minutes)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(participant_key, period_key) DO UPDATE SET
                member_id = excluded.member_id,
                display_name = excluded.display_name,
                raw_minutes = raw_minutes + excluded.raw_minutes,
                weighted_minutes = weighted_minutes + excluded.weighted_minutes,
                updated_at = CURRENT_TIMESTAMP
            `).bind(participantKey, periodKey, member?.id ?? null, displayName, creditedSeconds, creditedSeconds),
          ])
        }
        return Response.json({ ok: true, sessionType, seconds: creditedSeconds })
      }

      if (body.action === 'claim') {
        await ensurePreviousWeekAwards()
        await expireWantedRewards(participantKey)
        const db = leaderboardDb()
        const awards = await db.prepare(`SELECT period_key, rank, reward_coins FROM wanted_weekly_awards WHERE participant_key = ? AND claimed_at IS NULL AND datetime('now') < datetime(period_key, '+7 days', '+19 hours') ORDER BY period_key ASC`).bind(participantKey).all<{ period_key: string; rank: number; reward_coins: number }>()
        const total = awards.results.reduce((sum, row) => sum + Math.max(0, Number(row.reward_coins) || 0), 0)
        if (total <= 0) return Response.json({ ok: true, coins: 0 })
        let credited = Math.min(total, 99_999)
        if (member) {
          const rewardKey = `wanted-weekly:${awards.results.map(row => row.period_key).join(',')}`
          const account = await memberDb().prepare('SELECT coin_balance FROM members WHERE id = ?').bind(member.id).first<{ coin_balance: number }>()
          credited = Math.min(total, Math.max(0, 99_999 - (Number(account?.coin_balance) || 0)))
          if (account && credited > 0) await memberDb().batch([
            memberDb().prepare(`UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND NOT EXISTS (SELECT 1 FROM member_coin_transactions WHERE member_id = ? AND idempotency_key = ?)`)
              .bind(credited, member.id, member.id, rewardKey),
            memberDb().prepare(`INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key) SELECT id, ?, coin_balance, 'wanted_weekly_reward', ? FROM members WHERE id = ?`)
              .bind(credited, rewardKey, member.id),
          ])
        }
        await db.prepare(`UPDATE wanted_weekly_awards SET claimed_at = CURRENT_TIMESTAMP WHERE participant_key = ? AND claimed_at IS NULL`).bind(participantKey).run()
        return Response.json({ ok: true, coins: credited, destination: member ? 'member' : 'browser' })
      }
      return jsonError('不支持的操作')
    },
  } },
})

function normalizeGuestKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim().slice(0, 80) : ''
  return /^guest:[a-zA-Z0-9_-]{12,72}$/.test(key) ? key : null
}

function normalizeGuestName(value: unknown, participantKey: string) {
  const name = typeof value === 'string' ? value.trim().slice(0, 20) : ''
  return name || `游客${participantKey.slice(-5).toUpperCase()}`
}

function getWantedWeekKey(timestamp: number) {
  const shifted = new Date(timestamp + 5 * 60 * 60 * 1000)
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysSinceMonday)).toISOString().slice(0, 10)
}

async function adoptGuestWantedIdentity(memberId: string, displayName: string, guestKey: string) {
  const memberKey = `member:${memberId}`
  const db = leaderboardDb()
  const guestRecord = await db.prepare(`
    SELECT 1 AS found FROM wanted_weekly_fair_time WHERE participant_key = ?
    UNION ALL
    SELECT 1 AS found FROM wanted_weekly_online_time WHERE participant_key = ?
    UNION ALL
    SELECT 1 AS found FROM wanted_weekly_awards WHERE participant_key = ?
    LIMIT 1
  `).bind(guestKey, guestKey, guestKey).first<{ found: number }>()
  if (!guestRecord) return

  await db.batch([
    db.prepare(`
      INSERT INTO wanted_weekly_fair_time
        (participant_key, period_key, member_id, display_name, raw_minutes, weighted_minutes, updated_at)
      SELECT ?, period_key, ?, ?, raw_minutes, weighted_minutes, updated_at
      FROM wanted_weekly_fair_time WHERE participant_key = ?
      ON CONFLICT(participant_key, period_key) DO UPDATE SET
        member_id = excluded.member_id,
        display_name = excluded.display_name,
        raw_minutes = raw_minutes + excluded.raw_minutes,
        weighted_minutes = weighted_minutes + excluded.weighted_minutes,
        updated_at = CASE WHEN updated_at > excluded.updated_at THEN updated_at ELSE excluded.updated_at END
    `).bind(memberKey, memberId, displayName, guestKey),
    db.prepare(`DELETE FROM wanted_weekly_fair_time WHERE participant_key = ?`).bind(guestKey),
    db.prepare(`
      INSERT INTO wanted_weekly_online_time
        (participant_key, period_key, member_id, display_name, seconds, updated_at)
      SELECT ?, period_key, ?, ?, seconds, updated_at
      FROM wanted_weekly_online_time WHERE participant_key = ?
      ON CONFLICT(participant_key, period_key) DO UPDATE SET
        member_id = excluded.member_id,
        display_name = excluded.display_name,
        seconds = seconds + excluded.seconds,
        updated_at = CASE WHEN updated_at > excluded.updated_at THEN updated_at ELSE excluded.updated_at END
    `).bind(memberKey, memberId, displayName, guestKey),
    db.prepare(`DELETE FROM wanted_weekly_online_time WHERE participant_key = ?`).bind(guestKey),
    db.prepare(`
      UPDATE wanted_weekly_awards
      SET participant_key = ?, member_id = ?, display_name = ?
      WHERE participant_key = ? AND claimed_at IS NULL
    `).bind(memberKey, memberId, displayName, guestKey),
    db.prepare(`UPDATE wanted_playtime_submissions SET participant_key = ? WHERE participant_key = ?`).bind(memberKey, guestKey),
    db.prepare(`
      INSERT OR IGNORE INTO wanted_weekly_posters (period_key, participant_key, poster_number)
      SELECT period_key, ?, poster_number FROM wanted_weekly_posters WHERE participant_key = ?
    `).bind(memberKey, guestKey),
    db.prepare(`DELETE FROM wanted_weekly_posters WHERE participant_key = ?`).bind(guestKey),
  ])
}

async function ensureWantedPosterAssignments(periodKey: string, leaders: WantedRow[]) {
  const db = leaderboardDb()
  for (const leader of leaders) {
    const assigned = await db.prepare(`
      SELECT poster_number FROM wanted_weekly_posters
      WHERE period_key = ? AND participant_key = ?
    `).bind(periodKey, leader.participant_key).first<{ poster_number: number }>()
    if (assigned) continue

    const firstPoster = stablePosterNumber(`${periodKey}:${leader.participant_key}`)
    for (let offset = 0; offset < 18; offset += 1) {
      const posterNumber = (firstPoster + offset - 1) % 18 + 1
      await db.prepare(`
        INSERT OR IGNORE INTO wanted_weekly_posters (period_key, participant_key, poster_number)
        VALUES (?, ?, ?)
      `).bind(periodKey, leader.participant_key, posterNumber).run()
      const created = await db.prepare(`
        SELECT poster_number FROM wanted_weekly_posters
        WHERE period_key = ? AND participant_key = ?
      `).bind(periodKey, leader.participant_key).first<{ poster_number: number }>()
      if (created) break
    }
  }

  const assignments = await db.prepare(`
    SELECT participant_key, poster_number FROM wanted_weekly_posters WHERE period_key = ?
  `).bind(periodKey).all<{ participant_key: string; poster_number: number }>()
  return new Map(assignments.results.map(row => [row.participant_key, row.poster_number]))
}

function stablePosterNumber(seed: string) {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 18 + 1
}

async function expireWantedRewards(participantKey: string) {
  const db = leaderboardDb()
  const expired = await db.prepare(`
    SELECT period_key, rank, reward_coins FROM wanted_weekly_awards
    WHERE participant_key = ? AND claimed_at IS NULL
      AND datetime('now') >= datetime(period_key, '+7 days', '+19 hours')
    ORDER BY period_key ASC
  `).bind(participantKey).all<{ period_key: string; rank: number; reward_coins: number }>()
  if (expired.results.length) await db.prepare(`
    UPDATE wanted_weekly_awards SET claimed_at = 'expired'
    WHERE participant_key = ? AND claimed_at IS NULL
      AND datetime('now') >= datetime(period_key, '+7 days', '+19 hours')
  `).bind(participantKey).run()
  return expired.results.map(row => ({ periodKey: row.period_key, rank: row.rank, coins: row.reward_coins }))
}

async function ensurePreviousWeekAwards() {
  const db = leaderboardDb()
  const currentKey = getWantedWeekKey(Date.now())
  const periods = await db.prepare(`
    SELECT period_key FROM (
      SELECT DISTINCT period_key FROM wanted_weekly_fair_time WHERE period_key < ?
      UNION
      SELECT DISTINCT period_key FROM wanted_weekly_online_time WHERE period_key < ?
    ) ORDER BY period_key ASC LIMIT 8
  `).bind(currentKey, currentKey).all<{ period_key: string }>()
  for (const period of periods.results) {
    const leaders = await db.prepare(`
      SELECT participant_key, member_id, display_name, weighted_minutes
      FROM wanted_weekly_fair_time WHERE period_key = ? AND weighted_minutes > 0
      ORDER BY weighted_minutes DESC, updated_at ASC LIMIT 3
    `).bind(period.period_key).all<WantedRow>()
    if (leaders.results.length) await db.batch(leaders.results.map((row, index) => db.prepare(`
      INSERT OR IGNORE INTO wanted_weekly_awards
        (period_key, rank, participant_key, member_id, display_name, weighted_minutes, reward_coins)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(period.period_key, index + 1, row.participant_key, row.member_id, row.display_name, row.weighted_minutes, WEEKLY_REWARDS[index] ?? 0)))
    const onlineLeader = await db.prepare(`
      SELECT participant_key, member_id, display_name, seconds
      FROM wanted_weekly_online_time WHERE period_key = ? AND seconds > 0
        AND participant_key NOT IN (
          SELECT participant_key FROM wanted_weekly_fair_time
          WHERE period_key = ? AND weighted_minutes > 0
          ORDER BY weighted_minutes DESC, updated_at ASC LIMIT 3
        )
      ORDER BY seconds DESC, updated_at ASC LIMIT 1
    `).bind(period.period_key, period.period_key).first<{ participant_key: string; member_id: string | null; display_name: string; seconds: number }>()
    if (onlineLeader) await db.prepare(`
      INSERT OR IGNORE INTO wanted_weekly_awards
        (period_key, rank, participant_key, member_id, display_name, weighted_minutes, reward_coins)
      VALUES (?, 4, ?, ?, ?, ?, ?)
    `).bind(period.period_key, onlineLeader.participant_key, onlineLeader.member_id, onlineLeader.display_name, onlineLeader.seconds, ONLINE_TIME_REWARD).run()
  }
}
