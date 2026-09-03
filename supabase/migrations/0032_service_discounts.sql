-- Simple per-service discount: admin sets a percent-off and toggles it on
-- with the toggle kept separate from the percent value so a discount can be
-- switched off without losing the configured rate. `effective_price` is a
-- generated column so every existing `select *` on services (booking flow,
-- admin) picks it up automatically with no query changes, and there's a
-- single source of truth for the discounted price rather than recomputing
-- the same formula in SQL and in the client.

alter table services
  add column if not exists discount_percent numeric(5, 2) not null default 0
    check (discount_percent >= 0 and discount_percent <= 100),
  add column if not exists discount_active boolean not null default false;

alter table services
  add column if not exists effective_price numeric(10, 2)
    generated always as (
      round(price * (1 - (case when discount_active then discount_percent else 0 end) / 100.0), 2)
    ) stored;

-- create_booking: price the booking off effective_price instead of price,
-- so the discount is what's actually charged. Everything else (extras
-- pricing, availability checks, gift-card redemption from 0030) is
-- unchanged from the current definition.
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
  v_booths int;
  v_max_concurrent int;
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

notify pgrst, 'reload schema';
