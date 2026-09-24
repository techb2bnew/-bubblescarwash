-- Two admin tiers: "view" (read-only across bookings/calendar/dashboard/
-- analytics) and "edit" (full access, today's behavior). Existing admins
-- default to "edit" so nobody currently in admin_users loses access.

alter table admin_users
  add column if not exists role text not null default 'edit'
    check (role in ('view', 'edit'));

create or replace function is_edit_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admin_users where id = auth.uid() and role = 'edit'
  );
$$;

grant execute on function is_edit_admin() to authenticated;

notify pgrst, 'reload schema';
