"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe";
import { getPaymentMode, type PaymentMode } from "@/lib/payment-mode";
import { onBookingCreated } from "@/lib/booking-sync";
import { getSiteOrigin } from "@/lib/site-origin";
import type { PaymentStatus } from "@/lib/types";

export interface BookedTime {
  time: string;
  reason: string | null;
  isBlocked: boolean;
}

export async function getBookedTimes(date: string): Promise<BookedTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booked_times", {
    target_date: date,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (b: { booking_time: string; reason: string | null; is_blocked: boolean }) => ({
      time: b.booking_time.slice(0, 5),
      reason: b.reason,
      isBlocked: b.is_blocked,
    }),
  );
}

export async function getDateHours(
  date: string,
): Promise<{ openingTime: string; closingTime: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_business_hours", { target_date: date })
    .single();
  if (error) throw new Error(error.message);
  const row = data as { opening_time: string; closing_time: string };
  return {
    openingTime: row.opening_time.slice(0, 5),
    closingTime: row.closing_time.slice(0, 5),
  };
}

export async function getBookingPaymentMode(): Promise<PaymentMode> {
  return getPaymentMode();
}

export interface GiftCardPreview {
  valid: boolean;
  reason?: "not found" | "already used" | "cancelled" | "expired";
  value?: number;
}

/**
 * Read-only, non-binding preview for the "apply gift card code" input.
 * Real validation and consumption happen atomically inside create_booking
 * at submit time, so a code that goes stale between preview and submit
 * simply surfaces as a thrown RPC error the UI already displays.
 */
export async function previewGiftCard(code: string): Promise<GiftCardPreview> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("preview_gift_card_by_code", { p_code: code })
    .maybeSingle();
  if (error || !data) return { valid: false, reason: "not found" };

  const row = data as { value: number; status: string; expires_at: string };
  if (row.status === "used") return { valid: false, reason: "already used" };
  if (row.status === "cancelled") return { valid: false, reason: "cancelled" };
  if (row.status !== "active" || new Date(row.expires_at) < new Date()) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, value: row.value };
}

export async function countBookingsByEmail(email: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_bookings_by_email", {
    p_email: email,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export interface CreateBookingInput {
  service_id: string;
  vehicle_type: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  extra_ids?: string[];
  gift_card_code?: string;
}

/**
 * Reserves the slot immediately (via create_booking, same validation as
 * always) so it can't be taken while the customer is on Stripe's hosted
 * page, then starts a Checkout Session for the total. Calendar sync and
 * confirmation emails are deferred until the Stripe webhook confirms
 * payment — see /api/stripe/webhook.
 */
export async function createCheckoutSession(
  input: CreateBookingInput,
): Promise<{ url: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error(
      "Online payment isn't set up yet. Please call us to complete your booking.",
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: input.service_id,
    p_vehicle_type: input.vehicle_type,
    p_booking_date: input.booking_date,
    p_booking_time: input.booking_time,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_email: input.customer_email,
    p_extra_ids: input.extra_ids ?? [],
    p_gift_card_code: input.gift_card_code || null,
  });
  if (error) throw new Error(error.message);
  const bookingId = data as string;

  try {
    const [{ data: price, error: priceError }, { data: service }] = await Promise.all([
      supabase.rpc("get_booking_price", { p_booking_id: bookingId }),
      supabase.from("services").select("name").eq("id", input.service_id).single(),
    ]);
    if (priceError) throw new Error(priceError.message);
    if (price == null) throw new Error("Could not price this booking.");

    // Fully covered by a gift card — Stripe rejects zero-amount sessions,
    // so mark the booking paid directly and skip Stripe entirely.
    if (Number(price) === 0) {
      const { error: paidError } = await supabase.rpc("mark_booking_paid_no_charge", {
        p_booking_id: bookingId,
      });
      if (paidError) throw new Error(paidError.message);

      await onBookingCreated({
        bookingId,
        serviceId: input.service_id,
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        customerEmail: input.customer_email,
        bookingDate: input.booking_date,
        bookingTime: input.booking_time,
        price: 0,
      });

      const origin = await getSiteOrigin();
      return { url: `${origin}/book/confirmation?booking_id=${bookingId}` };
    }

    const extraCount = input.extra_ids?.length ?? 0;
    const serviceName = service?.name ?? "Car Wash";
    const description = `${input.booking_date} at ${input.booking_time.slice(0, 5)}${
      extraCount > 0 ? ` + ${extraCount} extra${extraCount === 1 ? "" : "s"}` : ""
    }`;

    const origin = await getSiteOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: input.customer_email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: getStripeCurrency(),
            unit_amount: Math.round(Number(price) * 100),
            product_data: {
              name: serviceName,
              description,
            },
          },
        },
      ],
      metadata: { type: "booking", booking_id: bookingId },
      expires_at: Math.floor(Date.now() / 1000) + 32 * 60,
      success_url: `${origin}/book/confirmation?booking_id=${bookingId}`,
      cancel_url: `${origin}/book/cancelled?booking_id=${bookingId}`,
    });

    if (!session.url) throw new Error("Stripe did not return a checkout URL.");

    const { error: sessionError } = await supabase.rpc("set_booking_checkout_session", {
      p_booking_id: bookingId,
      p_stripe_checkout_session_id: session.id,
    });
    if (sessionError) throw new Error(sessionError.message);

    return { url: session.url };
  } catch (err) {
    await supabase.rpc("cancel_unpaid_booking", { p_booking_id: bookingId });
    throw err instanceof Error
      ? err
      : new Error("Something went wrong starting payment. Please try again.");
  }
}

export interface CreateBookingSimpleResult {
  bookingId: string;
}

/**
 * No-Stripe "pay in person" path: creates the booking directly (payment_status
 * stays 'unpaid' by column default) and fires calendar sync + emails
 * immediately, since there's no payment gate to wait on.
 */
export async function createBookingSimple(
  input: CreateBookingInput,
): Promise<CreateBookingSimpleResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: input.service_id,
    p_vehicle_type: input.vehicle_type,
    p_booking_date: input.booking_date,
    p_booking_time: input.booking_time,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_email: input.customer_email,
    p_extra_ids: input.extra_ids ?? [],
    p_gift_card_code: input.gift_card_code || null,
  });
  if (error) throw new Error(error.message);
  const bookingId = data as string;

  const { data: price } = await supabase.rpc("get_booking_price", {
    p_booking_id: bookingId,
  });

  await onBookingCreated({
    bookingId,
    serviceId: input.service_id,
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    customerEmail: input.customer_email,
    bookingDate: input.booking_date,
    bookingTime: input.booking_time,
    price: price != null ? Number(price) : null,
  });

  return { bookingId };
}

export interface BookingPaymentStatus {
  status: string;
  paymentStatus: PaymentStatus;
  customerName: string;
  bookingDate: string;
  bookingTime: string;
  price: number | null;
  serviceName: string | null;
}

export async function getBookingPaymentStatus(
  bookingId: string,
): Promise<BookingPaymentStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_booking_payment_status", { p_booking_id: bookingId })
    .single();
  if (error || !data) return null;

  const row = data as {
    status: string;
    payment_status: PaymentStatus;
    customer_name: string;
    booking_date: string;
    booking_time: string;
    price: number | null;
    service_name: string | null;
  };
  return {
    status: row.status,
    paymentStatus: row.payment_status,
    customerName: row.customer_name,
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
    price: row.price,
    serviceName: row.service_name,
  };
}

/** Best-effort release of the slot when the customer cancels out of Stripe. */
export async function cancelUnpaidBooking(bookingId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("cancel_unpaid_booking", { p_booking_id: bookingId });
}
