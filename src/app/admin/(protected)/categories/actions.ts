"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SimpleEntityInput } from "../_components/entity-form";

function revalidateAll() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function createServiceCategory(input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").insert(input);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateServiceCategory(id: string, input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteServiceCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_categories").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "This category has services assigned to it — move them to another category first.",
      );
    }
    throw new Error(error.message);
  }
  revalidateAll();
}

export async function toggleServiceCategoryActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("service_categories")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}
