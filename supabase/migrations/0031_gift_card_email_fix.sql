-- gift_cards has no anon SELECT policy (by design — it holds purchaser/
-- recipient PII and redemption codes), so onGiftCardPurchased() can't
-- re-fetch the row with the anon-key client the way it was written; RLS
-- silently returns zero rows instead of erroring, so the email send was
-- never reached. Fix: have the purchase RPCs return the gift card's data
-- (including the product name, via a join only a security-definer function
-- can do) so the caller never needs a second, RLS-blocked SELECT — same
-- pattern onBookingCreated() already uses (booking data passed in, not
-- re-queried).

drop function if exists mark_gift_card_paid(text, text);

create or replace function mark_gift_card_paid(
  p_stripe_checkout_session_id text,
  p_stripe_payment_intent_id text
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
  expires_at timestamptz
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
      stripe_payment_intent_id = p_stripe_payment_intent_id
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gcp.name, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at
    from gift_cards gc
    left join gift_card_products gcp on gcp.id = gc.product_id
    where gc.id = v_id;
end;
$$;

grant execute on function mark_gift_card_paid(text, text) to anon, authenticated;

drop function if exists complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text);

create or replace function complete_gift_card_purchase_simple(
  p_product_id uuid,
  p_purchaser_name text,
  p_purchaser_email text,
  p_purchaser_phone text,
  p_recipient_name text,
  p_recipient_email text,
  p_message text
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
  expires_at timestamptz
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
    p_recipient_name, p_recipient_email, p_message
  );

  update gift_cards
  set payment_status = 'paid', status = 'active'
  where id = v_id;

  return query
    select gc.id, gc.code, gc.value, gcp.name, gc.purchaser_name, gc.purchaser_email,
           gc.recipient_name, gc.recipient_email, gc.message, gc.expires_at
    from gift_cards gc
    left join gift_card_products gcp on gcp.id = gc.product_id
    where gc.id = v_id;
end;
$$;

grant execute on function complete_gift_card_purchase_simple(uuid, text, text, text, text, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
