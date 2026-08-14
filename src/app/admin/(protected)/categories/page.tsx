import { createClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/lib/types";
import { EntityPageClient } from "../_components/entity-page-client";
import {
  createCategory,
  deleteCategory,
  toggleCategoryActive,
  updateCategory,
} from "./actions";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order");

  return (
    <EntityPageClient
      entities={(data as CategoryRow[]) ?? []}
      title="Categories"
      description="The service categories (e.g. Wash, Detailing) used across services and add-ons."
      entityLabel="Category"
      entityLabelPlural="Categories"
      slugPlaceholder="Wash"
      onCreate={createCategory}
      onUpdate={updateCategory}
      onDelete={deleteCategory}
      onToggleActive={toggleCategoryActive}
    />
  );
}
