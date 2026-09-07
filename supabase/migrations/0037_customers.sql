-- Standalone customer directory for the admin Customers page. Previously
-- that page derived its list entirely from `bookings` (see
-- aggregateCustomers in customers/page.tsx), so there was nothing to
-- add/edit/delete independently of a booking. This table becomes the
-- source of truth for the roster (name/phone/email, editable, deletable,
-- and addable with zero bookings), while `bookings` keeps supplying the
-- per-customer stats (booking count, total spent, visit history).
--
-- Customers are matched to bookings the same way the page always grouped
-- them: by email, falling back to phone when email is blank.
--
-- A trigger keeps this table in sync with new bookings (from any of the
-- three paths that insert into `bookings`: the public booking flow, admin
-- "online" bookings, and admin "offline" bookings) so a customer who books
-- again after being manually added/edited doesn't fork into a second,
-- unmanaged entry — without this, the roster would silently drift out of
-- sync with actual booking activity within days of shipping.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customers enable row level security;

grant select, insert, update, delete on customers to authenticated;

drop policy if exists "customers admin all" on customers;
create policy "customers admin all" on customers
  for all using (is_admin()) with check (is_admin());

create index if not exists customers_email_idx on customers (lower(email));
create index if not exists customers_phone_idx on customers (phone);

-- One-time backfill: one row per distinct customer seen in booking
-- history, using each customer's most recent booking for their current
-- name/phone/email.
insert into customers (name, phone, email, created_at)
select distinct on (coalesce(nullif(lower(trim(customer_email)), ''), trim(customer_phone)))
  customer_name, customer_phone, customer_email, now()
from bookings
order by coalesce(nullif(lower(trim(customer_email)), ''), trim(customer_phone)),
  booking_date desc, booking_time desc;

create or replace function sync_customer_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(new.customer_email));
  v_phone text := trim(new.customer_phone);
begin
  if v_email <> '' then
    update customers
    set name = new.customer_name, phone = new.customer_phone, updated_at = now()
    where lower(email) = v_email;

    if not found then
      insert into customers (name, phone, email)
      values (new.customer_name, new.customer_phone, new.customer_email);
    end if;
  elsif v_phone <> '' then
    update customers
    set name = new.customer_name, email = new.customer_email, updated_at = now()
    where phone = v_phone and trim(email) = '';

    if not found then
      insert into customers (name, phone, email)
      values (new.customer_name, new.customer_phone, new.customer_email);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_sync_customer on bookings;
create trigger bookings_sync_customer
  after insert on bookings
  for each row execute function sync_customer_from_booking();

notify pgrst, 'reload schema';
