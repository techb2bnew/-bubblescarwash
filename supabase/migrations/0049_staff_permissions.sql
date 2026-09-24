-- Replaces the simple view/edit admin tiers (0048) with a proper role +
-- granular per-module permission system:
--   "admin" — full access everywhere, unchanged from today.
--   "staff" — gated per module by staff_permissions (view/create/edit/delete),
--             editable by an admin from /admin/permissions. Shared across
--             every staff account — one permission set, not per-user.
-- Dashboard isn't in this table: it's the safe landing page and always
-- visible to any admin_users member, so there's no toggle for it.

alter table admin_users drop constraint if exists admin_users_role_check;

update admin_users set role = 'admin' where role = 'edit';
update admin_users set role = 'staff' where role = 'view';

alter table admin_users add constraint admin_users_role_check check (role in ('admin', 'staff'));

drop function if exists is_edit_admin();

create table if not exists staff_permissions (
  module text primary key,
  can_view boolean not null default false,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false
);

alter table staff_permissions enable row level security;

grant select on staff_permissions to authenticated;
grant insert, update, delete on staff_permissions to authenticated;

drop policy if exists "staff_permissions readable by admins" on staff_permissions;
create policy "staff_permissions readable by admins" on staff_permissions
  for select using (is_admin());

drop policy if exists "staff_permissions writable by full admins" on staff_permissions;
create policy "staff_permissions writable by full admins" on staff_permissions
  for all using (
    exists (select 1 from admin_users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from admin_users where id = auth.uid() and role = 'admin')
  );

insert into staff_permissions (module, can_view, can_create, can_edit, can_delete) values
  ('analytics', true, false, false, false),
  ('bookings', true, false, false, false),
  ('calendar', true, false, false, false),
  ('set_operations', false, false, false, false),
  ('customers', false, false, false, false),
  ('services', false, false, false, false),
  ('inclusions', false, false, false, false),
  ('categories', false, false, false, false),
  ('vehicle_types', false, false, false, false),
  ('extras', false, false, false, false),
  ('gift_cards', false, false, false, false),
  ('discounts', false, false, false, false),
  ('payments', false, false, false, false)
on conflict (module) do nothing;

notify pgrst, 'reload schema';
