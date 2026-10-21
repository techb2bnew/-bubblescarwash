-- The tax invoice also names how the customer paid (card, Apple Pay, Google
-- Pay, Link). Stripe knows that, so hand back the payment intent id too and
-- let the server look it up when the invoice is built.

create or replace function get_booking_invoice(p_booking_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'booking_id',               b.id,
    'customer_name',            b.customer_name,
    'customer_email',           b.customer_email,
    'customer_phone',           b.customer_phone,
    'car_number',               b.car_number,
    'booking_date',             b.booking_date,
    'booking_time',             b.booking_time,
    'booking_type',             b.booking_type,
    'vehicle_name',             v.name,
    'service_name',             s.name,
    'price',                    b.price,
    'discount_amount',          coalesce(b.discount_amount, 0),
    'gift_card_discount',       coalesce(b.gift_card_discount, 0),
    'card_brand',               b.card_brand,
    'card_last4',               b.card_last4,
    'receipt_url',              b.receipt_url,
    'stripe_payment_intent_id', b.stripe_payment_intent_id,
    'extras', coalesce((
      select jsonb_agg(jsonb_build_object('name', e.name, 'price', e.price) order by e.created_at)
      from booking_extras e
      where e.booking_id = b.id
    ), '[]'::jsonb)
  )
  from bookings b
  left join services s on s.id = b.service_id
  left join vehicle_types v on v.slug = b.vehicle_type
  where b.id = p_booking_id
    and b.payment_status = 'paid';
$$;

grant execute on function get_booking_invoice(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
