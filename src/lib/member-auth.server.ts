import { env } from 'cloudflare:workers'
import { pbkdf2Sync } from 'node:crypto'
import { postgresDatabase } from './postgres-d1.server'

const SESSION_COOKIE = '__Host-ucg999_member'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const PASSWORD_ITERATIONS = 100_000
const WEB_CRYPTO_PBKDF2_LIMIT = 100_000
type MemberRow = {
  id: string
  username: string
  display_name: string
  password_hash: string
  password_salt: string
  password_iterations: number
  coin_balance: number
  player_number: number
  recovery_hash: string | null
  recovery_salt: string | null
  recovery_iterations: number | null
}

export type MemberView = {
  id: string
  username: string
  displayName: string
  coinBalance: number
  playerNumber: number
  needsNickname: boolean
}

export function memberDb() {
  if (env.HYPERDRIVE?.connectionString) return postgresDatabase(env.HYPERDRIVE.connectionString)
  if (env.SUPABASE_DATABASE_URL) return postgresDatabase(env.SUPABASE_DATABASE_URL)
  const db = env.LEADERBOARD_DB
  if (!db) throw new Error('玩家数据库尚未绑定')
  return db
}

// Original-game rankings stay on Cloudflare D1 so score writes and reads use
// the same edge database without waiting on the member database connection.
export function leaderboardDb() {
  const db = env.LEADERBOARD_DB
  if (!db) return memberDb()
  return db
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status })
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) {
    throw new Response('Forbidden', { status: 403 })
  }
}

export async function checkAuthRateLimit(request: Request, action: string) {
  const db = memberDb()
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const digest = await sha256(`${action}:${ip}`)
  const now = Date.now()
  const windowMs = 15 * 60_000
  const row = await db.prepare('SELECT attempts, window_started_at FROM member_auth_limits WHERE key = ?').bind(digest).first<{ attempts: number; window_started_at: number }>()
  if (!row || now - row.window_started_at >= windowMs) {
    await db.prepare('INSERT INTO member_auth_limits (key, attempts, window_started_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at').bind(digest, now).run()
    return true
  }
  if (row.attempts >= 10) return false
  await db.prepare('UPDATE member_auth_limits SET attempts = attempts + 1 WHERE key = ?').bind(digest).run()
  return true
}

export function validateCredentials(username: unknown, password: unknown) {
  const normalizedUsername = typeof username === 'string' ? username.trim().toLocaleLowerCase('en-US') : ''
  if (!normalizedUsername || normalizedUsername.length > 20) return { error: '用户名或密码不正确' }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return { error: '密码需为 8–72 位' }
  }
  return { normalizedUsername, password }
}

export function validateRegistrationCredentials(username: unknown, password: unknown) {
  const credentials = validateCredentials(username, password)
  if ('error' in credentials) return credentials
  if (!/^[a-z0-9_]{6,20}$/i.test(credentials.normalizedUsername)) {
    return { error: '用户名只允许字母、数字和下划线，长度为 6–20 位' }
  }
  return credentials
}

export function validateNickname(value: unknown) {
  const nickname = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if ([...nickname].length < 1 || [...nickname].length > 20 || /[\u0000-\u001f\u007f]/.test(nickname)) {
    return { error: '昵称需为 1–20 个字符，可以使用中文、字母、数字和常用符号' }
  }
  return { nickname }
}

export async function hashPassword(password: string, salt = randomHex(16), iterations = PASSWORD_ITERATIONS) {
  if (iterations > WEB_CRYPTO_PBKDF2_LIMIT) {
    const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex')
    return { hash, salt, iterations }
  }
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(salt), iterations }, material, 256)
  return { hash: bytesToHex(new Uint8Array(bits)), salt, iterations }
}

export function passwordNeedsRehash(iterations: number) {
  return iterations !== PASSWORD_ITERATIONS
}

export async function verifyPassword(member: MemberRow, password: string) {
  const candidate = await hashPassword(password, member.password_salt, member.password_iterations)
  return timingSafeEqual(candidate.hash, member.password_hash)
}

export async function createRecoveryCode() {
  const code = `${randomHex(3).toUpperCase()}-${randomHex(3).toUpperCase()}-${randomHex(3).toUpperCase()}`
  const salt = randomHex(16)
  return { code, password: { hash: await sha256(`${salt}:${code}`), salt, iterations: 0 } }
}

export async function verifyRecoveryCode(member: MemberRow, code: string) {
  if (!member.recovery_hash || !member.recovery_salt || member.recovery_iterations === null) return false
  const normalizedCode = code.trim().toUpperCase()
  const hash = member.recovery_iterations === 0
    ? await sha256(`${member.recovery_salt}:${normalizedCode}`)
    : (await hashPassword(normalizedCode, member.recovery_salt, member.recovery_iterations)).hash
  return timingSafeEqual(hash, member.recovery_hash)
}

export async function releaseInactiveMembers() {
  await memberDb().prepare(`
    DELETE FROM members
    WHERE COALESCE(last_login_at, created_at) < datetime('now', '-1 year')
  `).run()
}

export async function createSession(memberId: string, request: Request) {
  const rawToken = randomHex(32)
  const tokenHash = await sha256(rawToken)
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString().replace('T', ' ').replace('Z', '')
  await memberDb().prepare('INSERT INTO member_sessions (id, member_id, expires_at) VALUES (?, ?, ?)').bind(tokenHash, memberId, expiresAt).run()
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return {
    cookie: `${secure ? '__Host-ucg999_member' : 'ucg999_member'}=${rawToken}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`,
  }
}

