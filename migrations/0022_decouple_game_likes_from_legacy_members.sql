CREATE TABLE psp_game_like_members_next (
  member_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  first_liked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, game_id)
);

INSERT OR IGNORE INTO psp_game_like_members_next (member_id, game_id, first_liked_at)
SELECT member_id, game_id, first_liked_at FROM psp_game_like_members;

DROP TABLE psp_game_like_members;
ALTER TABLE psp_game_like_members_next RENAME TO psp_game_like_members;

CREATE INDEX idx_psp_game_like_members_game
ON psp_game_like_members(game_id);
