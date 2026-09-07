-- Browser push notifications (Firebase Cloud Messaging) for admins, plus a
-- persistent notification log. notifyAdmins() in src/lib/push-notifications.ts
-- is the single call site for this — it always writes to `notifications`
-- (even if Firebase isn't configured) and additionally pushes to every
-- registered admin browser token when it is.
--
-- All writes/reads used by that server module run under the anon-key
-- client (the same client used throughout booking-sync.ts, since a public
-- customer's booking can trigger this), so — same reasoning as
-- create_booking/create_gift_card_purchase — they go through
-- security-definer RPCs rather than direct table grants.

create table if not exists admin_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users (id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  unique (admin_id, token)
);

alter table admin_fcm_tokens enable row level security;

grant select, delete on admin_fcm_tokens to authenticated;

create policy "admin_fcm_tokens own read" on admin_fcm_tokens
  for select using (admin_id = auth.uid());

create policy "admin_fcm_tokens own delete" on admin_fcm_tokens
  for delete using (admin_id = auth.uid());

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

grant select, update on notifications to authenticated;

create policy "notifications admin read" on notifications
  for select using (is_admin());

create policy "notifications admin mark read" on notifications
  for update using (is_admin()) with check (is_admin());

-- Register (or refresh) the calling admin's own FCM token. auth.uid() is
-- read server-side so a client can never register a token under a
-- different admin's id.
create or replace function register_fcm_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to register a notification token.';
  end if;

  insert into admin_fcm_tokens (admin_id, token)
  values (auth.uid(), p_token)
  on conflict (admin_id, token) do nothing;
end;
$$;

grant execute on function register_fcm_token(text) to authenticated;

-- Called by notifyAdmins() to persist the notification record. Callable by
-- anon since a public customer's booking (simple pay-in-person path, or the
-- Stripe webhook acting on their behalf) is what triggers this.
create or replace function create_notification(
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into notifications (type, title, body, data)
  values (p_type, p_title, p_body, p_data)
  returning id;
$$;

grant execute on function create_notification(text, text, text, jsonb) to anon, authenticated;

-- Read-only list of every admin's token, for notifyAdmins() to push to.
-- Never exposes which admin owns which token.
create or replace function get_admin_fcm_tokens()
returns table (token text)
language sql
stable
security definer
set search_path = public
as $$
  select token from admin_fcm_tokens;
$$;

grant execute on function get_admin_fcm_tokens() to anon, authenticated;

-- Cleanup for tokens Firebase reports as unregistered/invalid.
create or replace function prune_fcm_tokens(p_tokens text[])
returns void
language sql
security definer
set search_path = public
as $$
  delete from admin_fcm_tokens where token = any(p_tokens);
$$;

grant execute on function prune_fcm_tokens(text[]) to anon, authenticated;

notify pgrst, 'reload schema';
