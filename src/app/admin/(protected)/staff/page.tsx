import { redirect } from "next/navigation";
import { getAdminRole } from "@/lib/admin-role";
import { isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listStaff } from "./actions";
import StaffPageClient from "./staff-page-client";

export default async function AdminStaffPage() {
  const role = await getAdminRole();
  if (role !== "admin") {
    redirect("/admin");
  }
  const staff = await listStaff();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Staff</h1>
        <p className="mt-1 text-sm text-gray-500">
          Each staff account has its own login and its own permissions — control which pages they can see and
          what they can change from their permissions page.
        </p>
      </div>
      <StaffPageClient staff={staff} serviceRoleConfigured={isServiceRoleConfigured()} />
    </div>
  );
}
