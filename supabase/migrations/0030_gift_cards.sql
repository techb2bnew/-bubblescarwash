-- Gift cards: admin-managed purchasable denominations (gift_card_products,
-- mirrors `extras`) and purchased instances (gift_cards, mirrors the
-- Stripe/payment-status pattern on `bookings` from 0029_stripe_payments.sql).
--
-- Redemption is folded into create_booking() as an optional parameter rather
-- than a separate two-step API: validating the code, computing the discount,
-- and consuming the card all happen in one locked transaction, so there's no
-- window where a one-time-use card could be marked used but the booking
-- creation subsequently fails.

create table if not exists gift_card_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2) not null check (price >= 0),
  validity_days int not null check (validity_days > 0),
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table gift_card_products enable row level security;

grant select on gift_card_products to anon, authenticated;
grant insert, update, delete on gift_card_products to authenticated;

create policy "gift_card_products public read" on gift_card_products
  for select using (true);

create policy "gift_card_products admin write" on gift_card_products
  for all using (is_admin()) with check (is_admin());

-- Purchased gift card instances. "expired" is not a stored status — it's
-- computed at read/redeem time from expires_at < now(), same reasoning as
-- bookings never needing a cron sweep for their own state.
create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references gift_card_products (id) on delete set null,
  code text not null unique,
  value numeric(10, 2) not null check (value >= 0),

  purchaser_name text not null,
  purchaser_email text not null,
  purchaser_phone text,

  recipient_name text,
  recipient_email text,
  message text,

  status text not null default 'pending'
    check (status in ('pending', 'active', 'used', 'cancelled')),

  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,

  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_booking_id uuid references bookings (id) on delete set null,

  created_at timestamptz not null default now()
);

