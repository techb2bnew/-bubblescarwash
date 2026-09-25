import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminRole } from "@/lib/admin-role";
import { getStaffMember, getStaffPermissionsFor } from "../actions";
import StaffPermissionsTable from "./staff-permissions-table";

export default async function StaffPermissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getAdminRole();
  if (role !== "admin") {
    redirect("/admin");
  }
  const { id } = await params;
  const member = await getStaffMember(id);
  if (!member) {
    redirect("/admin/staff");
  }
  const permissions = await getStaffPermissionsFor(id);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/staff" className="text-sm font-medium text-brand-600 hover:underline">
          ← Staff
        </Link>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 normal-case">{member.name || member.email}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {member.email} — control which pages this account can see and what it can change.
        </p>
      </div>
      <StaffPermissionsTable userId={id} initialPermissions={permissions} />
    </div>
  );
}
