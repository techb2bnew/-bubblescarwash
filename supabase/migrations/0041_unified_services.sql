-- Services become one shared entity per offering, priced separately per
-- vehicle type (instead of one fully independent row per vehicle type, as
-- the previous "quick multi-create" admin form produced). `services` keeps
-- its name/id and becomes the template (name, duration, discount, add-ons —
-- inclusions.service_id already points here and needs no change); the new
-- `service_prices` table holds the per-vehicle-type price. Deliberately
-- NOT renaming `services` and NOT repointing bookings.service_id — both
-- keep referencing the template exactly as before, which is what lets
-- every existing `services(...)`/`inclusions(...)` embed elsewhere in the
-- app keep working unchanged. The 3 services created under the old
-- multi-row model don't map cleanly onto the new shape (no bookings
-- reference them yet), so they're cleared rather than migrated.

delete from services;

alter table services
  drop column if exists effective_price,
  drop column if exists vehicle_type,
  drop column if exists price;

create table if not exists service_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id) on delete cascade,
  vehicle_type text not null,
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  unique (service_id, vehicle_type)
);

alter table service_prices enable row level security;

grant select on service_prices to anon, authenticated;
grant insert, update, delete on service_prices to authenticated;

drop policy if exists "service_prices public read" on service_prices;
create policy "service_prices public read" on service_prices
  for select using (true);

drop policy if exists "service_prices admin write" on service_prices;
create policy "service_prices admin write" on service_prices
  for all using (is_admin()) with check (is_admin());

-- The actual vehicle type booked, snapshotted like customer_name/price
-- already are. bookings.service_id keeps referencing services(id) (the
-- template) unchanged — only this new column identifies which priced
-- variant was selected.
alter table bookings add column if not exists vehicle_type text not null default '';
alter table bookings alter column vehicle_type drop default;

-- create_booking: same signature plus p_vehicle_type, same logic
-- throughout (capacity/hour-window checks, blocked slots, gift cards,
-- extras all unchanged) — only the price/duration lookup changes, now
-- joining service_prices (price, matched by vehicle type) with services
-- (duration, discount), computing effective_price with the same formula
-- the old generated column used.
drop function if exists create_booking(uuid, date, time, text, text, text, uuid[], text);

create or replace function create_booking(
  p_service_id uuid,
  p_vehicle_type text,
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
  hs timestamp;
  v_win_start time;
  v_win_end time;
  v_capacity int;
  v_cnt int;
  checked_windows text[] := '{}';
  v_win_key text;
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  select
    round(sp.price * (1 - (case when s.discount_active then s.discount_percent else 0 end) / 100.0), 2),
    s.duration_minutes
    into v_price, v_duration
  from service_prices sp
  join services s on s.id = sp.service_id
  where sp.service_id = p_service_id and sp.vehicle_type = p_vehicle_type;

  if v_duration is null then
    raise exception 'This service is not available for the selected vehicle type.';
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

  hs := date_trunc('hour', v_start);
  while hs < v_end loop
    select window_start, window_end, booth_count
      into v_win_start, v_win_end, v_capacity
    from get_capacity_window(p_booking_date, hs::time);

    v_win_key := v_win_start::text || '-' || v_win_end::text;
    if not (v_win_key = any(checked_windows)) then
      checked_windows := checked_windows || v_win_key;

      select count(*) into v_cnt
      from bookings b
      join services s on s.id = b.service_id
      where b.booking_date = p_booking_date
        and b.status <> 'cancelled'
        and b.booking_type = 'online'
        and (b.booking_date + b.booking_time)::timestamp < (p_booking_date + v_win_end)::timestamp
        and (b.booking_date + b.booking_time)::timestamp
            + make_interval(mins => s.duration_minutes) > (p_booking_date + v_win_start)::timestamp;

      if v_cnt >= v_capacity then
        raise exception 'This time slot is fully booked. Please pick another.';
      end if;
    end if;

    hs := hs + interval '1 hour';
  end loop;

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
    service_id, vehicle_type, booking_date, booking_time,
    customer_name, customer_phone, customer_email, price, booking_type,
    gift_card_id, gift_card_discount
  ) values (
    p_service_id, p_vehicle_type, p_booking_date, p_booking_time,
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

grant execute on function create_booking(uuid, text, date, time, text, text, text, uuid[], text)
  to anon, authenticated;

notify pgrst, 'reload schema';