export async function getMemberFromRequest(request: Request) {
  const requestUrl = new URL(request.url)
  const token = readCookie(request.headers.get('cookie'), requestUrl.protocol === 'https:' ? SESSION_COOKIE : 'ucg999_member')
  if (!token) return getLocalDevelopmentOwner(requestUrl)
  const tokenHash = await sha256(token)
  const row = await memberDb().prepare(`
    SELECT m.id, m.username, m.display_name, m.coin_balance, m.player_number
    FROM member_sessions s JOIN members m ON m.id = s.member_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).bind(tokenHash).first<Pick<MemberRow, 'id' | 'username' | 'display_name' | 'coin_balance' | 'player_number'>>()
  if (!row) return getLocalDevelopmentOwner(requestUrl)
  // Session reads must remain available even if this non-essential activity
  // timestamp cannot be written. Throttling also avoids a database write on
  // every route change, focus event and account-panel refresh.
  try {
    await memberDb().prepare(`
      UPDATE member_sessions SET last_seen_at = CURRENT_TIMESTAMP
      WHERE id = ? AND last_seen_at < datetime('now', '-15 minutes')
    `).bind(tokenHash).run()
  } catch (error) {
    console.warn('Unable to refresh member session activity', error instanceof Error ? error.message : error)
  }
  return toMemberView(row)
}

export async function settleMaturedMemberDeposits(memberId: string) {
  const today = getShanghaiDateKey()
  const pending = await memberDb().prepare(`
    SELECT transfer_date, browser_to_member AS amount
    FROM member_daily_transfers t
    WHERE t.member_id = ? AND t.transfer_date < ?
      AND EXISTS (
        SELECT 1 FROM member_coin_transactions p
        WHERE p.member_id = t.member_id
          AND p.idempotency_key = 'browser_coin_deposit_pending:' || t.transfer_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM member_coin_transactions c
        WHERE c.member_id = t.member_id
          AND c.idempotency_key = 'browser_coin_deposit_settlement:' || t.transfer_date
      )
    ORDER BY transfer_date ASC
  `).bind(memberId, today).all<{ transfer_date: string; amount: number }>()
  const amount = pending.results.reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0)
  if (amount < 1) return 0

  const account = await memberDb().prepare('SELECT coin_balance FROM members WHERE id = ?').bind(memberId).first<{ coin_balance: number }>()
  if (!account) return 0
  const credited = Math.min(amount, Math.max(0, 99_999 - Number(account.coin_balance || 0)))
  const nextBalance = Math.min(99_999, Number(account.coin_balance || 0) + credited)
  let remainingCredit = credited
  const settlements = pending.results.map(row => {
    const rowAmount = Math.max(0, Number(row.amount) || 0)
    const applied = Math.min(rowAmount, remainingCredit)
    remainingCredit -= applied
    return { ...row, applied }
  })
  await memberDb().batch([
    memberDb().prepare(`
      UPDATE members SET coin_balance = CASE
        WHEN coin_balance + ? > 99999 THEN 99999
        ELSE coin_balance + ?
      END, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(credited, credited, memberId),
    ...settlements.map(row => memberDb().prepare(`
      INSERT OR IGNORE INTO member_coin_transactions (member_id, amount, balance_after, reason, idempotency_key)
      VALUES (?, ?, ?, 'browser_coin_deposit_settlement', ?)
    `).bind(memberId, row.applied, nextBalance, `browser_coin_deposit_settlement:${row.transfer_date}`)),
  ])
  return credited
}

async function getLocalDevelopmentOwner(url: URL) {
  if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1' && url.hostname !== '[::1]') return null
  try {
    const owner = await memberDb().prepare(`
      SELECT id, username, display_name, coin_balance, player_number
      FROM members WHERE player_number = 1 LIMIT 1
    `).first<Pick<MemberRow, 'id' | 'username' | 'display_name' | 'coin_balance' | 'player_number'>>()
    if (owner) return toMemberView(owner)
  } catch (error) {
    console.warn('Local member database is unavailable; using the owner test profile')
  }
  return {
    id: 'local-owner-00001',
    username: 'game-adventure',
    displayName: '游戏历险记',
    coinBalance: 99_999,
    playerNumber: 1,
    needsNickname: false,
  }
}

export async function deleteSession(request: Request) {
  const cookieName = new URL(request.url).protocol === 'https:' ? SESSION_COOKIE : 'ucg999_member'
  const token = readCookie(request.headers.get('cookie'), cookieName)
  if (token) await memberDb().prepare('DELETE FROM member_sessions WHERE id = ?').bind(await sha256(token)).run()
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : ''
  return `${cookieName}=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`
}

export async function findMemberByUsername(username: string) {
  return memberDb().prepare('SELECT * FROM members WHERE username = ?').bind(username).first<MemberRow>()
}

export function toMemberView(row: Pick<MemberRow, 'id' | 'username' | 'display_name' | 'coin_balance' | 'player_number'>): MemberView {
  return { id: row.id, username: row.username, displayName: row.display_name, coinBalance: row.coin_balance, playerNumber: row.player_number, needsNickname: !row.display_name.trim() }
}

function readCookie(header: string | null, name: string) {
  for (const part of header?.split(/;\s*/) ?? []) {
    const equals = part.indexOf('=')
    if (equals >= 0 && part.slice(0, equals) === name) return part.slice(equals + 1)
  }
  return null
}

function randomHex(bytes: number) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return bytesToHex(value)
}

function getShanghaiDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(value: string) {
  return Uint8Array.from(value.match(/.{1,2}/g)?.map(byte => Number.parseInt(byte, 16)) ?? [])
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}
