"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-role";
import type { ModuleKey } from "@/lib/types";

/** Only a full "admin" can change what "staff" is allowed to do — never staff themselves. */
async function requireAdmin() {
  if ((await getAdminRole()) !== "admin") {
    throw new Error("Only an admin can change staff permissions.");
  }
}

export async function setStaffPermission(
  module: ModuleKey,
  patch: { can_view?: boolean; can_create?: boolean; can_edit?: boolean; can_delete?: boolean },
) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_permissions")
    .upsert({ module, ...patch }, { onConflict: "module" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/permissions");
  revalidatePath("/admin");
}
