-- Makes vehicle types and service categories admin-manageable instead of
-- hardcoded. Services/inclusions still store the slug as plain text (no FK)
-- to avoid a disruptive data migration; the CHECK constraints that pinned
-- them to a fixed set are dropped so new values can be added from the admin.

create table if not exists vehicle_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into vehicle_types (name, slug, sort_order) values
  ('Sedan', 'sedan', 1),
  ('SUV / 4WD', 'suv', 2),
  ('X-Large', 'xlarge', 3),
  ('XXL', 'xxl', 4)
on conflict (slug) do nothing;

insert into service_categories (name, slug, sort_order) values
  ('Wash', 'wash', 1),
  ('Detailing', 'detailing', 2)
on conflict (slug) do nothing;

alter table services drop constraint if exists services_category_check;
alter table services drop constraint if exists services_vehicle_type_check;
alter table inclusions drop constraint if exists inclusions_category_check;

alter table vehicle_types enable row level security;
alter table service_categories enable row level security;

grant usage on schema public to anon, authenticated;
grant select on vehicle_types, service_categories to anon, authenticated;
grant insert, update, delete on vehicle_types, service_categories to authenticated;

drop policy if exists "vehicle_types public read" on vehicle_types;
create policy "vehicle_types public read" on vehicle_types
  for select using (true);
drop policy if exists "vehicle_types admin insert" on vehicle_types;
create policy "vehicle_types admin insert" on vehicle_types
  for insert with check (is_admin());
drop policy if exists "vehicle_types admin update" on vehicle_types;
create policy "vehicle_types admin update" on vehicle_types
  for update using (is_admin());
drop policy if exists "vehicle_types admin delete" on vehicle_types;
create policy "vehicle_types admin delete" on vehicle_types
  for delete using (is_admin());

drop policy if exists "service_categories public read" on service_categories;
create policy "service_categories public read" on service_categories
  for select using (true);
drop policy if exists "service_categories admin insert" on service_categories;
create policy "service_categories admin insert" on service_categories
  for insert with check (is_admin());
drop policy if exists "service_categories admin update" on service_categories;
create policy "service_categories admin update" on service_categories
  for update using (is_admin());
drop policy if exists "service_categories admin delete" on service_categories;
create policy "service_categories admin delete" on service_categories
  for delete using (is_admin());
