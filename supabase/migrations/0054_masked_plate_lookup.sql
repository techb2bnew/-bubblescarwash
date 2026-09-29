-- Client feedback (asked repeatedly, in different forms): the returning-
-- customer popup should also work from the rego plate alone, not just
-- phone. A plate-alone lookup that hands back full contact details (name,
-- phone, email) was explicitly not built here — a plate is visible on the
-- car in a public car park, so anyone who reads someone's plate could pull
-- up their real contact info, which is a genuine privacy problem, not a
-- hypothetical one.
--
-- This is the safe middle ground: plate-alone lookup is allowed, but it
-- only ever returns a MASKED name (first letter of each word, rest
-- asterisked — "John Smith" -> "J*** S***") plus vehicle type and the
-- plate itself. Never phone, never email, never the real name. The masked
-- name lets the customer visually confirm "yes, that's probably me" before
-- the form fills in their vehicle type, without exposing anything a
-- stranger could actually use to contact or impersonate them.
create or replace function mask_name(p_name text)
returns text
language sql
immutable
as $$
  select coalesce(
    string_agg(
      left(word, 1) || repeat('*', greatest(length(word) - 1, 0)),
      ' '
    ),
    ''
  )
  from unnest(string_to_array(trim(p_name), ' ')) as word
  where word <> '';
$$;

create or replace function lookup_car_by_plate_masked(p_car_number text)
returns table (
  masked_name text,
  vehicle_type text,
  car_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select mask_name(b.customer_name), b.vehicle_type, b.car_number
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
