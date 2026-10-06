-- Rego plate + last 4 digits of the phone on file => full autofill.
--
-- A plate alone must never return contact details (it is readable off the
-- car in a public car park), so this lookup also requires the last 4 digits
-- of the booking's phone number — something a passer-by doesn't have. Four
-- digits are only 10,000 guesses though, so the function rate-limits itself:
--   * per plate:  5 wrong guesses in an hour  -> that plate is locked 1 hour
--   * globally:   60 wrong guesses in 10 min  -> all verified lookups pause
--                 10 min (stops someone fanning out a few guesses across
--                 many plates)
-- Wrong digits and unknown plates answer identically ("mismatch"), so the
-- response never confirms which plates exist. Nothing but a success returns
-- any customer data.

create table if not exists plate_lookup_attempts (
  plate_key text primary key,
  failures int not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz
);

-- Only the security-definer function below touches this table.
alter table plate_lookup_attempts enable row level security;
revoke all on plate_lookup_attempts from anon, authenticated;

create or replace function lookup_car_verified(p_car_number text, p_last4 text)
returns table (
  status text,
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_type text,
  car_number text,
  service_id uuid
)
language plpgsql
volatile
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_key text := upper(trim(coalesce(p_car_number, '')));
  v_last4 text := trim(coalesce(p_last4, ''));
  v_glob plate_lookup_attempts%rowtype;
  v_att plate_lookup_attempts%rowtype;
  v_row record;
begin
  if v_key = '' or v_last4 !~ '^[0-9]{4}$' then
    return query select 'invalid'::text, null::text, null::text, null::text,
                        null::text, null::text, null::uuid;
    return;
  end if;

  -- Global throttle row (reset its window when it has expired).
  insert into plate_lookup_attempts (plate_key) values ('__global__')
    on conflict (plate_key) do nothing;
  select * into v_glob from plate_lookup_attempts
    where plate_key = '__global__' for update;
  if v_glob.window_started_at < now() - interval '10 minutes' then
    update plate_lookup_attempts
      set failures = 0, window_started_at = now(), locked_until = null
      where plate_key = '__global__';
    v_glob.failures := 0;
    v_glob.locked_until := null;
  end if;
  if v_glob.locked_until is not null and v_glob.locked_until > now() then
    return query select 'locked'::text, null::text, null::text, null::text,
                        null::text, null::text, null::uuid;
    return;
  end if;

  -- Unknown plate: count it globally and answer exactly like a wrong guess.
  if not exists (
    select 1 from bookings b
    where b.car_number is not null
      and upper(trim(b.car_number)) = v_key
      and b.status <> 'cancelled'
  ) then
    update plate_lookup_attempts
      set failures = failures + 1,
          locked_until = case when failures + 1 >= 60
                              then now() + interval '10 minutes' end
      where plate_key = '__global__';
    return query select 'mismatch'::text, null::text, null::text, null::text,
                        null::text, null::text, null::uuid;
    return;
  end if;

  -- Known plate: per-plate throttle.
  insert into plate_lookup_attempts (plate_key) values (v_key)
    on conflict (plate_key) do nothing;
  select * into v_att from plate_lookup_attempts
    where plate_key = v_key for update;
  if v_att.window_started_at < now() - interval '1 hour' then
    update plate_lookup_attempts
      set failures = 0, window_started_at = now(), locked_until = null
      where plate_key = v_key;
    v_att.failures := 0;
    v_att.locked_until := null;
  end if;
  if v_att.locked_until is not null and v_att.locked_until > now() then
    return query select 'locked'::text, null::text, null::text, null::text,
                        null::text, null::text, null::uuid;
    return;
  end if;

  select b.customer_name, b.customer_phone, b.customer_email, b.vehicle_type,
         b.car_number, b.service_id
    into v_row
  from bookings b
  where b.car_number is not null
    and upper(trim(b.car_number)) = v_key
    and b.status <> 'cancelled'
    and right(regexp_replace(coalesce(b.customer_phone, ''), '\D', '', 'g'), 4) = v_last4
  order by b.created_at desc
  limit 1;

  if found then
    update plate_lookup_attempts
      set failures = 0, locked_until = null where plate_key = v_key;
    return query select 'ok'::text, v_row.customer_name, v_row.customer_phone,
                        v_row.customer_email, v_row.vehicle_type,
                        v_row.car_number, v_row.service_id;
    return;
  end if;

  update plate_lookup_attempts
    set failures = failures + 1,
        locked_until = case when failures + 1 >= 5
                            then now() + interval '1 hour' end
    where plate_key = v_key;
  update plate_lookup_attempts
    set failures = failures + 1,
        locked_until = case when failures + 1 >= 60
                            then now() + interval '10 minutes' end
    where plate_key = '__global__';
  return query select 'mismatch'::text, null::text, null::text, null::text,
                      null::text, null::text, null::uuid;
end;
$$;

revoke all on function lookup_car_verified(text, text) from public;
grant execute on function lookup_car_verified(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
