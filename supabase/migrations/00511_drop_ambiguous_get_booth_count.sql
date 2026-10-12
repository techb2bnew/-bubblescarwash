-- 0025 created get_booth_count(date), 0038 added a second overload
-- get_booth_count(date, time default null) without ever dropping the first
-- one. Both signatures still exist side by side in the database, so any
-- PostgREST call that supplies only target_date (no target_time key at
-- all) fails outright with PGRST203 "Could not choose the best candidate
-- function" — Postgres itself can resolve the overload fine, but
-- PostgREST's RPC dispatch can't when nothing distinguishes which one was
-- meant. No current call site hits this (getBoothCountForDate always sends
-- target_time, even as null), but it's a live footgun for any future
-- caller that doesn't, and dead schema cruft either way — the 2-arg
-- version (default null) already covers every case the 1-arg one did.
drop function if exists get_booth_count(date);

notify pgrst, 'reload schema';
