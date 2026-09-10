-- Public-facing "X spots left" lookup for the booking page. Mirrors the
-- exact overlap-counting logic create_booking already uses to enforce
-- capacity (bookings whose span overlaps the capacity window, online and
-- not cancelled), but only returns aggregate numbers — no booking/customer
-- rows are exposed, so this is safe to grant to anon alongside the other
-- read-only booking-availability RPCs (get_booked_times, get_capacity_window).

create or replace function get_slot_capacity(target_date date, target_time time)
returns table (capacity int, booked int, remaining int)
language sql
stable
security definer
set search_path = public
as $$
  with w as (
    select window_start, window_end, booth_count
    from get_capacity_window(target_date, target_time)
  ),
  usage as (
    select count(*)::int as cnt
    from bookings b
    join services s on s.id = b.service_id
    cross join w
    where b.booking_date = target_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
      and (b.booking_date + b.booking_time)::timestamp < (target_date + w.window_end)::timestamp
      and (b.booking_date + b.booking_time)::timestamp
          + make_interval(mins => s.duration_minutes) > (target_date + w.window_start)::timestamp
  )
  select w.booth_count, usage.cnt, greatest(w.booth_count - usage.cnt, 0)
  from w, usage;
$$;

grant execute on function get_slot_capacity(date, time) to anon, authenticated;

notify pgrst, 'reload schema';
