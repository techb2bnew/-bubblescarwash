-- The "previous booking is not completed" pop-up now also names the earlier
-- slot so the customer can choose to reuse it. Replaces the yes/no function
-- from 0067 with one that returns the most recent unpaid booking's service,
-- date and time (nothing personal: no name, phone or email).

drop function if exists has_incomplete_booking(text, text);

create or replace function get_incomplete_booking(p_email text, p_phone text)
returns table (service_name text, booking_date date, booking_time time)
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
  select s.name, i.booking_date, i.booking_time
  from mine i
  left join services s on s.id = i.service_id
  where i.payment_status in ('pending', 'failed')
    and i.created_at > now() - interval '24 hours'
    and not exists (
      select 1 from mine p
      where p.payment_status = 'paid' and p.created_at > i.created_at
    )
  order by i.created_at desc
  limit 1;
$$;

grant execute on function get_incomplete_booking(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
