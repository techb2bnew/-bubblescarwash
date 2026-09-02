-- Priced optional extras, selectable as a step in the public booking flow
-- (distinct from `inclusions`, which is the no-price feature checklist shown
-- on the service comparison table). Prices are snapshotted onto
-- `booking_extras` at booking time so later price edits don't rewrite history.

create table if not exists extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table extras enable row level security;

grant select on extras to anon, authenticated;
grant insert, update, delete on extras to authenticated;

drop policy if exists "extras public read" on extras;
create policy "extras public read" on extras
  for select using (true);

drop policy if exists "extras admin write" on extras;
create policy "extras admin write" on extras
  for all using (is_admin()) with check (is_admin());

create table if not exists booking_extras (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings (id) on delete cascade,
  extra_id uuid references extras (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists booking_extras_booking_id_idx
  on booking_extras (booking_id);

alter table booking_extras enable row level security;

grant select on booking_extras to authenticated;

drop policy if exists "booking_extras admin read" on booking_extras;
create policy "booking_extras admin read" on booking_extras
  for select using (is_admin());

-- create_booking: accept optional extra ids, price them server-side (never
-- trust a client-supplied total), fold the sum into bookings.price, and
-- snapshot each selected extra's name/price onto booking_extras.
drop function if exists create_booking(uuid, date, time, text, text, text);

create or replace function create_booking(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_extra_ids uuid[] default '{}'::uuid[]
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

  select coalesce(sum(price), 0) into v_extras_total
  from extras where id = any(p_extra_ids);
  v_price := v_price + v_extras_total;

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

  insert into booking_extras (booking_id, extra_id, name, price)
  select new_id, id, name, price from extras where id = any(p_extra_ids);

  return new_id;
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text, uuid[])
  to anon, authenticated;

notify pgrst, 'reload schema';
