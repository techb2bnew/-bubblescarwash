"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ServiceCategory, VehicleType } from "@/lib/types";

export interface ServiceInput {
  name: string;
  category: ServiceCategory;
  vehicle_type: VehicleType;
  price: number;
  duration_minutes: number;
}

async function syncAddOns(serviceId: string, inclusionIds: string[]) {
  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("service_inclusions")
    .delete()
    .eq("service_id", serviceId);
  if (deleteError) throw new Error(deleteError.message);

  if (inclusionIds.length === 0) return;

  const { error: insertError } = await supabase.from("service_inclusions").insert(
    inclusionIds.map((inclusion_id) => ({ service_id: serviceId, inclusion_id })),
  );
  if (insertError) throw new Error(insertError.message);
}

export async function createService(input: ServiceInput, inclusionIds: string[]) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await syncAddOns(data.id, inclusionIds);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function updateService(
  id: string,
  input: ServiceInput,
  inclusionIds: string[],
) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  await syncAddOns(id, inclusionIds);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function toggleServiceActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
}

export async function deleteService(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
}
