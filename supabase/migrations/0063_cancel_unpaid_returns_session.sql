-- cancel_unpaid_booking used to return nothing, so when a customer pressed
-- "Close" on the payment window the booking was cancelled but the Stripe
-- Checkout Session stayed open (payable) until it timed out ~32 minutes
-- later. It now returns the session id of the booking it cancelled so the
-- server can expire that session in Stripe at the same moment.

drop function if exists cancel_unpaid_booking(uuid);

create function cancel_unpaid_booking(p_booking_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  with updated as (
    update bookings
    set payment_status = 'failed', status = 'cancelled'
    where id = p_booking_id
      and payment_status <> 'paid'
    returning stripe_checkout_session_id
  )
  select stripe_checkout_session_id from updated;
$$;

grant execute on function cancel_unpaid_booking(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
