-- Returning-customer autofill should also pre-select the service that car
-- booked last time, so the customer lands on the form with everything
-- already chosen and only edits what changed.
--
-- Adds service_id to lookup_returning_customer_cars. Still phone-keyed (see
-- 0050) — the return type changes, so the old function is dropped first.
drop function if exists lookup_returning_customer_cars(text);

create or replace function lookup_returning_customer_cars(p_phone text)
returns table (
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_type text,
  car_number text,
  service_id uuid,
  last_booked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (upper(trim(coalesce(b.car_number, ''))))
    b.customer_name, b.customer_phone, b.customer_email, b.vehicle_type,
    b.car_number, b.service_id, b.created_at
  from bookings b
  where trim(p_phone) <> ''
    and b.customer_phone = trim(p_phone)
    and b.status <> 'cancelled'
  order by upper(trim(coalesce(b.car_number, ''))), b.created_at desc;
$$;

grant execute on function lookup_returning_customer_cars(text) to anon, authenticated;

notify pgrst, 'reload schema';
