-- Moves booking creation into a SECURITY DEFINER function so the public
-- booking flow no longer depends on anon having direct INSERT rights on
-- the bookings table (which was mysteriously failing via the REST API
-- despite correct grants + RLS policy). The function itself enforces the
-- blocked-date check and relies on the existing unique index to prevent
-- double-booking the same slot.

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
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
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

grant execute on function public.create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;
