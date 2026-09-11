"use server";

import { revalidatePath } from "next/cache";
import {
  onBlockedDateCreated,
  onBlockedDateRemoved,
} from "@/lib/blocked-date-sync";
import {
  onBlockedSlotCreated,
  onBlockedSlotRemoved,
  onBlockedSlotsCreated,
} from "@/lib/blocked-slot-sync";
import { onBookingCreated } from "@/lib/booking-sync";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeCurrency } from "@/lib/stripe";
import { getSiteOrigin } from "@/lib/site-origin";
import type {
  BlockedSlot,
  BoothCapacityDuration,
  HoursSource,
  WeekdayHours,
} from "@/lib/types";
import {
  bookingHourBuckets,
  boothPeriodEndDate,
  formatDateLong,
  formatTimeLabel,
  generateTimeSlots,
  toMinutes,
  weekdayOfDateKey,
} from "@/lib/date-utils";

export async function blockDate(date: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_dates")
    .insert({ date, reason: reason || null });
  if (error) throw new Error(error.message);

  await onBlockedDateCreated(date, reason || null);

  revalidatePath("/admin/calendar");
}

export async function unblockDate(date: string) {
  const supabase = await createClient();

  await onBlockedDateRemoved(date);

  const { error } = await supabase
    .from("blocked_dates")
    .delete()
    .eq("date", date);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export interface DateAvailability {
  bookedTimes: string[];
  blockedSlots: BlockedSlot[];
  boothCount: number;
  slotUsage: { time: string; count: number }[];
  openingTime: string;
  closingTime: string;
  hoursSource: HoursSource;
}

export async function getBoothCountForDate(date: string, time?: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booth_count", {
    target_date: date,
    target_time: time ?? null,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 1;
}

export interface CapacityWindow {
  windowStart: string;
  windowEnd: string;
  boothCount: number;
}

/**
 * The counting range and capacity that apply at a given time — the full
 * span of a custom-hours period when one covers it (so e.g. 11am-1pm at
 * capacity 10 is one shared pool, not 10 per clock hour within it),
 * otherwise the plain clock hour.
 */
export async function getCapacityWindowForDate(date: string, time: string): Promise<CapacityWindow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_capacity_window", { target_date: date, target_time: time })
    .single();
  if (error) throw new Error(error.message);
  const row = data as { window_start: string; window_end: string; booth_count: number };
  return {
    windowStart: row.window_start.slice(0, 5),
    windowEnd: row.window_end.slice(0, 5),
    boothCount: row.booth_count,
  };
}

/**
 * The busiest clock hour in the range, and how many online bookings share it.
 * Capacity can never be set below this number — those bookings are already
 * confirmed, and lowering the pool under them would oversell the hour.
 */
async function peakHourlyBookings(
  startDate: string,
  endDate: string,
  /** Restrict to hours within [startTime, endTime) — for a custom-hours capacity window. */
  hourWindow?: { startTime: string; endTime: string },
): Promise<{ date: string; hour: string; count: number } | null> {
  const supabase = await createClient();
  const [{ data: bookings, error }, { data: settings }] = await Promise.all([
    supabase
      .from("bookings")
      .select("booking_date, booking_time, services(duration_minutes)")
      .gte("booking_date", startDate)
      .lte("booking_date", endDate)
      .eq("booking_type", "online")
      .neq("status", "cancelled"),
    supabase
      .from("business_settings")
      .select("slot_interval_minutes")
      .eq("id", 1)
      .single(),
  ]);
  if (error) throw new Error(error.message);

  const intervalMinutes = settings?.slot_interval_minutes ?? 30;
  const counts = new Map<string, number>();
  let peak: { date: string; hour: string; count: number } | null = null;

  for (const b of bookings ?? []) {
    const duration =
      (b.services as unknown as { duration_minutes: number } | null)
        ?.duration_minutes ?? intervalMinutes;
    for (const hour of bookingHourBuckets(b.booking_time, duration)) {
      if (hourWindow && (hour < hourWindow.startTime || hour >= hourWindow.endTime)) continue;
      const key = `${b.booking_date}T${hour}`;
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (!peak || count > peak.count) {
        peak = { date: b.booking_date, hour, count };
      }
    }
  }
  return peak;
}

