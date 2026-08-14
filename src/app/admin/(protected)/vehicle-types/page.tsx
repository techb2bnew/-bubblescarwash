import { createClient } from "@/lib/supabase/server";
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
  const { data } = await supabase
    .from("vehicle_types")
    .select("*")
    .order("sort_order");

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
    />
  );
}
