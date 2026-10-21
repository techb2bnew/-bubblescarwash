import type { SupabaseClient } from "@supabase/supabase-js";
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
  sendBookingExpiredEmail,
  sendBookingCreatedEmails,
  sendBookingPaymentFailedEmails,
  sendBookingPaymentPendingEmail,
  sendBookingRescheduledEmails,
  sendPaymentProcessingEmail,
  sendPaymentRetryEmail,
  sendTaxInvoiceEmail,
  type BookingEmailDetails,
} from "@/lib/email";
import { getStripeClient } from "@/lib/stripe";
import {
  buildTaxInvoice,
  renderTaxInvoicePdf,
  type InvoiceRow,
  type PaymentMethodInfo,
} from "@/lib/tax-invoice";

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
    .select("name, duration_minutes")
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
): BookingEmailDetails {
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

/**
 * Keeps Google Calendar in line with booking status, whatever the payment
 * state: every confirmed/completed/rescheduled booking gets an event, and a cancelled
 * booking loses any event it still has. Safe to run on every page load —
 * it only touches bookings that are out of sync. No emails are sent here.
 */
export async function syncBookingsToGoogle(
  client?: SupabaseClient,
): Promise<void> {
  try {
    const supabase = client ?? (await createClient());
    const select =
      "id, service_id, customer_name, customer_phone, customer_email, car_number, booking_date, booking_time, price, google_event_id, services(name, duration_minutes)";

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

    // Confirmation emails for active bookings that haven't had one. A booking
    // whose payment is still "pending" is deliberately left out: it gets the
    // "still pending — please confirm the payment" reminder instead (see
    // sendPendingPaymentReminders). Past bookings are skipped.
    const adminEmail = getAdminEmail(business.email);
    if (!adminEmail) return;
    const { data: unemailed } = await supabase
      .from("bookings")
      .select(select)
      .in("status", ["confirmed", "completed", "rescheduled"])
      .is("confirmation_email_sent_at", null)
      .gte("booking_date", todayKeyInTimezone(getBusinessTimezone()))
      .in("payment_status", ["paid", "unpaid"])
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
      price: input.price ?? null,
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
      const emailDetails = buildEmailDetails(booking, business, calendarLink);
      await sendBookingCreatedEmails(emailDetails, adminEmail);
    }
  } catch (err) {
    console.error("[booking-sync] onBookingCreated failed:", err);
  }
}

/** Asks Stripe how the customer paid (card, Apple Pay, Google Pay, Link). Best effort. */
async function lookupPaymentMethod(paymentIntentId: string | null | undefined): Promise<PaymentMethodInfo> {
  const none: PaymentMethodInfo = { type: null, wallet: null };
  const stripe = getStripeClient();
  if (!stripe || !paymentIntentId) return none;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = typeof pi.latest_charge === "string" ? null : pi.latest_charge;
    const details = charge?.payment_method_details;
    return { type: details?.type ?? null, wallet: details?.card?.wallet?.type ?? null };
  } catch (err) {
    console.error("[booking-sync] payment method lookup failed:", err);
    return none;
  }
}

/**
 * Called once, right after a booking is marked paid: emails the customer a tax
 * invoice (PDF attached) with a link to their Stripe payment receipt. Never
 * throws — a failed invoice must not undo a successful payment.
 */
