-- Returning-customer lookup for the public booking flow: a popup on /book
-- asks for the phone number + car number/plate used on a previous booking.
-- A match autofills name/email/vehicle type from that booking, so a repeat
-- customer doesn't have to retype everything or re-pick their vehicle type.
--
-- Requires BOTH the phone and the plate to match (not the plate alone): a
-- plate is visible on the car in a public car park, so keying this off the
-- plate by itself would let anyone who can read someone else's plate pull up
-- that person's name/phone/email. The phone number is something only the
-- actual customer knows, so pairing it with the plate keeps this from being
-- a PII-enumeration endpoint while still being anon-callable (the booking
-- flow has no login).
create or replace function lookup_returning_customer(p_phone text, p_car_number text)
returns table (
  customer_name text,
  customer_phone text,
  customer_email text,
  vehicle_type text,
  car_number text
)
language sql
stable
security definer
set search_path = public
as $$
  select b.customer_name, b.customer_phone, b.customer_email, b.vehicle_type, b.car_number
  from bookings b
  where trim(p_phone) <> ''
    and trim(p_car_number) <> ''
    and b.customer_phone = trim(p_phone)
    and b.car_number is not null
    and upper(trim(b.car_number)) = upper(trim(p_car_number))
    and b.status <> 'cancelled'
  order by b.created_at desc
  limit 1;
$$;

grant execute on function lookup_returning_customer(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
