-- Allow admins to update blocked_dates (needed to save google_event_id after calendar sync).

drop policy if exists "blocked_dates admin update" on blocked_dates;
create policy "blocked_dates admin update" on blocked_dates
  for update using (is_admin());
