-- Fixes: "new row violates row-level security policy for table bookings"
-- Safe to run multiple times (idempotent).

grant usage on schema public to anon, authenticated;

grant select, insert on public.bookings to anon, authenticated;
grant update on public.bookings to authenticated;

grant select on public.services, public.blocked_dates, public.business_settings
  to anon, authenticated;
grant insert, update, delete on public.services, public.blocked_dates, public.business_settings
  to authenticated;

grant select on public.admin_users to authenticated;

drop policy if exists "bookings public insert" on bookings;
create policy "bookings public insert" on bookings
  for insert with check (true);

drop policy if exists "bookings admin read" on bookings;
create policy "bookings admin read" on bookings
  for select using (is_admin());

drop policy if exists "bookings admin update" on bookings;
create policy "bookings admin update" on bookings
  for update using (is_admin());
