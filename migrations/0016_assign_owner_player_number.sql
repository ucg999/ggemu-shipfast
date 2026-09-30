CREATE TABLE IF NOT EXISTS member_owner_number_swap (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  old_number INTEGER NOT NULL
);

DELETE FROM member_owner_number_swap;

INSERT INTO member_owner_number_swap (id, old_number)
SELECT 1, player_number FROM members
WHERE display_name = '游戏历险记'
ORDER BY created_at ASC LIMIT 1;

UPDATE members
SET player_number = -1
WHERE player_number = 1
  AND display_name <> '游戏历险记'
  AND EXISTS (SELECT 1 FROM member_owner_number_swap);

UPDATE members
SET player_number = 1
WHERE id = (
  SELECT id FROM members
  WHERE display_name = '游戏历险记'
  ORDER BY created_at ASC LIMIT 1
);

UPDATE members
SET player_number = (SELECT old_number FROM member_owner_number_swap WHERE id = 1)
WHERE player_number = -1;

DROP TABLE member_owner_number_swap;
