-- Recurring per-weekday business hours, e.g. Mon-Sat 9:00-17:00 but Sunday
-- 10:00-16:00. Sits between the per-date override and the global default, so
-- the resolution chain for any date becomes:
--   date_hours_overrides  >  weekday_hours  >  business_settings
--
-- day_of_week follows the Postgres `extract(dow ...)` / JS `getDay()`
-- convention: 0 = Sunday, 1 = Monday, ... 6 = Saturday.

create table if not exists weekday_hours (
  day_of_week smallint primary key check (day_of_week between 0 and 6),
  opening_time time not null,
  closing_time time not null,
  created_at timestamptz not null default now(),
  check (closing_time > opening_time)
);

alter table weekday_hours enable row level security;

grant select on weekday_hours to anon, authenticated;
grant insert, update, delete on weekday_hours to authenticated;

drop policy if exists "weekday_hours public read" on weekday_hours;
create policy "weekday_hours public read" on weekday_hours
  for select using (true);

drop policy if exists "weekday_hours admin write" on weekday_hours;
create policy "weekday_hours admin write" on weekday_hours
  for all using (is_admin()) with check (is_admin());

-- Effective opening/closing time for a date: the per-date override wins, then
-- the weekday rule, then the business default. Both columns of a given source
-- are NOT NULL, so a row either supplies both times or is absent entirely --
-- per-column coalesce can't mix an override's start with a weekday's end.
create or replace function get_business_hours(target_date date)
returns table (opening_time time, closing_time time)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(o.start_time, w.opening_time, bs.opening_time),
    coalesce(o.end_time,   w.closing_time, bs.closing_time)
  from business_settings bs
  left join date_hours_overrides o
    on o.date = target_date
  left join weekday_hours w
    on w.day_of_week = extract(dow from target_date)::smallint
  where bs.id = 1;
$$;

grant execute on function get_business_hours(date) to anon, authenticated;

-- get_booked_times and create_booking already resolve hours through
-- get_business_hours, so both pick up weekday hours with no change.

notify pgrst, 'reload schema';
