"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { DiscountType } from "@/lib/types";

export interface DiscountInput {
  name: string;
  discount_type: DiscountType;
  value: number;
  /** Exactly one of code/customer_id is set — enforced by a DB check constraint. */
  code: string | null;
  customer_id: string | null;
  max_redemptions: number | null;
  per_customer_limit: number | null;
  expires_at: string | null;
}

export async function createDiscount(input: DiscountInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discounts")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
  return { id: data.id };
}

export async function updateDiscount(id: string, input: DiscountInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("discounts").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function toggleDiscountActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("discounts").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}

export async function deleteDiscount(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("discounts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/discounts");
}
