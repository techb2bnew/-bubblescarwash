-- Customers who open the payment window but don't finish get one reminder
-- email ("your slot booking is still pending — please confirm the payment").
-- pending_reminder_sent_at records that it went out; the claim function lets
-- exactly one caller win, so two overlapping cron runs / page loads can't both
-- send it.

alter table bookings
  add column if not exists pending_reminder_sent_at timestamptz;

-- Existing bookings are treated as already handled so rolling this out never
-- emails customers about old, long-settled checkouts.
update bookings
set pending_reminder_sent_at = now()
where pending_reminder_sent_at is null;

create or replace function claim_pending_payment_reminder(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  update bookings
  set pending_reminder_sent_at = now()
  where id = p_booking_id
    and pending_reminder_sent_at is null
    and payment_status = 'pending'
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

grant execute on function claim_pending_payment_reminder(uuid)
  to anon, authenticated;

notify pgrst, 'reload schema';
