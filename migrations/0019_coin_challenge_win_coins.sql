ALTER TABLE coin_challenge_room_competitions
ADD COLUMN win_coins_json TEXT NOT NULL DEFAULT '{}';
