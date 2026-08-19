-- Found the real bug: get_booked_times computed the span end as
-- (start + duration - slot_interval). When a service's duration is SHORTER
-- than the slot interval (e.g. a 25-minute service on a 30-minute grid),
-- that end time lands BEFORE the start time, so generate_series(start, end,
-- step) produced zero rows — the booking silently vanished from the
-- availability check entirely. Fix: never let the span be shorter than one
-- slot by flooring duration at slot_interval_minutes before subtracting.

drop function if exists get_booked_times(date);

create function get_booked_times(target_date date)
returns table (booking_time time, reason text)
language sql
security definer
stable
as $$
  with settings as (
    select slot_interval_minutes from business_settings where id = 1
  )
  select gs::time, null::text
  from bookings b
  join services s on s.id = b.service_id
  cross join settings
  cross join lateral generate_series(
    (target_date + b.booking_time)::timestamp,
    (target_date + b.booking_time)::timestamp
      + make_interval(mins => greatest(s.duration_minutes, settings.slot_interval_minutes))
      - make_interval(mins => settings.slot_interval_minutes),
    make_interval(mins => settings.slot_interval_minutes)
  ) as gs
  where b.booking_date = target_date and b.status <> 'cancelled'
  union
  select time, reason from blocked_slots
  where date = target_date;
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

notify pgrst, 'reload schema';
