import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffPermissions } from "@/lib/admin-role";
import AdminShell from "./admin-shell";
import type { AdminRole } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    redirect("/admin/login");
  }

  // Route-level restriction for "staff" is enforced in the proxy
  // (src/lib/supabase/middleware.ts) — it sees the pathname on every
  // navigation, which a Server Component layout is not guaranteed to.
  const role = (adminRow.role as AdminRole | null) ?? "admin";
  const permissions = role === "staff" ? await getStaffPermissions() : null;

  return (
    <AdminShell role={role} permissions={permissions}>
      {children}
    </AdminShell>
  );
}
