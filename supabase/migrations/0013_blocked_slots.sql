-- Lets the admin block individual time slots on a date (not just the whole
-- day). Blocked slots are merged into get_booked_times so both the public
-- booking calendar and the admin reschedule picker automatically grey them
-- out, and create_booking rejects them server-side too.

create table if not exists blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (date, time)
);

alter table blocked_slots enable row level security;

grant select on blocked_slots to anon, authenticated;
grant insert, delete on blocked_slots to authenticated;

drop policy if exists "blocked_slots public read" on blocked_slots;
create policy "blocked_slots public read" on blocked_slots
  for select using (true);
drop policy if exists "blocked_slots admin insert" on blocked_slots;
create policy "blocked_slots admin insert" on blocked_slots
  for insert with check (is_admin());
drop policy if exists "blocked_slots admin delete" on blocked_slots;
create policy "blocked_slots admin delete" on blocked_slots
  for delete using (is_admin());

create or replace function get_booked_times(target_date date)
returns table (booking_time time)
language sql
security definer
stable
as $$
  select booking_time from bookings
  where booking_date = target_date and status <> 'cancelled'
  union
  select time from blocked_slots
  where date = target_date;
$$;

create or replace function create_booking(
  p_service_id uuid,
  p_booking_date date,
  p_booking_time time,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  if exists (
    select 1 from blocked_slots
    where date = p_booking_date and time = p_booking_time
  ) then
    raise exception 'This time slot is not available for booking.';
  end if;

  insert into bookings (
    service_id, booking_date, booking_time,
    customer_name, customer_phone, customer_email
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'This time slot was just taken. Please pick another.';
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;
