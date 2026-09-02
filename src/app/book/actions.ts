"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency, isStripeConfigured } from "@/lib/stripe";
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

export async function isPaymentConfigured(): Promise<boolean> {
  return isStripeConfigured();
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
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  extra_ids?: string[];
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
    p_booking_date: input.booking_date,
    p_booking_time: input.booking_time,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_email: input.customer_email,
    p_extra_ids: input.extra_ids ?? [],
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
      metadata: { booking_id: bookingId },
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
