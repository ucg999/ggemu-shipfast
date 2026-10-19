CREATE TABLE IF NOT EXISTS game_library_collection_events (
  event_key TEXT PRIMARY KEY,
  owner_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  game_id TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_library_collection_events_game
  ON game_library_collection_events(platform, game_id, collected_at);

INSERT OR IGNORE INTO game_library_collection_events
  (event_key, owner_key, platform, game_id, collected_at)
SELECT
  'legacy:' || owner_key || ':' || platform || ':' || game_id,
  owner_key,
  platform,
  game_id,
  collected_at
FROM game_library_collections;

CREATE TABLE IF NOT EXISTS game_library_guest_unlocks (
  owner_key TEXT NOT NULL,
  platform TEXT NOT NULL,
  game_id TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  PRIMARY KEY (owner_key, platform, game_id)
);
