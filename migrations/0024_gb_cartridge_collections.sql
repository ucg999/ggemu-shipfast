CREATE TABLE IF NOT EXISTS member_gb_cartridges (
  member_id TEXT NOT NULL,
  cartridge_id TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, cartridge_id)
);

CREATE INDEX IF NOT EXISTS idx_member_gb_cartridges_member
  ON member_gb_cartridges(member_id, collected_at);
