import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { onBookingCreated } from "@/lib/booking-sync";
import { onGiftCardPurchased } from "@/lib/gift-card-sync";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

interface PaidBookingRow {
  booking_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_date: string;
  booking_time: string;
  price: number | null;
}

interface PaidGiftCardRow {
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
  design_slug: string | null;
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

interface PaymentDetails {
  cardBrand: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
}

/** Best-effort — a failure here shouldn't block marking the booking/gift card paid. */
async function getPaymentDetails(
  stripe: Stripe,
  paymentIntentId: string | null,
): Promise<PaymentDetails> {
  const empty: PaymentDetails = { cardBrand: null, cardLast4: null, receiptUrl: null };
  if (!paymentIntentId) return empty;

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge"],
    });
    const charge =
      typeof paymentIntent.latest_charge === "string" ? null : paymentIntent.latest_charge;
    if (!charge) return empty;

    return {
      cardBrand: charge.payment_method_details?.card?.brand ?? null,
      cardLast4: charge.payment_method_details?.card?.last4 ?? null,
      receiptUrl: charge.receipt_url ?? null,
    };
  } catch (err) {
    console.error("[stripe-webhook] getPaymentDetails failed:", err);
    return empty;
  }
}

async function handleBookingPaid(session: Stripe.Checkout.Session, stripe: Stripe) {
  const supabase = await createClient();
  const paymentIntentId = getPaymentIntentId(session);
  const { cardBrand, cardLast4, receiptUrl } = await getPaymentDetails(stripe, paymentIntentId);
  const { data, error } = await supabase.rpc("mark_booking_paid", {
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
    p_card_brand: cardBrand,
    p_card_last4: cardLast4,
    p_receipt_url: receiptUrl,
  });
  if (error) {
    console.error("[stripe-webhook] mark_booking_paid failed:", error);
    return;
  }

  const row = (data as PaidBookingRow[] | null)?.[0];
  if (!row) return; // already processed, or booking not found — idempotent no-op

  await onBookingCreated({
    bookingId: row.booking_id,
    serviceId: row.service_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
    price: row.price,
  });
}

async function handleGiftCardPaid(session: Stripe.Checkout.Session, stripe: Stripe) {
  const supabase = await createClient();
  const paymentIntentId = getPaymentIntentId(session);
  const { cardBrand, cardLast4, receiptUrl } = await getPaymentDetails(stripe, paymentIntentId);
  const { data, error } = await supabase.rpc("mark_gift_card_paid", {
    p_stripe_checkout_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
    p_card_brand: cardBrand,
    p_card_last4: cardLast4,
    p_receipt_url: receiptUrl,
  });
  if (error) {
    console.error("[stripe-webhook] mark_gift_card_paid failed:", error);
    return;
  }

  const row = (data as PaidGiftCardRow[] | null)?.[0];
  if (!row) return; // already processed, or gift card not found — idempotent no-op

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
    designSlug: row.design_slug,
  });
}

async function handlePaid(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.metadata?.type === "gift_card") {
    return handleGiftCardPaid(session, stripe);
  }
  return handleBookingPaid(session, stripe);
}

async function handleFailed(session: Stripe.Checkout.Session) {
  const supabase = await createClient();
  const rpc =
    session.metadata?.type === "gift_card"
      ? "mark_gift_card_payment_failed"
      : "mark_booking_payment_failed";
  const { error } = await supabase.rpc(rpc, {
    p_stripe_checkout_session_id: session.id,
  });
  if (error) {
    console.error(`[stripe-webhook] ${rpc} failed:`, error);
  }
}

export async function POST(request: Request) {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    console.error("[stripe-webhook] Stripe not configured");
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handlePaid(event.data.object, stripe);
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await handleFailed(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error("[stripe-webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
