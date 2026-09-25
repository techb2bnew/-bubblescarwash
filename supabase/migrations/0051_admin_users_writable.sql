-- admin_users previously had no insert/update policy at all ("managed
-- manually / service role" per 0001's comment) — but /admin/staff now
-- creates staff rows and edits their name/email through the regular
-- (non-service-role) server client, so a full admin needs to be able to
-- write here too. Deletion still only ever happens via the service-role
-- Admin API (which bypasses RLS), so no delete policy is added.

grant insert, update on admin_users to authenticated;

drop policy if exists "admin_users insertable by full admins" on admin_users;
create policy "admin_users insertable by full admins" on admin_users
  for insert with check (
    exists (select 1 from admin_users a where a.id = auth.uid() and a.role = 'admin')
  );

drop policy if exists "admin_users updatable by full admins" on admin_users;
create policy "admin_users updatable by full admins" on admin_users
  for update using (
    exists (select 1 from admin_users a where a.id = auth.uid() and a.role = 'admin')
  ) with check (
    exists (select 1 from admin_users a where a.id = auth.uid() and a.role = 'admin')
  );

notify pgrst, 'reload schema';
