-- Real customer bookings were not showing up as unavailable on the public
-- booking calendar (only admin-blocked slots were). Whatever version of
-- get_booked_times is currently live is not matching active bookings
-- correctly, so this drops it completely and recreates it fresh, then asks
-- PostgREST to reload its schema cache immediately (a stale cache can
-- otherwise keep serving the old function behavior after a DDL change).

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
      + make_interval(mins => s.duration_minutes)
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
