-- Different packages take different amounts of time (e.g. a 1hr wash vs a
-- 2.5hr detail). Until now the whole system only ever blocked the single
-- slot a booking started in, so a 2hr booking at 10:00 left 10:30/11:00/11:30
-- looking "available" even though the bay/staff were still busy. This makes
-- every availability check duration-aware:
--   - get_booked_times expands each active booking into every slot it spans
--     (using the service's duration_minutes), so both the public booking
--     calendar and the admin calendar/reschedule pickers grey out the whole
--     span, not just the start time.
--   - create_booking now rejects a new booking whenever its
--     [start, start + duration) span overlaps an existing booking's span or
--     a blocked slot, or would run past closing time — real interval math,
--     not just an exact-start-time match.

drop function if exists get_booked_times(date);

create or replace function get_booked_times(target_date date)
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

  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_closing is not null and v_end::time > v_closing and v_end::date = p_booking_date then
    raise exception 'This service does not fit before closing time. Please pick an earlier time.';
  end if;

  if exists (
    select 1 from bookings b
    join services s on s.id = b.service_id
    where b.booking_date = p_booking_date
      and b.status <> 'cancelled'
      and (b.booking_date + b.booking_time)::timestamp < v_end
      and (b.booking_date + b.booking_time)::timestamp
        + make_interval(mins => s.duration_minutes) > v_start
  ) then
    raise exception 'This time slot was just taken. Please pick another.';
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
    customer_name, customer_phone, customer_email, price
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'This time slot was just taken. Please pick another.';
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;
