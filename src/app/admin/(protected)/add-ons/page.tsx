import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import AddOnsPageClient, { type AddOnWithService, type ServiceOption } from "./addons-page-client";

export default async function AdminAddOnsPage() {
  const supabase = await createClient();
  const [{ data: addOns }, { data: services }, role, permissions] = await Promise.all([
    supabase
      .from("inclusions")
      .select("*, services(id, name)")
      .order("sort_order"),
    supabase.from("services").select("id, name").order("name"),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  return (
    <AddOnsPageClient
      addOns={(addOns as AddOnWithService[]) ?? []}
      services={(services as ServiceOption[]) ?? []}
      canCreate={hasPermission(role, permissions, "inclusions", "create")}
      canEdit={hasPermission(role, permissions, "inclusions", "edit")}
      canDelete={hasPermission(role, permissions, "inclusions", "delete")}
    />
  );
}
