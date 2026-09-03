"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ExtraInput {
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  active: boolean;
}

export async function createExtra(input: ExtraInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("extras").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}

export async function updateExtra(id: string, input: ExtraInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("extras").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}

export async function toggleExtraActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("extras")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}

export async function deleteExtra(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("extras").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}
