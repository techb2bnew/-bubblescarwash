-- Captures the service price at the time of booking, so revenue reporting
-- stays accurate even if service prices change later. Existing bookings are
-- backfilled with the current price of their service (best available data).

alter table bookings add column if not exists price numeric(10, 2);

update bookings b
set price = s.price
from services s
where b.service_id = s.id and b.price is null;

create or replace function public.create_booking(
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
  v_price numeric(10, 2);
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  select price into v_price from services where id = p_service_id;

  insert into bookings (
    service_id, booking_date, booking_time,
    customer_name, customer_phone, customer_email, price
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'This time slot was just taken. Please pick another.';
end;
$$;

grant execute on function public.create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;
