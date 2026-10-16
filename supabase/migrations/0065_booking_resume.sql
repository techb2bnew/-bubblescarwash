-- Powers the "Complete Your Booking" link in the pending-payment reminder
-- email: given a booking id, return what the /book/resume page needs to put
-- the customer back on the payment step. The booking uuid in the link is the
-- only credential (unguessable, same as the confirmation page), and the Stripe
-- session id is only handed out while the booking is still awaiting payment.

create or replace function get_booking_resume(p_booking_id uuid)
returns table (
  status text,
  payment_status text,
  stripe_checkout_session_id text,
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
  select
    b.status,
    b.payment_status,
    case when b.payment_status = 'pending' and b.status <> 'cancelled'
         then b.stripe_checkout_session_id end,
    b.customer_name,
    b.booking_date,
    b.booking_time,
    b.price,
    s.name
  from bookings b
  left join services s on s.id = b.service_id
  where b.id = p_booking_id;
$$;

grant execute on function get_booking_resume(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
