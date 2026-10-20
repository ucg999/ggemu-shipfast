CREATE TABLE IF NOT EXISTS game_comments (
  id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  member_id TEXT,
  author_key TEXT,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS game_comments_game_created_idx
  ON game_comments(game_id, created_at DESC);
