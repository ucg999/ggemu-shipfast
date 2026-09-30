ALTER TABLE coin_challenge_presence ADD COLUMN room_id TEXT;
ALTER TABLE coin_challenge_shared_rounds ADD COLUMN target_index INTEGER NOT NULL DEFAULT 0;

