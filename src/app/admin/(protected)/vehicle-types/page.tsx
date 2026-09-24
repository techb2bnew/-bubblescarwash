import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import type { VehicleTypeRow } from "@/lib/types";
import { EntityPageClient } from "../_components/entity-page-client";
import {
  createVehicleType,
  deleteVehicleType,
  toggleVehicleTypeActive,
  updateVehicleType,
} from "./actions";

export default async function AdminVehicleTypesPage() {
  const supabase = await createClient();
  const [{ data }, role, permissions] = await Promise.all([
    supabase.from("vehicle_types").select("*").order("sort_order"),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  return (
    <EntityPageClient
      entities={(data as VehicleTypeRow[]) ?? []}
      title="Vehicle Types"
      description="The vehicle options customers choose from when booking."
      entityLabel="Vehicle Type"
      entityLabelPlural="Vehicle Types"
      slugPlaceholder="Sedan"
      onCreate={createVehicleType}
      onUpdate={updateVehicleType}
      onDelete={deleteVehicleType}
      onToggleActive={toggleVehicleTypeActive}
      canCreate={hasPermission(role, permissions, "vehicle_types", "create")}
      canEdit={hasPermission(role, permissions, "vehicle_types", "edit")}
      canDelete={hasPermission(role, permissions, "vehicle_types", "delete")}
    />
  );
}
