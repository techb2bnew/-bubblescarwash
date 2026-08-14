"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
