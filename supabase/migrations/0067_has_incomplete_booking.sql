-- Powers the "your previous booking is not completed" pop-up on the booking
-- page. True when the same customer (email or phone) started a booking in the
-- last 24 hours that never got paid (payment still pending, or abandoned /
-- expired / failed), unless they have since paid for a later booking.
-- Returns only a yes/no so nothing about anyone's bookings is exposed.

create or replace function has_incomplete_booking(p_email text, p_phone text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select
      lower(trim(coalesce(p_email, ''))) as email,
      right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 9) as phone
  ),
  mine as (
    select b.*
    from bookings b, me
    where (me.email <> '' and lower(b.customer_email) = me.email)
       or (length(me.phone) = 9
           and right(regexp_replace(coalesce(b.customer_phone, ''), '\D', '', 'g'), 9) = me.phone)
  )
  select exists (
    select 1
    from mine i
    where i.payment_status in ('pending', 'failed')
      and i.created_at > now() - interval '24 hours'
      and not exists (
        select 1 from mine p
        where p.payment_status = 'paid' and p.created_at > i.created_at
      )
  );
$$;

grant execute on function has_incomplete_booking(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
