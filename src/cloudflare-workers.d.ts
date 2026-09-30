declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    GG_DEALS_API_KEY?: string
    LEADERBOARD_DB?: D1Database
  }
}
