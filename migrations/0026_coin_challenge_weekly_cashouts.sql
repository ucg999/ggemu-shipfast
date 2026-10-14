CREATE TABLE IF NOT EXISTS coin_challenge_weekly_cashouts (
  player_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  cashout_coins INTEGER NOT NULL DEFAULT 0 CHECK (cashout_coins >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, period_key),
  FOREIGN KEY (player_id) REFERENCES leaderboard_players(player_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coin_challenge_weekly_cashouts
  ON coin_challenge_weekly_cashouts(period_key, cashout_coins DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS coin_challenge_weekly_settlements (
  period_key TEXT PRIMARY KEY,
  champion_player_id TEXT,
  cashout_coins INTEGER NOT NULL DEFAULT 0,
  reward_coins INTEGER NOT NULL DEFAULT 5000,
  reward_applied INTEGER NOT NULL DEFAULT 0 CHECK (reward_applied IN (0, 1)),
  settled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
