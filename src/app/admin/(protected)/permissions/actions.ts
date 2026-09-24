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

  // Upsert with a partial payload would reset every column not named in
  // `patch` back to its table default (false) — PostgREST's ON CONFLICT DO
  // UPDATE only carries the columns actually sent. Read the current row
  // first and always write the full merged row instead.
  const { data: existing } = await supabase
    .from("staff_permissions")
    .select("can_view, can_create, can_edit, can_delete")
    .eq("module", module)
    .maybeSingle();

  const { error } = await supabase.from("staff_permissions").upsert(
    {
      module,
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
      ...patch,
    },
    { onConflict: "module" },
  );
  if (error) throw new Error(error.message);
  revalidatePath("/admin/permissions");
  revalidatePath("/admin");
}
