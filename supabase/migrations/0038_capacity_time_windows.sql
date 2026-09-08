-- Time-of-day scoped booth capacity: lets an admin set a different booth
-- count for just part of a day (e.g. 11am-3pm) instead of only whole
-- days/weeks/months. NULL start_time/end_time means "all day", so every
-- existing row keeps working exactly as before.

alter table booth_capacity_periods
  add column if not exists start_time time,
  add column if not exists end_time time;

alter table booth_capacity_periods
  drop constraint if exists booth_capacity_periods_time_range_check;
alter table booth_capacity_periods
  add constraint booth_capacity_periods_time_range_check
    check (
      (start_time is null and end_time is null)
      or (start_time is not null and end_time is not null and end_time > start_time)
    );

-- Booth count for a date (and, optionally, a specific time of day): the
-- most specific active period wins — a time-scoped period covering that
-- time beats an all-day period, then shortest date range, then most
-- recent. Passing no time (existing 1-arg callers) only ever matches
-- all-day periods, preserving prior behavior exactly.
create or replace function get_booth_count(target_date date, target_time time default null)
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
        and (
          (start_time is null and end_time is null)
          or (
            target_time is not null
            and target_time >= start_time and target_time < end_time
          )
        )
      order by
        (start_time is not null) desc,
        (end_date - start_date) asc,
        created_at desc
      limit 1
    ),
    (select default_booth_count from business_settings where id = 1)
  );
$$;

grant execute on function get_booth_count(date, time) to anon, authenticated;

-- get_booked_times: capacity is now checked per slot (its own clock hour)
-- rather than once for the whole day, so a slot that crosses into/out of a
-- time-scoped capacity window is judged correctly on each side.
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
  where usage.booking_count >= get_booth_count(target_date, s.slot_time)
  union all
  select bs.time, bs.reason, true
  from blocked_slots bs
  where bs.date = target_date;
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

-- create_booking: same signature and logic as 0032_service_discounts.sql,
-- except the single day-wide capacity check is replaced with a per-hour
-- check (each overlapping clock hour judged against its own capacity).
create or replace function create_booking(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_extra_ids uuid[] default '{}'::uuid[],
  p_gift_card_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  v_price numeric(10, 2);
  v_extras_total numeric(10, 2);
  v_duration int;
  v_opening time;
  v_closing time;
  v_start timestamp;
  v_end timestamp;
  v_gift_card_id uuid;
  v_gift_card_value numeric(10, 2);
  v_gift_card_discount numeric(10, 2) := 0;
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  select effective_price, duration_minutes into v_price, v_duration
  from services where id = p_service_id;
  if v_duration is null then
    raise exception 'Service not found.';
  end if;

  select coalesce(sum(price), 0) into v_extras_total
  from extras where id = any(p_extra_ids);
  v_price := v_price + v_extras_total;

  select opening_time, closing_time into v_opening, v_closing
  from get_business_hours(p_booking_date);

  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_opening is not null and p_booking_time < v_opening then
    raise exception 'This time is before opening hours. Please pick a later time.';
  end if;

  if v_closing is not null and v_end::time > v_closing and v_end::date = p_booking_date then
    raise exception 'This service does not fit before closing time. Please pick an earlier time.';
  end if;

  if exists (
    select 1
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
    ) as hourly
    where hourly.cnt >= get_booth_count(p_booking_date, hs.hour_start::time)
  ) then
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

  if p_gift_card_code is not null and length(trim(p_gift_card_code)) > 0 then
    select id, value into v_gift_card_id, v_gift_card_value
    from gift_cards
    where upper(code) = upper(trim(p_gift_card_code))
    for update;

    if v_gift_card_id is null then
      raise exception 'Gift card code not found.';
    end if;

    perform 1 from gift_cards
      where id = v_gift_card_id
        and status = 'active'
        and expires_at > now();
    if not found then
      raise exception 'This gift card is not valid (already used, cancelled, or expired).';
    end if;

    v_gift_card_discount := least(v_gift_card_value, v_price);
    v_price := v_price - v_gift_card_discount;
  end if;

  insert into bookings (
    service_id, booking_date, booking_time,
    customer_name, customer_phone, customer_email, price, booking_type,
    gift_card_id, gift_card_discount
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price, 'online',
    v_gift_card_id, v_gift_card_discount
  )
  returning id into new_id;

  insert into booking_extras (booking_id, extra_id, name, price)
  select new_id, id, name, price from extras where id = any(p_extra_ids);

  if v_gift_card_id is not null then
    update gift_cards
    set status = 'used', redeemed_at = now(), redeemed_booking_id = new_id
    where id = v_gift_card_id;
  end if;

  return new_id;
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text, uuid[], text)
  to anon, authenticated;

notify pgrst, 'reload schema';
