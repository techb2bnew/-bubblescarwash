"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { VehicleType } from "@/lib/types";

export interface ServiceTemplateInput {
  name: string;
  discount_percent: number;
  discount_active: boolean;
  duration_minutes: number;
}

export async function createServiceTemplate(input: ServiceTemplateInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .insert(input)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { id: data.id };
}

export async function updateServiceTemplate(id: string, input: ServiceTemplateInput) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").update(input).eq("id", id);
  if (error) throw new Error(error.message);
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

export async function deleteServiceTemplate(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "This service has existing bookings and can't be deleted — mark it Inactive instead to hide it from new bookings while keeping booking history intact.",
      );
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/services");
}

// A service's price for one vehicle type. Deleting a single price row (one
// vehicle variant) is unrestricted — bookings only snapshot the price, they
// don't reference this row — but deleting the whole template above is
// blocked while any booking references it.

export async function createServicePrice(
  serviceId: string,
  vehicleType: VehicleType,
  price: number,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_prices")
    .insert({ service_id: serviceId, vehicle_type: vehicleType, price })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { id: data.id };
}

export async function updateServicePrice(id: string, price: number) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_prices").update({ price }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function deleteServicePrice(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("service_prices").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

// Add-ons belong directly to one service template (inclusions.service_id),
// managed from inside that service's own edit form rather than a separate
// page, and shared across all of that service's vehicle-type prices.

export async function createServiceAddOn(
  serviceId: string,
  name: string,
  sortOrder: number,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inclusions")
    .insert({ service_id: serviceId, name, sort_order: sortOrder })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
  return { id: data.id };
}

export async function updateServiceAddOn(id: string, name: string, sortOrder: number) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inclusions")
    .update({ name, sort_order: sortOrder })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function toggleServiceAddOnActive(id: string, active: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("inclusions").update({ active }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}

export async function deleteServiceAddOn(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("inclusions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/services");
  revalidatePath("/book");
}
