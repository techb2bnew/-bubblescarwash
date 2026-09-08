-- Re-adds a lightweight categories concept (Wash, Detailing, ...) as a
-- proper admin-manageable lookup table + FK on services, mirroring the
-- vehicle_types pattern. This is deliberately NOT the old pre-0040 model
-- (where add-ons were shared per-category via service_inclusions) — add-ons
-- still belong directly to one service (inclusions.service_id), unchanged.
-- Categories here are purely for organizing/filtering services, in the
-- admin Services list and as tabs on the public booking page.

create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table service_categories enable row level security;

grant select on service_categories to anon, authenticated;
grant insert, update, delete on service_categories to authenticated;

drop policy if exists "service_categories public read" on service_categories;
create policy "service_categories public read" on service_categories
  for select using (true);

drop policy if exists "service_categories admin write" on service_categories;
create policy "service_categories admin write" on service_categories
  for all using (is_admin()) with check (is_admin());

insert into service_categories (name, slug, sort_order) values
  ('Wash', 'wash', 1),
  ('Detailing', 'detailing', 2)
on conflict (slug) do nothing;

-- Every existing service defaults to Wash (confirmed with the client —
-- they'll add Detailing services themselves afterward). NOT NULL once
-- backfilled: a service always belongs to exactly one category.
alter table services add column if not exists category_id uuid references service_categories (id);

update services set category_id = (select id from service_categories where slug = 'wash')
where category_id is null;

alter table services alter column category_id set not null;

notify pgrst, 'reload schema';
