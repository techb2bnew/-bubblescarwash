"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlockedSlot, BookingType } from "@/lib/types";

export async function blockDate(date: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_dates")
    .insert({ date, reason: reason || null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}

export async function unblockDate(date: string) {
  const supabase = await createClient();
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
}

export async function getDateAvailability(
  date: string,
): Promise<DateAvailability> {
  const supabase = await createClient();
  const [{ data: bookings }, { data: blockedSlots }, { data: settings }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("booking_time, services(duration_minutes)")
        .eq("booking_date", date)
        .neq("status", "cancelled"),
      supabase.from("blocked_slots").select("*").eq("date", date),
      supabase
        .from("business_settings")
        .select("slot_interval_minutes")
        .eq("id", 1)
        .single(),
    ]);

  const intervalMinutes = settings?.slot_interval_minutes ?? 30;
  const bookedTimes = new Set<string>();
  for (const b of bookings ?? []) {
    const duration =
      (b.services as unknown as { duration_minutes: number } | null)
        ?.duration_minutes ?? intervalMinutes;
    const [h, m] = b.booking_time.slice(0, 5).split(":").map(Number);
    let minutes = h * 60 + m;
    const end = minutes + duration;
    while (minutes < end) {
      const hh = Math.floor(minutes / 60);
      const mm = minutes % 60;
      bookedTimes.add(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
      minutes += intervalMinutes;
    }
  }

  return {
    bookedTimes: Array.from(bookedTimes),
    blockedSlots: (blockedSlots as BlockedSlot[]) ?? [],
  };
}

export async function blockSlot(date: string, time: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_slots")
    .insert({ date, time, reason: reason || null });
  if (error) throw new Error(error.message);
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

  if (input.booking_type === "online") {
    const { error } = await supabase.rpc("create_booking", {
      p_service_id: input.service_id,
      p_booking_date: input.booking_date,
      p_booking_time: input.booking_time,
      p_customer_name: input.customer_name,
      p_customer_phone: input.customer_phone,
      p_customer_email: input.customer_email,
    });
    if (error) throw new Error(error.message);
  } else {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("price")
      .eq("id", input.service_id)
      .single();
    if (serviceError) throw new Error(serviceError.message);

    const { error } = await supabase.from("bookings").insert({
      service_id: input.service_id,
      booking_date: input.booking_date,
      booking_time: input.booking_time,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_email: input.customer_email,
      price: service?.price ?? null,
      booking_type: "offline",
    });
    if (error) throw new Error(error.message);
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
  revalidatePath("/admin/calendar");
}

export async function unblockSlot(date: string, time: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("blocked_slots")
    .delete()
    .eq("date", date)
    .eq("time", time);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/calendar");
}
