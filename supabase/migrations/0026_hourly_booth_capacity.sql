-- Hourly booth capacity: booth_count limits concurrent bookings per clock hour.
-- 30-minute slots in the same hour (e.g. 9:00 and 9:30) share one capacity pool.

drop function if exists get_booked_times(date);

create or replace function get_booked_times(target_date date)
returns table (booking_time time, reason text, is_blocked boolean)
language sql
security definer
stable
set search_path = public
as $$
  with settings as (
    select opening_time, closing_time, slot_interval_minutes
    from business_settings where id = 1
  ),
  capacity as (
    select get_booth_count(target_date) as booths
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
  )
  select s.slot_time, null::text, false
  from slots s
  cross join capacity c
  cross join lateral (
    select count(*)::int as booking_count
    from bookings b
    join services s2 on s2.id = b.service_id
    where b.booking_date = target_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
      and (target_date + b.booking_time)::timestamp
          < date_trunc('hour', (target_date + s.slot_time)::timestamp) + interval '1 hour'
      and (target_date + b.booking_time)::timestamp
          + make_interval(mins => s2.duration_minutes)
          > date_trunc('hour', (target_date + s.slot_time)::timestamp)
  ) usage
  where usage.booking_count >= c.booths
  union all
  select bs.time, bs.reason, true
  from blocked_slots bs
  where bs.date = target_date;
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

create or replace function create_booking(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  v_price numeric(10, 2);
  v_duration int;
  v_closing time;
  v_start timestamp;
  v_end timestamp;
  v_booths int;
  v_max_concurrent int;
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  select price, duration_minutes into v_price, v_duration
  from services where id = p_service_id;
  if v_duration is null then
    raise exception 'Service not found.';
  end if;

  select closing_time into v_closing from business_settings where id = 1;

  v_booths := get_booth_count(p_booking_date);
  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_closing is not null and v_end::time > v_closing and v_end::date = p_booking_date then
    raise exception 'This service does not fit before closing time. Please pick an earlier time.';
  end if;

  select coalesce(max(hourly.cnt), 0) into v_max_concurrent
  from generate_series(
    date_trunc('hour', v_start),
    date_trunc('hour', v_end - interval '1 microsecond'),
    interval '1 hour'
  ) as hs(hour_start)
  cross join lateral (
    select count(*)::int as cnt
    from bookings b
    join services s on s.id = b.service_id
    where b.booking_date = p_booking_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
      and (b.booking_date + b.booking_time)::timestamp < hs.hour_start + interval '1 hour'
      and (b.booking_date + b.booking_time)::timestamp
          + make_interval(mins => s.duration_minutes) > hs.hour_start
  ) as hourly;

  if v_max_concurrent >= v_booths then
    raise exception 'This time slot is fully booked. Please pick another.';
  end if;

  if exists (
    select 1 from blocked_slots
    where date = p_booking_date
      and (p_booking_date + time)::timestamp >= v_start
      and (p_booking_date + time)::timestamp < v_end
  ) then
    raise exception 'This time slot is not available for booking.';
  end if;

  insert into bookings (
    service_id, booking_date, booking_time,
    customer_name, customer_phone, customer_email, price, booking_type
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price, 'online'
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
