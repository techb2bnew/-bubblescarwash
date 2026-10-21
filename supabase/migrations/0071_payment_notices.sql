-- Two customer notices for bookings that are still "pending" in our database
-- while the customer is actually in the middle of paying:
--   * "payment processing": Stripe received the payment but the bank hasn't
--     confirmed it yet.
--   * "payment didn't go through, try again": a card attempt was declined but
--     the checkout is still open, so the slot is still held.
-- Each is sent at most once per booking, so the claim happens in the database.

alter table bookings
  add column if not exists payment_processing_notice_at timestamptz,
  add column if not exists payment_failed_notice_at timestamptz;

drop function if exists claim_payment_processing_notice(text);
create function claim_payment_processing_notice(p_stripe_checkout_session_id text)
returns table (
  booking_id uuid,
  service_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  car_number text,
  booking_date date,
  booking_time time,
  price numeric(10, 2),
  service_name text,
  duration_minutes int
)
language sql
security definer
set search_path = public
as $$
  with updated as (
    update bookings b
    set payment_processing_notice_at = now()
    where b.stripe_checkout_session_id = p_stripe_checkout_session_id
      and b.payment_status = 'pending'
      and b.payment_processing_notice_at is null
    returning b.id, b.service_id, b.customer_name, b.customer_phone,
              b.customer_email, b.car_number, b.booking_date,
              b.booking_time, b.price
  )
  select u.id, u.service_id, u.customer_name, u.customer_phone,
         u.customer_email, u.car_number, u.booking_date, u.booking_time,
         u.price, s.name, s.duration_minutes
  from updated u
  left join services s on s.id = u.service_id;
$$;

drop function if exists claim_payment_failed_notice(text);
create function claim_payment_failed_notice(p_stripe_checkout_session_id text)
returns table (
  booking_id uuid,
  service_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  car_number text,
  booking_date date,
  booking_time time,
  price numeric(10, 2),
  service_name text,
  duration_minutes int
)
language sql
security definer
set search_path = public
as $$
  with updated as (
    update bookings b
    set payment_failed_notice_at = now(),
        payment_attempted = true
    where b.stripe_checkout_session_id = p_stripe_checkout_session_id
      and b.payment_status = 'pending'
      and b.payment_failed_notice_at is null
    returning b.id, b.service_id, b.customer_name, b.customer_phone,
              b.customer_email, b.car_number, b.booking_date,
              b.booking_time, b.price
  )
  select u.id, u.service_id, u.customer_name, u.customer_phone,
         u.customer_email, u.car_number, u.booking_date, u.booking_time,
         u.price, s.name, s.duration_minutes
  from updated u
  left join services s on s.id = u.service_id;
$$;

-- When the checkout finally expires: had this customer already been told that
-- their payment failed?
create or replace function payment_failed_notice_was_sent(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select payment_failed_notice_at is not null from bookings where id = p_booking_id), false);
$$;

grant execute on function claim_payment_processing_notice(text) to anon, authenticated;
grant execute on function claim_payment_failed_notice(text) to anon, authenticated;
grant execute on function payment_failed_notice_was_sent(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
