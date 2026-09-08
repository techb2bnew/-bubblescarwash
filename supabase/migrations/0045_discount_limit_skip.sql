-- A customer-targeted discount (auto-matched by email/phone, no code
-- typed) that has hit its redemption limit should NOT block the booking —
-- the customer never asked for it, so the booking should just proceed at
-- full price. A typed coupon code hitting its limit should still raise, so
-- the customer sees why their code didn't apply. Same signature as before;
-- only the discount-resolution block changes (tracks whether the match
-- came from a customer or a typed code, and only raises for the latter).

create or replace function create_booking(
  p_service_id uuid,
  p_vehicle_type text,
  p_booking_date date,
  p_booking_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_extra_ids uuid[] default '{}'::uuid[],
  p_gift_card_code text default null,
  p_discount_code text default null
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
  v_discount_id uuid;
  v_discount_is_code boolean := false;
  v_discount_type text;
  v_discount_value numeric(10, 2);
  v_discount_max int;
  v_discount_count int;
  v_discount_per_customer int;
  v_discount_amount numeric(10, 2) := 0;
  v_customer_redemptions int;
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

  select sp.price, s.duration_minutes
    into v_price, v_duration
  from service_prices sp
  join services s on s.id = sp.service_id
  where sp.service_id = p_service_id and sp.vehicle_type = p_vehicle_type;

  if v_duration is null then
    raise exception 'This service is not available for the selected vehicle type.';
  end if;

  -- Resolve an applicable discount: a customer match takes priority (it was
  -- deliberately assigned to them), otherwise fall back to a typed coupon
  -- code. Either way, lock the row before validating limits so two
  -- concurrent bookings can't both squeeze past a redemption cap.
  select d.id into v_discount_id
  from discounts d
  join customers c on c.id = d.customer_id
  where d.active
    and (d.expires_at is null or d.expires_at > now())
    and (
      (p_customer_email <> '' and lower(c.email) = lower(p_customer_email))
      or (p_customer_phone <> '' and c.phone = p_customer_phone)
    )
  limit 1;

  if v_discount_id is null and p_discount_code is not null and length(trim(p_discount_code)) > 0 then
    select id into v_discount_id
    from discounts
    where upper(code) = upper(trim(p_discount_code))
      and customer_id is null
      and active
      and (expires_at is null or expires_at > now());

    if v_discount_id is null then
      raise exception 'Discount code not found or no longer valid.';
    end if;
    v_discount_is_code := true;
  end if;

  if v_discount_id is not null then
    select discount_type, value, max_redemptions, redemption_count, per_customer_limit
      into v_discount_type, v_discount_value, v_discount_max, v_discount_count, v_discount_per_customer
    from discounts
    where id = v_discount_id
    for update;

    if v_discount_max is not null and v_discount_count >= v_discount_max then
      if v_discount_is_code then
        raise exception 'This discount code has reached its redemption limit.';
      end if;
      -- Auto-matched customer discount, maxed out — skip it silently and
      -- let the booking continue at full price rather than blocking it.
      v_discount_id := null;
    end if;
  end if;

  if v_discount_id is not null and v_discount_per_customer is not null then
    select count(*) into v_customer_redemptions
    from discount_redemptions
    where discount_id = v_discount_id
      and (
        (p_customer_email <> '' and lower(customer_email) = lower(p_customer_email))
        or (p_customer_phone <> '' and customer_phone = p_customer_phone)
      );
    if v_customer_redemptions >= v_discount_per_customer then
      if v_discount_is_code then
        raise exception 'You have already used this discount code the maximum number of times.';
      end if;
      v_discount_id := null;
    end if;
  end if;

  if v_discount_id is not null then
    v_discount_amount := case
      when v_discount_type = 'percent' then round(v_price * v_discount_value / 100.0, 2)
      else least(v_discount_value, v_price)
    end;
    v_price := v_price - v_discount_amount;
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
    gift_card_id, gift_card_discount, discount_id, discount_amount
  ) values (
    p_service_id, p_vehicle_type, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price, 'online',
    v_gift_card_id, v_gift_card_discount, v_discount_id, v_discount_amount
  )
  returning id into new_id;

  insert into booking_extras (booking_id, extra_id, name, price)
  select new_id, id, name, price from extras where id = any(p_extra_ids);

  if v_gift_card_id is not null then
    update gift_cards
    set status = 'used', redeemed_at = now(), redeemed_booking_id = new_id
    where id = v_gift_card_id;
  end if;

  if v_discount_id is not null then
    insert into discount_redemptions (discount_id, booking_id, customer_email, customer_phone, amount)
    values (v_discount_id, new_id, p_customer_email, p_customer_phone, v_discount_amount);

    update discounts set redemption_count = redemption_count + 1 where id = v_discount_id;
  end if;

  return new_id;
end;
$$;

grant execute on function create_booking(uuid, text, date, time, text, text, text, uuid[], text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
