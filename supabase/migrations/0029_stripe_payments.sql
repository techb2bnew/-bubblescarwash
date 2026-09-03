-- Stripe Checkout payments for online bookings.
--
-- Flow: create_booking() reserves the slot immediately (status='confirmed',
-- payment_status='unpaid') so nobody else can take it while the customer is
-- on Stripe's hosted checkout page. set_booking_checkout_session() then
-- attaches the Checkout Session id (payment_status -> 'pending'). Stripe's
-- webhook calls mark_booking_paid() on success (idempotent — only fires
-- calendar/email side effects once) or mark_booking_payment_failed() /
-- cancel_unpaid_booking() to release the slot again (status -> 'cancelled',
-- which the existing capacity checks already exclude).
--
-- All functions here are callable by `anon` because the public booking flow
-- and the Stripe webhook route both use the anon-key Supabase client (no
-- admin session) — same pattern as create_booking/get_booked_times.

alter table bookings
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists bookings_stripe_checkout_session_id_idx
  on bookings (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- Price of a just-created booking, for sizing the Stripe Checkout line item.
create or replace function get_booking_price(p_booking_id uuid)
returns numeric(10, 2)
language sql
stable
security definer
set search_path = public
as $$
  select price from bookings where id = p_booking_id;
$$;

grant execute on function get_booking_price(uuid) to anon, authenticated;

-- Attach the Stripe Checkout Session id once created; flips to 'pending'.
create or replace function set_booking_checkout_session(
  p_booking_id uuid,
  p_stripe_checkout_session_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings
  set stripe_checkout_session_id = p_stripe_checkout_session_id,
      payment_status = 'pending'
  where id = p_booking_id
    and payment_status = 'unpaid';
$$;

grant execute on function set_booking_checkout_session(uuid, text) to anon, authenticated;

-- Webhook: checkout.session.completed. Idempotent — returns no rows if the
-- session isn't found or was already marked paid, so the caller knows not
-- to re-fire calendar/email side effects.
create or replace function mark_booking_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
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
      stripe_payment_intent_id = p_stripe_payment_intent_id
  where b.id = v_id;

  return query
    select b.id, b.service_id, b.customer_name, b.customer_phone, b.customer_email,
           b.booking_date, b.booking_time, b.price
    from bookings b
    where b.id = v_id;
end;
$$;

grant execute on function mark_booking_paid(text, text) to anon, authenticated;

-- Webhook: checkout.session.expired / async_payment_failed. Only touches a
-- still-pending booking so an out-of-order event can't undo a real payment.
create or replace function mark_booking_payment_failed(p_stripe_checkout_session_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings
  set payment_status = 'failed', status = 'cancelled'
  where stripe_checkout_session_id = p_stripe_checkout_session_id
    and payment_status = 'pending';
$$;

grant execute on function mark_booking_payment_failed(text) to anon, authenticated;

-- User-initiated cancel (Stripe cancel_url), or cleanup when creating the
-- Checkout Session itself fails after the slot was already reserved. Safety
-- guard: never cancels a booking that somehow already got marked paid.
create or replace function cancel_unpaid_booking(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings
  set payment_status = 'failed', status = 'cancelled'
  where id = p_booking_id
    and payment_status <> 'paid';
$$;

grant execute on function cancel_unpaid_booking(uuid) to anon, authenticated;

-- Read-only status for the /book confirmation and cancelled pages.
create or replace function get_booking_payment_status(p_booking_id uuid)
returns table (
  status text,
  payment_status text,
  customer_name text,
  booking_date date,
  booking_time time,
  price numeric(10, 2),
  service_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.status, b.payment_status, b.customer_name, b.booking_date,
         b.booking_time, b.price, s.name
  from bookings b
  left join services s on s.id = b.service_id
  where b.id = p_booking_id;
$$;

grant execute on function get_booking_payment_status(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
