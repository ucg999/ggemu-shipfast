CREATE TABLE IF NOT EXISTS member_fc_saves (
  member_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  save_payload TEXT NOT NULL,
  backup_payload TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_member_fc_saves_member_updated
  ON member_fc_saves(member_id, updated_at DESC);
