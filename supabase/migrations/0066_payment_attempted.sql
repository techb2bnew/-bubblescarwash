-- Admin only wants to see failed bookings where the customer actually tried to
-- pay (card declined, delayed payment failed). A booking that was merely
-- abandoned (payment window closed, or left unpaid until it expired) is noise.
-- Both end up as payment_status = 'failed', so remember the difference here.

alter table bookings
  add column if not exists payment_attempted boolean not null default false;

create or replace function mark_booking_payment_attempted(p_booking_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update bookings
  set payment_attempted = true
  where id = p_booking_id
    and payment_status <> 'paid';
$$;

grant execute on function mark_booking_payment_attempted(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
