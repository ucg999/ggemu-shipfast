import { createFileRoute } from '@tanstack/react-router'

import { memberDb } from '#/lib/member-auth.server'

type TotalRow = { member_id: string; display_name: string; player_number: number; coin_balance: number }
type DailyRow = { member_id: string; display_name: string; player_number: number; coins_gained: number }

export const Route = createFileRoute('/api/coin-rankings')({
  server: {
    handlers: {
      GET: async () => {
        const dateRow = await memberDb().prepare(`SELECT date('now') AS today`).first<{ today: string }>()
        const today = dateRow?.today ?? new Date().toISOString().slice(0, 10)
        const current = await memberDb().prepare(`
          SELECT id AS member_id, display_name, player_number, coin_balance
          FROM members WHERE player_number IS NOT NULL
          ORDER BY coin_balance DESC, player_number ASC LIMIT 10
        `).all<TotalRow>()

        const daily = await memberDb().prepare(`
          SELECT m.id AS member_id, m.display_name, m.player_number,
            SUM(t.amount) AS coins_gained
          FROM member_coin_transactions t
          JOIN members m ON m.id = t.member_id
          WHERE t.amount > 0 AND date(t.created_at) = date('now')
          GROUP BY m.id, m.display_name, m.player_number
          ORDER BY coins_gained DESC, m.player_number ASC LIMIT 10
        `).all<DailyRow>()

        return Response.json({
          date: today,
          total: current.results.map((row, index) => ({ rank: index + 1, displayName: row.display_name, playerNumber: row.player_number, coins: row.coin_balance })),
          daily: daily.results.map((row, index) => ({ rank: index + 1, displayName: row.display_name, playerNumber: row.player_number, coins: row.coins_gained })),
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})
