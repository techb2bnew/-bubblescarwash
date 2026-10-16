import { createClient } from "@/lib/supabase/server";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/google-calendar";
import {
  sendBookingCancelledEmails,
  sendBookingCreatedEmails,
  sendBookingRescheduledEmails,
  type BookingEmailDetails,
} from "@/lib/email";

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
 * Keeps Google Calendar in line with booking status, whatever the payment
 * state: every confirmed/completed booking gets an event, and a cancelled
 * booking loses any event it still has. Safe to run on every page load —
 * it only touches bookings that are out of sync. No emails are sent here.
 */
export async function syncBookingsToGoogle(): Promise<void> {
  try {
    const supabase = await createClient();
    const select =
      "id, service_id, customer_name, customer_phone, customer_email, car_number, booking_date, booking_time, price, google_event_id, services(name, duration_minutes)";

    const [{ data: missing }, { data: stale }, business] = await Promise.all([
      supabase
        .from("bookings")
        .select(select)
        .in("status", ["confirmed", "completed"])
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
    if (adminEmail) {
      const emailDetails = buildEmailDetails(booking, business, calendarLink);
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
