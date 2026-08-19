-- Lets the public booking flow check how many active bookings an email has
-- made so far, without exposing the bookings table itself to anon (which
-- RLS otherwise restricts to admins). Only a count is returned — no PII.

create or replace function count_bookings_by_email(p_email text)
returns int
language sql
security definer
stable
as $$
  select count(*)::int from bookings
  where lower(customer_email) = lower(p_email) and status <> 'cancelled';
$$;

grant execute on function count_bookings_by_email(text) to anon, authenticated;