export async function setBoothCapacity(
  startDate: string,
  boothCount: number,
  duration: BoothCapacityDuration,
  hours?: { startTime: string; endTime: string },
) {
  if (boothCount < 1) throw new Error("Booth count must be at least 1.");
  if (hours && hours.startTime >= hours.endTime) {
    throw new Error("Start time must be before end time.");
  }

  const endDate = boothPeriodEndDate(startDate, duration);
  const peak = await peakHourlyBookings(startDate, endDate, hours);
  if (peak && boothCount < peak.count) {
    throw new Error(
      `${formatDateLong(peak.date)} already has ${peak.count} booking${
        peak.count === 1 ? "" : "s"
      } in the ${formatTimeLabel(peak.hour)} hour, so capacity can't be set below ${
        peak.count
      }.`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("booth_capacity_periods").insert({
    start_date: startDate,
    end_date: endDate,
    booth_count: boothCount,
    start_time: hours ? `${hours.startTime}:00` : null,
    end_time: hours ? `${hours.endTime}:00` : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export async function getDateHoursForDate(
  date: string,
): Promise<{ openingTime: string; closingTime: string; hoursSource: HoursSource }> {
  const supabase = await createClient();
  const [{ data: hours, error }, { data: override }, { data: weekday }] =
    await Promise.all([
      supabase.rpc("get_business_hours", { target_date: date }).single(),
      supabase
        .from("date_hours_overrides")
        .select("date")
        .eq("date", date)
        .maybeSingle(),
      supabase
        .from("weekday_hours")
        .select("day_of_week")
        .eq("day_of_week", weekdayOfDateKey(date))
        .maybeSingle(),
    ]);
  if (error) throw new Error(error.message);
  const row = hours as { opening_time: string; closing_time: string } | null;
  return {
    openingTime: (row?.opening_time ?? "09:00").slice(0, 5),
    closingTime: (row?.closing_time ?? "17:00").slice(0, 5),
    hoursSource: override ? "date" : weekday ? "weekday" : "default",
  };
}

export async function getWeekdayHours(): Promise<WeekdayHours[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekday_hours")
    .select("day_of_week, opening_time, closing_time")
    .order("day_of_week");
  if (error) throw new Error(error.message);
  return ((data as WeekdayHours[]) ?? []).map((w) => ({
    ...w,
    opening_time: w.opening_time.slice(0, 5),
    closing_time: w.closing_time.slice(0, 5),
  }));
}

/**
 * Sets recurring hours for one weekday. Per-date overrides still win over
 * this, so a date the admin has already customised is left alone.
 */
export async function setWeekdayHours(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
) {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("Invalid day of week.");
  }
  if (startTime >= endTime) {
    throw new Error("Start time must be before end time.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekday_hours")
    .upsert(
      {
        day_of_week: dayOfWeek,
        opening_time: startTime,
        closing_time: endTime,
      },
      { onConflict: "day_of_week" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function clearWeekdayHours(dayOfWeek: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekday_hours")
    .delete()
    .eq("day_of_week", dayOfWeek);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
  revalidatePath("/book");
}

export async function setDateHours(
  date: string,
  startTime: string,
  endTime: string,
) {
  if (startTime >= endTime) {
    throw new Error("Start time must be before end time.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("date_hours_overrides")
    .upsert(
      { date, start_time: startTime, end_time: endTime },
      { onConflict: "date" },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export async function clearDateHours(date: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("date_hours_overrides")
    .delete()
    .eq("date", date);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export async function getDateAvailability(
  date: string,
): Promise<DateAvailability> {
  const supabase = await createClient();
  const [
    { data: bookings },
    { data: blockedSlots },
    { data: settings },
    dateHours,
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("booking_time, booking_type, services(duration_minutes)")
      .eq("booking_date", date)
      .neq("status", "cancelled"),
    supabase.from("blocked_slots").select("*").eq("date", date),
    supabase
      .from("business_settings")
      .select("slot_interval_minutes")
      .eq("id", 1)
      .single(),
    getDateHoursForDate(date),
  ]);

  const intervalMinutes = settings?.slot_interval_minutes ?? 30;
  const { openingTime, closingTime, hoursSource } = dateHours;

  const bookingSpans = (bookings ?? [])
    .filter((b) => (b.booking_type as string) === "online")
    .map((b) => {
      const duration =
        (b.services as unknown as { duration_minutes: number } | null)
          ?.duration_minutes ?? intervalMinutes;
      const start = toMinutes(b.booking_time);
      return { start, end: start + duration };
    });

  // A custom-hours window shares one combined pool across its whole span
  // (e.g. 11am-1pm at capacity 10 is 10 total, not 10 per clock hour within
  // it) — resolved via the same RPC create_booking uses, a single source of
  // truth rather than a reimplemented copy here.
  const slots = generateTimeSlots(openingTime, closingTime, intervalMinutes);
  const windows = await Promise.all(slots.map((t) => getCapacityWindowForDate(date, t)));
  const bookedTimes: string[] = [];
  const slotUsage: { time: string; count: number }[] = [];
  slots.forEach((time, i) => {
    const win = windows[i];
    const winStart = toMinutes(win.windowStart);
    const winEnd = toMinutes(win.windowEnd);
    const count = bookingSpans.filter((b) => b.start < winEnd && b.end > winStart).length;
    slotUsage.push({ time, count });
    if (count >= win.boothCount) bookedTimes.push(time);
  });
  const boothCount = windows[0]?.boothCount ?? 1;

  return {
    bookedTimes,
    blockedSlots: (blockedSlots as BlockedSlot[]) ?? [],
    boothCount,
    slotUsage,
    openingTime,
    closingTime,
    hoursSource,
  };
}

export async function blockSlot(date: string, time: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_slots")
    .insert({ date, time, reason: reason || null });
  if (error) throw new Error(error.message);

  await onBlockedSlotCreated(date, time, reason || null);

  revalidatePath("/admin/calendar");
}

export interface AdminBookingInput {
  service_id: string;
  vehicle_type: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  extra_ids?: string[];
  /** Walk-in override: bypass create_booking's slot/capacity validation (a raw insert). */
  overrideAvailability: boolean;
}

/**
 * Walk-in override: insert the booking directly, bypassing create_booking's
 * slot/capacity validation. Priced here rather than by the RPC, and typed
 * 'offline' so it never counts against a slot's capacity. Shared by both the
 * Pay Later and Stripe paths — an override is about skipping the
 * availability check, not about how the customer pays.
 */
async function insertOverrideBooking(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: AdminBookingInput,
): Promise<string> {
  const { data: servicePrice, error: priceError } = await supabase
    .from("service_prices")
    .select("price")
    .eq("service_id", input.service_id)
    .eq("vehicle_type", input.vehicle_type)
    .single();
  if (priceError) throw new Error(priceError.message);

  let extraRows: { id: string; name: string; price: number }[] = [];
  if (input.extra_ids && input.extra_ids.length > 0) {
    const { data: extrasData, error: extrasError } = await supabase
      .from("extras")
      .select("id, name, price")
      .in("id", input.extra_ids);
    if (extrasError) throw new Error(extrasError.message);
    extraRows = extrasData ?? [];
  }
  const extrasTotal = extraRows.reduce((sum, e) => sum + e.price, 0);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      service_id: input.service_id,
      vehicle_type: input.vehicle_type,
      booking_date: input.booking_date,
      booking_time: input.booking_time,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_email: input.customer_email,
      price: servicePrice.price + extrasTotal,
      booking_type: "offline",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const bookingId = data.id as string;

  if (extraRows.length > 0) {
    const { error: extrasInsertError } = await supabase.from("booking_extras").insert(
      extraRows.map((e) => ({
        booking_id: bookingId,
        extra_id: e.id,
        name: e.name,
        price: e.price,
      })),
    );
    if (extrasInsertError) throw new Error(extrasInsertError.message);
  }

  return bookingId;
}

/**
 * "Pay Later" path: if not overriding, reserves via create_booking (same
 * validation as the public flow); if overriding (walk-in onto a
 * full/blocked slot), inserts the row directly, bypassing that validation.
 * Either way, payment_status stays 'unpaid' and calendar sync + emails fire
 * immediately since there's no payment gate to wait on.
 */
export async function createBookingAdminPayLater(
  input: AdminBookingInput,
): Promise<{ bookingId: string }> {
  const supabase = await createClient();
  let bookingId: string;

  if (!input.overrideAvailability) {
    const { data, error } = await supabase.rpc("create_booking", {
      p_service_id: input.service_id,
      p_vehicle_type: input.vehicle_type,
      p_booking_date: input.booking_date,
      p_booking_time: input.booking_time,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_customer_email: input.customer_email,
      p_extra_ids: input.extra_ids ?? [],
    });
    if (error) throw new Error(error.message);
    bookingId = data as string;
  } else {
    bookingId = await insertOverrideBooking(supabase, input);
  }

  await onBookingCreated({
    bookingId,
    serviceId: input.service_id,
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    customerEmail: input.customer_email,
    bookingDate: input.booking_date,
    bookingTime: input.booking_time,
  });

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");

  return { bookingId };
}

/**
 * "Charge via Stripe" path — mirrors createCheckoutSession in
 * src/app/book/actions.ts exactly, just with admin-facing redirect URLs.
 * Works with an availability override too: the row is inserted directly
 * instead of through create_booking, and from there the payment half is
 * identical — the booking sits unpaid until the webhook marks it paid,
 * which is what fires the calendar sync and emails.
 */
export async function createBookingAdminCheckout(
  input: AdminBookingInput,
): Promise<{ url: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Online payment isn't set up yet.");
  }

  const supabase = await createClient();
  let bookingId: string;

  if (input.overrideAvailability) {
    bookingId = await insertOverrideBooking(supabase, input);
  } else {
    const { data, error } = await supabase.rpc("create_booking", {
      p_service_id: input.service_id,
      p_vehicle_type: input.vehicle_type,
      p_booking_date: input.booking_date,
      p_booking_time: input.booking_time,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_customer_email: input.customer_email,
      p_extra_ids: input.extra_ids ?? [],
    });
    if (error) throw new Error(error.message);
    bookingId = data as string;
  }

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
      metadata: { type: "booking", booking_id: bookingId },
      expires_at: Math.floor(Date.now() / 1000) + 32 * 60,
      success_url: `${origin}/admin/calendar?stripe_success=1&booking_id=${bookingId}`,
      cancel_url: `${origin}/admin/calendar?stripe_cancelled=1&booking_id=${bookingId}`,
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

export async function blockSlots(date: string, times: string[], reason: string) {
  if (times.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_slots")
    .upsert(
      times.map((time) => ({ date, time, reason: reason || null })),
      { onConflict: "date,time", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);

  await onBlockedSlotsCreated(date, times, reason || null);

  revalidatePath("/admin/calendar");
}

export async function unblockSlot(date: string, time: string) {
  const supabase = await createClient();

  await onBlockedSlotRemoved(date, time);

  const { error } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("date", date)
    .eq("time", time);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}
