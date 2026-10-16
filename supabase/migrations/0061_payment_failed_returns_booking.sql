-- mark_booking_payment_failed used to return nothing. It now returns the
-- booking it just cancelled so the Stripe webhook can email the customer.
-- A row comes back only when the booking really moved pending -> failed, so a
-- repeated webhook delivery (or a later "expired" after a "failed") returns
-- nothing and the customer is never emailed twice.

drop function if exists mark_booking_payment_failed(text);

create function mark_booking_payment_failed(p_stripe_checkout_session_id text)
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
    set payment_status = 'failed', status = 'cancelled'
    where b.stripe_checkout_session_id = p_stripe_checkout_session_id
      and b.payment_status = 'pending'
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

grant execute on function mark_booking_payment_failed(text) to anon, authenticated;

notify pgrst, 'reload schema';
