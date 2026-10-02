CREATE TABLE IF NOT EXISTS wanted_weekly_playtime (
  participant_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  member_id TEXT,
  display_name TEXT NOT NULL,
  raw_minutes INTEGER NOT NULL DEFAULT 0,
  weighted_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (participant_key, period_key)
);

CREATE INDEX IF NOT EXISTS idx_wanted_weekly_rank
  ON wanted_weekly_playtime(period_key, weighted_minutes DESC, updated_at ASC);

CREATE TABLE IF NOT EXISTS wanted_playtime_submissions (
  submission_key TEXT PRIMARY KEY,
  participant_key TEXT NOT NULL,
  period_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wanted_weekly_awards (
  period_key TEXT NOT NULL,
  rank INTEGER NOT NULL,
  participant_key TEXT NOT NULL,
  member_id TEXT,
  display_name TEXT NOT NULL,
  weighted_minutes INTEGER NOT NULL,
  reward_coins INTEGER NOT NULL,
  claimed_at TEXT,
  PRIMARY KEY (period_key, rank)
);

CREATE INDEX IF NOT EXISTS idx_wanted_awards_participant
  ON wanted_weekly_awards(participant_key, claimed_at);
