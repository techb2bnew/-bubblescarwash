"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminRole } from "@/lib/admin-role";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { MODULES } from "@/lib/permission-modules";
import type { ModuleKey, StaffPermission } from "@/lib/types";

/** Only a full "admin" can manage staff accounts or their permissions — never staff themselves. */
async function requireAdmin() {
  if ((await getAdminRole()) !== "admin") {
    throw new Error("Only an admin can manage staff.");
  }
}

export interface StaffMember {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

export async function listStaff(): Promise<StaffMember[]> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, name, created_at")
    .eq("role", "staff")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as StaffMember[];
}

export async function getStaffMember(id: string): Promise<StaffMember | null> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("id, email, name, created_at")
    .eq("id", id)
    .eq("role", "staff")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as StaffMember | null;
}

export async function createStaff(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ id: string }> {
  await requireAdmin();
  if (!isServiceRoleConfigured()) {
    throw new Error(
      "Staff account creation isn't set up yet — add SUPABASE_SERVICE_ROLE_KEY to the environment first.",
    );
  }
  const email = input.email.trim().toLowerCase();
  if (!email || input.password.length < 6) {
    throw new Error("Enter a valid email and a password of at least 6 characters.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  const userId = data.user.id;

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("admin_users").insert({
    id: userId,
    role: "staff",
    email,
    name: input.name?.trim() || null,
  });
  if (insertError) {
    // Roll back the auth user so a failed insert doesn't leave an orphaned login.
    await admin.auth.admin.deleteUser(userId);
    throw new Error(insertError.message);
  }

  const { error: permError } = await supabase.from("staff_permissions").insert(
    MODULES.map((m) => ({
      admin_user_id: userId,
      module: m.key,
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
    })),
  );
  if (permError) throw new Error(permError.message);

  revalidatePath("/admin/staff");
  return { id: userId };
}

export async function deleteStaff(id: string) {
  await requireAdmin();
  if (!isServiceRoleConfigured()) {
    throw new Error("Staff account deletion isn't set up yet — add SUPABASE_SERVICE_ROLE_KEY to the environment first.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  // admin_users.id -> auth.users(id) on delete cascade, and staff_permissions.admin_user_id
  // -> admin_users(id) on delete cascade, so both rows clean up automatically.
  revalidatePath("/admin/staff");
}

export async function updateStaffDetails(
  id: string,
  input: { name: string; email: string },
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("admin_users")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const name = input.name.trim() || null;
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Email can't be empty.");
  const emailChanged = email !== current?.email;

  if (emailChanged) {
    // The login email lives in auth.users, which only the Admin API can
    // change — updating just the admin_users cache column would leave them
    // signing in with the old address while the UI shows the new one.
    if (!isServiceRoleConfigured()) {
      throw new Error("Changing email isn't set up yet — add SUPABASE_SERVICE_ROLE_KEY to the environment first.");
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
    if (error) throw new Error(error.message);
  }

  const { error: updateError } = await supabase.from("admin_users").update({ name, email }).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  revalidatePath("/admin/staff");
  revalidatePath(`/admin/staff/${id}`);
}

export async function resetStaffPassword(id: string, password: string) {
  await requireAdmin();
  if (!isServiceRoleConfigured()) {
    throw new Error("Password reset isn't set up yet — add SUPABASE_SERVICE_ROLE_KEY to the environment first.");
  }
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
}

export async function getStaffPermissionsFor(userId: string): Promise<Record<ModuleKey, StaffPermission>> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("staff_permissions").select("*").eq("admin_user_id", userId);
  const byModule = new Map(((data as StaffPermission[] | null) ?? []).map((p) => [p.module, p]));
  const result = {} as Record<ModuleKey, StaffPermission>;
  for (const m of MODULES) {
    result[m.key] =
      byModule.get(m.key) ?? { module: m.key, can_view: false, can_create: false, can_edit: false, can_delete: false };
  }
  return result;
}

export async function setStaffPermission(
  userId: string,
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
    .eq("admin_user_id", userId)
    .eq("module", module)
    .maybeSingle();

  const { error } = await supabase.from("staff_permissions").upsert(
    {
      admin_user_id: userId,
      module,
      can_view: existing?.can_view ?? false,
      can_create: existing?.can_create ?? false,
      can_edit: existing?.can_edit ?? false,
      can_delete: existing?.can_delete ?? false,
      ...patch,
    },
    { onConflict: "admin_user_id,module" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/staff/${userId}`);
}
