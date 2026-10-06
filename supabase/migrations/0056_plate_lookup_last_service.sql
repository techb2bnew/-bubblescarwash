-- Rego-only lookup should also preselect the service that plate booked last,
-- so the form can show the same "Welcome back" summary the phone lookup does.
--
-- Still deliberately NOT returning name/phone/email: a plate is readable off
-- the car in a public car park, so a plate-keyed lookup must never hand back
-- contact details (see 0054). It returns a masked name, the vehicle type, and
-- now the last service id — booking details, not a way to reach the person.
-- The return type changes, so the old function is dropped first.
drop function if exists lookup_car_by_plate_masked(text);

create or replace function lookup_car_by_plate_masked(p_car_number text)
returns table (
  masked_name text,
  vehicle_type text,
  car_number text,
  service_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select mask_name(b.customer_name), b.vehicle_type, b.car_number, b.service_id
  from bookings b
  where trim(coalesce(p_car_number, '')) <> ''
    and b.car_number is not null
    and upper(trim(b.car_number)) = upper(trim(p_car_number))
    and b.status <> 'cancelled'
  order by b.created_at desc
  limit 1;
$$;

grant execute on function lookup_car_by_plate_masked(text) to anon, authenticated;

notify pgrst, 'reload schema';
