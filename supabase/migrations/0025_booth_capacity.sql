-- Multi-booth capacity: allow multiple concurrent bookings per time slot.
-- Admins can set booth count for a day, week, or month via booth_capacity_periods.

alter table business_settings
  add column if not exists default_booth_count int not null default 1
    check (default_booth_count >= 1);

create table if not exists booth_capacity_periods (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date not null,
  booth_count int not null check (booth_count >= 1),
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists booth_capacity_periods_dates_idx
  on booth_capacity_periods (start_date, end_date);

alter table booth_capacity_periods enable row level security;

grant select on booth_capacity_periods to anon, authenticated;
grant insert, update, delete on booth_capacity_periods to authenticated;

drop policy if exists "booth_capacity_periods public read" on booth_capacity_periods;
create policy "booth_capacity_periods public read" on booth_capacity_periods
  for select using (true);

drop policy if exists "booth_capacity_periods admin write" on booth_capacity_periods;
create policy "booth_capacity_periods admin write" on booth_capacity_periods
  for all using (is_admin()) with check (is_admin());

-- Booth count for a date: most specific (shortest) active period wins, else default.
create or replace function get_booth_count(target_date date)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select booth_count
      from booth_capacity_periods
      where target_date between start_date and end_date
      order by (end_date - start_date) asc, created_at desc
      limit 1
    ),
    (select default_booth_count from business_settings where id = 1)
  );
$$;

grant execute on function get_booth_count(date) to anon, authenticated;

-- Remove single-booking-per-slot constraint for online bookings.
drop index if exists bookings_date_time_unique;

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
  capacity as (
    select get_booth_count(target_date) as booths
  ),
  expanded as (
    select gs::time as slot_time
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
    where b.booking_date = target_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
  ),
  usage as (
    select slot_time, count(*)::int as booking_count
    from expanded
    group by slot_time
  )
  select u.slot_time, null::text, false
  from usage u
  cross join capacity c
  where u.booking_count >= c.booths
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
  v_interval int;
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

  select closing_time, slot_interval_minutes
  into v_closing, v_interval
  from business_settings where id = 1;

  v_booths := get_booth_count(p_booking_date);
  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_closing is not null and v_end::time > v_closing and v_end::date = p_booking_date then
    raise exception 'This service does not fit before closing time. Please pick an earlier time.';
  end if;

  select coalesce(max(concurrent.cnt), 0) into v_max_concurrent
  from generate_series(
    v_start,
    v_end - make_interval(mins => v_interval),
    make_interval(mins => v_interval)
  ) as gs(ts)
  cross join lateral (
    select count(*)::int as cnt
    from bookings b
    join services s on s.id = b.service_id
    where b.booking_date = p_booking_date
      and b.status <> 'cancelled'
      and b.booking_type = 'online'
      and (b.booking_date + b.booking_time)::timestamp
        < gs.ts + make_interval(mins => v_interval)
      and (b.booking_date + b.booking_time)::timestamp
        + make_interval(mins => s.duration_minutes) > gs.ts
  ) as concurrent;

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
