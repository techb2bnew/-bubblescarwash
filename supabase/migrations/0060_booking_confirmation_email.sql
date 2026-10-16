-- Track whether a booking's confirmation email has gone out, so it is sent
-- exactly once however the booking got there (Stripe webhook, admin "Pay
-- Later", or the status-based catch-up sync) and regardless of payment state.

alter table bookings
  add column if not exists confirmation_email_sent_at timestamptz;

-- Everything that exists today is treated as already handled so that rolling
-- this out never emails customers about old bookings.
update bookings
set confirmation_email_sent_at = now()
where confirmation_email_sent_at is null;

-- Atomic claim: returns true for exactly one caller per booking. Two things
-- racing (e.g. the webhook and the catch-up sync) can't both send the email.
create or replace function claim_booking_confirmation_email(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  update bookings
  set confirmation_email_sent_at = now()
  where id = p_booking_id
    and confirmation_email_sent_at is null
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

grant execute on function claim_booking_confirmation_email(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
