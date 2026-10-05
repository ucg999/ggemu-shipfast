import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, leaderboardDb, memberDb } from '#/lib/member-auth.server'

type RankRow = { display_name: string; score: number; wins: number; losses: number; updated_at: string }
type WeeklyCoinRow = { player_id: string; display_name: string; coins: number }
type PresenceRow = { member_id: string; display_name: string; bets_json: string; game_mode: string; credits: number; room_id: string | null; room_seat: number | null; last_seen_at: string }
type SharedRoundRow = { round_token: string; starts_at_ms: number; target_index: number; award_member_id: string | null; award_amount: number; competition_round: number; competition_jackpot: number }
type CompetitionRow = { round_number: number; jackpot: number; win_counts_json: string; win_coins_json: string; last_round_token: string | null }

export const Route = createFileRoute('/api/coin-challenge-community')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const searchParams = new URL(request.url).searchParams
        const channel = normalizeChatChannel(searchParams.get('channel'))
        const leaderboardMode = normalizeArenaMode(searchParams.get('mode'))
        if (searchParams.get('round') === '1' || searchParams.get('room') === '1') {
          return jsonError('联机功能已关闭', 410)
        }
        if (searchParams.get('round') === '1') {
          const sharedRound = await memberDb().prepare(`
            SELECT round_token, starts_at_ms, target_index, award_member_id, award_amount, competition_round, competition_jackpot FROM coin_challenge_shared_rounds WHERE room_id = '1'
          `).first<SharedRoundRow>()
          return Response.json({
            sharedRound: sharedRound && sharedRound.starts_at_ms >= Date.now() - 12_000
              ? sharedRoundView(sharedRound)
              : null,
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        }
        const member = await getMemberFromRequest(request)
        if (searchParams.get('room') === '1') {
          const [onlineResult, sharedRound, competition] = await Promise.all([
            memberDb().prepare(`
              SELECT member_id, display_name, bets_json, game_mode, credits, room_id, room_seat, last_seen_at
              FROM coin_challenge_presence WHERE game_channel = ? AND last_seen_at >= datetime('now', '-30 minutes')
              ORDER BY last_seen_at DESC LIMIT 30
            `).bind(channel).all<PresenceRow>(),
            memberDb().prepare(`SELECT round_token, starts_at_ms, target_index, award_member_id, award_amount, competition_round, competition_jackpot FROM coin_challenge_shared_rounds WHERE room_id = '1'`).first<SharedRoundRow>(),
            memberDb().prepare(`SELECT round_number, jackpot, win_counts_json, win_coins_json, last_round_token FROM coin_challenge_room_competitions WHERE room_id = '1'`).first<CompetitionRow>(),
          ])
          const now = Date.now()
          return Response.json({
            online: onlineResult.results.length,
            winCounts: parseWinCounts(competition?.win_counts_json),
            winCoins: parseWinCounts(competition?.win_coins_json),
            sharedRound: sharedRound && sharedRound.starts_at_ms >= now - 12_000 ? sharedRoundView(sharedRound) : null,
            room: {
              joined: Boolean(member && onlineResult.results.some(row => row.member_id === member.id && row.room_id === '1')),
              count: onlineResult.results.filter(row => row.room_id === '1').length,
              capacity: 4,
            },
            players: onlineResult.results.map(row => ({
              memberId: row.member_id, displayName: row.display_name, bets: parseBets(row.bets_json),
              mode: row.game_mode, credits: Math.max(0, Number(row.credits) || 0),
              inRoom: row.room_id === '1', seat: row.room_seat,
            })),
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        }
        const leaderboardGame = channel === 'ghost-hunter' ? 'ghost-hunter' : channel === 'red-blue-arena' ? 'red-blue-arena' : 'coin-challenge'
        const leaderboardPeriodKey = channel === 'red-blue-arena' ? leaderboardMode : 'all'
        const leaderboardMetric = channel === 'red-blue-arena' ? 's.wins' : 's.score'
        if (channel === 'red-blue-arena') await settleArenaWeeks()
        const rankPromise = leaderboardDb().prepare(`
          SELECT p.nickname AS display_name, ${leaderboardMetric} AS score, s.wins, s.losses, s.updated_at
          FROM leaderboard_scores s JOIN leaderboard_players p ON p.player_id = s.player_id
          WHERE s.game_id = ? AND s.period_type = 'all' AND s.period_key = ? AND ${channel === 'red-blue-arena' ? '(s.wins + s.losses)' : leaderboardMetric} > 0
          ORDER BY ${leaderboardMetric} DESC, s.losses ASC, s.updated_at ASC LIMIT 10
        `).bind(leaderboardGame, leaderboardPeriodKey).all<RankRow>()
        const [onlineResult, sharedRound, competition, rankResult] = await Promise.all([
          memberDb().prepare(`
            SELECT member_id, display_name, bets_json, game_mode, credits, room_id, room_seat, last_seen_at
            FROM coin_challenge_presence WHERE game_channel = ? AND last_seen_at >= datetime('now', '-30 minutes')
            ORDER BY last_seen_at DESC LIMIT 30
          `).bind(channel).all<PresenceRow>(),
          memberDb().prepare(`SELECT round_token, starts_at_ms, target_index, award_member_id, award_amount, competition_round, competition_jackpot FROM coin_challenge_shared_rounds WHERE room_id = '1'`).first<SharedRoundRow>(),
          memberDb().prepare(`SELECT round_number, jackpot, win_counts_json, win_coins_json, last_round_token FROM coin_challenge_room_competitions WHERE room_id = '1'`).first<CompetitionRow>(),
          rankPromise,
        ])
        const now = Date.now()
        const weeklyKey = getArenaWeekKey(now)
        const [bountyResult, arrestResult] = channel === 'red-blue-arena'
          ? await Promise.all([
              leaderboardDb().prepare(`
                SELECT s.player_id, p.nickname AS display_name, s.won_coins AS coins
                FROM arena_weekly_coin_scores s JOIN leaderboard_players p ON p.player_id = s.player_id
                WHERE s.period_key = ? AND s.won_coins > 0
                ORDER BY s.won_coins DESC, s.updated_at ASC LIMIT 10
              `).bind(weeklyKey).all<WeeklyCoinRow>(),
              leaderboardDb().prepare(`
                SELECT s.player_id, p.nickname AS display_name, s.lost_coins AS coins
                FROM arena_weekly_coin_scores s JOIN leaderboard_players p ON p.player_id = s.player_id
                WHERE s.period_key = ? AND s.lost_coins > 0
                ORDER BY s.lost_coins DESC, s.updated_at ASC LIMIT 10
              `).bind(weeklyKey).all<WeeklyCoinRow>(),
            ])
          : [{ results: [] as WeeklyCoinRow[] }, { results: [] as WeeklyCoinRow[] }]
        const lastWeekChampion = channel === 'red-blue-arena'
          ? await leaderboardDb().prepare(`
              SELECT CASE WHEN x.reward_coins > 0 THEN arrest.nickname ELSE bounty.nickname END AS display_name
              FROM arena_weekly_settlements x
              LEFT JOIN leaderboard_players bounty ON bounty.player_id = x.bounty_player_id
              LEFT JOIN leaderboard_players arrest ON arrest.player_id = x.arrest_player_id
              WHERE x.period_key < ?
              ORDER BY x.period_key DESC LIMIT 1
            `).bind(weeklyKey).first<{ display_name: string | null }>()
          : null
        return Response.json({
          leaderboard: rankResult.results.map((row: RankRow, index: number) => ({ rank: index + 1, displayName: row.display_name, score: row.score, wins: row.wins, losses: row.losses, updatedAt: row.updated_at })),
          bountyLeaderboard: bountyResult.results.map((row, index) => ({ rank: index + 1, displayName: row.display_name, coins: row.coins })),
          arrestLeaderboard: arrestResult.results.map((row, index) => ({ rank: index + 1, displayName: row.display_name, coins: row.coins })),
          lastWeekChampion: lastWeekChampion?.display_name ?? null,
          member,
          online: onlineResult.results.length,
          winCounts: parseWinCounts(competition?.win_counts_json),
          winCoins: parseWinCounts(competition?.win_coins_json),
          sharedRound: sharedRound && sharedRound.starts_at_ms >= now - 12_000
            ? sharedRoundView(sharedRound)
            : null,
          room: {
            joined: Boolean(member && onlineResult.results.some((row: PresenceRow) => row.member_id === member.id && row.room_id === '1')),
            count: onlineResult.results.filter((row: PresenceRow) => row.room_id === '1').length,
            capacity: 4,
          },
          players: onlineResult.results.map((row: PresenceRow) => ({
            memberId: row.member_id,
            displayName: row.display_name,
            bets: parseBets(row.bets_json),
            mode: row.game_mode,
            credits: Math.max(0, Number(row.credits) || 0),
            inRoom: row.room_id === '1',
            seat: row.room_seat,
          })),
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const member = await getMemberFromRequest(request)
          if (!member) return jsonError('请先登录玩家账号', 401)
          if (member.needsNickname) return jsonError('请先完成必填昵称设置', 428)
          const body = await request.json() as Record<string, unknown>
          const channel = normalizeChatChannel(body.channel)
          if (['presence', 'presence-leave', 'room-join', 'room-leave', 'round-start'].includes(String(body.action))) {
            return jsonError('联机功能已关闭', 410)
          }
          if (body.action === 'presence') {
            const bets = Array.isArray(body.bets)
              ? body.bets.slice(0, 8).map(value => Math.min(9, Math.max(0, Math.floor(Number(value) || 0))))
              : []
            while (bets.length < 8) bets.push(0)
            const mode = body.mode === 'gold' || body.mode === 'ghost' ? body.mode : 'normal'
            const credits = Math.min(99_999, Math.max(0, Math.floor(Number(body.credits) || 0)))
            await memberDb().prepare(`
              INSERT INTO coin_challenge_presence (member_id, display_name, bets_json, game_mode, credits, game_channel, last_seen_at)
              VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(member_id) DO UPDATE SET display_name = excluded.display_name, bets_json = excluded.bets_json,
                game_mode = excluded.game_mode, credits = excluded.credits, game_channel = excluded.game_channel, last_seen_at = CURRENT_TIMESTAMP
              WHERE coin_challenge_presence.display_name <> excluded.display_name
                OR coin_challenge_presence.bets_json <> excluded.bets_json
                OR coin_challenge_presence.game_mode <> excluded.game_mode
                OR coin_challenge_presence.credits <> excluded.credits
                OR coin_challenge_presence.game_channel <> excluded.game_channel
                OR coin_challenge_presence.last_seen_at < datetime('now', '-30 minutes')
            `).bind(member.id, member.displayName, JSON.stringify(bets), mode, credits, channel).run()
            return Response.json({ ok: true })
          }
          if (body.action === 'presence-leave') {
            await memberDb().prepare('DELETE FROM coin_challenge_presence WHERE member_id = ? AND game_channel = ?').bind(member.id, channel).run()
            return Response.json({ ok: true })
          }
          if (body.action === 'room-join') {
            const current = await memberDb().prepare(`SELECT room_id, room_seat FROM coin_challenge_presence WHERE member_id = ?`).bind(member.id).first<{ room_id: string | null; room_seat: number | null }>()
            if (current?.room_id === '1' && current.room_seat) return Response.json({ ok: true, joined: true, seat: current.room_seat })
            const room = await memberDb().prepare(`
              SELECT room_seat FROM coin_challenge_presence
              WHERE room_id = '1' AND last_seen_at >= datetime('now', '-30 minutes')
            `).all<{ room_seat: number | null }>()
            const occupied = new Set(room.results.map(row => Number(row.room_seat)).filter(seat => seat >= 1 && seat <= 4))
            const seat = [1, 2, 3, 4].find(value => !occupied.has(value))
            if (!seat) return jsonError('1号房间已满，请稍后再试', 409)
            await memberDb().prepare(`
              INSERT INTO coin_challenge_presence (member_id, display_name, room_id, room_seat, game_channel, last_seen_at)
              VALUES (?, ?, '1', ?, 'coin-challenge', CURRENT_TIMESTAMP)
              ON CONFLICT(member_id) DO UPDATE SET room_id = '1', room_seat = excluded.room_seat,
                display_name = excluded.display_name, game_channel = 'coin-challenge', last_seen_at = CURRENT_TIMESTAMP
            `).bind(member.id, member.displayName, seat).run()
            return Response.json({ ok: true, joined: true, seat })
          }
          if (body.action === 'room-leave') {
            await memberDb().prepare(`UPDATE coin_challenge_presence SET room_id = NULL, room_seat = NULL, bets_json = '[0,0,0,0,0,0,0,0]', last_seen_at = CURRENT_TIMESTAMP WHERE member_id = ?`).bind(member.id).run()
            return Response.json({ ok: true, joined: false })
          }
          if (body.action === 'round-start') {
            const roomMember = await memberDb().prepare(`SELECT room_id, room_seat FROM coin_challenge_presence WHERE member_id = ?`).bind(member.id).first<{ room_id: string | null; room_seat: number | null }>()
            if (roomMember?.room_id !== '1') return Response.json({ ok: true, shared: false })
            if (roomMember.room_seat !== 1) return jsonError('请等待1P开始游戏', 403)

            const now = Date.now()
            const current = await memberDb().prepare(`
              SELECT round_token, starts_at_ms, target_index, award_member_id, award_amount, competition_round, competition_jackpot FROM coin_challenge_shared_rounds WHERE room_id = '1'
            `).first<SharedRoundRow>()
            if (current && current.starts_at_ms >= now - 1_000 && current.starts_at_ms <= now + 11_000) {
              return Response.json({ ok: true, shared: true, round: sharedRoundView(current) })
            }

            const token = crypto.randomUUID()
            // A short synchronization window lets every joined browser receive
            // the same target without showing a countdown to players.
            const startsAt = now + 2_000
            const target = chooseSharedTarget()
            const roomPlayers = await memberDb().prepare(`
              SELECT member_id, display_name, bets_json, game_mode, credits, room_id, room_seat, last_seen_at
              FROM coin_challenge_presence
              WHERE room_id = '1' AND last_seen_at >= datetime('now', '-30 minutes')
              ORDER BY room_seat ASC
            `).all<PresenceRow>()
            const competition = await settleCompetition(token, target, roomPlayers.results)
            await memberDb().batch([
              memberDb().prepare(`
                INSERT INTO coin_challenge_shared_rounds
                (room_id, round_token, starts_at_ms, target_index, award_member_id, award_amount, competition_round, competition_jackpot, created_at)
                VALUES ('1', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(room_id) DO UPDATE SET round_token = excluded.round_token,
                starts_at_ms = excluded.starts_at_ms, target_index = excluded.target_index,
                award_member_id = excluded.award_member_id, award_amount = excluded.award_amount,
                competition_round = excluded.competition_round, competition_jackpot = excluded.competition_jackpot,
                created_at = CURRENT_TIMESTAMP
              `).bind(token, startsAt, target, competition.awardMemberId, competition.awardAmount, competition.round, competition.jackpot),
              memberDb().prepare(`UPDATE coin_challenge_presence SET bets_json = '[0,0,0,0,0,0,0,0]' WHERE room_id = '1'`),
            ])
            return Response.json({ ok: true, shared: true, round: { token, startsAt, target, ...competition } })
          }
          if (body.action === 'score') {
            const score = Math.floor(Number(body.score) || 0)
            const submissionKey = typeof body.submissionKey === 'string' ? body.submissionKey.slice(0, 96) : ''
            if (score < 1 || score > 99_999 || !submissionKey) return jsonError('这次中奖记录不能上传')
            const ranking = leaderboardDb()
            await ranking.batch([
              ranking.prepare(`
                INSERT INTO leaderboard_players (player_id, nickname) VALUES (?, ?)
                ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, updated_at = CURRENT_TIMESTAMP
              `).bind(member.id, member.displayName),
              ranking.prepare(`INSERT INTO leaderboard_submissions (submission_key, game_id, player_id, score) VALUES (?, 'coin-challenge', ?, ?)`).bind(submissionKey, member.id, score),
              ranking.prepare(`
                INSERT INTO leaderboard_scores (game_id, player_id, period_type, period_key, score)
                VALUES ('coin-challenge', ?, 'all', 'all', ?)
                ON CONFLICT(game_id, player_id, period_type, period_key) DO UPDATE SET
                  score = MAX(score, excluded.score), updated_at = CURRENT_TIMESTAMP
              `).bind(member.id, score),
            ])
            return Response.json({ ok: true, score })
          }
          if (body.action === 'game-score') {
            const scoreChannel = normalizeChatChannel(body.channel)
            if (scoreChannel !== 'ghost-hunter' && scoreChannel !== 'red-blue-arena') return jsonError('不支持的排行榜')
            const score = Math.floor(Number(body.score) || 0)
            const submissionKey = typeof body.submissionKey === 'string' ? body.submissionKey.slice(0, 128) : ''
            const gameId = scoreChannel === 'ghost-hunter' ? 'ghost-hunter' : 'red-blue-arena'
            const periodKey = scoreChannel === 'red-blue-arena' ? normalizeArenaMode(body.mode) : 'all'
            const outcome = body.outcome === 'loss' ? 'loss' : body.outcome === 'draw' ? 'draw' : 'win'
            const wonCoins = Math.min(999_999, Math.max(0, Math.floor(Number(body.wonCoins) || 0)))
            const lostCoins = Math.min(999_999, Math.max(0, Math.floor(Number(body.lostCoins) || 0)))
            if (score < 1 || score > 999_999 || !submissionKey) return jsonError('成绩记录无效')
            const scoreUpdate = scoreChannel === 'ghost-hunter'
              ? 'score = MAX(score, excluded.score), updated_at = CURRENT_TIMESTAMP'
              : outcome === 'win'
                ? 'score = score + 1, wins = wins + 1, updated_at = CURRENT_TIMESTAMP'
                : outcome === 'loss' ? 'losses = losses + 1, updated_at = CURRENT_TIMESTAMP' : 'updated_at = CURRENT_TIMESTAMP'
            const initialWins = scoreChannel === 'red-blue-arena' && outcome === 'win' ? 1 : 0
            const initialLosses = scoreChannel === 'red-blue-arena' && outcome === 'loss' ? 1 : 0
            const initialScore = scoreChannel === 'red-blue-arena' ? initialWins : score
            const ranking = leaderboardDb()
            const statements = [
              ranking.prepare(`
                INSERT INTO leaderboard_players (player_id, nickname) VALUES (?, ?)
                ON CONFLICT(player_id) DO UPDATE SET nickname = excluded.nickname, updated_at = CURRENT_TIMESTAMP
              `).bind(member.id, member.displayName),
              ranking.prepare(`INSERT INTO leaderboard_submissions (submission_key, game_id, player_id, score) VALUES (?, ?, ?, ?)`).bind(submissionKey, gameId, member.id, score),
              ranking.prepare(`
                INSERT INTO leaderboard_scores (game_id, player_id, period_type, period_key, score, wins, losses)
                VALUES (?, ?, 'all', ?, ?, ?, ?)
                ON CONFLICT(game_id, player_id, period_type, period_key) DO UPDATE SET ${scoreUpdate}
              `).bind(gameId, member.id, periodKey, initialScore, initialWins, initialLosses),
            ]
            if (scoreChannel === 'red-blue-arena' && (wonCoins > 0 || lostCoins > 0)) {
              statements.push(ranking.prepare(`
                INSERT INTO arena_weekly_coin_scores (player_id, period_key, won_coins, lost_coins)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(player_id, period_key) DO UPDATE SET
                  won_coins = won_coins + excluded.won_coins,
                  lost_coins = lost_coins + excluded.lost_coins,
                  updated_at = CURRENT_TIMESTAMP
              `).bind(member.id, getArenaWeekKey(Date.now()), wonCoins, lostCoins))
            }
            await ranking.batch(statements)
            return Response.json({ ok: true, score })
          }
          return jsonError('不支持的操作')
        } catch (error) {
          if (error instanceof Response) return error
          const message = error instanceof Error ? error.message : ''
          if (
            message.includes('UNIQUE constraint failed: leaderboard_submissions.submission_key')
            || (message.includes('duplicate key value violates unique constraint') && message.includes('submission_key'))
          ) {
            return Response.json({ ok: true, duplicate: true })
          }
          return jsonError('操作失败，请稍后重试', 500)
        }
      },
    },
  },
})

