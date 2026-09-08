import { createClient } from "@/lib/supabase/server";
import AddOnsPageClient, { type AddOnWithService, type ServiceOption } from "./addons-page-client";

export default async function AdminAddOnsPage() {
  const supabase = await createClient();
  const [{ data: addOns }, { data: services }] = await Promise.all([
    supabase
      .from("inclusions")
      .select("*, services(id, name)")
      .order("sort_order"),
    supabase.from("services").select("id, name").order("name"),
  ]);

  return (
    <AddOnsPageClient
      addOns={(addOns as AddOnWithService[]) ?? []}
      services={(services as ServiceOption[]) ?? []}
    />
  );
}
