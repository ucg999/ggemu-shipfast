import { createFileRoute } from '@tanstack/react-router'

import { assertSameOrigin, getMemberFromRequest, jsonError, memberDb, sha256, toMemberView } from '#/lib/member-auth.server'

const SHARE_REWARD = 100
const LINK_TTL_MS = 48 * 60 * 60 * 1000
const OWNER_COOKIE = 'ucg_share_owner'
const SHARE_TARGETS = new Set(['好友', '微信', 'QQ', '小红书', '抖音', 'B站', '快手', '头条'])

type ShareLinkRow = { token: string; member_id: string | null; owner_hash: string; creator_ip_hash: string; share_day: string; created_at_ms: number; visited_at_ms: number | null; claimed_at_ms: number | null }

export const Route = createFileRoute('/api/home-share-reward')({
  server: { handlers: { POST: async ({ request }) => {
    try {
      assertSameOrigin(request)
      await ensureShareTable()
      const payload = await request.json().catch(() => null) as { action?: string; target?: string; token?: string } | null
      const action = String(payload?.action || '')
      if (action === 'create') return createShareLink(request, String(payload?.target || ''))
      if (action === 'visit') return confirmShareVisit(request, String(payload?.token || ''))
      if (action === 'claim') return claimConfirmedShare(request)
      return jsonError('无效的分享请求', 400)
    } catch (error) {
      if (error instanceof Response) return error
      console.error('Homepage share reward failed', error)
      return jsonError('分享奖励暂时处理失败，请稍后重试', 500)
    }
  } } },
})

async function createShareLink(request: Request, target: string) {
  if (!SHARE_TARGETS.has(target)) return jsonError('请选择有效的分享方式', 400)
  const member = await getMemberFromRequest(request)
  const owner = readCookie(request, OWNER_COOKIE) || crypto.randomUUID()
  const ownerHash = await sha256(`homepage-share-owner:${owner}`)
  const creatorIpHash = await hashRequestIp(request)
  const day = getShanghaiDateKey()
  const existing = await memberDb().prepare(`SELECT token FROM homepage_share_links WHERE owner_hash = ? AND share_day = ? AND claimed_at_ms IS NULL ORDER BY created_at_ms DESC LIMIT 1`).bind(ownerHash, day).first<{ token: string }>()
  const token = existing?.token || crypto.randomUUID().replaceAll('-', '')
  if (!existing) await memberDb().prepare(`INSERT INTO homepage_share_links (token, member_id, owner_hash, creator_ip_hash, share_day, created_at_ms) VALUES (?, ?, ?, ?, ?, ?)`).bind(token, member?.id || null, ownerHash, creatorIpHash, day, Date.now()).run()
  const url = new URL('/', request.url)
  url.searchParams.set('share', token)
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return Response.json({ url: url.toString() }, { headers: { 'Cache-Control': 'private, no-store', 'Set-Cookie': `${OWNER_COOKIE}=${owner}; Path=/; Max-Age=31536000; HttpOnly${secure}; SameSite=Lax` } })
}

async function confirmShareVisit(request: Request, token: string) {
  if (!/^[a-f0-9]{32}$/i.test(token)) return jsonError('分享链接无效', 400)
  const row = await getShareLink(token)
  if (!row || Date.now() - row.created_at_ms > LINK_TTL_MS) return jsonError('分享链接已失效', 410)
  if (row.visited_at_ms) return Response.json({ confirmed: true }, noStore())
  const visitorIpHash = await hashRequestIp(request)
  if (visitorIpHash === row.creator_ip_hash) return jsonError('不能通过自己打开分享链接领取奖励', 409)
  const result = await memberDb().prepare(`UPDATE homepage_share_links SET visited_at_ms = ?, visitor_ip_hash = ? WHERE token = ? AND visited_at_ms IS NULL`).bind(Date.now(), visitorIpHash, token).run()
  if (result.meta.changes && row.member_id) await awardMember(row)
  return Response.json({ confirmed: true }, noStore())
}

