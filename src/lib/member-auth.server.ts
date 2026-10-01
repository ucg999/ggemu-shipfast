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
}

export function memberDb() {
  if (env.HYPERDRIVE?.connectionString) return postgresDatabase(env.HYPERDRIVE.connectionString)
  if (env.SUPABASE_DATABASE_URL) return postgresDatabase(env.SUPABASE_DATABASE_URL)
  const db = env.LEADERBOARD_DB
  if (!db) throw new Error('玩家数据库尚未绑定')
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
  const displayName = typeof username === 'string' ? username.trim() : ''
  const normalizedUsername = displayName.toLocaleLowerCase('en-US')
  const characters = [...displayName]
  const chineseCharacters = characters.filter(character => /\p{Script=Han}/u.test(character)).length
  if (!/^[\p{L}\p{N}_-]+$/u.test(displayName) || characters.length > 20 || chineseCharacters > 8) {
    return { error: '用户名可使用中文、字母、数字、下划线或短横线；中文最多8个字，英文和数字最多20位' }
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return { error: '密码需为 8–72 位' }
  }
  return { displayName, normalizedUsername, password }
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
  return { code, password: await hashPassword(code) }
}

export async function verifyRecoveryCode(member: MemberRow, code: string) {
  if (!member.recovery_hash || !member.recovery_salt || !member.recovery_iterations) return false
  const candidate = await hashPassword(code.trim().toUpperCase(), member.recovery_salt, member.recovery_iterations)
  return timingSafeEqual(candidate.hash, member.recovery_hash)
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
  const token = readCookie(request.headers.get('cookie'), new URL(request.url).protocol === 'https:' ? SESSION_COOKIE : 'ucg999_member')
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await memberDb().prepare(`
    SELECT m.id, m.username, m.display_name, m.coin_balance, m.player_number
    FROM member_sessions s JOIN members m ON m.id = s.member_id
    WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP
  `).bind(tokenHash).first<Pick<MemberRow, 'id' | 'username' | 'display_name' | 'coin_balance' | 'player_number'>>()
  if (!row) return null
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
  return { id: row.id, username: row.username, displayName: row.display_name, coinBalance: row.coin_balance, playerNumber: row.player_number }
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

async function sha256(value: string) {
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
