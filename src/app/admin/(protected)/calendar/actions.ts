"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlockedSlot } from "@/lib/types";

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
  const [{ data: bookings }, { data: blockedSlots }] = await Promise.all([
    supabase
      .from("bookings")
      .select("booking_time")
      .eq("booking_date", date)
      .neq("status", "cancelled"),
    supabase.from("blocked_slots").select("*").eq("date", date),
  ]);
  return {
    bookedTimes: (bookings ?? []).map((b) => b.booking_time.slice(0, 5)),
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
