-- get_booked_times built its list of slots from business_settings' single
-- opening/closing time (09:00-17:00), but the booking form offers the
-- per-day hours from get_business_hours (weekday/date overrides, e.g. an
-- 8:00 AM opening). A full slot outside the settings range — 8:00 AM — was
-- therefore never reported as booked: it kept showing as Available, and
-- create_booking then refused it with "This time slot is fully booked".
--
-- Same function as in 0039 except the slots now come from
-- get_business_hours(target_date), so the list agrees with what is offered
-- and with what create_booking enforces.
create or replace function get_booked_times(target_date date)
returns table (booking_time time, reason text, is_blocked boolean)
language sql
security definer
stable
set search_path = public
as $$
  with settings as (
    select h.opening_time, h.closing_time, b.slot_interval_minutes
    from business_settings b
    cross join lateral get_business_hours(target_date) h
    where b.id = 1
  ),
  slots as (
    select gs::time as slot_time
    from settings,
    generate_series(
      (target_date + settings.opening_time)::timestamp,
      (target_date + settings.closing_time)::timestamp
        - make_interval(mins => settings.slot_interval_minutes),
      make_interval(mins => settings.slot_interval_minutes)
    ) as gs
  ),
  windows as (
    select s.slot_time, w.window_start, w.window_end, w.booth_count
    from slots s
    cross join lateral get_capacity_window(target_date, s.slot_time) w
  )
  select w.slot_time, null::text, false
  from windows w
  cross join lateral (
    select count(*)::int as booking_count
    from bookings b
    join services s2 on s2.id = b.service_id
    where b.booking_date = target_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
      and (target_date + b.booking_time)::timestamp < (target_date + w.window_end)::timestamp
      and (target_date + b.booking_time)::timestamp
          + make_interval(mins => s2.duration_minutes) > (target_date + w.window_start)::timestamp
  ) usage
  where usage.booking_count >= w.booth_count
  union all
  select bs.time, bs.reason, true
  from blocked_slots bs
  where bs.date = target_date;
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

notify pgrst, 'reload schema';
