import { createClient } from "@/lib/supabase/server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getBusinessTimezone,
  updateCalendarEvent,
} from "@/lib/google-calendar";
import { todayKeyInTimezone } from "@/lib/date-utils";
import {
  sendBookingCancelledEmails,
  sendBookingCreatedEmails,
  sendBookingPaymentFailedEmails,
  sendBookingRescheduledEmails,
  type BookingEmailDetails,
} from "@/lib/email";
import type { PaymentReceiptInfo } from "@/lib/receipt-pdf";

export interface BookingNotificationInput {
  bookingId: string;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  carNumber?: string | null;
  bookingDate: string;
  bookingTime: string;
  price?: number | null;
  /** Set when the booking has just been paid, so the email carries a receipt. */
  payment?: PaymentReceiptInfo | null;
}

/** Receipt details for the confirmation email + PDF. */
export function buildPaymentInfo(p: {
  amount: number | null;
  cardBrand: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
  paymentIntentId: string | null;
  paidAt: Date | null;
}): PaymentReceiptInfo {
  const brand = p.cardBrand
    ? p.cardBrand.charAt(0).toUpperCase() + p.cardBrand.slice(1)
    : null;
  return {
    amount: p.amount,
    currency: process.env.STRIPE_CURRENCY ?? "aud",
    methodLabel: brand && p.cardLast4 ? `${brand} •••• ${p.cardLast4}` : null,
    paidAtLabel: p.paidAt
      ? new Intl.DateTimeFormat("en-AU", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: getBusinessTimezone(),
        }).format(p.paidAt)
      : null,
    reference: p.paymentIntentId,
    receiptUrl: p.receiptUrl,
  };
}

interface BookingWithService {
  id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  car_number: string | null;
  booking_date: string;
  booking_time: string;
  price: number | null;
  payment_status?: string | null;
  receipt_url?: string | null;
  card_brand?: string | null;
  card_last4?: string | null;
  stripe_payment_intent_id?: string | null;
  google_event_id: string | null;
  services: {
    name: string;
    duration_minutes: number;
  } | null;
}

async function fetchBooking(bookingId: string): Promise<BookingWithService | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, service_id, customer_name, customer_phone, customer_email, car_number, booking_date, booking_time, price, google_event_id, services(name, duration_minutes)",
    )
    .eq("id", bookingId)
    .single();

  if (error || !data) return null;
  return data as unknown as BookingWithService;
}

async function fetchService(serviceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("id", serviceId)
    .single();
  return data;
}

async function fetchBusinessSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_settings")
    .select("name, address, phone, email")
    .eq("id", 1)
    .single();
  return data;
}

function getAdminEmail(businessEmail: string | null | undefined): string | null {
  return process.env.ADMIN_EMAIL ?? businessEmail ?? null;
}

function buildEmailDetails(
  booking: BookingWithService,
  business: {
    name: string;
    address: string | null;
    phone: string | null;
  },
  calendarLink: string | null,
  payment?: PaymentReceiptInfo | null,
): BookingEmailDetails {
  // Bookings already paid in Stripe carry their receipt details from the DB.
  const paidPayment =
    payment ??
    (booking.payment_status === "paid"
      ? buildPaymentInfo({
          amount: booking.price,
          cardBrand: booking.card_brand ?? null,
          cardLast4: booking.card_last4 ?? null,
          receiptUrl: booking.receipt_url ?? null,
          paymentIntentId: booking.stripe_payment_intent_id ?? null,
          paidAt: null,
        })
      : null);
  return {
    bookingId: booking.id,
    customerName: booking.customer_name,
    customerEmail: booking.customer_email,
    customerPhone: booking.customer_phone,
    carNumber: booking.car_number,
    serviceName: booking.services?.name ?? "Car Wash",
    bookingDate: booking.booking_date,
    bookingTime: booking.booking_time,
    price: booking.price,
    durationMinutes: booking.services?.duration_minutes ?? 30,
    businessName: business.name,
    businessAddress: business.address,
    businessPhone: business.phone,
    calendarLink,
    payment: paidPayment,
  };
}

