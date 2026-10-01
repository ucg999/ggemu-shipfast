-- Run once after importing the legacy D1 data into PostgreSQL/Supabase.
-- The imported rows keep their numeric IDs, but PostgreSQL sequences do not
-- automatically advance to the current MAX(id).

SELECT setval(
  pg_get_serial_sequence('public.leaderboard_scores', 'id'),
  COALESCE((SELECT MAX(id) FROM public.leaderboard_scores), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('public.leaderboard_submissions', 'id'),
  COALESCE((SELECT MAX(id) FROM public.leaderboard_submissions), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('public.member_coin_transactions', 'id'),
  COALESCE((SELECT MAX(id) FROM public.member_coin_transactions), 0) + 1,
  false
);

SELECT setval(
  pg_get_serial_sequence('public.coin_challenge_chat_messages', 'id'),
  COALESCE((SELECT MAX(id) FROM public.coin_challenge_chat_messages), 0) + 1,
  false
);
