-- Card brand/last4 + Stripe's hosted receipt link, captured at payment time
-- and shown in the admin panel. Populated only for Stripe-paid
-- bookings/gift cards — the "simple form" pay-in-person path has no card,
-- so these columns just stay null there (matches the existing "Manual"
-- badge treatment).

alter table bookings
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists receipt_url text;

alter table gift_cards
  add column if not exists card_brand text,
  add column if not exists card_last4 text,
  add column if not exists receipt_url text;

drop function if exists mark_booking_paid(text, text);

create or replace function mark_booking_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_card_brand text default null,
  p_card_last4 text default null,
  p_receipt_url text default null
)
returns table (
  booking_id uuid,
  service_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  booking_date date,
  booking_time time,
  price numeric(10, 2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_already_paid boolean;
begin
  select b.id, (b.payment_status = 'paid')
    into v_id, v_already_paid
  from bookings b
  where b.stripe_checkout_session_id = p_stripe_checkout_session_id;

  if v_id is null or v_already_paid then
    return;
  end if;

  update bookings b
  set payment_status = 'paid',
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      card_brand = p_card_brand,
      card_last4 = p_card_last4,
      receipt_url = p_receipt_url
  where b.id = v_id;

  return query
    select b.id, b.service_id, b.customer_name, b.customer_phone, b.customer_email,
           b.booking_date, b.booking_time, b.price
    from bookings b
    where b.id = v_id;
end;
$$;

grant execute on function mark_booking_paid(text, text, text, text, text) to anon, authenticated;

drop function if exists mark_gift_card_paid(text, text);

create or replace function mark_gift_card_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_card_brand text default null,
  p_card_last4 text default null,
  p_receipt_url text default null
)
returns table (
  gift_card_id uuid,
  code text,
  value numeric(10, 2),
  product_name text,
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
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      card_brand = p_card_brand,
      card_last4 = p_card_last4,
      receipt_url = p_receipt_url
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gcp.name, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at
    from gift_cards gc
    left join gift_card_products gcp on gcp.id = gc.product_id
    where gc.id = v_id;
end;
$$;

grant execute on function mark_gift_card_paid(text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
