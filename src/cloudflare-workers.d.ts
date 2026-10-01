declare module 'cloudflare:workers' {
  export const env: Record<string, unknown> & {
    GG_DEALS_API_KEY?: string
    LEADERBOARD_DB?: D1Database
    SUPABASE_DATABASE_URL?: string
    HYPERDRIVE?: { connectionString: string }
  }
}
