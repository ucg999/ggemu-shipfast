CREATE TABLE IF NOT EXISTS coin_challenge_room_competitions (
  room_id TEXT PRIMARY KEY,
  round_number INTEGER NOT NULL DEFAULT 0,
  jackpot INTEGER NOT NULL DEFAULT 0,
  win_counts_json TEXT NOT NULL DEFAULT '{}',
  last_round_token TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE coin_challenge_shared_rounds ADD COLUMN award_member_id TEXT;
ALTER TABLE coin_challenge_shared_rounds ADD COLUMN award_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coin_challenge_shared_rounds ADD COLUMN competition_round INTEGER NOT NULL DEFAULT 0;
ALTER TABLE coin_challenge_shared_rounds ADD COLUMN competition_jackpot INTEGER NOT NULL DEFAULT 0;
