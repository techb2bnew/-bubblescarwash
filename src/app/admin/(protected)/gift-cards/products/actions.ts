"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface GiftCardProductInput {
  name: string;
  description: string | null;
  price: number;
  validity_days: number;
  sort_order: number;
  active: boolean;
}

export async function createGiftCardProduct(input: GiftCardProductInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("gift_card_products").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/gift-cards");
  revalidatePath("/gift-cards");
}

export async function updateGiftCardProduct(id: string, input: GiftCardProductInput) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_card_products")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/gift-cards");
  revalidatePath("/gift-cards");
}

export async function toggleGiftCardProductActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("gift_card_products")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/gift-cards");
  revalidatePath("/gift-cards");
}

export async function deleteGiftCardProduct(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("gift_card_products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/gift-cards");
  revalidatePath("/gift-cards");
}
