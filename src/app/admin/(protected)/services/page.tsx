import { createClient } from "@/lib/supabase/server";
import type { AddOn, CategoryRow, Service, VehicleTypeRow } from "@/lib/types";
import ServicesPageClient from "./services-page-client";

export default async function AdminServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: inclusions }, { data: vehicleTypes }, { data: categories }] =
    await Promise.all([
      supabase
        .from("services")
        .select("*, service_inclusions(inclusion_id)")
        .order("vehicle_type")
        .order("category")
        .order("price"),
      supabase.from("inclusions").select("*").order("category").order("sort_order"),
      supabase.from("vehicle_types").select("*").order("sort_order"),
      supabase.from("service_categories").select("*").order("sort_order"),
    ]);

  return (
    <ServicesPageClient
      services={(services as Service[]) ?? []}
      inclusions={(inclusions as AddOn[]) ?? []}
      vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
      categories={(categories as CategoryRow[]) ?? []}
    />
  );
}
