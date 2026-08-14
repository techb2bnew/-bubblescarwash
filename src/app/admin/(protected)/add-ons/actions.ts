"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ServiceCategory } from "@/lib/types";

export interface AddOnInput {
  name: string;
  category: ServiceCategory;
  sort_order: number;
  active: boolean;
}

export async function createAddOn(input: AddOnInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("inclusions").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function updateAddOn(id: string, input: AddOnInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("inclusions").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function toggleAddOnActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inclusions")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/add-ons");
  revalidatePath("/book");
}

export async function deleteAddOn(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inclusions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/add-ons");
  revalidatePath("/admin/services");
  revalidatePath("/book");
}
