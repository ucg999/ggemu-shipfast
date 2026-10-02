import { createFileRoute } from '@tanstack/react-router'

import {
  assertSameOrigin,
  checkAuthRateLimit,
  createRecoveryCode,
  createSession,
  deleteSession,
  findMemberByUsername,
  getMemberFromRequest,
  hashPassword,
  jsonError,
  memberDb,
  passwordNeedsRehash,
  releaseInactiveMembers,
  toMemberView,
  validateCredentials,
  validateNickname,
  validateRegistrationCredentials,
  verifyRecoveryCode,
  verifyPassword,
} from '#/lib/member-auth.server'

export const Route = createFileRoute('/api/member')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const member = await getMemberFromRequest(request)
        const usedToday = member ? await getTodayTransferred(member.id) : 0
        return Response.json({ member, remainingToday: Math.max(0, 999 - usedToday) })
      },
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const body = await request.json() as Record<string, unknown>
          const action = body.action === 'register' ? 'register' : body.action === 'reset-password' ? 'reset-password' : 'login'
          if (!await checkAuthRateLimit(request, action)) return jsonError('尝试次数过多，请稍后再试', 429)
          await releaseInactiveMembers()
          const credentials = action === 'register'
            ? validateRegistrationCredentials(body.username, body.password)
            : validateCredentials(body.username, body.password)
          if ('error' in credentials) return jsonError(credentials.error ?? '账号信息不符合要求')

          if (action === 'register') {
            if (await findMemberByUsername(credentials.normalizedUsername)) return jsonError('这个用户名已被使用', 409)
            const password = await hashPassword(credentials.password)
            const recovery = await createRecoveryCode()
            const memberId = crypto.randomUUID()
            const coinBalance = 0
            const playerNumber = await allocatePlayerNumber()
            if (!Number.isInteger(playerNumber) || playerNumber < 1 || playerNumber > 99_999) return jsonError('玩家 ID 已达到上限', 503)
            const generatedNickname = `玩家${String(playerNumber).padStart(5, '0')}`
            try {
              await memberDb().prepare(`
                INSERT INTO members (id, username, display_name, password_hash, password_salt, password_iterations,
                  recovery_hash, recovery_salt, recovery_iterations, coin_balance, player_number, last_login_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
              `).bind(memberId, credentials.normalizedUsername, generatedNickname, password.hash, password.salt, password.iterations,
                recovery.password.hash, recovery.password.salt, recovery.password.iterations, playerNumber).run()
            } catch {
              return jsonError('这个用户名已被使用', 409)
            }
            const session = await createSession(memberId, request)
            return Response.json({ member: { id: memberId, username: credentials.normalizedUsername, displayName: generatedNickname, coinBalance, playerNumber, needsNickname: false }, recoveryCode: recovery.code, needsNickname: false }, { status: 201, headers: { 'Set-Cookie': session.cookie } })
          }

          if (action === 'reset-password') {
            const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode : ''
            const row = await findMemberByUsername(credentials.normalizedUsername)
            if (!row || !await verifyRecoveryCode(row, recoveryCode)) return jsonError('用户名或恢复码不正确', 401)
            const password = await hashPassword(credentials.password)
            const recovery = await createRecoveryCode()
            await memberDb().batch([
              memberDb().prepare(`UPDATE members SET password_hash = ?, password_salt = ?, password_iterations = ?,
                recovery_hash = ?, recovery_salt = ?, recovery_iterations = ?, updated_at = CURRENT_TIMESTAMP,
                last_login_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(password.hash, password.salt, password.iterations,
                recovery.password.hash, recovery.password.salt, recovery.password.iterations, row.id),
              memberDb().prepare('DELETE FROM member_sessions WHERE member_id = ?').bind(row.id),
            ])
            const session = await createSession(row.id, request)
            return Response.json({ member: toMemberView(row), recoveryCode: recovery.code }, { headers: { 'Set-Cookie': session.cookie } })
          }

          const row = await findMemberByUsername(credentials.normalizedUsername)
          if (!row) {
            // Keep a comparable response time for unknown users without doing a
            // second PBKDF2 calculation for every successful login.
            await hashPassword(credentials.password, '00000000000000000000000000000000')
            return jsonError('用户名或密码不正确', 401)
          }
          if (!await verifyPassword(row, credentials.password)) return jsonError('用户名或密码不正确', 401)
          if (passwordNeedsRehash(row.password_iterations)) {
            const upgraded = await hashPassword(credentials.password)
            await memberDb().prepare(`
              UPDATE members SET password_hash = ?, password_salt = ?, password_iterations = ?,
                last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).bind(upgraded.hash, upgraded.salt, upgraded.iterations, row.id).run()
          } else {
            await memberDb().prepare('UPDATE members SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run()
          }
          const session = await createSession(row.id, request)
          return Response.json({ member: toMemberView(row) }, { headers: { 'Set-Cookie': session.cookie } })
        } catch (error) {
          if (error instanceof Response) return error
          return jsonError(error instanceof Error ? error.message : '玩家服务暂时不可用', 500)
        }
      },
      PUT: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const member = await getMemberFromRequest(request)
          if (!member) return jsonError('请先登录玩家账号', 401)
          if (member.needsNickname) return jsonError('请先完成必填昵称设置', 428)
          const body = await request.json() as Record<string, unknown>
          const amount = Math.floor(Number(body.amount) || 0)
          if (amount < 1 || amount > 999) return jsonError('单次转入数量需为 1–999 个')
          const idempotencyKey = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.slice(0, 96) : crypto.randomUUID()
          if (body.action === 'spend') {
            const result = await memberDb().prepare(`
              UPDATE members SET coin_balance = coin_balance - ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND coin_balance >= ?
            `).bind(amount, member.id, amount).run()
            if (!result.meta.changes) return jsonError('玩家金币不足')
            const updated = await memberDb().prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
            if (!updated) return jsonError('玩家账号不存在', 404)
            await memberDb().prepare(`
              INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key)
              VALUES (?, ?, ?, 'member_coin_spend', ?)
            `).bind(member.id, -amount, updated.coin_balance, idempotencyKey).run()
            return Response.json({ member: toMemberView(updated), spent: amount })
          }
          const usedToday = await getTodayTransferred(member.id)
          if (usedToday + amount > 999) return jsonError(`今天最多还能转入 ${Math.max(0, 999 - usedToday)} 个金币`)
          if (member.coinBalance + amount > 99_999) return jsonError('玩家金币已达到 99,999 个上限')
          try {
            await memberDb().batch([
              memberDb().prepare(`
                INSERT INTO member_daily_transfers (member_id, transfer_date, browser_to_member)
                VALUES (?, date('now'), ?)
                ON CONFLICT(member_id, transfer_date) DO UPDATE SET
                  browser_to_member = member_daily_transfers.browser_to_member + excluded.browser_to_member,
                  updated_at = CURRENT_TIMESTAMP
              `).bind(member.id, amount),
              memberDb().prepare('UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(amount, member.id),
              memberDb().prepare(`
                INSERT INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key)
                SELECT id, ?, coin_balance, 'browser_coin_deposit', ? FROM members WHERE id = ?
              `).bind(amount, idempotencyKey, member.id),
            ])
          } catch (error) {
            const message = error instanceof Error ? error.message : ''
            if (message.includes('CHECK constraint failed')) return jsonError('今天转入玩家金币已达到 999 个上限')
            throw error
          }
          const updated = await memberDb().prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
          if (!updated) return jsonError('玩家账号不存在', 404)
          const totalToday = usedToday + amount
          return Response.json(
            { member: toMemberView(updated), transferred: amount, remainingToday: Math.max(0, 999 - totalToday) },
            { headers: { 'Cache-Control': 'private, no-store' } },
          )
        } catch (error) {
          if (error instanceof Response) return error
          return jsonError(error instanceof Error ? error.message : '金币保存失败', 500)
        }
      },
      PATCH: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const member = await getMemberFromRequest(request)
          if (!member) return jsonError('请先登录玩家账号', 401)
          const body = await request.json() as Record<string, unknown>

          if (body.action === 'set-nickname') {
            const validated = validateNickname(body.nickname)
            if ('error' in validated) return jsonError(validated.error ?? '昵称不符合要求')
            const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').replace('Z', '')
            const recentChange = await memberDb().prepare(`
              SELECT created_at FROM member_coin_transactions
              WHERE member_id = ? AND reason = 'nickname_change' AND created_at > ?
              ORDER BY created_at DESC LIMIT 1
            `).bind(member.id, threshold).first<{ created_at: string }>()
            if (recentChange) return jsonError('昵称每30天只能修改一次', 429)
            await memberDb().batch([
              memberDb().prepare('UPDATE members SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(validated.nickname, member.id),
              memberDb().prepare(`
                INSERT INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key)
                VALUES (?, 0, ?, 'nickname_change', ?)
              `).bind(member.id, member.coinBalance, crypto.randomUUID()),
            ])
            const updated = await memberDb().prepare('SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?').bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
            if (!updated) return jsonError('玩家账号不存在', 404)
            return Response.json({ member: toMemberView(updated) })
          }

          if (member.needsNickname) return jsonError('请先完成必填昵称设置', 428)

          const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
          const row = await findMemberByUsername(member.username)
          if (!row || !await verifyPassword(row, currentPassword)) return jsonError('当前密码不正确', 401)

          if (body.action === 'change-password') {
            const nextPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
            if (nextPassword.length < 8 || nextPassword.length > 72) return jsonError('新密码需为 8–72 位')
            const password = await hashPassword(nextPassword)
            await memberDb().batch([
              memberDb().prepare('UPDATE members SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(password.hash, password.salt, password.iterations, member.id),
              memberDb().prepare('DELETE FROM member_sessions WHERE member_id = ?').bind(member.id),
            ])
            const session = await createSession(member.id, request)
            return Response.json({ ok: true, headers: undefined }, { headers: { 'Set-Cookie': session.cookie } })
          }

          if (body.action === 'new-recovery-code') {
            const recovery = await createRecoveryCode()
            await memberDb().prepare(`UPDATE members SET recovery_hash = ?, recovery_salt = ?, recovery_iterations = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
              .bind(recovery.password.hash, recovery.password.salt, recovery.password.iterations, member.id).run()
            return Response.json({ ok: true, recoveryCode: recovery.code })
          }
          return jsonError('不支持的操作')
        } catch (error) {
          if (error instanceof Response) return error
          return jsonError('密码操作失败，请稍后重试', 500)
        }
      },
      DELETE: async ({ request }) => {
        try {
          assertSameOrigin(request)
          return Response.json({ ok: true }, { headers: { 'Set-Cookie': await deleteSession(request) } })
        } catch (error) {
          if (error instanceof Response) return error
          return jsonError('退出失败', 500)
        }
      },
    },
  },
})

async function getTodayTransferred(memberId: string) {
  const row = await memberDb().prepare(`
    SELECT browser_to_member AS total
    FROM member_daily_transfers
    WHERE member_id = ? AND transfer_date = date('now')
  `).bind(memberId).first<{ total: number }>()
  return Math.max(0, Math.floor(Number(row?.total) || 0))
}

async function allocatePlayerNumber() {
  while (true) {
    const sequence = await memberDb().prepare('INSERT INTO member_number_sequence DEFAULT VALUES').run()
    const playerNumber = Number(sequence.meta.last_row_id)
    if (!Number.isInteger(playerNumber) || playerNumber > 99_999) return playerNumber
    if (!isReservedPlayerNumber(playerNumber)) return playerNumber
  }
}

function isReservedPlayerNumber(playerNumber: number) {
  if (playerNumber >= 2 && playerNumber <= 100) return true
  const fiveDigitId = String(playerNumber).padStart(5, '0')
  return /(.)\1{3}/.test(fiveDigitId)
}
