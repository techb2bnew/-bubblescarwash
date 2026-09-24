"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/admin-role";
import { createClient } from "@/lib/supabase/server";

export interface CustomerInput {
  name: string;
  phone: string;
  email: string;
}

export async function createCustomer(input: CustomerInput) {
  await requirePermission("customers", "create");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
}

export async function updateCustomer(id: string, input: CustomerInput) {
  await requirePermission("customers", "edit");
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
}

export async function deleteCustomer(id: string) {
  await requirePermission("customers", "delete");
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
}