function buildCalendarInput(
  booking: BookingWithService,
  businessName: string,
) {
  const serviceName = booking.services?.name ?? "Car Wash";
  const duration = booking.services?.duration_minutes ?? 30;

  return {
    summary: `${booking.customer_name} — ${serviceName}`,
    description: [
      `Customer: ${booking.customer_name}`,
      `Phone: ${booking.customer_phone}`,
      `Email: ${booking.customer_email}`,
      `Service: ${serviceName}`,
      `Business: ${businessName}`,
      `Booking ID: ${booking.id}`,
    ].join("\n"),
    startDate: booking.booking_date,
    startTime: booking.booking_time,
    durationMinutes: duration,
  };
}

async function saveGoogleEventId(
  bookingId: string,
  eventId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_booking_google_event_id", {
    p_booking_id: bookingId,
    p_google_event_id: eventId,
  });
  if (error) {
    console.error("[booking-sync] failed to save google_event_id:", error);
  }
}

/**
 * True for exactly one caller per booking, so the confirmation email goes out
 * once even if the webhook and the catch-up sync race. If the claim itself
 * fails we send anyway — a duplicate beats a lost confirmation.
 */
async function claimConfirmationEmail(bookingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_booking_confirmation_email", {
    p_booking_id: bookingId,
  });
  if (error) {
    console.error("[booking-sync] claim_booking_confirmation_email failed:", error);
    return true;
  }
  return data === true;
}

/** Pending-payment bookings wait this long before emailing, so an abandoned checkout (which expires and cancels after ~32 min) never gets one. */
const PENDING_PAYMENT_EMAIL_DELAY_MS = 35 * 60 * 1000;

/**
 * Keeps Google Calendar in line with booking status, whatever the payment
 * state: every confirmed/completed/rescheduled booking gets an event, and a cancelled
 * booking loses any event it still has. Safe to run on every page load —
 * it only touches bookings that are out of sync. No emails are sent here.
 */
export async function syncBookingsToGoogle(): Promise<void> {
  try {
    const supabase = await createClient();
    const select =
      "id, service_id, customer_name, customer_phone, customer_email, car_number, booking_date, booking_time, price, payment_status, receipt_url, card_brand, card_last4, stripe_payment_intent_id, google_event_id, services(name, duration_minutes)";

    const [{ data: missing }, { data: stale }, business] = await Promise.all([
      supabase
        .from("bookings")
        .select(select)
        .in("status", ["confirmed", "completed", "rescheduled"])
        .or("google_event_id.is.null,google_event_id.eq.")
        .order("booking_date", { ascending: true })
        .limit(100),
      supabase
        .from("bookings")
        .select("id, google_event_id")
        .eq("status", "cancelled")
        .not("google_event_id", "is", null)
        .neq("google_event_id", "")
        .limit(100),
      fetchBusinessSettings(),
    ]);

    for (const row of stale ?? []) {
      await deleteCalendarEvent(row.google_event_id as string);
      await saveGoogleEventId(row.id as string, "");
    }

    if (!business) return;
    for (const row of (missing ?? []) as unknown as BookingWithService[]) {
      const result = await createCalendarEvent(
        buildCalendarInput(row, business.name),
      );
      if (result?.eventId) await saveGoogleEventId(row.id, result.eventId);
    }

    // Confirmation emails for active bookings that haven't had one — whatever
    // the payment state. Past bookings are skipped; so are pending-payment
    // ones younger than the grace period (see PENDING_PAYMENT_EMAIL_DELAY_MS).
    const adminEmail = getAdminEmail(business.email);
    if (!adminEmail) return;
    const cutoff = new Date(Date.now() - PENDING_PAYMENT_EMAIL_DELAY_MS).toISOString();
    const { data: unemailed } = await supabase
      .from("bookings")
      .select(select)
      .in("status", ["confirmed", "completed", "rescheduled"])
      .is("confirmation_email_sent_at", null)
      .gte("booking_date", todayKeyInTimezone(getBusinessTimezone()))
      .or(`payment_status.in.(paid,unpaid),created_at.lte.${cutoff}`)
      .order("booking_date", { ascending: true })
      .limit(20);

    for (const row of (unemailed ?? []) as unknown as BookingWithService[]) {
      if (!(await claimConfirmationEmail(row.id))) continue;
      await sendBookingCreatedEmails(
        buildEmailDetails(row, business, null),
        adminEmail,
      );
    }
  } catch (err) {
    console.error("[booking-sync] syncBookingsToGoogle failed:", err);
  }
}

