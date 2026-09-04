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
import type {
  BlockedSlot,
  BookingType,
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
  hourBucketKey,
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

export async function getBoothCountForDate(date: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booth_count", {
    target_date: date,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 1;
}

/**
 * The busiest clock hour in the range, and how many online bookings share it.
 * Capacity can never be set below this number — those bookings are already
 * confirmed, and lowering the pool under them would oversell the hour.
 */
async function peakHourlyBookings(
  startDate: string,
  endDate: string,
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
) {
  if (boothCount < 1) throw new Error("Booth count must be at least 1.");

  const endDate = boothPeriodEndDate(startDate, duration);
  const peak = await peakHourlyBookings(startDate, endDate);
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
    boothCount,
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
    getBoothCountForDate(date),
    getDateHoursForDate(date),
  ]);

  const intervalMinutes = settings?.slot_interval_minutes ?? 30;
  const { openingTime, closingTime, hoursSource } = dateHours;
  const hourCounts = new Map<string, number>();

  for (const b of bookings ?? []) {
    if ((b.booking_type as string) !== "online") continue;
    const duration =
      (b.services as unknown as { duration_minutes: number } | null)
        ?.duration_minutes ?? intervalMinutes;
    for (const key of bookingHourBuckets(b.booking_time, duration)) {
      hourCounts.set(key, (hourCounts.get(key) ?? 0) + 1);
    }
  }

  const slots = generateTimeSlots(openingTime, closingTime, intervalMinutes);
  const bookedTimes: string[] = [];
  const slotUsage: { time: string; count: number }[] = [];
  for (const time of slots) {
    const count = hourCounts.get(hourBucketKey(time)) ?? 0;
    slotUsage.push({ time, count });
    if (count >= boothCount) bookedTimes.push(time);
  }

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
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_type: BookingType;
}

export async function createBookingAdmin(input: AdminBookingInput) {
  const supabase = await createClient();
  let bookingId: string | null = null;

  if (input.booking_type === "online") {
    const { data, error } = await supabase.rpc("create_booking", {
      p_service_id: input.service_id,
      p_booking_date: input.booking_date,
      p_booking_time: input.booking_time,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_customer_email: input.customer_email,
    });
    if (error) throw new Error(error.message);
    bookingId = data as string;
  } else {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("price")
      .eq("id", input.service_id)
      .single();
    if (serviceError) throw new Error(serviceError.message);

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        service_id: input.service_id,
        booking_date: input.booking_date,
        booking_time: input.booking_time,
        customer_name: input.customer_name,
        customer_phone: input.customer_phone,
        customer_email: input.customer_email,
        price: service?.price ?? null,
        booking_type: "offline",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    bookingId = data.id;
  }

  if (bookingId) {
    await onBookingCreated({
      bookingId,
      serviceId: input.service_id,
      customerName: input.customer_name,
      customerPhone: input.customer_phone,
      customerEmail: input.customer_email,
      bookingDate: input.booking_date,
      bookingTime: input.booking_time,
    });
  }

  revalidatePath("/admin/calendar");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
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
