import { redirect } from "next/navigation";
import { getAdminRole, getStaffPermissions } from "@/lib/admin-role";
import PermissionsTable from "./permissions-table";

export default async function AdminPermissionsPage() {
  const role = await getAdminRole();
  if (role !== "admin") {
    redirect("/admin");
  }
  const permissions = await getStaffPermissions();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Permissions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Control which pages staff accounts can see and which changes they can make. This applies to every
          staff account — it isn&apos;t set per person.
        </p>
      </div>
      <PermissionsTable initialPermissions={permissions} />
    </div>
  );
}
