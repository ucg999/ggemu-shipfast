CREATE TABLE IF NOT EXISTS game_library_collections (
  owner_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  game_id TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_key, platform, game_id)
);

CREATE INDEX IF NOT EXISTS idx_game_library_collections_game
  ON game_library_collections(platform, game_id, collected_at);
