CREATE TABLE IF NOT EXISTS wanted_weekly_posters (
  period_key TEXT NOT NULL,
  participant_key TEXT NOT NULL,
  poster_number INTEGER NOT NULL CHECK (poster_number BETWEEN 1 AND 18),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (period_key, participant_key),
  UNIQUE (period_key, poster_number)
);

CREATE INDEX IF NOT EXISTS idx_wanted_weekly_posters_period
  ON wanted_weekly_posters(period_key, poster_number);
