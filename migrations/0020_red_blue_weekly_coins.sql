CREATE TABLE IF NOT EXISTS arena_weekly_coin_scores (
  player_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  won_coins INTEGER NOT NULL DEFAULT 0 CHECK (won_coins >= 0),
  lost_coins INTEGER NOT NULL DEFAULT 0 CHECK (lost_coins >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, period_key),
  FOREIGN KEY (player_id) REFERENCES leaderboard_players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_arena_weekly_bounty
  ON arena_weekly_coin_scores(period_key, won_coins DESC, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_arena_weekly_arrest
  ON arena_weekly_coin_scores(period_key, lost_coins DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS arena_weekly_settlements (
  period_key TEXT PRIMARY KEY,
  bounty_player_id TEXT,
  bounty_coins INTEGER NOT NULL DEFAULT 0,
  arrest_player_id TEXT,
  arrest_coins INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 0,
  reward_applied INTEGER NOT NULL DEFAULT 0 CHECK (reward_applied IN (0, 1)),
  settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
