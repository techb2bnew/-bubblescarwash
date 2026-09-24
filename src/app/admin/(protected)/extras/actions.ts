"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-role";
import { createClient } from "@/lib/supabase/server";

export interface ExtraInput {
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  active: boolean;
}

export async function createExtra(input: ExtraInput) {
  await requirePermission("extras", "create");
  const supabase = await createClient();
  const { error } = await supabase.from("extras").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}

export async function updateExtra(id: string, input: ExtraInput) {
  await requirePermission("extras", "edit");
  const supabase = await createClient();
  const { error } = await supabase.from("extras").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}

export async function toggleExtraActive(id: string, active: boolean) {
  await requirePermission("extras", "edit");
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
  await requirePermission("extras", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("extras").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/extras");
  revalidatePath("/book");
}
