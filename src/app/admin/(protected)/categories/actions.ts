"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SimpleEntityInput } from "../_components/entity-form";

function revalidateAll() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/services");
  revalidatePath("/admin/add-ons");
  revalidatePath("/book");
}

export async function createCategory(input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").insert(input);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateCategory(id: string, input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function toggleCategoryActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}
