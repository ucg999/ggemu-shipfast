ALTER TABLE coin_challenge_presence ADD COLUMN bets_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE coin_challenge_presence ADD COLUMN game_mode TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE coin_challenge_presence ADD COLUMN credits INTEGER NOT NULL DEFAULT 0;
