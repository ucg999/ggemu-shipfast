import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb } from '#/lib/member-auth.server'

type WishRow = {
  id: string
  game_name: string
  platform: string
  genre: string
  era: string
  requester_name: string
  owner_reply: string
  created_at: string
  updated_at: string
  support_count: number | string
  supported: boolean | number | string
}

export const Route = createFileRoute('/api/game-wishes')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const requestUrl = new URL(request.url)
          if (requestUrl.searchParams.get('view') === 'count') {
            await ensureWishTables()
            const result = await memberDb().prepare('SELECT COUNT(*) AS count FROM game_wishes').first<{ count: number | string }>()
            return Response.json({ count: Number(result?.count) || 0 }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } })
          }
          const member = await getMemberFromRequest(request)
          const guestKey = normalizeGuestKey(requestUrl.searchParams.get('guestKey'))
          const actorKey = member ? `member:${member.id}` : guestKey || 'anonymous'
          if (member?.id === 'local-owner-00001') {
            return Response.json({ wishes: getLocalWishStore().map(wish => ({ ...wish, supported: wish.voters.includes(actorKey), supportCount: wish.voters.length })), isOwner: true }, { headers: { 'Cache-Control': 'private, no-store' } })
          }
          await ensureWishTables()
          const rows = await memberDb().prepare(`
            SELECT w.id, w.game_name, w.platform, w.genre, w.era, w.requester_name,
              w.owner_reply, w.created_at, w.updated_at,
              COUNT(v.voter_key) AS support_count,
              EXISTS (
                SELECT 1 FROM game_wish_votes mine
                WHERE mine.wish_id = w.id AND mine.voter_key = ?
              ) AS supported
            FROM game_wishes w
            LEFT JOIN game_wish_votes v ON v.wish_id = w.id
            GROUP BY w.id, w.game_name, w.platform, w.genre, w.era, w.requester_name,
              w.owner_reply, w.created_at, w.updated_at
            ORDER BY support_count DESC, w.created_at DESC
            LIMIT 100
          `).bind(actorKey).all<WishRow>()
          return Response.json({
            wishes: rows.results.map(toWishView),
            isOwner: member?.playerNumber === 1,
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
          console.error('[game-wishes:get]', error)
          return jsonError('愿望单暂时加载失败，请稍后重试', 503)
        }
      },
      POST: async ({ request }) => {
        try {
          assertSameOrigin(request)
          const body = await request.json().catch(() => ({})) as Record<string, unknown>
          const member = await getMemberFromRequest(request)
          const guestKey = normalizeGuestKey(body.guestKey)
          const actorKey = member ? `member:${member.id}` : guestKey
          if (!actorKey) return jsonError('浏览器身份无效，请刷新页面后重试')
          if (member?.id === 'local-owner-00001') return handleLocalPreviewAction(body, actorKey)
          await ensureWishTables()

          if (body.action === 'create') {
            const gameName = cleanText(body.gameName, 80)
            const platform = cleanText(body.platform, 40)
            const genre = cleanText(body.genre, 40)
            const era = cleanText(body.era, 20)
            if (!gameName || !platform || !genre || !era) return jsonError('请填写游戏名、平台、类型和年代')
            const requesterName = member?.displayName || `游客${actorKey.slice(-5).toUpperCase()}`
            const id = crypto.randomUUID()
            await memberDb().prepare(`
              INSERT INTO game_wishes
                (id, game_name, platform, genre, era, requester_key, requester_name)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(id, gameName, platform, genre, era, actorKey, requesterName).run()
            return Response.json({ created: true, id })
          }

          if (body.action === 'support') {
            const wishId = cleanId(body.wishId)
            if (!wishId) return jsonError('愿望信息无效')
            const wish = await memberDb().prepare('SELECT id FROM game_wishes WHERE id = ?').bind(wishId).first()
            if (!wish) return jsonError('这个愿望已不存在', 404)
            await memberDb().prepare(`
              INSERT INTO game_wish_votes (wish_id, voter_key)
              VALUES (?, ?) ON CONFLICT(wish_id, voter_key) DO NOTHING
            `).bind(wishId, actorKey).run()
            const count = await memberDb().prepare('SELECT COUNT(*) AS count FROM game_wish_votes WHERE wish_id = ?').bind(wishId).first<{ count: number | string }>()
            return Response.json({ supported: true, supportCount: Number(count?.count) || 0 })
          }

          if (body.action === 'reply') {
            if (member?.playerNumber !== 1) return jsonError('只有 00001 账号可以回复进度', 403)
            const wishId = cleanId(body.wishId)
            const reply = cleanText(body.reply, 500, true)
            if (!wishId) return jsonError('愿望信息无效')
            await memberDb().prepare(`
              UPDATE game_wishes SET owner_reply = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            `).bind(reply, wishId).run()
            return Response.json({ saved: true, reply })
          }

          if (body.action === 'delete') {
            if (member?.playerNumber !== 1) return jsonError('只有 00001 账号可以删除愿望', 403)
            const wishId = cleanId(body.wishId)
            if (!wishId) return jsonError('愿望信息无效')
            await memberDb().prepare('DELETE FROM game_wishes WHERE id = ?').bind(wishId).run()
            return Response.json({ deleted: true })
          }

          return jsonError('不支持的操作')
        } catch (error) {
          if (error instanceof Response) return error
          console.error('[game-wishes:post]', error)
          return jsonError('操作失败，请稍后重试', 503)
        }
      },
    },
  },
})

let tablesReady: Promise<void> | null = null

function ensureWishTables() {
  tablesReady ??= (async () => {
    await memberDb().prepare(`
      CREATE TABLE IF NOT EXISTS game_wishes (
        id TEXT PRIMARY KEY,
        game_name TEXT NOT NULL,
        platform TEXT NOT NULL,
        genre TEXT NOT NULL,
        era TEXT NOT NULL DEFAULT '',
        requester_key TEXT NOT NULL,
        requester_name TEXT NOT NULL,
        owner_reply TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await memberDb().prepare("ALTER TABLE game_wishes ADD COLUMN IF NOT EXISTS era TEXT NOT NULL DEFAULT ''").run()
    await memberDb().prepare(`
      CREATE TABLE IF NOT EXISTS game_wish_votes (
        wish_id TEXT NOT NULL REFERENCES game_wishes(id) ON DELETE CASCADE,
        voter_key TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (wish_id, voter_key)
      )
    `).run()
    await memberDb().prepare('CREATE INDEX IF NOT EXISTS game_wishes_created_idx ON game_wishes(created_at DESC)').run()
    await memberDb().prepare('CREATE INDEX IF NOT EXISTS game_wish_votes_wish_idx ON game_wish_votes(wish_id)').run()
  })().catch((error) => {
    tablesReady = null
    throw error
  })
  return tablesReady
}

function cleanText(value: unknown, max: number, allowEmpty = false) {
  const text = typeof value === 'string' ? value.trim().replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ') : ''
  if (!text && allowEmpty) return ''
  return text.slice(0, max)
}

function cleanId(value: unknown) {
  const id = typeof value === 'string' ? value.trim() : ''
  return /^[a-zA-Z0-9-]{16,64}$/.test(id) ? id : ''
}

function normalizeGuestKey(value: unknown) {
  const key = typeof value === 'string' ? value.trim() : ''
  return /^guest:[a-zA-Z0-9_-]{12,72}$/.test(key) ? key : null
}

function toWishView(row: WishRow) {
  return {
    id: row.id,
    gameName: row.game_name,
    platform: row.platform,
    genre: row.genre,
    era: row.era || '',
    requesterName: row.requester_name,
    ownerReply: row.owner_reply || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supportCount: Math.max(0, Number(row.support_count) || 0),
    supported: row.supported === true || row.supported === 1 || row.supported === '1' || row.supported === 'true',
  }
}

type LocalWish = ReturnType<typeof toLocalWish>

function getLocalWishStore() {
  const scope = globalThis as typeof globalThis & { __ucg999LocalWishes?: LocalWish[] }
  scope.__ucg999LocalWishes ??= []
  return scope.__ucg999LocalWishes
}

function toLocalWish(gameName: string, platform: string, genre: string, era: string, requesterName: string) {
  return {
    id: crypto.randomUUID(), gameName, platform, genre, era, requesterName,
    ownerReply: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    voters: [] as string[], supported: false, supportCount: 0,
  }
}

function handleLocalPreviewAction(body: Record<string, unknown>, actorKey: string) {
  const store = getLocalWishStore()
  if (body.action === 'create') {
    const gameName = cleanText(body.gameName, 80)
    const platform = cleanText(body.platform, 40)
    const genre = cleanText(body.genre, 40)
    const era = cleanText(body.era, 20)
    if (!gameName || !platform || !genre || !era) return jsonError('请填写游戏名、平台、类型和年代')
    const wish = toLocalWish(gameName, platform, genre, era, '00001 本地预览')
    store.unshift(wish)
    return Response.json({ created: true, id: wish.id, preview: true })
  }
  const wishId = cleanId(body.wishId)
  const wish = store.find(item => item.id === wishId)
  if (!wish) return jsonError('这个愿望已不存在', 404)
  if (body.action === 'support') {
    if (!wish.voters.includes(actorKey)) wish.voters.push(actorKey)
    return Response.json({ supported: true, supportCount: wish.voters.length, preview: true })
  }
  if (body.action === 'reply') {
    wish.ownerReply = cleanText(body.reply, 500, true)
    wish.updatedAt = new Date().toISOString()
    return Response.json({ saved: true, reply: wish.ownerReply, preview: true })
  }
  if (body.action === 'delete') {
    store.splice(store.indexOf(wish), 1)
    return Response.json({ deleted: true, preview: true })
  }
  return jsonError('不支持的操作')
}
