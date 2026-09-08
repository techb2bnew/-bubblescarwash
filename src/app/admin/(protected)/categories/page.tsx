import { createClient } from "@/lib/supabase/server";
import type { ServiceCategoryRow } from "@/lib/types";
import { EntityPageClient } from "../_components/entity-page-client";
import {
  createServiceCategory,
  deleteServiceCategory,
  toggleServiceCategoryActive,
  updateServiceCategory,
} from "./actions";

export default async function AdminServiceCategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order");

  return (
    <EntityPageClient
      entities={(data as ServiceCategoryRow[]) ?? []}
      title="Categories"
      description="Groups services (e.g. Wash, Detailing) for organizing the admin Services list and the public booking page."
      entityLabel="Category"
      entityLabelPlural="Categories"
      slugPlaceholder="Detailing"
      onCreate={createServiceCategory}
      onUpdate={updateServiceCategory}
      onDelete={deleteServiceCategory}
      onToggleActive={toggleServiceCategoryActive}
    />
  );
}