export async function onBookingPaidInvoice(bookingId: string): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_booking_invoice", { p_booking_id: bookingId });
    if (error || !data) {
      console.error("[booking-sync] get_booking_invoice failed:", error);
      return;
    }
    const row = data as InvoiceRow;
    const invoice = buildTaxInvoice(row, new Date(), await lookupPaymentMethod(row.stripe_payment_intent_id));
    const pdf = await renderTaxInvoicePdf(invoice);
    await sendTaxInvoiceEmail(invoice, pdf);
  } catch (err) {
    console.error("[booking-sync] onBookingPaidInvoice failed:", err);
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
export interface PendingPaymentBooking {
  id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  car_number: string | null;
  booking_date: string;
  booking_time: string;
  price: number | null;
  created_at: string;
  services: { name: string; duration_minutes: number } | null;
}

/** Emails the customer that their booking is still awaiting payment. Returns true if one was sent. */
export async function onBookingPaymentPending(
  row: PendingPaymentBooking,
  holdUntil: Date,
): Promise<boolean> {
  try {
    const business = await fetchBusinessSettings();
    if (!business) return false;
    if (!(await claimPendingPaymentReminder(row.id))) return false;

    const holdUntilLabel = new Intl.DateTimeFormat("en-AU", {
      timeStyle: "short",
      timeZone: getBusinessTimezone(),
    }).format(holdUntil);

    const details = buildEmailDetails(
      {
        ...row,
        google_event_id: null,
      },
      business,
      null,
    );
    await sendBookingPaymentPendingEmail(details, holdUntilLabel);
    return true;
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentPending failed:", err);
    return false;
  }
}

async function claimPendingPaymentReminder(bookingId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_pending_payment_reminder", {
    p_booking_id: bookingId,
  });
  if (error) {
    // Unlike the confirmation email, a reminder isn't worth risking a repeat
    // for — skip it if we can't be sure it hasn't gone out.
    console.error("[booking-sync] claim_pending_payment_reminder failed:", error);
    return false;
  }
  return data === true;
}

function emailDetailsForFailedRow(
  row: PaymentFailedBooking,
  business: { name: string; address: string | null; phone: string | null },
): BookingEmailDetails {
  return buildEmailDetails(
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
}

/**
 * Final notice for a booking whose checkout sat unpaid until it expired
 * ("your booking is cancelled — you can no longer complete the payment").
 * Customer only; runs once because the DB only returns the booking on the
 * pending -> failed transition.
 */
export async function onBookingPaymentExpired(
  row: PaymentFailedBooking,
): Promise<void> {
  try {
    const business = await fetchBusinessSettings();
    if (!business) return;
    await sendBookingExpiredEmail(emailDetailsForFailedRow(row, business));
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentExpired failed:", err);
  }
}

export async function onBookingPaymentFailed(
  row: PaymentFailedBooking,
  { customerAlreadyTold = false }: { customerAlreadyTold?: boolean } = {},
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
    if (customerAlreadyTold) {
      // They already got "your payment didn't go through"; now the slot is gone,
      // so the customer gets the plain "cancelled" notice and admin the failure copy.
      await Promise.all([
        sendBookingExpiredEmail(details),
        sendBookingPaymentFailedEmails(details, adminEmail, { customer: false }),
      ]);
      return;
    }
    await sendBookingPaymentFailedEmails(details, adminEmail);
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentFailed failed:", err);
  }
}

function holdUntilLabelFor(holdUntil: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeStyle: "short",
    timeZone: getBusinessTimezone(),
  }).format(holdUntil);
}

/** A card attempt was declined while the checkout is still open: tell the customer, with a retry link. */
export async function onBookingPaymentRetryNeeded(
  row: PaymentFailedBooking,
  holdUntil: Date,
): Promise<void> {
  try {
    const business = await fetchBusinessSettings();
    if (!business) return;
    await sendPaymentRetryEmail(emailDetailsForFailedRow(row, business), holdUntilLabelFor(holdUntil));
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentRetryNeeded failed:", err);
  }
}

/** Stripe has the payment but the bank hasn't cleared it: reassure the customer. */
export async function onBookingPaymentProcessing(row: PaymentFailedBooking): Promise<void> {
  try {
    const business = await fetchBusinessSettings();
    if (!business) return;
    await sendPaymentProcessingEmail(emailDetailsForFailedRow(row, business));
  } catch (err) {
    console.error("[booking-sync] onBookingPaymentProcessing failed:", err);
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
