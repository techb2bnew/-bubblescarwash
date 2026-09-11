-- Gift cards gain an occasion design (Birthday, Christmas, Mum, Dad, plain
-- Gift). The designs themselves are fixed image assets shipped in
-- public/gift-cards, so they live as a constant in the app
-- (src/lib/gift-card-designs.ts) rather than a table — only the customer's
-- chosen slug needs persisting, so the delivery email can show the same
-- card they picked. gift_card_products stay as the suggested amounts, but
-- the customer can also type their own value (p_amount) as long as it meets
-- the $50 minimum, in which case no product is attached at all
-- (gift_cards.product_id is already nullable).

alter table gift_cards add column if not exists design_slug text;

-- create_gift_card_purchase: same as before plus p_design_slug and p_amount
-- (new trailing parameters, so existing positional call sites keep working).
drop function if exists create_gift_card_purchase(uuid, text, text, text, text, text, text);
drop function if exists create_gift_card_purchase(uuid, text, text, text, text, text, text, text);

create or replace function create_gift_card_purchase(
  p_product_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text,
  p_design_slug text default null,
  p_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  v_price numeric(10, 2);
  v_validity_days int;
  v_code text;
  v_attempt int := 0;
  v_product_id uuid := p_product_id;
begin
  if p_amount is not null then
    -- Customer-entered amount: no product is attached (the presets are only
    -- suggestions), and the card lives as long as the most generous preset
    -- the admin currently offers.
    v_price := round(p_amount, 2);
    v_product_id := null;
    select coalesce(max(validity_days), 365) into v_validity_days
    from gift_card_products
    where active;
  else
    select price, validity_days into v_price, v_validity_days
    from gift_card_products
    where id = p_product_id and active;

    if v_price is null then
      raise exception 'Gift card product not found or unavailable.';
    end if;
  end if;

  -- The $50 floor applies to every card, preset or custom. Mirrors
  -- MIN_GIFT_CARD_AMOUNT in src/lib/gift-card-designs.ts.
  if v_price < 50 then
    raise exception 'Gift cards start at $50.';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := generate_gift_card_code();
    begin
      insert into gift_cards (
        product_id, code, value, purchaser_name, purchaser_email, purchaser_phone,
        recipient_name, recipient_email, message, expires_at, design_slug
      ) values (
        v_product_id, v_code, v_price, p_purchaser_name, p_purchaser_email,
        nullif(p_purchaser_phone, ''),
        nullif(p_recipient_name, ''), nullif(p_recipient_email, ''), nullif(p_message, ''),
        now() + make_interval(days => v_validity_days),
        nullif(p_design_slug, '')
      )
      returning id into new_id;
      exit;
    exception when unique_violation then
      if v_attempt >= 5 then
        raise exception 'Could not generate a unique gift card code, please try again.';
      end if;
    end;
  end loop;

  return new_id;
end;
$$;

grant execute on function create_gift_card_purchase(uuid, text, text, text, text, text, text, text, numeric)
  to anon, authenticated;

-- complete_gift_card_purchase_simple / mark_gift_card_paid: both now also
-- return design_slug so the caller can render the chosen card in the email
-- (gift_cards has no anon SELECT policy, so it can't be re-queried).
drop function if exists complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text);
drop function if exists complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text, text);

create or replace function complete_gift_card_purchase_simple(
  p_product_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text,
  p_design_slug text default null,
  p_amount numeric default null
)
returns table (
  gift_card_id uuid,
  code text,
  value numeric(10, 2),
  product_name text,
  purchaser_name text,
  purchaser_email text,
  recipient_name text,
  recipient_email text,
  message text,
  expires_at timestamptz,
  design_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  v_id := create_gift_card_purchase(
    p_product_id, p_purchaser_name, p_purchaser_email, p_purchaser_phone,
    p_recipient_name, p_recipient_email, p_message, p_design_slug, p_amount
  );

  update gift_cards
  set payment_status = 'paid', status = 'active'
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gcp.name, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at, gc.design_slug
    from gift_cards gc
    left join gift_card_products gcp on gcp.id = gc.product_id
    where gc.id = v_id;
end;
$$;

grant execute on function complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text, text, numeric)
  to anon, authenticated;

drop function if exists mark_gift_card_paid(text, text, text, text, text);

create or replace function mark_gift_card_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text,
  p_card_brand text default null,
  p_card_last4 text default null,
  p_receipt_url text default null
)
returns table (
  gift_card_id uuid,
  code text,
  value numeric(10, 2),
  product_name text,
  purchaser_name text,
  purchaser_email text,
  recipient_name text,
  recipient_email text,
  message text,
  expires_at timestamptz,
  design_slug text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_already_paid boolean;
begin
  select gc.id, (gc.payment_status = 'paid') into v_id, v_already_paid
  from gift_cards gc
  where gc.stripe_checkout_session_id = p_stripe_checkout_session_id;

  if v_id is null or v_already_paid then
    return;
  end if;

  update gift_cards
  set payment_status = 'paid', status = 'active',
      stripe_payment_intent_id = p_stripe_payment_intent_id,
      card_brand = p_card_brand,
      card_last4 = p_card_last4,
      receipt_url = p_receipt_url
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gcp.name, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at, gc.design_slug
    from gift_cards gc
    left join gift_card_products gcp on gcp.id = gc.product_id
    where gc.id = v_id;
end;
$$;

grant execute on function mark_gift_card_paid(text, text, text, text, text) to anon, authenticated;

-- Gift cards start at $50; seed the standard amounts so the storefront always
-- has valid options. Idempotent: only inserts an amount that isn't already
-- offered. Existing products priced under $50 are left alone (the storefront
-- filters them out) so no admin-entered data is silently rewritten.
insert into gift_card_products (name, description, price, validity_days, sort_order, active)
select v.name, v.description, v.price, 365, v.sort_order, true
from (values
  ('$50 Gift Card',  'Covers a standard wash.',              50.00,  1),
  ('$75 Gift Card',  'A wash plus a coffee at the cafe.',    75.00,  2),
  ('$100 Gift Card', 'Our most popular gift amount.',       100.00,  3),
  ('$150 Gift Card', 'Enough for a full detail.',           150.00,  4),
  ('$200 Gift Card', 'The works, with change to spare.',    200.00,  5)
) as v(name, description, price, sort_order)
where not exists (
  select 1 from gift_card_products gcp where gcp.price = v.price
);

notify pgrst, 'reload schema';
