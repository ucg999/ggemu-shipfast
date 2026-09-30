CREATE TABLE IF NOT EXISTS coin_leaderboard_daily_snapshot (
  snapshot_date TEXT NOT NULL,
  rank INTEGER NOT NULL,
  member_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  player_number INTEGER NOT NULL,
  coin_balance INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_date, rank)
);

CREATE INDEX IF NOT EXISTS idx_coin_snapshot_date
  ON coin_leaderboard_daily_snapshot(snapshot_date DESC, rank ASC);