async function claimConfirmedShare(request: Request) {
  const member = await getMemberFromRequest(request)
  const owner = readCookie(request, OWNER_COOKIE)
  if (!owner && !member) return Response.json({ awarded: 0, pending: false }, noStore())
  const ownerHash = owner ? await sha256(`homepage-share-owner:${owner}`) : ''
  const row = await memberDb().prepare(`SELECT token, member_id, owner_hash, creator_ip_hash, share_day, created_at_ms, visited_at_ms, claimed_at_ms FROM homepage_share_links WHERE share_day = ? AND visited_at_ms IS NOT NULL AND claimed_at_ms IS NULL AND ${member ? 'member_id = ?' : 'owner_hash = ?'} ORDER BY visited_at_ms ASC LIMIT 1`).bind(getShanghaiDateKey(), member?.id || ownerHash).first<ShareLinkRow>()
  if (!row) return Response.json({ awarded: 0, pending: false }, noStore())
  if (member && row.member_id) {
    const awarded = await awardMember(row)
    const updated = await memberDb().prepare(`SELECT id, username, display_name, coin_balance, player_number FROM members WHERE id = ?`).bind(member.id).first<{ id: string; username: string; display_name: string; coin_balance: number; player_number: number }>()
    return Response.json({ awarded, target: 'member', member: updated ? toMemberView(updated) : undefined }, noStore())
  }
  if (!await reserveDailyReward(row)) return jsonError('今天已经领取过分享奖励了', 409)
  const claimed = await memberDb().prepare(`UPDATE homepage_share_links SET claimed_at_ms = ? WHERE token = ? AND claimed_at_ms IS NULL`).bind(Date.now(), row.token).run()
  return Response.json({ awarded: claimed.meta.changes ? SHARE_REWARD : 0, target: 'browser' }, noStore())
}

async function awardMember(row: ShareLinkRow) {
  if (!row.member_id || row.claimed_at_ms) return 0
  if (!await reserveDailyReward(row)) return 0
  const claimKey = `homepage_share_reward:${row.share_day}`
  const account = await memberDb().prepare('SELECT coin_balance FROM members WHERE id = ?').bind(row.member_id).first<{ coin_balance: number }>()
  if (!account) return 0
  const awarded = Math.min(SHARE_REWARD, Math.max(0, 99_999 - account.coin_balance))
  await memberDb().batch([
    memberDb().prepare(`UPDATE homepage_share_links SET claimed_at_ms = ? WHERE token = ? AND claimed_at_ms IS NULL`).bind(Date.now(), row.token),
    memberDb().prepare(`UPDATE members SET coin_balance = coin_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND NOT EXISTS (SELECT 1 FROM member_coin_transactions WHERE member_id = ? AND idempotency_key = ?)`).bind(awarded, row.member_id, row.member_id, claimKey),
    memberDb().prepare(`INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key) SELECT id, ?, coin_balance, 'homepage_share_reward', ? FROM members WHERE id = ?`).bind(awarded, claimKey, row.member_id),
  ])
  return awarded
}

async function reserveDailyReward(row: ShareLinkRow) {
  const key = await sha256(`homepage-share-reward:${row.share_day}:${row.creator_ip_hash}`)
  const result = await memberDb().prepare(`INSERT OR IGNORE INTO member_auth_limits (key, attempts, window_started_at) VALUES (?, 1, ?)`).bind(key, Date.now()).run()
  return Boolean(result.meta.changes)
}

async function getShareLink(token: string) {
  return memberDb().prepare(`SELECT token, member_id, owner_hash, creator_ip_hash, share_day, created_at_ms, visited_at_ms, claimed_at_ms FROM homepage_share_links WHERE token = ?`).bind(token).first<ShareLinkRow>()
}

async function ensureShareTable() {
  await memberDb().prepare(`CREATE TABLE IF NOT EXISTS homepage_share_links (token TEXT PRIMARY KEY, member_id TEXT, owner_hash TEXT NOT NULL, creator_ip_hash TEXT NOT NULL, share_day TEXT NOT NULL, created_at_ms INTEGER NOT NULL, visited_at_ms INTEGER, visitor_ip_hash TEXT, claimed_at_ms INTEGER)`).run()
  await memberDb().prepare('CREATE INDEX IF NOT EXISTS idx_homepage_share_owner_day ON homepage_share_links(owner_hash, share_day)').run()
}

function readCookie(request: Request, name: string) {
  const item = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  return item ? decodeURIComponent(item.slice(name.length + 1)) : ''
}

async function hashRequestIp(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  return sha256(`homepage-share-ip:${ip}`)
}

function noStore() { return { headers: { 'Cache-Control': 'private, no-store' } } }
function getShanghaiDateKey() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
