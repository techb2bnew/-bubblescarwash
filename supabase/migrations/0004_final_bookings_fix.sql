-- Guaranteed fix for "new row violates row-level security policy for table bookings"
-- Run this once in the Supabase SQL Editor, then retry the booking on /book.

grant usage on schema public to anon, authenticated;

grant select, insert on public.bookings to anon, authenticated;
grant update on public.bookings to authenticated;

grant select on public.services, public.blocked_dates, public.business_settings
  to anon, authenticated;

grant execute on function public.get_booked_times(date) to anon, authenticated;

drop policy if exists "bookings public insert" on public.bookings;
create policy "bookings public insert" on public.bookings
  as permissive
  for insert
  to anon, authenticated
  with check (true);
