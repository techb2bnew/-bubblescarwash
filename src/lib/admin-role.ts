import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/permission-modules";
import type { AdminRole, ModuleKey, StaffPermission } from "@/lib/types";

/** The signed-in admin's role. Defaults to "admin" if something's missing, matching the DB default. */
export async function getAdminRole(): Promise<AdminRole> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "admin";
  const { data } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (data?.role as AdminRole | null) ?? "admin";
}

/** Every module's permission row, defaulting anything missing from the table to fully closed. */
export async function getStaffPermissions(): Promise<Record<ModuleKey, StaffPermission>> {
  const supabase = await createClient();
  const { data } = await supabase.from("staff_permissions").select("*");
  const byModule = new Map(((data as StaffPermission[] | null) ?? []).map((p) => [p.module, p]));
  const result = {} as Record<ModuleKey, StaffPermission>;
  for (const m of MODULES) {
    result[m.key] =
      byModule.get(m.key) ?? { module: m.key, can_view: false, can_create: false, can_edit: false, can_delete: false };
  }
  return result;
}

type Action = "view" | "create" | "edit" | "delete";

/** Pure check for UI rendering — pass already-fetched role/permissions rather than re-querying. */
export function hasPermission(
  role: AdminRole,
  permissions: Record<ModuleKey, StaffPermission> | null,
  module: ModuleKey,
  action: Action,
): boolean {
  if (role === "admin") return true;
  return Boolean(permissions?.[module]?.[`can_${action}` as const]);
}

/**
 * Blocks a "staff" admin from a mutation their role isn't granted for that
 * module, even if they reach it directly (bypassing the UI, which already
 * hides these controls). "admin" role always passes. Throws so the calling
 * action's try/catch surfaces it as a normal error toast.
 */
export async function requirePermission(module: ModuleKey, action: Action): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { data: adminRow } = await supabase.from("admin_users").select("role").eq("id", user.id).maybeSingle();
  if (!adminRow) throw new Error("Not authorized.");
  if (adminRow.role === "admin") return;

  const { data: perm } = await supabase
    .from("staff_permissions")
    .select("can_view, can_create, can_edit, can_delete")
    .eq("module", module)
    .maybeSingle();
  const allowed = Boolean(perm?.[`can_${action}` as const]);
  if (!allowed) {
    throw new Error("Your account doesn't have permission to do this.");
  }
}
