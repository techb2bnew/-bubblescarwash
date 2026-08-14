import { createClient } from "@/lib/supabase/server";
import type { AddOn, CategoryRow } from "@/lib/types";
import AddOnsPageClient from "./addons-page-client";

export default async function AdminAddOnsPage() {
  const supabase = await createClient();
  const [{ data: addOns }, { data: categories }] = await Promise.all([
    supabase.from("inclusions").select("*").order("category").order("sort_order"),
    supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
  ]);

  return (
    <AddOnsPageClient
      addOns={(addOns as AddOn[]) ?? []}
      categories={(categories as CategoryRow[]) ?? []}
    />
  );
}
