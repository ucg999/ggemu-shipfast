CREATE TABLE IF NOT EXISTS coin_challenge_weekly_special_hits (
  player_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  bomb_hits INTEGER NOT NULL DEFAULT 0 CHECK (bomb_hits >= 0),
  ghost_hits INTEGER NOT NULL DEFAULT 0 CHECK (ghost_hits >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, period_key),
  FOREIGN KEY (player_id) REFERENCES leaderboard_players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coin_challenge_weekly_special_hits
  ON coin_challenge_weekly_special_hits(period_key, bomb_hits DESC, ghost_hits DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS coin_challenge_bomb_weekly_settlements (
  period_key TEXT PRIMARY KEY,
  champion_player_id TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0 CHECK (hit_count >= 0),
  reward_coins INTEGER NOT NULL DEFAULT 1000 CHECK (reward_coins >= 0),
  reward_applied INTEGER NOT NULL DEFAULT 0 CHECK (reward_applied IN (0, 1)),
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coin_challenge_bomb_weekly_pending
  ON coin_challenge_bomb_weekly_settlements(champion_player_id, reward_applied, period_key);
