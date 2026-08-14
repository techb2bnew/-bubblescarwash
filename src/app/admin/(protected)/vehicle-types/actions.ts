"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SimpleEntityInput } from "../_components/entity-form";

function revalidateAll() {
  revalidatePath("/admin/vehicle-types");
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function createVehicleType(input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_types").insert(input);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function updateVehicleType(id: string, input: SimpleEntityInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_types").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function deleteVehicleType(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vehicle_types").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function toggleVehicleTypeActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vehicle_types")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}