function parseBets(value: string) {
  try {
    const bets = JSON.parse(value)
    return Array.isArray(bets) ? bets.slice(0, 8).map(item => Math.min(9, Math.max(0, Math.floor(Number(item) || 0)))) : Array(8).fill(0)
  } catch {
    return Array(8).fill(0)
  }
}

function normalizeChatChannel(value: unknown) {
  return value === 'red-blue-arena' || value === 'ghost-hunter' ? value : 'coin-challenge'
}

function normalizeArenaMode(value: unknown) {
  return value === 'three' || value === 'four' || value === 'team' || value === 'team3' || value === 'billiards'
    ? value
    : 'duel'
}

// Weekly periods use China Standard Time and roll over every Monday at 03:00.
// Shifting by UTC+8 and then back three hours lets UTC date arithmetic model
// that boundary without depending on the worker's host timezone.
function getArenaWeekKey(timestamp: number) {
  const shifted = new Date(timestamp + 5 * 60 * 60 * 1000)
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysSinceMonday))
  return monday.toISOString().slice(0, 10)
}

async function settleArenaWeeks() {
  const ranking = leaderboardDb()
  const currentKey = getArenaWeekKey(Date.now())
  const periods = await ranking.prepare(`
    SELECT DISTINCT s.period_key
    FROM arena_weekly_coin_scores s
    LEFT JOIN arena_weekly_settlements x ON x.period_key = s.period_key
    WHERE s.period_key < ? AND (x.period_key IS NULL OR x.reward_applied = 0)
    ORDER BY s.period_key ASC LIMIT 8
  `).bind(currentKey).all<{ period_key: string }>()

  for (const period of periods.results) {
    const totals = await ranking.prepare(`
      SELECT COALESCE(SUM(won_coins), 0) AS bounty_total,
             COALESCE(SUM(lost_coins), 0) AS arrest_total
      FROM arena_weekly_coin_scores WHERE period_key = ?
    `).bind(period.period_key).first<{ bounty_total: number; arrest_total: number }>()
    const bounty = await ranking.prepare(`SELECT player_id, won_coins AS coins FROM arena_weekly_coin_scores WHERE period_key = ? AND won_coins > 0 ORDER BY won_coins DESC, updated_at ASC LIMIT 1`).bind(period.period_key).first<{ player_id: string; coins: number }>()
    const arrest = await ranking.prepare(`SELECT player_id, lost_coins AS coins FROM arena_weekly_coin_scores WHERE period_key = ? AND lost_coins > 0 ORDER BY lost_coins DESC, updated_at ASC LIMIT 1`).bind(period.period_key).first<{ player_id: string; coins: number }>()
    const bountyTotal = Math.max(0, Number(totals?.bounty_total) || 0)
    const arrestTotal = Math.max(0, Number(totals?.arrest_total) || 0)
    const reward = arrest && arrestTotal > bountyTotal ? arrestTotal - bountyTotal : 0
    await ranking.prepare(`
      INSERT OR IGNORE INTO arena_weekly_settlements
        (period_key, bounty_player_id, bounty_coins, arrest_player_id, arrest_coins, reward_coins, reward_applied)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(period.period_key, bounty?.player_id ?? null, bountyTotal, arrest?.player_id ?? null, arrestTotal, reward, reward > 0 ? 0 : 1).run()

    if (reward <= 0 || !arrest) continue
    const rewardKey = `red-blue-arrest:${period.period_key}`
    const alreadyPaid = await memberDb().prepare('SELECT id FROM member_coin_transactions WHERE member_id = ? AND idempotency_key = ? LIMIT 1').bind(arrest.player_id, rewardKey).first<{ id: number }>()
    if (!alreadyPaid) {
      const account = await memberDb().prepare('SELECT coin_balance FROM members WHERE id = ?').bind(arrest.player_id).first<{ coin_balance: number }>()
      const credited = Math.min(reward, Math.max(0, 99_999 - (Number(account?.coin_balance) || 0)))
      if (account && credited > 0) {
        await memberDb().batch([
          memberDb().prepare(`UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND NOT EXISTS (SELECT 1 FROM member_coin_transactions WHERE member_id = ? AND idempotency_key = ?)`)
            .bind(credited, arrest.player_id, arrest.player_id, rewardKey),
          memberDb().prepare(`INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key) SELECT id, ?, coin_balance, 'red_blue_weekly_arrest_reward', ? FROM members WHERE id = ?`)
            .bind(credited, rewardKey, arrest.player_id),
        ])
      }
    }
    await ranking.prepare('UPDATE arena_weekly_settlements SET reward_applied = 1, settled_at = CURRENT_TIMESTAMP WHERE period_key = ?').bind(period.period_key).run()
  }
}

function sharedRoundView(row: SharedRoundRow) {
  return {
    token: row.round_token,
    startsAt: row.starts_at_ms,
    target: row.target_index,
    awardMemberId: row.award_member_id,
    awardAmount: Math.max(0, Number(row.award_amount) || 0),
    round: Math.max(0, Number(row.competition_round) || 0),
    jackpot: Math.max(0, Number(row.competition_jackpot) || 0),
  }
}

async function settleCompetition(token: string, target: number, players: Array<PresenceRow>) {
  if (players.length < 2) {
    await memberDb().prepare(`
      INSERT INTO coin_challenge_room_competitions (room_id) VALUES ('1')
      ON CONFLICT(room_id) DO UPDATE SET round_number = 0, jackpot = 0,
        win_counts_json = '{}', win_coins_json = '{}', last_round_token = NULL, updated_at = CURRENT_TIMESTAMP
    `).run()
    return { round: 0, jackpot: 0, awardMemberId: null as string | null, awardAmount: 0 }
  }
  const previous = await memberDb().prepare(`
    SELECT round_number, jackpot, win_counts_json, win_coins_json, last_round_token
    FROM coin_challenge_room_competitions WHERE room_id = '1'
  `).first<CompetitionRow>()
  if (previous?.last_round_token === token) {
    return { round: previous.round_number, jackpot: previous.jackpot, awardMemberId: null as string | null, awardAmount: 0 }
  }
  const outcome = SHARED_OUTCOMES[target]
  const counts = parseWinCounts(previous?.win_counts_json)
  const wonCoins = parseWinCounts(previous?.win_coins_json)
  let lostCoins = 0
  for (const player of players) {
    const bets = parseBets(player.bets_json)
    const total = bets.reduce((sum, value) => sum + value, 0)
    const won = outcome?.option !== null && outcome?.option !== undefined && (bets[outcome.option] ?? 0) > 0
    if (won) {
      counts[player.member_id] = (counts[player.member_id] ?? 0) + 1
      wonCoins[player.member_id] = (wonCoins[player.member_id] ?? 0) +
        (bets[outcome.option!] ?? 0) * outcome.multiplier
    }
    else lostCoins += total
  }
  const round = (previous?.round_number ?? 0) + 1
  // Every multiplayer round contributes five house coins in addition to the
  // wagers that were not won. This guarantees a visible five-round prize.
  const jackpot = Math.min(99_999, (previous?.jackpot ?? 0) + lostCoins + 5)
  let awardMemberId: string | null = null
  let awardAmount = 0
  if (round >= 5 && jackpot > 0) {
    const highestCoins = Math.max(0, ...players.map(player => wonCoins[player.member_id] ?? 0))
    const coinFinalists = players.filter(player => (wonCoins[player.member_id] ?? 0) === highestCoins)
    const highestWins = Math.max(0, ...coinFinalists.map(player => counts[player.member_id] ?? 0))
    const finalists = coinFinalists.filter(player => (counts[player.member_id] ?? 0) === highestWins)
    awardMemberId = finalists[Math.floor(Math.random() * finalists.length)]?.member_id ?? null
    awardAmount = awardMemberId ? jackpot : 0
  }
  await memberDb().prepare(`
    INSERT INTO coin_challenge_room_competitions
      (room_id, round_number, jackpot, win_counts_json, win_coins_json, last_round_token, updated_at)
    VALUES ('1', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(room_id) DO UPDATE SET round_number = excluded.round_number,
      jackpot = excluded.jackpot, win_counts_json = excluded.win_counts_json,
      win_coins_json = excluded.win_coins_json,
      last_round_token = excluded.last_round_token, updated_at = CURRENT_TIMESTAMP
  `).bind(awardMemberId ? 0 : round, awardMemberId ? 0 : jackpot,
    awardMemberId ? '{}' : JSON.stringify(counts),
    awardMemberId ? '{}' : JSON.stringify(wonCoins), token).run()
  return { round, jackpot, awardMemberId, awardAmount }
}

function parseWinCounts(value?: string) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {} as Record<string, number>
  }
}

const SHARED_OUTCOMES: Array<{ option: number | null; multiplier: number }> = [
  { option: 1, multiplier: 10 }, { option: 3, multiplier: 10 }, { option: null, multiplier: 1 },
  { option: 7, multiplier: 100 }, { option: null, multiplier: 1 }, { option: 0, multiplier: 5 },
  { option: 2, multiplier: 10 }, { option: 4, multiplier: 20 }, { option: 4, multiplier: 3 },
  { option: null, multiplier: 1 }, { option: 0, multiplier: 5 }, { option: 1, multiplier: 2 },
  { option: 1, multiplier: 10 }, { option: 3, multiplier: 10 }, { option: 6, multiplier: 3 },
  { option: 6, multiplier: 20 }, { option: 0, multiplier: 5 }, { option: 2, multiplier: 2 },
  { option: 2, multiplier: 10 }, { option: 5, multiplier: 20 }, { option: 5, multiplier: 3 },
  { option: null, multiplier: 1 }, { option: 0, multiplier: 5 }, { option: 1, multiplier: 2 },
]

function chooseSharedTarget() {
  // Multiplayer is deliberately fair by physical light: every one of the 24
  // track cells has exactly the same chance. Solo mode keeps its tuned table.
  return Math.floor(Math.random() * SHARED_OUTCOMES.length)
}
