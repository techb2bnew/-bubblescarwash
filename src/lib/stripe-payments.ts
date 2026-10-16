import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  onBookingCreated,
  onBookingPaymentExpired,
  onBookingPaymentFailed,
  onBookingPaymentPending,
  type PaymentFailedBooking,
  type PendingPaymentBooking,
} from "@/lib/booking-sync";
import { onGiftCardPurchased } from "@/lib/gift-card-sync";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe";

interface PaidBookingRow {
  booking_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  car_number: string | null;
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

export function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
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
    carNumber: row.car_number,
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

export async function handlePaid(session: Stripe.Checkout.Session, stripe: Stripe) {
  if (session.metadata?.type === "gift_card") {
    return handleGiftCardPaid(session, stripe);
  }
  return handleBookingPaid(session, stripe);
}

export async function handleFailed(
  session: Stripe.Checkout.Session,
  eventType: string,
) {
  const supabase = await createClient();
  const rpc =
    session.metadata?.type === "gift_card"
      ? "mark_gift_card_payment_failed"
      : "mark_booking_payment_failed";
  const { data, error } = await supabase.rpc(rpc, {
    p_stripe_checkout_session_id: session.id,
  });
  if (error) {
    console.error(`[stripe-webhook] ${rpc} failed:`, error);
    return;
  }
  if (rpc !== "mark_booking_payment_failed") return;

  // The DB only returns the booking when it really moved pending -> failed,
  // so each customer is emailed at most once (a customer who pressed Close was
  // already cancelled and gets nothing here).
  const row = (data as PaymentFailedBooking[] | null)?.[0];
  if (!row) return;

  // A payment was tried and didn't go through (a PaymentIntent exists, or
  // Stripe reported a delayed-payment failure): "payment unsuccessful" notice,
  // with the refund note. Otherwise the checkout was simply left unpaid until
  // it expired: the final "your booking is cancelled" notice.
  const paymentWasAttempted =
    eventType === "checkout.session.async_payment_failed" ||
    Boolean(getPaymentIntentId(session));
  if (paymentWasAttempted) {
    await onBookingPaymentFailed(row);
  } else {
    await onBookingPaymentExpired(row);
  }
}

/** A Checkout Session lives ~32 minutes; anything still pending after this has outlived it. */
const PENDING_GRACE_MS = 34 * 60 * 1000;

/**
 * Safety net for a Stripe webhook that never arrived (Stripe retries, but only
 * after a delay): look up every booking still "pending" past its checkout's
 * lifetime and settle it from Stripe's own record — paid becomes paid, an
 * expired session releases the slot. Uses the same handlers as the webhook, so
 * it is idempotent and safe to run on every admin page load.
 */
export async function reconcilePendingPayments(
  client?: SupabaseClient,
): Promise<void> {
  try {
    const stripe = getStripeClient();
    if (!stripe) return;

    const supabase = client ?? (await createClient());
    const cutoff = new Date(Date.now() - PENDING_GRACE_MS).toISOString();
    const { data: rows } = await supabase
      .from("bookings")
      .select("stripe_checkout_session_id")
      .eq("payment_status", "pending")
      .not("stripe_checkout_session_id", "is", null)
      .lte("created_at", cutoff)
      .limit(20);

    for (const row of rows ?? []) {
      const sessionId = row.stripe_checkout_session_id as string;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        await handlePaid(session, stripe);
      } else if (session.status === "expired") {
        await handleFailed(session, "checkout.session.expired");
      }
    }
  } catch (err) {
    console.error("[stripe-payments] reconcilePendingPayments failed:", err);
  }
}

/** Wait this long after checkout opens before nudging the customer. */
const REMIND_AFTER_MS = 10 * 60 * 1000;
/** Past this the 32-minute checkout is over (reconcile settles those instead). */
const REMIND_UNTIL_MS = 31 * 60 * 1000;

/**
 * One "your slot booking is still pending — please confirm the payment" email
 * for each booking whose checkout has been open 10+ minutes without payment.
 * The Stripe session is checked first, so nothing goes out for a booking that
 * has since been paid or has expired; the DB claim makes it once per booking.
 * Returns how many emails were sent.
 */
export async function sendPendingPaymentReminders(
  client?: SupabaseClient,
): Promise<number> {
  try {
    const stripe = getStripeClient();
    if (!stripe) return 0;

    const supabase = client ?? (await createClient());
    const now = Date.now();
    const { data: rows } = await supabase
      .from("bookings")
      .select(
        "id, service_id, customer_name, customer_phone, customer_email, car_number, booking_date, booking_time, price, created_at, stripe_checkout_session_id, services(name, duration_minutes)",
      )
      .eq("payment_status", "pending")
      .in("status", ["confirmed", "rescheduled"])
      .is("pending_reminder_sent_at", null)
      .not("stripe_checkout_session_id", "is", null)
      .lte("created_at", new Date(now - REMIND_AFTER_MS).toISOString())
      .gte("created_at", new Date(now - REMIND_UNTIL_MS).toISOString())
      .limit(20);

    let sent = 0;
    for (const row of rows ?? []) {
      const session = await stripe.checkout.sessions.retrieve(
        row.stripe_checkout_session_id as string,
      );
      if (session.status !== "open") continue;
      // The session's own expiry is the real "slot held until" time.
      const holdUntil = new Date((session.expires_at ?? 0) * 1000);
      if (
        await onBookingPaymentPending(
          row as unknown as PendingPaymentBooking,
          holdUntil,
        )
      ) {
        sent += 1;
      }
    }
    return sent;
  } catch (err) {
    console.error("[stripe-payments] sendPendingPaymentReminders failed:", err);
    return 0;
  }
}
