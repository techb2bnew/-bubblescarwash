-- Service inclusions: a checklist of features per category (wash/detailing)
-- that admins can toggle per service, shown as a comparison matrix on the
-- customer booking page (matches the reference site's tier comparison table).

create table if not exists inclusions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('wash', 'detailing')),
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists service_inclusions (
  service_id uuid not null references services (id) on delete cascade,
  inclusion_id uuid not null references inclusions (id) on delete cascade,
  primary key (service_id, inclusion_id)
);

alter table inclusions enable row level security;
alter table service_inclusions enable row level security;

grant usage on schema public to anon, authenticated;
grant select on inclusions, service_inclusions to anon, authenticated;
grant insert, update, delete on inclusions, service_inclusions to authenticated;

drop policy if exists "inclusions public read" on inclusions;
create policy "inclusions public read" on inclusions
  for select using (true);
drop policy if exists "inclusions admin insert" on inclusions;
create policy "inclusions admin insert" on inclusions
  for insert with check (is_admin());
drop policy if exists "inclusions admin update" on inclusions;
create policy "inclusions admin update" on inclusions
  for update using (is_admin());
drop policy if exists "inclusions admin delete" on inclusions;
create policy "inclusions admin delete" on inclusions
  for delete using (is_admin());

drop policy if exists "service_inclusions public read" on service_inclusions;
create policy "service_inclusions public read" on service_inclusions
  for select using (true);
drop policy if exists "service_inclusions admin insert" on service_inclusions;
create policy "service_inclusions admin insert" on service_inclusions
  for insert with check (is_admin());
drop policy if exists "service_inclusions admin delete" on service_inclusions;
create policy "service_inclusions admin delete" on service_inclusions
  for delete using (is_admin());
