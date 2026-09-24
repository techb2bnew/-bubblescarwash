import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
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
  const [{ data }, role, permissions] = await Promise.all([
    supabase.from("service_categories").select("*").order("sort_order"),
    getAdminRole(),
    getStaffPermissions(),
  ]);

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
      canCreate={hasPermission(role, permissions, "categories", "create")}
      canEdit={hasPermission(role, permissions, "categories", "edit")}
      canDelete={hasPermission(role, permissions, "categories", "delete")}
    />
  );
}
