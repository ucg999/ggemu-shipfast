import { createFileRoute } from '@tanstack/react-router'

import {
  assertSameOrigin,
  getMemberFromRequest,
  jsonError,
  memberDb,
  sha256,
  toMemberView,
} from '#/lib/member-auth.server'

const SHARE_REWARD = 100

export const Route = createFileRoute('/api/home-share-reward')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const member = await getMemberFromRequest(request)
          const day = getShanghaiDateKey()
          const ip = request.headers.get('cf-connecting-ip')
            ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            ?? 'local'
          const ipClaimKey = await sha256(`homepage-share:${day}:${ip}`)
          const accountClaimKey = `homepage_share_reward:${day}`

          if (member) {
            const accountClaim = await memberDb().prepare(`
              SELECT id FROM member_coin_transactions
              WHERE member_id = ? AND idempotency_key = ?
            `).bind(member.id, accountClaimKey).first()
            if (accountClaim) return jsonError('今天已经领取过分享奖励了', 409)
          }

          const ipReservation = await memberDb().prepare(`
            INSERT OR IGNORE INTO member_auth_limits (key, attempts, window_started_at)
            VALUES (?, 1, ?)
          `).bind(ipClaimKey, Date.now()).run()
          if (!ipReservation.meta.changes) return jsonError('当前网络今天已经领取过分享奖励了', 409)

          if (!member) {
            return Response.json({ awarded: SHARE_REWARD, target: 'browser' }, {
              headers: { 'Cache-Control': 'private, no-store' },
            })
          }

          const available = Math.max(0, 99_999 - member.coinBalance)
          const awarded = Math.min(SHARE_REWARD, available)
          if (awarded > 0) {
            await memberDb().batch([
              memberDb().prepare(`
                UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND NOT EXISTS (
                  SELECT 1 FROM member_coin_transactions WHERE member_id = ? AND idempotency_key = ?
                )
              `).bind(awarded, member.id, member.id, accountClaimKey),
              memberDb().prepare(`
                INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key)
                SELECT id, ?, coin_balance, 'homepage_share_reward', ? FROM members WHERE id = ?
              `).bind(awarded, accountClaimKey, member.id),
            ])
          }

          const updated = await memberDb().prepare(`
            SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?
          `).bind(member.id).first<{
            id: string
            username: string
            display_name: string
            coin_balance: number
            player_number: number
          }>()
          if (!updated) return jsonError('玩家账号不存在', 404)

          return Response.json({ awarded, target: 'member', member: toMemberView(updated) }, {
            headers: { 'Cache-Control': 'private, no-store' },
          })
        } catch (error) {
          if (error instanceof Response) return error
          console.error('Homepage share reward failed', error)
          return jsonError('分享奖励暂时领取失败，请稍后重试', 500)
        }
      },
    },
  },
})

function getShanghaiDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}
