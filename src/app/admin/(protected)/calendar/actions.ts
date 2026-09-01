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
import type { BlockedSlot, BookingType, BoothCapacityDuration } from "@/lib/types";
import { boothPeriodEndDate } from "@/lib/date-utils";

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
}

export async function getBoothCountForDate(date: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booth_count", {
    target_date: date,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 1;
}

export async function setBoothCapacity(
  startDate: string,
  boothCount: number,
  duration: BoothCapacityDuration,
) {
  if (boothCount < 1) throw new Error("Booth count must be at least 1.");

  const supabase = await createClient();
  const endDate = boothPeriodEndDate(startDate, duration);
  const { error } = await supabase.from("booth_capacity_periods").insert({
    start_date: startDate,
    end_date: endDate,
    booth_count: boothCount,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export async function getDateAvailability(
  date: string,
): Promise<DateAvailability> {
  const supabase = await createClient();
  const [{ data: bookings }, { data: blockedSlots }, { data: settings }, boothCount] =
    await Promise.all([
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
    ]);

  const intervalMinutes = settings?.slot_interval_minutes ?? 30;
  const slotCounts = new Map<string, number>();

  for (const b of bookings ?? []) {
    if ((b.booking_type as string) !== "online") continue;
    const duration =
      (b.services as unknown as { duration_minutes: number } | null)
        ?.duration_minutes ?? intervalMinutes;
    const span = Math.max(duration, intervalMinutes);
    const [h, m] = b.booking_time.slice(0, 5).split(":").map(Number);
    let minutes = h * 60 + m;
    const end = minutes + span;
    while (minutes < end) {
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      const key = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
      slotCounts.set(key, (slotCounts.get(key) ?? 0) + 1);
      minutes += intervalMinutes;
    }
  }

  const bookedTimes: string[] = [];
  const slotUsage: { time: string; count: number }[] = [];
  for (const [time, count] of slotCounts.entries()) {
    slotUsage.push({ time, count });
    if (count >= boothCount) bookedTimes.push(time);
  }

  return {
    bookedTimes,
    blockedSlots: (blockedSlots as BlockedSlot[]) ?? [],
    boothCount,
    slotUsage,
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
