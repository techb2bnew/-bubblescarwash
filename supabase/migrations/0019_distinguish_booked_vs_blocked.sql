-- Lets the public booking calendar tell "already booked by another
-- customer" apart from "admin blocked this slot" visually (blue vs red),
-- matching the distinction already shown in the admin calendar.

drop function if exists get_booked_times(date);

create function get_booked_times(target_date date)
returns table (booking_time time, reason text, is_blocked boolean)
language sql
security definer
stable
as $$
  with settings as (
    select slot_interval_minutes from business_settings where id = 1
  )
  select gs::time, null::text, false
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
  select time, reason, true from blocked_slots
  where date = target_date;
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

notify pgrst, 'reload schema';
