-- Reserve 00002–00100. The next automatically allocated player number starts at 00101.
INSERT INTO member_number_sequence(id)
SELECT 100
WHERE COALESCE((SELECT MAX(id) FROM member_number_sequence), 0) < 100;
