-- Google Calendar integration: store the event id on each booking so we can
-- update or delete it when the booking is rescheduled or cancelled.

alter table bookings
  add column if not exists google_event_id text;

-- Server-side helper to persist the Google event id after calendar sync.
-- SECURITY DEFINER so public booking creation can save the id without service role.
create or replace function set_booking_google_event_id(
  p_booking_id uuid,
  p_google_event_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update bookings
  set google_event_id = p_google_event_id
  where id = p_booking_id;
end;
$$;

grant execute on function set_booking_google_event_id(uuid, text)
  to anon, authenticated;
