CREATE TABLE IF NOT EXISTS ghost_hunter_weekly_settlements (
  period_key TEXT PRIMARY KEY,
  champion_player_id TEXT,
  champion_score INTEGER NOT NULL DEFAULT 0 CHECK (champion_score >= 0),
  reward_coins INTEGER NOT NULL DEFAULT 1000 CHECK (reward_coins >= 0),
  reward_applied INTEGER NOT NULL DEFAULT 0 CHECK (reward_applied IN (0, 1)),
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ghost_hunter_weekly_pending
  ON ghost_hunter_weekly_settlements (champion_player_id, reward_applied, period_key);
