-- Car wash booking system: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push` if the CLI is linked).

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- admin_users: whitelist of Supabase auth users allowed into /admin
-- ─────────────────────────────────────────────
create table if not exists admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from admin_users where id = auth.uid()
  );
$$;

-- ─────────────────────────────────────────────
-- business_settings: single-row table for opening hours / slot config
-- ─────────────────────────────────────────────
create table if not exists business_settings (
  id int primary key default 1,
  name text not null default 'My Car Wash',
  address text,
  phone text,
  email text,
  opening_time time not null default '09:00',
  closing_time time not null default '17:00',
  slot_interval_minutes int not null default 30,
  constraint business_settings_single_row check (id = 1)
);

insert into business_settings (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- services: vehicle type x wash/detailing tiers with price + duration
-- ─────────────────────────────────────────────
create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('wash', 'detailing')),
  vehicle_type text not null check (vehicle_type in ('sedan', 'suv', 'xlarge', 'xxl')),
  price numeric(10, 2) not null,
  duration_minutes int not null default 30,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- blocked_dates: whole days the business is closed (holidays, maintenance)
-- ─────────────────────────────────────────────
create table if not exists blocked_dates (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- bookings
-- ─────────────────────────────────────────────
create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services (id),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  booking_date date not null,
  booking_time time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists bookings_date_idx on bookings (booking_date);

-- prevents double-booking the same slot at the database level (race-safe)
create unique index if not exists bookings_date_time_unique
  on bookings (booking_date, booking_time)
  where status <> 'cancelled';

-- exposes only booked times (no customer PII) so the public booking calendar
-- can grey out taken slots without bypassing RLS on the bookings table
create or replace function get_booked_times(target_date date)
returns table (booking_time time)
language sql
security definer
stable
as $$
  select booking_time from bookings
  where booking_date = target_date and status <> 'cancelled';
$$;

grant execute on function get_booked_times(date) to anon, authenticated;

-- ─────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────
alter table admin_users enable row level security;
alter table business_settings enable row level security;
alter table services enable row level security;
alter table blocked_dates enable row level security;
alter table bookings enable row level security;

-- table-level grants (RLS policies below narrow these down further)
grant usage on schema public to anon, authenticated;
grant select on admin_users to authenticated;
grant select on business_settings to anon, authenticated;
grant update on business_settings to authenticated;
grant select on services, blocked_dates to anon, authenticated;
grant insert, update, delete on services, blocked_dates to authenticated;
grant select, insert on bookings to anon, authenticated;
grant update on bookings to authenticated;

-- admin_users: only admins can read the list; nobody writes via API (managed manually / service role)
drop policy if exists "admin_users readable by admins" on admin_users;
create policy "admin_users readable by admins" on admin_users
  for select using (is_admin());

-- business_settings: public read, admin write
drop policy if exists "business_settings public read" on business_settings;
create policy "business_settings public read" on business_settings
  for select using (true);
drop policy if exists "business_settings admin write" on business_settings;
create policy "business_settings admin write" on business_settings
  for update using (is_admin());

-- services: public reads active services, admin manages all
drop policy if exists "services public read active" on services;
create policy "services public read active" on services
  for select using (active = true or is_admin());
drop policy if exists "services admin insert" on services;
create policy "services admin insert" on services
  for insert with check (is_admin());
drop policy if exists "services admin update" on services;
create policy "services admin update" on services
  for update using (is_admin());
drop policy if exists "services admin delete" on services;
create policy "services admin delete" on services
  for delete using (is_admin());

-- blocked_dates: public read (needed to grey out calendar), admin write
drop policy if exists "blocked_dates public read" on blocked_dates;
create policy "blocked_dates public read" on blocked_dates
  for select using (true);
drop policy if exists "blocked_dates admin insert" on blocked_dates;
create policy "blocked_dates admin insert" on blocked_dates
  for insert with check (is_admin());
drop policy if exists "blocked_dates admin delete" on blocked_dates;
create policy "blocked_dates admin delete" on blocked_dates
  for delete using (is_admin());

-- bookings: anyone can create a booking; only admins can view/manage the list
drop policy if exists "bookings public insert" on bookings;
create policy "bookings public insert" on bookings
  for insert with check (true);
drop policy if exists "bookings admin read" on bookings;
create policy "bookings admin read" on bookings
  for select using (is_admin());
drop policy if exists "bookings admin update" on bookings;
create policy "bookings admin update" on bookings
  for update using (is_admin());