/** Called after a new booking is created (public or admin). */
export async function onBookingCreated(
  input: BookingNotificationInput,
): Promise<void> {
  try {
    const [business, service] = await Promise.all([
      fetchBusinessSettings(),
      fetchService(input.serviceId),
    ]);
    if (!business) return;

    const booking: BookingWithService = {
      id: input.bookingId,
      service_id: input.serviceId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      customer_email: input.customerEmail,
      car_number: input.carNumber ?? null,
      booking_date: input.bookingDate,
      booking_time: input.bookingTime,
      price: input.price ?? service?.price ?? null,
      google_event_id: null,
      services: service
        ? { name: service.name, duration_minutes: service.duration_minutes }
        : null,
    };

    const calendarInput = buildCalendarInput(booking, business.name);
    const calendarResult = await createCalendarEvent(calendarInput);

    const calendarLink: string | null = calendarResult?.htmlLink ?? null;
    if (calendarResult?.eventId) {
      await saveGoogleEventId(input.bookingId, calendarResult.eventId);
    }

    const adminEmail = getAdminEmail(business.email);
    if (adminEmail && (await claimConfirmationEmail(input.bookingId))) {
      const emailDetails = buildEmailDetails(
        booking,
        business,
        calendarLink,
        input.payment,
      );
      await sendBookingCreatedEmails(emailDetails, adminEmail);
    }
  } catch (err) {
    console.error("[booking-sync] onBookingCreated failed:", err);
  }
}

/** Called when an admin reschedules a booking. */
export async function onBookingRescheduled(bookingId: string): Promise<void> {
  try {
    const [booking, business] = await Promise.all([
      fetchBooking(bookingId),
      fetchBusinessSettings(),
    ]);
    if (!booking || !business) return;

    let calendarLink: string | null = null;

    if (booking.google_event_id) {
      const calendarInput = buildCalendarInput(booking, business.name);
      const result = await updateCalendarEvent(
        booking.google_event_id,
        calendarInput,
      );
      calendarLink = result?.htmlLink ?? null;
    } else {
      const calendarInput = buildCalendarInput(booking, business.name);
      const result = await createCalendarEvent(calendarInput);
      if (result?.eventId) {
        await saveGoogleEventId(bookingId, result.eventId);
        calendarLink = result.htmlLink;
      }
    }

    const adminEmail = getAdminEmail(business.email);
    if (adminEmail) {
      const emailDetails = buildEmailDetails(booking, business, calendarLink);
      await sendBookingRescheduledEmails(emailDetails, adminEmail);
    }
  } catch (err) {
    console.error("[booking-sync] onBookingRescheduled failed:", err);
  }
}

export interface PaymentFailedBooking {
  booking_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  car_number: string | null;
  booking_date: string;
  booking_time: string;
  price: number | null;
  service_name: string | null;
  duration_minutes: number | null;
}

/** Called by the Stripe webhook after it cancels a booking whose payment failed. */
export async function onBookingPaymentFailed(
  row: PaymentFailedBooking,
): Promise<void> {
  try {
    const business = await fetchBusinessSettings();
    if (!business) return;
    const adminEmail = getAdminEmail(business.email);
    if (!adminEmail) return;

    const details = buildEmailDetails(
      {
        id: row.booking_id,
        service_id: row.service_id,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        customer_email: row.customer_email,
        car_number: row.car_number,
        booking_date: row.booking_date,
        booking_time: row.booking_time,
        price: row.price,
        google_event_id: null,
        services: {
          name: row.service_name ?? "Car Wash",
          duration_minutes: row.duration_minutes ?? 30,
        },
      },
      business,
      null,
    );
    await sendBookingPaymentFailedEmails(details, adminEmail);
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentFailed failed:", err);
  }
}

/** Called when a booking is cancelled. */
export async function onBookingCancelled(bookingId: string): Promise<void> {
  try {
    const [booking, business] = await Promise.all([
      fetchBooking(bookingId),
      fetchBusinessSettings(),
    ]);
    if (!booking || !business) return;

    if (booking.google_event_id) {
      await deleteCalendarEvent(booking.google_event_id);
      await saveGoogleEventId(bookingId, "");
    }

    const adminEmail = getAdminEmail(business.email);
    if (adminEmail) {
      const emailDetails = buildEmailDetails(booking, business, null);
      await sendBookingCancelledEmails(emailDetails, adminEmail);
    }
  } catch (err) {
    console.error("[booking-sync] onBookingCancelled failed:", err);
  }
}
