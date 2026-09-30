CREATE TABLE IF NOT EXISTS coin_challenge_chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 120),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coin_challenge_chat_created
  ON coin_challenge_chat_messages(created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS coin_challenge_presence (
  member_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_coin_challenge_presence_seen
  ON coin_challenge_presence(last_seen_at DESC);
