CREATE TABLE IF NOT EXISTS coin_challenge_shared_rounds (
  room_id TEXT PRIMARY KEY,
  round_token TEXT NOT NULL,
  starts_at_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
