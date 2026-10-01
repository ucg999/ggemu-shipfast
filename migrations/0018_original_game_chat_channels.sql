ALTER TABLE coin_challenge_chat_messages ADD COLUMN game_channel TEXT NOT NULL DEFAULT 'coin-challenge';
ALTER TABLE coin_challenge_presence ADD COLUMN game_channel TEXT NOT NULL DEFAULT 'coin-challenge';

CREATE INDEX IF NOT EXISTS idx_coin_chat_channel_created
  ON coin_challenge_chat_messages(game_channel, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_coin_presence_channel_seen
  ON coin_challenge_presence(game_channel, last_seen_at DESC);
