ALTER TABLE members ADD COLUMN player_number INTEGER;

UPDATE members
SET player_number = (
  SELECT COUNT(*)
  FROM members AS earlier
  WHERE earlier.created_at < members.created_at
     OR (earlier.created_at = members.created_at AND earlier.id <= members.id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_player_number
  ON members(player_number);

CREATE TABLE IF NOT EXISTS member_number_sequence (
  id INTEGER PRIMARY KEY AUTOINCREMENT
);

INSERT INTO member_number_sequence(id)
VALUES ((SELECT COALESCE(MAX(player_number), 0) FROM members));
