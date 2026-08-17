-- Surfaces the admin's block reason (from blocked_slots) alongside each
-- unavailable time so the public booking calendar can show it on hover.
-- Real customer bookings still report a null reason (no customer PII leaks).

create or replace function get_booked_times(target_date date)
returns table (booking_time time, reason text)
language sql
security definer
stable
as $$
  select booking_time, null::text from bookings
  where booking_date = target_date and status <> 'cancelled'
  union
  select time, reason from blocked_slots
  where date = target_date;
$$;
