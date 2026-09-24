import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import type { Extra } from "@/lib/types";
import ExtrasPageClient from "./extras-page-client";

export default async function AdminExtrasPage() {
  const supabase = await createClient();
  const [{ data: extras }, role, permissions] = await Promise.all([
    supabase.from("extras").select("*").order("sort_order"),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  return (
    <ExtrasPageClient
      extras={(extras as Extra[]) ?? []}
      canCreate={hasPermission(role, permissions, "extras", "create")}
      canEdit={hasPermission(role, permissions, "extras", "edit")}
      canDelete={hasPermission(role, permissions, "extras", "delete")}
    />
  );
}
