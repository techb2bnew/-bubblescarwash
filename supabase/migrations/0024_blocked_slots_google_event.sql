-- Google Calendar sync for individually blocked time slots.

alter table blocked_slots
  add column if not exists google_event_id text;

grant update on blocked_slots to authenticated;

drop policy if exists "blocked_slots admin update" on blocked_slots;
create policy "blocked_slots admin update" on blocked_slots
  for update using (is_admin());