create unique index if not exists gift_cards_stripe_checkout_session_id_idx
  on gift_cards (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create index if not exists gift_cards_code_idx on gift_cards (code);
create index if not exists gift_cards_redeemed_booking_id_idx on gift_cards (redeemed_booking_id);

alter table gift_cards enable row level security;

-- No direct anon table access — purchase/redemption go exclusively through
-- the security-definer RPCs below, same pattern as `bookings`.
grant select on gift_cards to authenticated;

create policy "gift_cards admin read" on gift_cards
  for select using (is_admin());

alter table bookings
  add column if not exists gift_card_id uuid references gift_cards (id) on delete set null,
  add column if not exists gift_card_discount numeric(10, 2) not null default 0;

-- 8-char uppercase alphanumeric code, ambiguous characters excluded.
create or replace function generate_gift_card_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

-- create_booking: add optional gift-card redemption. Signature gains
-- p_gift_card_code as the new last parameter (preserves existing positional
-- call sites). Everything through the existing capacity/blocked-slot checks
-- is unchanged from 0028_priced_extras.sql — only the gift-card block
-- (validated + consumed atomically under a row lock, right before the
-- insert, so a concurrent booking can never redeem the same one-time-use
-- code, and no earlier validation failure can leave a card stranded as used)
-- and the two new bookings columns are new.
drop function if exists create_booking(uuid, date, time, text, text, text, uuid[]);

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

  -- Gift card redemption: only after every other validation has passed, so
  -- a failed booking never leaves a one-time-use card stranded as consumed.
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

-- A booking fully covered by a gift card has price = 0 — Stripe rejects
-- zero-amount Checkout Sessions, so the Stripe-path action calls this
-- instead of creating one, marking the booking paid with no Stripe fields.
create or replace function mark_booking_paid_no_charge(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings
  set payment_status = 'paid'
  where id = p_booking_id and payment_status = 'unpaid' and price = 0;
$$;

grant execute on function mark_booking_paid_no_charge(uuid) to anon, authenticated;

-- Reserve a gift card purchase and generate its redemption code up front
-- (mirrors create_booking's "reserve immediately" pattern). Retries on a
-- code collision (negligible odds at 8 chars, but defended anyway).
create or replace function create_gift_card_purchase(
  p_product_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  v_price numeric(10, 2);
  v_validity_days int;
  v_code text;
  v_attempt int := 0;
begin
  select price, validity_days into v_price, v_validity_days
  from gift_card_products
  where id = p_product_id and active;

  if v_price is null then
    raise exception 'Gift card product not found or unavailable.';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := generate_gift_card_code();
    begin
      insert into gift_cards (
        product_id, code, value, purchaser_name, purchaser_email, purchaser_phone,
        recipient_name, recipient_email, message, expires_at
      ) values (
        p_product_id, v_code, v_price, p_purchaser_name, p_purchaser_email,
        nullif(p_purchaser_phone, ''),
        nullif(p_recipient_name, ''), nullif(p_recipient_email, ''), nullif(p_message, ''),
        now() + make_interval(days => v_validity_days)
      )
      returning id into new_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique gift card code, please try again.';
      end if;
    end;
  end loop;

  return new_id;
end;
$$;

grant execute on function create_gift_card_purchase(uuid, text, text, text, text, text, text)
  to anon, authenticated;

-- Price lookup for sizing the Stripe Checkout line item (mirrors get_booking_price).
create or replace function get_gift_card_price(p_gift_card_id uuid)
returns numeric(10, 2)
language sql
stable
security definer
set search_path = public
as $$
  select value from gift_cards where id = p_gift_card_id;
$$;

grant execute on function get_gift_card_price(uuid) to anon, authenticated;

-- Attach the Stripe Checkout Session id; flips to 'pending'.
create or replace function set_gift_card_checkout_session(
  p_gift_card_id uuid,
  p_stripe_checkout_session_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  update gift_cards
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      payment_status = 'pending'
  where id = p_gift_card_id and payment_status = 'unpaid';
$$;

grant execute on function set_gift_card_checkout_session(uuid, text) to anon, authenticated;

-- Webhook: checkout.session.completed. Idempotent — returns no rows if the
-- session isn't found or was already marked paid. Flips status to 'active'
-- so the card becomes redeemable.
create or replace function mark_gift_card_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
)
returns table (
  gift_card_id uuid,
  code text,
  value numeric(10, 2),
  purchaser_name text,
  purchaser_email text,
  recipient_name text,
  recipient_email text,
  message text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_already_paid boolean;
begin
  select gc.id, (gc.payment_status = 'paid') into v_id, v_already_paid
  from gift_cards gc
  where gc.stripe_checkout_session_id = p_stripe_checkout_session_id;

  if v_id is null or v_already_paid then
    return;
  end if;

  update gift_cards
  set payment_status = 'paid', status = 'active',
      stripe_payment_intent_id = p_stripe_payment_intent_id
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at
    from gift_cards gc where gc.id = v_id;
end;
$$;

grant execute on function mark_gift_card_paid(text, text) to anon, authenticated;

-- Webhook: checkout.session.expired / async_payment_failed.
create or replace function mark_gift_card_payment_failed(p_stripe_checkout_session_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update gift_cards
  set payment_status = 'failed', status = 'cancelled'
  where stripe_checkout_session_id = p_stripe_checkout_session_id
    and payment_status = 'pending';
$$;

grant execute on function mark_gift_card_payment_failed(text) to anon, authenticated;

-- User-initiated cancel out of Stripe checkout, or cleanup when
-- session-creation fails after the row was already inserted.
create or replace function cancel_unpaid_gift_card(p_gift_card_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update gift_cards
  set payment_status = 'failed', status = 'cancelled'
  where id = p_gift_card_id and payment_status <> 'paid';
$$;

grant execute on function cancel_unpaid_gift_card(uuid) to anon, authenticated;

-- Read-only status for the gift-card confirmation page.
create or replace function get_gift_card_payment_status(p_gift_card_id uuid)
returns table (
  status text,
  payment_status text,
  code text,
  value numeric(10, 2),
  recipient_name text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select gc.status, gc.payment_status, gc.code, gc.value, gc.recipient_name, gc.expires_at
  from gift_cards gc where gc.id = p_gift_card_id;
$$;

grant execute on function get_gift_card_payment_status(uuid) to anon, authenticated;

-- Simple-form (no Stripe) path: create + mark paid + the card is
-- immediately redeemable, in one call — the client never sees an
-- intermediate unpaid row.
create or replace function complete_gift_card_purchase_simple(
  p_product_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text
)
returns table (
  gift_card_id uuid,
  code text,
  value numeric(10, 2),
  purchaser_name text,
  purchaser_email text,
  recipient_name text,
  recipient_email text,
  message text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := create_gift_card_purchase(
    p_product_id, p_purchaser_name, p_purchaser_email, p_purchaser_phone,
    p_recipient_name, p_recipient_email, p_message
  );

  update gift_cards
  set payment_status = 'paid', status = 'active'
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at
    from gift_cards gc where gc.id = v_id;
end;
$$;

grant execute on function complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text)
  to anon, authenticated;

-- Read-only preview for the booking-flow "apply gift card code" input.
-- Never exposes purchaser/recipient PII. Does not lock or consume —
-- final validation/redemption happens atomically inside create_booking.
create or replace function preview_gift_card_by_code(p_code text)
returns table (value numeric(10, 2), status text, expires_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select gc.value, gc.status, gc.expires_at
  from gift_cards gc
  where upper(gc.code) = upper(trim(p_code));
$$;

grant execute on function preview_gift_card_by_code(text) to anon, authenticated;

notify pgrst, 'reload schema';
