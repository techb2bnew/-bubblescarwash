-- Temporary diagnostic RPC so we can inspect the live policy state directly
-- via the REST API (same path the app uses), without relying on screenshots.
-- Safe to drop later with: drop function public.debug_bookings_state();

create or replace function public.debug_bookings_state()
returns jsonb
language sql
security definer
as $$
  select jsonb_build_object(
    'current_role', current_user,
    'rls_enabled', (select relrowsecurity from pg_class where relname = 'bookings'),
    'policies', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', policyname,
        'cmd', cmd,
        'permissive', permissive,
        'roles', roles,
        'with_check', with_check,
        'qual', qual
      )), '[]'::jsonb)
      from pg_policies where tablename = 'bookings'
    ),
    'anon_grants', (
      select coalesce(jsonb_agg(privilege_type), '[]'::jsonb)
      from information_schema.role_table_grants
      where table_name = 'bookings' and grantee = 'anon'
    )
  );
$$;

grant execute on function public.debug_bookings_state() to anon, authenticated;
