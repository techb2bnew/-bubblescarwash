"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe";
import { getPaymentMode, type PaymentMode } from "@/lib/payment-mode";
import { onGiftCardPurchased } from "@/lib/gift-card-sync";
import type { PaymentStatus } from "@/lib/types";

export async function getGiftCardPaymentMode(): Promise<PaymentMode> {
  return getPaymentMode();
}

export interface GiftCardPurchaseInput {
  product_id: string;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string;
  recipient_name?: string;
  recipient_email?: string;
  message?: string;
}

async function getSiteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function createGiftCardCheckoutSession(
  input: GiftCardPurchaseInput,
): Promise<{ url: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error(
      "Online payment isn't set up yet. Please call us to buy a gift card.",
    );
  }

  const supabase = await createClient();

  const { data: giftCardId, error } = await supabase.rpc("create_gift_card_purchase", {
    p_product_id: input.product_id,
    p_purchaser_name: input.purchaser_name,
    p_purchaser_email: input.purchaser_email,
    p_purchaser_phone: input.purchaser_phone,
    p_recipient_name: input.recipient_name ?? "",
    p_recipient_email: input.recipient_email ?? "",
    p_message: input.message ?? "",
  });
  if (error) throw new Error(error.message);
  const id = giftCardId as string;

  try {
    const [{ data: price, error: priceError }, { data: product }] = await Promise.all([
      supabase.rpc("get_gift_card_price", { p_gift_card_id: id }),
      supabase
        .from("gift_card_products")
        .select("name")
        .eq("id", input.product_id)
        .single(),
    ]);
    if (priceError) throw new Error(priceError.message);
    if (price == null) throw new Error("Could not price this gift card.");

    const productName = product?.name ?? "Gift Card";
    const origin = await getSiteOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.purchaser_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: getStripeCurrency(),
            unit_amount: Math.round(Number(price) * 100),
            product_data: {
              name: `Gift Card — ${productName}`,
            },
          },
        },
      ],
      metadata: { type: "gift_card", gift_card_id: id },
      expires_at: Math.floor(Date.now() / 1000) + 32 * 60,
      success_url: `${origin}/gift-cards/confirmation?gift_card_id=${id}`,
      cancel_url: `${origin}/gift-cards/cancelled?gift_card_id=${id}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const { error: sessionError } = await supabase.rpc(
      "set_gift_card_checkout_session",
      { p_gift_card_id: id, p_stripe_checkout_session_id: session.id },
    );
    if (sessionError) throw new Error(sessionError.message);

    return { url: session.url };
  } catch (err) {
    await supabase.rpc("cancel_unpaid_gift_card", { p_gift_card_id: id });
    throw err instanceof Error
      ? err
      : new Error("Something went wrong starting payment. Please try again.");
  }
}

export interface CreateGiftCardSimpleResult {
  giftCardId: string;
}

/** No-Stripe path: create + mark paid + email the code in one call. */
export async function createGiftCardSimple(
  input: GiftCardPurchaseInput,
): Promise<CreateGiftCardSimpleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("complete_gift_card_purchase_simple", {
      p_product_id: input.product_id,
      p_purchaser_name: input.purchaser_name,
      p_purchaser_email: input.purchaser_email,
      p_purchaser_phone: input.purchaser_phone,
      p_recipient_name: input.recipient_name ?? "",
      p_recipient_email: input.recipient_email ?? "",
      p_message: input.message ?? "",
    })
    .single();
  if (error) throw new Error(error.message);

  const row = data as {
    gift_card_id: string;
    code: string;
    value: number;
    product_name: string | null;
    purchaser_name: string;
    purchaser_email: string;
    recipient_name: string | null;
    recipient_email: string | null;
    message: string | null;
    expires_at: string;
  };
  await onGiftCardPurchased({
    giftCardId: row.gift_card_id,
    code: row.code,
    value: row.value,
    productName: row.product_name,
    purchaserName: row.purchaser_name,
    purchaserEmail: row.purchaser_email,
    recipientName: row.recipient_name,
    recipientEmail: row.recipient_email,
    message: row.message,
    expiresAt: row.expires_at,
  });
  return { giftCardId: row.gift_card_id };
}

export interface GiftCardPaymentStatus {
  status: string;
  paymentStatus: PaymentStatus;
  code: string | null;
  value: number | null;
  recipientName: string | null;
  expiresAt: string | null;
}

export async function getGiftCardPaymentStatus(
  giftCardId: string,
): Promise<GiftCardPaymentStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_gift_card_payment_status", { p_gift_card_id: giftCardId })
    .single();
  if (error || !data) return null;

  const row = data as {
    status: string;
    payment_status: PaymentStatus;
    code: string | null;
    value: number | null;
    recipient_name: string | null;
    expires_at: string | null;
  };
  return {
    status: row.status,
    paymentStatus: row.payment_status,
    code: row.code,
    value: row.value,
    recipientName: row.recipient_name,
    expiresAt: row.expires_at,
  };
}

/** Best-effort release when the customer cancels out of Stripe. */
export async function cancelUnpaidGiftCard(giftCardId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("cancel_unpaid_gift_card", { p_gift_card_id: giftCardId });
}
