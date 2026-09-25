-- Moves staff_permissions from one shared row per module (0049) to one row
-- per (admin_user_id, module) — each staff account now gets its own
-- independently editable permission set, managed from /admin/staff.
-- Also caches email/name on admin_users so the staff list and per-staff
-- permissions page don't need service-role access just to display who's who.

alter table admin_users add column if not exists email text;
alter table admin_users add column if not exists name text;

update admin_users a
set email = u.email
from auth.users u
where u.id = a.id and a.email is null;

-- Drop the old "module" primary key so multiple rows per module (one per
-- staff account) are allowed, then add the per-user column.
alter table staff_permissions drop constraint if exists staff_permissions_pkey;
alter table staff_permissions add column if not exists admin_user_id uuid references admin_users (id) on delete cascade;
alter table staff_permissions add column if not exists id uuid not null default gen_random_uuid();

-- Carry the old shared defaults over to every existing staff account so
-- nobody's access silently changes the moment this migration runs.
insert into staff_permissions (id, admin_user_id, module, can_view, can_create, can_edit, can_delete)
select gen_random_uuid(), a.id, sp.module, sp.can_view, sp.can_create, sp.can_edit, sp.can_delete
from admin_users a
cross join staff_permissions sp
where a.role = 'staff' and sp.admin_user_id is null;

delete from staff_permissions where admin_user_id is null;

alter table staff_permissions add primary key (id);
alter table staff_permissions alter column admin_user_id set not null;
alter table staff_permissions add constraint staff_permissions_user_module_unique unique (admin_user_id, module);

notify pgrst, 'reload schema';
