PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leaderboard_games (
  game_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  ranking_mode TEXT NOT NULL DEFAULT 'high_score'
    CHECK (ranking_mode IN ('high_score', 'low_time', 'most_wins')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard_players (
  player_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL CHECK (length(nickname) BETWEEN 1 AND 24),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leaderboard_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'all'
    CHECK (period_type IN ('all', 'daily', 'weekly')),
  period_key TEXT NOT NULL DEFAULT 'all',
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES leaderboard_games(game_id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES leaderboard_players(player_id) ON DELETE CASCADE,
  UNIQUE (game_id, player_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_high_score
  ON leaderboard_scores (game_id, period_type, period_key, score DESC, duration_ms ASC, updated_at ASC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_low_time
  ON leaderboard_scores (game_id, period_type, period_key, duration_ms ASC, score DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS leaderboard_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_key TEXT NOT NULL UNIQUE,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_submissions_created_at
  ON leaderboard_submissions (created_at);

INSERT OR IGNORE INTO leaderboard_games (game_id, display_name, ranking_mode) VALUES
  ('red-blue-arena', '红蓝竞技场', 'most_wins'),
  ('ghost-hunter', '幽灵捕手', 'high_score'),
  ('coin-challenge', '金币娱乐游戏', 'high_score');
