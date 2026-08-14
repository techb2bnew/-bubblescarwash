-- Bootstraps a default admin login so you don't have to click through the
-- Supabase dashboard. Run this AFTER 0001_init.sql, once, in the SQL Editor.
--
-- Default login (change the password after first login via
-- Supabase Dashboard -> Authentication -> Users -> edit user):
--   email:    admin@carwash.com
--   password: Admin@123

do $$
declare
  new_user_id uuid;
begin
  if exists (select 1 from auth.users where email = 'admin@carwash.com') then
    raise notice 'admin@carwash.com already exists, skipping creation';
    return;
  end if;

  new_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    'admin@carwash.com',
    crypt('Admin@123', gen_salt('bf')),
    now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id::text, 'admin@carwash.com')::jsonb,
    'email',
    new_user_id::text,
    now(), now(), now()
  );

  insert into admin_users (id) values (new_user_id);
end $$;
