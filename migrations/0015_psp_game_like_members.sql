CREATE TABLE IF NOT EXISTS psp_game_like_members (
  member_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  first_liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, game_id),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_psp_game_like_members_game
  ON psp_game_like_members(game_id);
