-- Per-date business hours override: admin can set a custom opening/closing time
-- for a single date. Falls back to business_settings.opening_time/closing_time
-- when no override exists for that date.

create table if not exists date_hours_overrides (
  date date primary key,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);

alter table date_hours_overrides enable row level security;

grant select on date_hours_overrides to anon, authenticated;
grant insert, update, delete on date_hours_overrides to authenticated;

drop policy if exists "date_hours_overrides public read" on date_hours_overrides;
create policy "date_hours_overrides public read" on date_hours_overrides
  for select using (true);

drop policy if exists "date_hours_overrides admin write" on date_hours_overrides;
create policy "date_hours_overrides admin write" on date_hours_overrides
  for all using (is_admin()) with check (is_admin());

-- Effective opening/closing time for a date: override wins, else business default.
create or replace function get_business_hours(target_date date)
returns table (opening_time time, closing_time time)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(o.start_time, bs.opening_time),
    coalesce(o.end_time, bs.closing_time)
  from business_settings bs
  left join date_hours_overrides o on o.date = target_date
  where bs.id = 1;
$$;

grant execute on function get_business_hours(date) to anon, authenticated;

-- get_booked_times: generate slots within the date's effective hours, not the global default.
drop function if exists get_booked_times(date);

create or replace function get_booked_times(target_date date)
returns table (booking_time time, reason text, is_blocked boolean)
language sql
security definer
stable
set search_path = public
as $$
  with settings as (
    select slot_interval_minutes from business_settings where id = 1
  ),
  hours as (
    select * from get_business_hours(target_date)
  ),
  capacity as (
    select get_booth_count(target_date) as booths
  ),
  slots as (
    select gs::time as slot_time
    from settings, hours,
    generate_series(
      (target_date + hours.opening_time)::timestamp,
      (target_date + hours.closing_time)::timestamp
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

-- create_booking: enforce the date's effective opening/closing hours.
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
  v_opening time;
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

  select opening_time, closing_time into v_opening, v_closing
  from get_business_hours(p_booking_date);

  v_booths := get_booth_count(p_booking_date);
  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_opening is not null and p_booking_time < v_opening then
    raise exception 'This time is before opening hours. Please pick a later time.';
  end if;

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
