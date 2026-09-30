CREATE TABLE IF NOT EXISTS member_daily_transfers (
  member_id TEXT NOT NULL,
  transfer_date TEXT NOT NULL,
  browser_to_member INTEGER NOT NULL DEFAULT 0 CHECK (browser_to_member BETWEEN 0 AND 999),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, transfer_date),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
