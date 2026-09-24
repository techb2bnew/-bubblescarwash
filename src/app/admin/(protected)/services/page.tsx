import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import type { ServiceCategoryRow, ServiceTemplate, VehicleTypeRow } from "@/lib/types";
import ServicesPageClient from "./services-page-client";

export default async function AdminServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: vehicleTypes }, { data: categories }, role, permissions] = await Promise.all([
    supabase
      .from("services")
      .select("*, prices:service_prices(*), inclusions(*)")
      .order("name"),
    supabase.from("vehicle_types").select("*").order("sort_order"),
    supabase.from("service_categories").select("*").order("sort_order"),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  return (
    <ServicesPageClient
      services={(services as ServiceTemplate[]) ?? []}
      vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
      categories={(categories as ServiceCategoryRow[]) ?? []}
      canCreate={hasPermission(role, permissions, "services", "create")}
      canEdit={hasPermission(role, permissions, "services", "edit")}
      canDelete={hasPermission(role, permissions, "services", "delete")}
    />
  );
}
