-- Adds an online/offline tag to bookings. Every customer-made booking
-- (through /book) is "online". Admin's manual "Create New Booking" panel
-- can now also log an "offline" booking (phone/walk-in) — and offline
-- bookings are exempt from the double-booking guard, since admin may
-- deliberately want to record one on a slot the system otherwise thinks is
-- full (e.g. extra capacity, correcting a walk-in that happened anyway).
-- Online bookings still fully respect availability via create_booking's own
-- overlap checks, regardless of this change.

alter table bookings
  add column if not exists booking_type text not null default 'online'
    check (booking_type in ('online', 'offline'));

drop index if exists bookings_date_time_unique;
create unique index if not exists bookings_date_time_unique
  on bookings (booking_date, booking_time)
  where status <> 'cancelled' and booking_type = 'online';

create or replace function create_booking(
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
  v_duration int;
  v_closing time;
  v_start timestamp;
  v_end timestamp;
begin
  if exists (select 1 from blocked_dates where date = p_booking_date) then
    raise exception 'This date is not available for booking.';
  end if;

  select price, duration_minutes into v_price, v_duration
  from services where id = p_service_id;
  if v_duration is null then
    raise exception 'Service not found.';
  end if;

  select closing_time into v_closing from business_settings where id = 1;

  v_start := (p_booking_date + p_booking_time)::timestamp;
  v_end := v_start + make_interval(mins => v_duration);

  if v_closing is not null and v_end::time > v_closing and v_end::date = p_booking_date then
    raise exception 'This service does not fit before closing time. Please pick an earlier time.';
  end if;

  if exists (
    select 1 from bookings b
    join services s on s.id = b.service_id
    where b.booking_date = p_booking_date
      and b.status <> 'cancelled'
      and (b.booking_date + b.booking_time)::timestamp < v_end
      and (b.booking_date + b.booking_time)::timestamp
        + make_interval(mins => s.duration_minutes) > v_start
  ) then
    raise exception 'This time slot was just taken. Please pick another.';
  end if;

  if exists (
    select 1 from blocked_slots
    where date = p_booking_date
      and (p_booking_date + time)::timestamp >= v_start
      and (p_booking_date + time)::timestamp < v_end
  ) then
    raise exception 'This time slot is not available for booking.';
  end if;

  insert into bookings (
    service_id, booking_date, booking_time,
    customer_name, customer_phone, customer_email, price, booking_type
  ) values (
    p_service_id, p_booking_date, p_booking_time,
    p_customer_name, p_customer_phone, p_customer_email, v_price, 'online'
  )
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    raise exception 'This time slot was just taken. Please pick another.';
end;
$$;

grant execute on function create_booking(uuid, date, time, text, text, text)
  to anon, authenticated;
