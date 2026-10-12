-- Client feedback: the "returning customer" popup should work from phone
-- number alone (car number was being required alongside it), and when one
-- phone has booked with more than one car, the customer should be asked
-- which car this booking is for instead of silently picking one.
--
-- This replaces lookup_returning_customer(phone, car_number) — which
-- required both — with a phone-only lookup that returns every distinct car
-- that phone has booked with, so the booking flow can autofill directly
-- when there's exactly one, or show a chooser when there's more than one.
--
-- Still phone-keyed, not plate-keyed: a plate is readable off the car in a
-- public car park, so a lookup a stranger could trigger with just the plate
-- would hand back that customer's name/phone/email to anyone who walked
-- past it. Phone number isn't visible that way, so it stays the required
-- key; the plate is now purely something the *frontend* can use to
-- pre-highlight one of the phone's own cars, never a second independent
-- lookup path.
drop function if exists lookup_returning_customer(text, text);

create or replace function lookup_returning_customer_cars(p_phone text)
returns table (
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_type text,
  car_number text,
  last_booked_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (upper(trim(coalesce(b.car_number, ''))))
    b.customer_name, b.customer_phone, b.customer_email, b.vehicle_type,
    b.car_number, b.created_at
  from bookings b
  where trim(p_phone) <> ''
    and b.customer_phone = trim(p_phone)
    and b.status <> 'cancelled'
  order by upper(trim(coalesce(b.car_number, ''))), b.created_at desc;
$$;

grant execute on function lookup_returning_customer_cars(text) to anon, authenticated;

notify pgrst, 'reload schema';
